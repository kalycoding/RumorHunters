"use client";

import { useEffect, useState } from "react";
import { loadReplay, type ReplayData } from "@/lib/replay";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";

interface Fact {
  id: string;
  title: string;
  text: string;
  source: string;
}

const TONE: Record<string, string> = {
  False: "bg-red-100 text-red-800",
  Misleading: "bg-amber-100 text-amber-800",
  True: "bg-emerald-100 text-emerald-800",
  Unverified: "bg-ink/10 text-ink/70",
};

export function Checker() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [data, setData] = useState<ReplayData | "missing" | "offline" | null>(
    null,
  );

  useEffect(() => {
    fetch(`${API}/facts`)
      .then((r) => r.json())
      .then(setFacts)
      .catch(() => setFacts([]));
    loadReplay().then(setData);
  }, []);

  const stories = data && typeof data === "object" ? data.stories : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Fact-checker</h1>
        <p className="mt-1 text-sm text-ink/60">
          Every claim is compared with the verified facts below and nothing
          else. If no fact covers it, the verdict is Unverified. The agent never
          guesses.
        </p>
      </div>

      <section>
        <Heading>Claims checked ({stories.length})</Heading>
        {data === "missing" && (
          <Note>Run the agents on the Watcher page first.</Note>
        )}
        {data === "offline" && <Note>The backend is not running.</Note>}
        <div className="space-y-3">
          {stories.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[15px] font-medium text-ink">
                  &ldquo;{s.claim}&rdquo;
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[s.verdict]}`}
                >
                  {s.verdict.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink/70">{s.reasoning}</p>
              {s.evidence && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                  <b>Verified fact ({s.evidence.source}):</b> {s.evidence.text}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <Heading>Verified facts ({facts.length})</Heading>
        <div className="grid gap-3 md:grid-cols-2">
          {facts.map((f) => (
            <div key={f.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-ink">{f.title}</p>
              <p className="mt-1 text-sm text-ink/70">{f.text}</p>
              <p className="mt-2 text-xs text-ink/40">Source: {f.source}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-ink/45">
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-white p-4 text-sm text-ink/60">{children}</p>
  );
}
