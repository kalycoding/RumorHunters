"use client";

import { PlatformBadge } from "@/components/PlatformBadge";
import { useEffect, useRef, useState } from "react";
import {
  estimateRange,
  loadProgress,
  LEVEL,
  type StoryCard,
  type ReplayData,
} from "@/lib/replay";

export const DAY = 1440; // minutes

/** Stories the agents have grouped and analysed, popping in while a fetch runs. */
export function ProgressPanel() {
  const [shown, setShown] = useState<StoryCard[]>([]);
  const [info, setInfo] = useState({ stage: "Starting", posts: 0 });
  const queue = useRef<StoryCard[]>([]);
  const have = useRef(0);

  useEffect(() => {
    const poll = () =>
      loadProgress(have.current)
        .then((p) => {
          have.current = p.total;
          queue.current.push(...p.stories);
          if (p.stage) setInfo({ stage: p.stage, posts: p.posts });
        })
        .catch(() => {});
    const reveal = () => {
      const next = queue.current.shift();
      if (next) setShown((list) => [next, ...list]);
    };
    poll();
    const a = window.setInterval(poll, 1000);
    const b = window.setInterval(reveal, 250);
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
    };
  }, []);

  const tone = {
    Critical: "border-red-300 bg-red-50/40",
    Elevated: "border-amber-300 bg-amber-50/40",
    Low: "border-black/[0.06] bg-white",
  };
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
        {info.stage}… · {info.posts} posts read · {shown.length}{" "}
        {shown.length === 1 ? "story" : "stories"}
      </p>
      {shown.map((s) => {
        const level = LEVEL[s.level];
        return (
          <div
            key={s.id}
            className={`animate-fade-up rounded-2xl border p-4 ${tone[level]}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
                  {s.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                  <span>
                    {s.posts} posts from {s.accounts}{" "}
                    {s.accounts === 1 ? "account" : "accounts"}
                  </span>
                </div>
                <p className="mt-2 font-medium text-ink">{s.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink/55">
                  &ldquo;{s.claim}&rdquo;
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/70 ring-1 ring-black/[0.06]">
                  {level}
                </span>
                <p className="mt-2 text-xs capitalize text-ink/55">
                  {s.verdict === "not_checked" ? "Not checked" : s.verdict}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Pick which days to look at. Dates we haven't collected can be fetched. */
export function DateFilter({
  data,
  past,
  onBackToLive,
  onFetchPast,
  fetching,
  fetchError,
  from,
  to,
  onChange,
}: {
  data: ReplayData;
  past?: boolean;
  onBackToLive?: () => void;
  onFetchPast?: (start: string, end: string) => void;
  fetching?: boolean;
  fetchError?: string;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
}) {
  const last = data.lastMinute;
  const [pending, setPending] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [cost, setCost] = useState<{ posts: number; usd: number } | null>(null);
  const dayOf = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const day = (m: number) => dayOf(data.start + m * 60000);
  const [nowMs] = useState(() => Date.now());
  const today = dayOf(nowMs);
  const yearAgo = dayOf(nowMs - 365 * DAY * 60000);
  // Minute of the start or end of a calendar day, counted from the first post.
  const minuteOf = (value: string, endOfDay: boolean) => {
    const [y, m, d] = value.split("-").map(Number);
    const t = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0);
    return Math.round((t.getTime() - data.start) / 60000);
  };

  // Dates inside what we hold filter instantly. Others need a fetch first.
  function pick(start: string, end: string) {
    if (end < start) end = start;
    if (start >= day(0) && end <= day(last)) {
      setPending(null);
      onChange(minuteOf(start, false), Math.min(minuteOf(end, true), last));
      return;
    }
    setPending({ start, end });
    if (!cost) estimateRange().then(setCost);
  }

  const presets = [
    ["24 hours", 1],
    ["3 days", 3],
    ["7 days", 7],
  ] as const;
  const input =
    "rounded-lg bg-white px-2 py-1.5 text-sm text-ink ring-1 ring-black/[0.08]";
  const startValue = pending?.start ?? day(Math.max(from, 0));
  const endValue = pending?.end ?? day(to);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink/45">
          Date range
        </span>
        {presets.map(([label, days]) => {
          const active =
            !past && to === last && from === Math.max(0, last - days * DAY);
          return (
            <button
              key={label}
              onClick={() => {
                setPending(null);
                if (past) onBackToLive?.();
                else onChange(Math.max(0, last - days * DAY), last);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium ${active ? "bg-brand text-white" : "bg-white text-ink/65 ring-1 ring-black/[0.08]"}`}
            >
              {label}
            </button>
          );
        })}
        <label className="flex items-center gap-2 text-ink/55">
          From
          <input
            type="date"
            className={input}
            min={yearAgo}
            max={today}
            value={startValue}
            onChange={(e) => e.target.value && pick(e.target.value, endValue)}
          />
        </label>
        <label className="flex items-center gap-2 text-ink/55">
          To
          <input
            type="date"
            className={input}
            min={yearAgo}
            max={today}
            value={endValue}
            onChange={(e) => e.target.value && pick(startValue, e.target.value)}
          />
        </label>
      </div>
      {pending && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <span>
            We haven&apos;t collected {pending.start} to {pending.end} yet.
            Fetching it searches X
            {cost
              ? `, about ${cost.posts} posts, about $${cost.usd.toFixed(2)}`
              : ""}
            .
          </span>
          <button
            onClick={() => {
              onFetchPast?.(pending.start, pending.end);
              setPending(null);
            }}
            disabled={fetching}
            className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            {fetching ? "Fetching…" : "Fetch and analyse"}
          </button>
          <button onClick={() => setPending(null)} className="text-amber-800">
            Cancel
          </button>
        </div>
      )}
      {fetchError && <p className="text-sm text-red-600">{fetchError}</p>}
    </div>
  );
}
