"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { clock, PLATFORM } from "@/lib/format";
import { DateFilter, DAY, ProgressPanel } from "@/components/DateFilter";
import { ORG, type DemoPost } from "@/lib/mock";
import {
  fetchRange,
  loadLive,
  loadReplay,
  refreshLive,
  mockReplay,
  runAgents,
  type ReplayData,
  type ReplayStory,
} from "@/lib/replay";

function spread(posts: DemoPost[], now: number) {
  const latest = posts.filter(
    (p) => p.minute > now - 60 && p.minute <= now,
  ).length;
  const before = posts.filter(
    (p) => p.minute > now - 120 && p.minute <= now - 60,
  ).length;
  const growth = latest / Math.max(before, 1);
  return { latest, growth, spike: latest >= 5 && growth >= 2 };
}

const LEVELS = ["Low", "Elevated", "Critical"] as const;
type Level = (typeof LEVELS)[number];

// Highest level reached so far. A story's level only goes up while it builds.
function peakLevel(posts: DemoPost[], now: number): Level {
  let peak = 0;
  for (let m = 0; m <= now; m += 6) {
    const s = spread(
      posts.filter((p) => p.minute <= m),
      m,
    );
    const lvl = s.spike ? 2 : s.latest >= 3 && s.growth >= 1.5 ? 1 : 0;
    if (lvl > peak) peak = lvl;
  }
  return LEVELS[peak];
}

type Stage =
  "Monitoring" | "Checking facts" | "Drafting reply" | "Needs approval";

function stageOf(story: ReplayStory, now: number): Stage {
  const at = story.spikeMinute;
  if (at === null || now < at) return "Monitoring";
  if (now < at + 8) return "Checking facts";
  if (now < at + 16) return "Drafting reply";
  return story.draft ? "Needs approval" : "Monitoring";
}

type Mode = "live" | "simulate";
const listeners = new Set<() => void>();

// The chosen mode lives in sessionStorage, so coming back from a story page keeps it.
function readMode(): Mode {
  try {
    return sessionStorage.getItem("rh-mode") === "simulate"
      ? "simulate"
      : "live";
  } catch {
    return "live";
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Live (real posts) or Simulate (fake posts, for showing others). */
export function Watcher() {
  const mode = useSyncExternalStore(subscribe, readMode, () => null);
  const modes = [
    ["live", "Live"],
    ["simulate", "Simulate"],
  ] as const;

  function pick(m: Mode) {
    try {
      sessionStorage.setItem("rh-mode", m);
    } catch {}
    listeners.forEach((notify) => notify());
  }

  if (!mode) return null;
  return (
    <>
      <div className="flex justify-end px-6 pt-6">
        <div className="flex rounded-xl bg-white p-1 text-sm ring-1 ring-black/[0.06]">
          {modes.map(([id, label]) => (
            <button
              key={id}
              onClick={() => pick(id)}
              className={`rounded-lg px-4 py-1.5 font-medium ${mode === id ? "bg-brand text-white" : "text-ink/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "live" ? (
        <LiveWatcher key="live" />
      ) : (
        <SimulateWatcher key="sim" />
      )}
    </>
  );
}

type State = "loading" | "missing" | "offline" | "running" | "ready";

/** Loads the agents' last output, and runs the agents again on demand. */
function useSource(
  load: () => Promise<ReplayData | "missing" | "offline">,
  run: () => Promise<ReplayData>,
) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [state, setState] = useState<State>("loading");
  const [version, setVersion] = useState(0); // bumps after each run, to play it in

  useEffect(() => {
    let alive = true;
    load().then((r) => {
      if (!alive) return;
      if (r === "missing" || r === "offline") setState(r);
      else {
        setData(r);
        setState("ready");
      }
    });
    return () => {
      alive = false;
    };
  }, [load]);

  async function refresh() {
    setState("running");
    try {
      setData(await run());
      setVersion((v) => v + 1);
      setState("ready");
    } catch {
      setState(data ? "ready" : "offline");
    }
  }

  const bump = () => setVersion((v) => v + 1);
  return { data, setData, state, setState, version, bump, refresh };
}

/** Real posts from X, analysed by the agents on demand. */
function LiveWatcher() {
  const { data, state, version, bump, refresh } = useSource(
    loadLive,
    refreshLive,
  );
  const [history, setHistory] = useState<ReplayData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Pull a past period from the X archive, then show only that.
  async function fetchPast(start: string, end: string) {
    setFetching(true);
    setFetchError("");
    try {
      setHistory(await fetchRange(start, end));
      bump();
    } catch {
      setFetchError("Could not fetch that period.");
    } finally {
      setFetching(false);
    }
  }

  if (state === "loading") return <Loading />;
  if (data && (state === "ready" || state === "running"))
    return (
      <WatcherView
        key={`${history ? `past-${history.start}` : "live"}-${version}`}
        data={history ?? data}
        busy={state === "running" || fetching}
        past={Boolean(history)}
        onBackToLive={() => setHistory(null)}
        onFetchPast={fetchPast}
        fetching={fetching}
        fetchError={fetchError}
        onRefresh={refresh}
        refreshing={state === "running"}
      />
    );
  return (
    <Setup
      state={state}
      title="No live data yet"
      text="The agents search X for the watched organizations, then read, check and group what they find. This takes a minute or two."
      button="Collect live posts"
      onRun={refresh}
      progress
    />
  );
}

/** The simulated Demo Bank stream: agents' cached output, played back. */
function SimulateWatcher() {
  const { data, setData, state, setState, refresh } = useSource(
    loadReplay,
    runAgents,
  );
  if (state === "loading") return <Loading />;
  if (state === "ready" && data) return <WatcherView data={data} />;
  return (
    <Setup
      state={state}
      title="Run the agents on the seeded data"
      text="The Watcher reads every simulated post, the Fact-checker compares each story with verified facts, and the Responder drafts a reply. Then you can play it back."
      button="Run the agents"
      onRun={refresh}
      canned={() => {
        setData(mockReplay());
        setState("ready");
      }}
    />
  );
}

const Loading = () => <p className="p-10 text-sm text-ink/40">Loading…</p>;

/** The card shown before there is any data, or when the backend is off. */
function Setup({
  state,
  title,
  text,
  button,
  onRun,
  progress,
  canned,
}: {
  state: State;
  title: string;
  text: string;
  button: string;
  onRun: () => void;
  progress?: boolean; // show the analysed stories while running
  canned?: () => void; // offline fallback
}) {
  const offline = state === "offline";
  const running = state === "running";
  const action =
    "mt-4 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50";
  return (
    <div className="space-y-4 px-6 py-8">
      <h1 className="text-3xl font-medium tracking-[-0.03em] text-ink">
        Watcher
      </h1>
      <div className="max-w-xl rounded-3xl bg-white p-6 ring-1 ring-black/[0.05]">
        <p className="font-medium text-ink">
          {offline
            ? "The backend isn't running."
            : running
              ? "The agents are working…"
              : title}
        </p>
        <p className="mt-1 text-sm text-ink/60">
          {offline
            ? "Start it with cd backend && .venv/bin/uvicorn app.main:app --port 8100, then reload."
            : text}
        </p>
        {running && progress && <ProgressPanel />}
        {offline && canned && (
          <button onClick={canned} className={`${action} bg-mist text-ink/70`}>
            Use canned data
          </button>
        )}
        {!offline && (
          <button
            onClick={onRun}
            disabled={running}
            className={`${action} bg-brand text-white hover:bg-brand-dark`}
          >
            {running ? "Working…" : button}
          </button>
        )}
      </div>
    </div>
  );
}

function WatcherView({
  data,
  busy,
  past,
  onBackToLive,
  onFetchPast,
  fetching,
  fetchError,
  onRefresh,
  refreshing,
}: {
  data: ReplayData;
  busy?: boolean; // a refresh or fetch is running
  past?: boolean; // showing a fetched past period, not the last few days
  onBackToLive?: () => void;
  onFetchPast?: (start: string, end: string) => void;
  fetching?: boolean;
  fetchError?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const router = useRouter();
  const live = data.live;
  const startFrom = live && !past ? Math.max(0, data.lastMinute - DAY) : 0;
  const [now, setNow] = useState(live ? data.lastMinute : 0);
  const [from, setFrom] = useState(startFrom);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setNow((n) => {
        if (n >= data.lastMinute) {
          setPlaying(false);
          return n;
        }
        return Math.min(n + 6, data.lastMinute);
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, data.lastMinute]);

  const clk = (m: number) =>
    live
      ? new Date(data.start + m * 60000).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : clock(m, data.startClock);
  const seen = useMemo(
    () => data.posts.filter((p) => p.minute <= now && p.minute >= from),
    [now, from, data.posts],
  );
  const stories = data.stories
    .map((st) => {
      const posts = seen.filter((p) => p.story === st.id);
      const s = spread(posts, now);
      const live = peakLevel(posts, now);
      // After a spike, use the Responder's risk level and keep it.
      const reached = st.spikeMinute !== null && now >= st.spikeMinute;
      const level = reached ? st.risk.level : live;
      return {
        ...st,
        posts,
        ...s,
        spike: reached || s.spike,
        level,
        stage: stageOf(st, now),
      };
    })
    .filter((s) => s.posts.length > 0)
    .sort((a, b) => Number(b.spike) - Number(a.spike) || b.latest - a.latest);

  const selected = stories.find((s) => s.id === picked) ?? stories[0] ?? null;
  // Overall threat is the worst story. Hovering a story shows its own level.
  const RANK = { Critical: 3, Elevated: 2, Low: 1 } as const;
  const overall = stories.reduce<string>(
    (worst, s) =>
      RANK[s.level as keyof typeof RANK] >
      (RANK[worst as keyof typeof RANK] ?? 0)
        ? s.level
        : worst,
    "Calm",
  );
  const focus = picked ? (stories.find((s) => s.id === picked) ?? null) : null;
  const top = focus ? focus.level : overall;
  const threat =
    top === "Critical" ? 100 : top === "Elevated" ? 60 : top === "Low" ? 25 : 8;
  const pending = stories.filter(
    (s) => s.stage === "Needs approval" && !approved[s.id],
  ).length;
  const sent = Object.values(approved).filter(Boolean).length;

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-[-0.03em] text-ink">
              Watcher
            </h1>
            <p className="mt-1 text-sm uppercase tracking-[0.14em] text-ink/40">
              {live ? data.org : ORG} ·{" "}
              {live
                ? "agents ran on real posts from X"
                : data.source === "agents"
                  ? "agents ran on simulated posts"
                  : "canned demo data"}
            </p>
          </div>
          {live ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink/70 ring-1 ring-black/[0.06]">
                <span
                  className={`h-2 w-2 rounded-full ${past ? "bg-amber-500" : "bg-emerald-500"}`}
                />
                {past ? "Past period" : "Live"}
              </span>
              {past ? (
                <button
                  onClick={onBackToLive}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
                >
                  Back to live
                </button>
              ) : (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  {refreshing ? "Collecting…" : "Refresh now"}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink/70 ring-1 ring-black/[0.06]">
                <span
                  className={`h-2 w-2 rounded-full ${playing ? "animate-pulse bg-emerald-500" : "bg-ink/25"}`}
                />
                {playing ? "Watching" : "Paused"} · {clk(now)}
              </span>
              <button
                onClick={() => {
                  if (now >= data.lastMinute) {
                    setNow(0);
                    setApproved({});
                    setPicked(null);
                  }
                  setPlaying((p) => !p);
                }}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
              >
                {playing
                  ? "Pause"
                  : now >= data.lastMinute
                    ? "Simulate again"
                    : now === 0
                      ? "Start simulation"
                      : "Resume"}
              </button>
            </div>
          )}
        </div>

        {live && (
          <DateFilter
            data={data}
            past={past}
            onBackToLive={onBackToLive}
            onFetchPast={onFetchPast}
            fetching={fetching}
            fetchError={fetchError}
            from={from}
            to={now}
            onChange={(f, t) => {
              setFrom(f);
              setNow(t);
            }}
          />
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card label="Sources">
            <p className="text-3xl font-medium tracking-[-0.03em] text-ink">
              {new Set(data.posts.map((p) => p.platform)).size}
              <span className="text-base text-ink/40">
                {live ? " live" : " simulated"}
              </span>
            </p>
            <p className="mt-1 text-xs text-ink/50">
              {live ? "In range" : "Simulation"} · {seen.length} posts read
            </p>
          </Card>
          <Card
            label={
              focus ? `Threat level · ${focus.title}` : "Threat level · overall"
            }
          >
            <p
              className={`text-3xl font-medium tracking-[-0.03em] ${top === "Critical" ? "text-red-600" : top === "Elevated" ? "text-amber-600" : "text-ink"}`}
            >
              {top}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${top === "Critical" ? "bg-red-500" : "bg-amber-400"}`}
                style={{ width: `${threat}%` }}
              />
            </div>
          </Card>
          <Card label="Replies">
            <p className="text-3xl font-medium tracking-[-0.03em] text-ink">
              {sent}
              <span className="text-base text-ink/40"> sent</span>
            </p>
            <p className="mt-1 text-xs text-ink/50">
              {pending} waiting for approval
            </p>
          </Card>
        </div>

        {busy ? (
          <ProgressPanel />
        ) : (
          <div>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-ink/45">
              Live story stream
            </h2>
            {stories.length === 0 ? (
              <p className="rounded-3xl bg-white p-10 text-center text-sm text-ink/40 ring-1 ring-black/[0.05]">
                {live
                  ? "No stories in this date range. Widen the dates or press Refresh now."
                  : "Press Start simulation. Stories appear here as the agents group posts."}
              </p>
            ) : (
              <div className="space-y-3">
                {stories.map((s) => {
                  const platforms = [
                    ...new Set(s.posts.map((p) => p.platform)),
                  ];
                  const sentThis = approved[s.id];
                  const tone =
                    s.level === "Critical"
                      ? "border-red-300 bg-red-50/40"
                      : s.level === "Elevated"
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-black/[0.06] bg-white";
                  return (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/watcher/${s.id}`)}
                      onMouseEnter={() => setPicked(s.id)}
                      onMouseLeave={() => setPicked(null)}
                      className={`block w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${tone} ${selected?.id === s.id ? "ring-2 ring-brand/40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
                            {platforms.map((p) => (
                              <span
                                key={p}
                                className="rounded-md bg-white px-2 py-0.5 font-medium text-ink/70 ring-1 ring-black/[0.06]"
                              >
                                {PLATFORM[p]}
                              </span>
                            ))}
                            <span>first seen {clk(s.posts[0].minute)}</span>
                          </div>
                          <p className="mt-2 font-medium text-ink">{s.title}</p>
                          <p className="mt-0.5 truncate text-sm text-ink/55">
                            &ldquo;{s.claim}&rdquo;
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              s.level === "Critical"
                                ? "bg-red-100 text-red-700"
                                : s.level === "Elevated"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-ink/5 text-ink/55"
                            }`}
                          >
                            {s.level}
                          </span>
                          <p className="mt-2 text-xs text-ink/55">
                            {sentThis ? "Reply sent" : s.stage}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.05]">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink/45">
        {label}
      </p>
      {children}
    </div>
  );
}
