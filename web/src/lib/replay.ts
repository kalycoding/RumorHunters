import {
  DEMO_VERDICT,
  LAST_MINUTE,
  POSTS,
  START,
  STORIES,
  type DemoPost,
  type StoryId,
} from "@/lib/mock";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

export interface Draft {
  statement: string;
  social: string;
  sms: string;
}
export interface ReplayStory {
  id: string;
  title: string;
  claim: string;
  calls: boolean;
  verdict: "True" | "False" | "Misleading" | "Unverified";
  reasoning: string;
  evidence: { text: string; source: string } | null;
  draft: Draft | null;
  risk: { level: "Critical" | "Elevated" | "Low"; score: number; drivers: string[] };
  peakPerHour: number; // most posts seen in any one hour
  growth: number; // fastest hour-on-hour growth while it was building
  spikeMinute: number | null; // minutes after the first post when it first counted as a spike
}
export interface ReplayData {
  startClock: string; // HH:MM of the first post
  posts: DemoPost[];
  stories: ReplayStory[];
  lastMinute: number;
  source: "agents" | "mock";
}

const cap = (v: string) =>
  (v.charAt(0).toUpperCase() + v.slice(1)) as ReplayStory["verdict"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromAgents(d: any): ReplayData {
  const t0 = new Date(d.start).getTime();
  const minute = (iso: string) => Math.round((new Date(iso).getTime() - t0) / 60000);
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
    const verdict = cap(s.verification.verdict);
    const fact = s.evidence?.[0];
    return {
      id: s.narrative.id,
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
        level:
          (
            {
              critical: "Critical",
              high: "Elevated",
              medium: "Elevated",
              low: "Low",
            } as const
          )[s.risk.level as "critical" | "high" | "medium" | "low"] ?? "Low",
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
    startClock,
    posts,
    stories,
    lastMinute: Math.max(...posts.map((p) => p.minute)),
    source: "agents",
  };
}

export async function loadReplay(): Promise<ReplayData | "missing" | "offline"> {
  try {
    const r = await fetch(`${API}/replay`);
    if (r.status === 404) return "missing";
    if (!r.ok) return "offline";
    return fromAgents(await r.json());
  } catch {
    return "offline";
  }
}

export async function runAgents(): Promise<ReplayData> {
  const r = await fetch(`${API}/replay/analyze`, { method: "POST" });
  if (!r.ok) throw new Error(String(r.status));
  return fromAgents(await r.json());
}

/** Fallback when the backend is not running: canned data, clearly labelled. */
export function mockReplay(): ReplayData {
  const ids = Object.keys(STORIES) as Exclude<StoryId, null>[];
  const stories: ReplayStory[] = ids.map((id) => {
    const v = DEMO_VERDICT[id];
    const posts = POSTS.filter((p) => p.story === id);
    let spike: number | null = null;
    for (let m = 0; m <= LAST_MINUTE && spike === null; m += 2) {
      const now = posts.filter((p) => p.minute <= m);
      const latest = now.filter((p) => p.minute > m - 60).length;
      const before = now.filter((p) => p.minute > m - 120 && p.minute <= m - 60).length;
      if (latest >= 5 && latest / Math.max(before, 1) >= 2) spike = m;
    }
    return {
      id,
      title: STORIES[id].title,
      claim: STORIES[id].claim,
      calls: STORIES[id].calls,
      verdict: v.verdict,
      reasoning: v.evidence,
      evidence:
        v.verdict === "Unverified" ? null : { text: v.evidence, source: v.source },
      draft: v.draft ? { statement: v.draft, social: "", sms: "" } : null,
      spikeMinute: spike,
      risk: {
        level: spike === null ? "Low" : "Critical",
        score: spike === null ? 0 : 80,
        drivers: [],
      },
      peakPerHour: Math.max(
        ...posts.map(
          (p) =>
            posts.filter((q) => q.minute >= p.minute && q.minute < p.minute + 60).length,
        ),
        0,
      ),
      growth: 1,
    };
  });
  return {
    startClock: START,
    posts: POSTS,
    stories,
    lastMinute: LAST_MINUTE,
    source: "mock",
  };
}
