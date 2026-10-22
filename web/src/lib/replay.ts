import { type DemoPost } from "@/lib/mock";
import { api } from "@/lib/auth";

export interface Draft {
  statement: string;
  social: string;
  sms: string;
}
export interface ReplayStory {
  id: string;
  org: string;
  title: string;
  claim: string;
  calls: boolean;
  verdict: "True" | "False" | "Misleading" | "Unverified" | "Not checked";
  reasoning: string;
  evidence: { text: string; source: string } | null;
  draft: Draft | null;
  risk: {
    level: "Critical" | "Elevated" | "Low";
    score: number;
    drivers: string[];
  };
  peakPerHour: number; // most posts seen in any one hour
  growth: number; // fastest hour-on-hour growth while it was building
  spikeMinute: number | null; // minutes after the first post when it first counted as a spike
}
export interface ReplayData {
  org: string;
  start: number; // time of the first post, in ms
  live: boolean; // real posts, not the simulated replay
  collected?: { x_new: number; x_error: string | null };
  startClock: string; // HH:MM of the first post
  posts: DemoPost[];
  stories: ReplayStory[];
  lastMinute: number;
}

const cap = (v: string) =>
  (v.charAt(0).toUpperCase() + v.slice(1)) as ReplayStory["verdict"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromAgents(d: any, live = false): ReplayData {
  const t0 = new Date(d.start).getTime();
  const minute = (iso: string) =>
    Math.round((new Date(iso).getTime() - t0) / 60000);
  const posts: DemoPost[] = d.posts.map((p: any) => ({
    id: p.id,
    platform: p.platform,
    lang: p.language,
    text: p.text,
    claim: p.claim,
    story: p.narrative_id,
    minute: minute(p.posted_at),
    reach: 1 + p.likes + 2 * p.reposts + 1.5 * p.replies,
    author: p.author,
    url: p.url,
  }));
  const stories: ReplayStory[] = d.stories.map((s: any) => {
    const verdict =
      s.verification.verdict === "not_checked"
        ? "Not checked"
        : cap(s.verification.verdict);
    const fact = s.evidence?.[0];
    return {
      id: s.narrative.id,
      org: s.org,
      title: s.narrative.title,
      claim: s.narrative.claim,
      calls: s.narrative.calls_for_action,
      verdict,
      reasoning: s.verification.reasoning,
      evidence:
        verdict !== "Unverified" && fact
          ? { text: fact.text, source: fact.source }
          : null,
      draft: s.draft
        ? {
            statement: s.draft.statement,
            social: s.draft.social_reply,
            sms: s.draft.customer_sms,
          }
        : null,
      risk: {
        level: LEVEL[s.risk.level as StoryCard["level"]] ?? "Low",
        score: s.risk.score,
        drivers: s.risk.drivers,
      },
      peakPerHour: s.narrative.posts_per_hour,
      growth: s.narrative.growth_rate,
      spikeMinute: s.narrative.spike_at ? minute(s.narrative.spike_at) : null,
    };
  });
  const startDate = new Date(d.start);
  const startClock = `${String(startDate.getUTCHours()).padStart(2, "0")}:${String(startDate.getUTCMinutes()).padStart(2, "0")}`;
  return {
    org: d.org,
    start: t0,
    live,
    collected: d.collected,
    startClock,
    posts,
    stories,
    lastMinute: Math.max(minute(d.end), 0),
  };
}

export async function loadReplay(): Promise<
  ReplayData | "missing" | "offline"
> {
  try {
    const r = await api(`/replay`);
    if (r.status === 404) return "missing";
    if (!r.ok) return "offline";
    return fromAgents(await r.json());
  } catch {
    return "offline";
  }
}

export async function loadLive(): Promise<ReplayData | "missing" | "offline"> {
  try {
    const r = await api(`/live`);
    if (r.status === 404) return "missing";
    if (!r.ok) return "offline";
    return fromAgents(await r.json(), true);
  } catch {
    return "offline";
  }
}

/** Collect from X, then run the agents. Takes a minute or two. */
export async function refreshLive(): Promise<ReplayData> {
  const r = await api(`/live/refresh`, { method: "POST" });
  if (!r.ok) throw new Error(String(r.status));
  return fromAgents(await r.json(), true);
}

export interface StoryCard {
  id: string;
  title: string;
  claim: string;
  platforms: DemoPost["platform"][];
  posts: number;
  accounts: number; // distinct accounts behind those posts
  verdict: string; // "not_checked" when there were no facts to check with
  level: "critical" | "high" | "medium" | "low";
  score: number;
}
export interface Progress {
  running: boolean;
  stage: string;
  posts: number; // posts found so far
  total: number; // stories analysed so far
  stories: StoryCard[]; // the ones after `after`
}

export interface WatchStatus {
  on: boolean;
  interval: number; // seconds between checks
  last_check: string | null;
  checks: number;
  new_posts: number;
  usd: number; // X reads so far, at half a cent a post
  budget: number; // live checks stop before spending more than this
  version: number; // goes up each time the stories change
  analysing: boolean;
  error: string | null;
}

export const getWatch = (): Promise<WatchStatus> =>
  api("/live/watch").then((r) => r.json());

export const setWatch = (on: boolean): Promise<WatchStatus> =>
  api("/live/watch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ on }),
  }).then((r) => r.json());

export const LEVEL = {
  critical: "Critical",
  high: "Elevated",
  medium: "Elevated",
  low: "Low",
} as const;

/** The running refresh or fetch: its step and the stories analysed so far. */
export async function loadProgress(after: number): Promise<Progress> {
  const r = await api(`/live/progress?after=${after}`);
  return r.json();
}

/** What it costs to fetch one past period from X. */
export async function estimateRange(): Promise<{ posts: number; usd: number }> {
  const r = await api(`/live/estimate`);
  return r.json();
}

/** Fetch a past period (YYYY-MM-DD to YYYY-MM-DD) from X and run the agents. */
export async function fetchRange(
  start: string,
  end: string,
): Promise<ReplayData> {
  const r = await api(`/live/range`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ start, end }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return fromAgents(await r.json(), true);
}

export async function runAgents(): Promise<ReplayData> {
  const r = await api(`/replay/analyze`, { method: "POST" });
  if (!r.ok) throw new Error(String(r.status));
  return fromAgents(await r.json());
}
