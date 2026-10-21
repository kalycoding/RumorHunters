"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clock, dur, LANG, PLATFORM } from "@/lib/format";
import type { DemoPost } from "@/lib/mock";
import {
  loadLive,
  loadReplay,
  mockReplay,
  type ReplayData,
} from "@/lib/replay";

const BUCKET = 30; // minutes per bar

export function StoryView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReplayData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "offline">(
    "loading",
  );

  useEffect(() => {
    let alive = true;
    const load = id.startsWith("live-") ? loadLive : loadReplay;
    load().then((r) => {
      if (!alive) return;
      if (r === "missing" || r === "offline") {
        setData(mockReplay());
        setState("offline");
      } else {
        setData(r);
        setState("ready");
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const story = data?.stories.find((s) => s.id === id) ?? null;
  const posts = useMemo(
    () => (data && story ? data.posts.filter((p) => p.story === story.id) : []),
    [data, story],
  );

  if (!data) return <p className="p-10 text-sm text-ink/40">Loading…</p>;
  if (!story) {
    return (
      <div className="p-10">
        <Link href="/watcher" className="text-sm text-brand hover:underline">
          ← Back to Watcher
        </Link>
        <p className="mt-4 text-ink/60">
          That story isn&apos;t in the current data.
        </p>
      </div>
    );
  }

  const start = data.startClock;
  const first = Math.min(...posts.map((p) => p.minute));
  const last = Math.max(...posts.map((p) => p.minute));
  const detect = story.spikeMinute !== null ? story.spikeMinute - first : null;
  const reach = Math.round(posts.reduce((n, p) => n + p.reach, 0));
  const tone =
    story.risk.level === "Critical"
      ? "red"
      : story.risk.level === "Elevated"
        ? "amber"
        : "ink";
  const verdictTone =
    story.verdict === "False"
      ? "bg-red-100 text-red-700"
      : story.verdict === "True"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-800";

  // Bars: posts per 30 minutes, plus the running total.
  const buckets = Math.ceil((data.lastMinute + 1) / BUCKET);
  const counts = Array.from(
    { length: buckets },
    (_, i) =>
      posts.filter((p) => p.minute >= i * BUCKET && p.minute < (i + 1) * BUCKET)
        .length,
  );
  const running = counts.reduce<number[]>(
    (acc, c) => [...acc, (acc.at(-1) ?? 0) + c],
    [],
  );

  const by = <K extends string>(key: (p: DemoPost) => K) => {
    const m = new Map<K, number>();
    posts.forEach((p) => m.set(key(p), (m.get(key(p)) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const platforms = by((p) => p.platform).map(
    ([k, v]) => [PLATFORM[k], v] as [string, number],
  );
  const languages = by((p) => p.lang).map(
    ([k, v]) => [LANG[k], v] as [string, number],
  );
  const sources = new Map<string, { n: number; reach: number }>();
  posts.forEach((p) => {
    const e = sources.get(p.author) ?? { n: 0, reach: 0 };
    sources.set(p.author, { n: e.n + 1, reach: e.reach + p.reach });
  });
  const topSources = [...sources.entries()]
    .sort((a, b) => b[1].reach - a[1].reach)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <Link
          href="/watcher"
          className="text-sm text-ink/50 transition hover:text-ink"
        >
          ← Back to Watcher
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-medium tracking-[-0.03em] text-ink">
              {story.title}
            </h1>
            <p className="mt-2 text-ink/60">&ldquo;{story.claim}&rdquo;</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${verdictTone}`}
            >
              {story.verdict}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${tone === "red" ? "bg-red-100 text-red-700" : tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-ink/5 text-ink/60"}`}
            >
              {story.risk.level} · {story.risk.score}/100
            </span>
          </div>
        </div>
        {state === "offline" && (
          <p className="mt-2 text-xs text-amber-700">
            Backend not running, showing canned demo data.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Posts" value={String(posts.length)} />
        <Stat label="Peak per hour" value={String(story.peakPerHour)} />
        <Stat label="Reach" value={reach.toLocaleString()} />
        <Stat label="Languages" value={String(languages.length)} />
        <Stat
          label="Time to detect"
          value={detect === null ? "No spike" : dur(Math.max(detect, 0))}
          hint={detect === null ? undefined : "first post to spike"}
        />
      </div>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.05]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink/45">
            Spread over time
          </h2>
          <div className="flex gap-4 text-xs text-ink/50">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-sm bg-brand/80" /> Posts per 30
              min
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-0.5 w-4 bg-emerald-600" /> Running total
            </span>
          </div>
        </div>
        <SpreadChart
          counts={counts}
          running={running}
          spikeBucket={
            story.spikeMinute === null ? null : story.spikeMinute / BUCKET
          }
          label={(i) => clock(i * BUCKET, start)}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="By platform">
          <Bars rows={platforms} total={posts.length} />
        </Card>
        <Card title="By language">
          <Bars rows={languages} total={posts.length} />
        </Card>
        <Card title="Most influential sources">
          <ul className="space-y-2.5 text-sm">
            {topSources.map(([name, v]) => (
              <li
                key={name}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-ink/75">{name}</span>
                <span className="shrink-0 text-xs text-ink/45">
                  {v.n} posts · reach {Math.round(v.reach)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Timeline">
          <ol className="space-y-3 text-sm">
            <Step time={clock(first, start)} text="First post seen" />
            {story.spikeMinute !== null && (
              <Step
                time={clock(story.spikeMinute, start)}
                text={`Spike detected${detect !== null ? `, ${dur(Math.max(detect, 0))} after the first post` : ""}`}
                hot
              />
            )}
            <Step
              time={clock(last, start)}
              text={`Latest post · ${posts.length} posts in total`}
            />
            <Step text={`Fact-checker verdict: ${story.verdict}`} />
            <Step
              text={
                story.draft
                  ? "Responder drafted a reply, waiting for approval"
                  : "No reply drafted"
              }
            />
          </ol>
        </Card>
        <Card title="Why this risk score">
          {story.risk.drivers.length ? (
            <ul className="space-y-2 text-sm text-ink/75">
              {story.risk.drivers.map((d) => (
                <li key={d} className="flex gap-2">
                  <span className="text-brand">▲</span>
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">
              No risk drivers. Low volume and no urge to act.
            </p>
          )}
          <p className="mt-4 text-xs text-ink/40">
            Score is plain arithmetic on reach, speed, growth, urgency and the
            verdict. No model guesses it.
          </p>
        </Card>
      </div>

      <Card title="What the Fact-checker found">
        <p className="text-sm text-ink/75">{story.reasoning}</p>
        {story.evidence && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-medium">
              Verified fact ({story.evidence.source}):
            </span>{" "}
            {story.evidence.text}
          </p>
        )}
      </Card>

      {story.draft && (
        <Card title="Draft reply (needs a person's approval)">
          <p className="text-sm leading-relaxed text-ink">
            {story.draft.statement}
          </p>
          {story.draft.social && (
            <p className="mt-3 text-xs text-ink/60">
              <span className="font-medium text-ink/75">Social reply:</span>{" "}
              {story.draft.social}
            </p>
          )}
          {story.draft.sms && (
            <p className="mt-1.5 text-xs text-ink/60">
              <span className="font-medium text-ink/75">SMS:</span>{" "}
              {story.draft.sms}
            </p>
          )}
        </Card>
      )}

      <Card title={`Every post (${posts.length})`}>
        <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {[...posts]
            .sort((a, b) => b.minute - a.minute)
            .map((p) => (
              <li key={p.id} className="rounded-xl bg-mist/70 p-3 text-xs">
                <div className="flex items-center justify-between gap-2 text-ink/50">
                  <span className="truncate">
                    <span className="font-medium text-ink/75">
                      {PLATFORM[p.platform]}
                    </span>{" "}
                    · {p.author} · {LANG[p.lang]}
                  </span>
                  <span className="shrink-0">{clock(p.minute, start)}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink">{p.text}</p>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-brand hover:underline"
                >
                  {p.url.replace("https://", "")} ↗
                </a>
                {!data.live && (
                  <span className="text-amber-600">simulated source</span>
                )}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.05]">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink/45">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-medium tracking-[-0.03em] text-ink">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-ink/40">{hint}</p>}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.05]">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-ink/45">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bars({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <ul className="space-y-3">
      {rows.map(([name, n]) => (
        <li key={name}>
          <div className="mb-1 flex justify-between text-xs text-ink/60">
            <span>{name}</span>
            <span>
              {n} · {Math.round((n / total) * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]">
            <div
              className="h-full rounded-full bg-brand/80"
              style={{ width: `${(n / total) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Step({
  time,
  text,
  hot,
}: {
  time?: string;
  text: string;
  hot?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${hot ? "bg-red-500" : "bg-brand/50"}`}
      />
      <span className="text-ink/75">
        {time && (
          <span className="mr-2 font-mono text-xs text-ink/45">{time}</span>
        )}
        {text}
      </span>
    </li>
  );
}

// Bars per time bucket, a running-total line, and a marker at the spike.
function SpreadChart({
  counts,
  running,
  spikeBucket,
  label,
}: {
  counts: number[];
  running: number[];
  spikeBucket: number | null;
  label: (i: number) => string;
}) {
  const W = 900,
    H = 240,
    L = 36,
    B = 28,
    T = 12,
    R = 12;
  const iw = W - L - R,
    ih = H - T - B;
  const n = counts.length;
  const max = Math.max(...counts, 1),
    total = Math.max(running.at(-1) ?? 1, 1);
  const bw = iw / n;
  const x = (i: number) => L + i * bw;
  const line = running
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(x(i) + bw / 2).toFixed(1)},${(T + ih - (v / total) * ih).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Posts over time"
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={L}
            x2={W - R}
            y1={T + ih - f * ih}
            y2={T + ih - f * ih}
            stroke="#16132b"
            strokeOpacity={0.07}
          />
          <text
            x={L - 6}
            y={T + ih - f * ih + 3}
            textAnchor="end"
            fontSize={10}
            fill="#16132b"
            fillOpacity={0.4}
          >
            {Math.round(f * max)}
          </text>
        </g>
      ))}
      {counts.map((c, i) => (
        <rect
          key={i}
          x={x(i) + 2}
          y={T + ih - (c / max) * ih}
          width={Math.max(bw - 4, 1)}
          height={(c / max) * ih}
          rx={3}
          fill="#3b2aa8"
          fillOpacity={c ? 0.8 : 0.1}
        />
      ))}
      <path d={line} fill="none" stroke="#059669" strokeWidth={2} />
      {spikeBucket !== null && (
        <g>
          <line
            x1={L + spikeBucket * bw}
            x2={L + spikeBucket * bw}
            y1={T}
            y2={T + ih}
            stroke="#dc2626"
            strokeDasharray="4 4"
          />
          <text
            x={L + spikeBucket * bw + 5}
            y={T + 11}
            fontSize={11}
            fill="#dc2626"
          >
            Spike detected
          </text>
        </g>
      )}
      {counts.map(
        (_, i) =>
          i % 2 === 0 && (
            <text
              key={i}
              x={x(i) + bw / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#16132b"
              fillOpacity={0.45}
            >
              {label(i)}
            </text>
          ),
      )}
    </svg>
  );
}
