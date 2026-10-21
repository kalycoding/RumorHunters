"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clock, PLATFORM } from "@/lib/format";
import { ORG, type DemoPost } from "@/lib/mock";
import {
  loadReplay,
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

/** Loads what the agents produced for the replay (or runs them), then plays it back. */
export function Watcher() {
  const [data, setData] = useState<ReplayData | null>(null);
  const [state, setState] = useState<
    "loading" | "missing" | "offline" | "running" | "ready"
  >("loading");

  useEffect(() => {
    let alive = true;
    loadReplay().then((r) => {
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
  }, []);

  async function run() {
    setState("running");
    try {
      setData(await runAgents());
      setState("ready");
    } catch {
      setState("offline");
    }
  }

  if (state === "loading")
    return <p className="p-10 text-sm text-ink/40">Loading…</p>;
  if (state === "ready" && data) return <WatcherView data={data} />;
  return (
    <div className="space-y-4 px-6 py-8">
      <h1 className="text-3xl font-medium tracking-[-0.03em] text-ink">
        Watcher
      </h1>
      <div className="max-w-xl rounded-3xl bg-white p-6 ring-1 ring-black/[0.05]">
        {state === "offline" ? (
          <>
            <p className="font-medium text-ink">
              The backend isn&apos;t running.
            </p>
            <p className="mt-1 text-sm text-ink/60">
              Start it with{" "}
              <code>
                cd backend &amp;&amp; .venv/bin/uvicorn app.main:app --port 8100
              </code>
              , then reload. Or use canned demo data.
            </p>
            <button
              onClick={() => {
                setData(mockReplay());
                setState("ready");
              }}
              className="mt-4 rounded-xl bg-mist px-4 py-2 text-sm font-medium text-ink/70"
            >
              Use canned data
            </button>
          </>
        ) : (
          <>
            <p className="font-medium text-ink">
              {state === "running"
                ? "The agents are working…"
                : "Run the agents on the seeded data"}
            </p>
            <p className="mt-1 text-sm text-ink/60">
              {state === "running"
                ? "Watcher, Fact-checker and Responder are reading 94 simulated posts. This takes about 90 seconds."
                : "The Watcher reads every post, the Fact-checker compares each story with verified facts, and the Responder drafts a reply. Then you can replay it."}
            </p>
            <button
              onClick={run}
              disabled={state === "running"}
              className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {state === "running" ? "Working…" : "Run the agents"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function WatcherView({ data }: { data: ReplayData }) {
  const router = useRouter();
  const [now, setNow] = useState(0);
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

  const clk = (m: number) => clock(m, data.startClock);
  const seen = useMemo(
    () => data.posts.filter((p) => p.minute <= now),
    [now, data.posts],
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
              {ORG} ·{" "}
              {data.source === "agents"
                ? "agents ran on simulated posts"
                : "canned demo data"}
            </p>
          </div>
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
                  ? "Replay again"
                  : now === 0
                    ? "Start replay"
                    : "Resume"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card label="Sources">
            <p className="text-3xl font-medium tracking-[-0.03em] text-ink">
              {new Set(data.posts.map((p) => p.platform)).size}
              <span className="text-base text-ink/40"> simulated</span>
            </p>
            <p className="mt-1 text-xs text-ink/50">
              Replay · {seen.length} posts read
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

        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-ink/45">
            Live story stream
          </h2>
          {stories.length === 0 ? (
            <p className="rounded-3xl bg-white p-10 text-center text-sm text-ink/40 ring-1 ring-black/[0.05]">
              Press Start replay. Stories appear here as the agents group posts.
            </p>
          ) : (
            <div className="space-y-3">
              {stories.map((s) => {
                const platforms = [...new Set(s.posts.map((p) => p.platform))];
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
