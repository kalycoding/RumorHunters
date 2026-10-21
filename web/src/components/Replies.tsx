"use client";

import { useEffect, useState } from "react";
import { loadReplay, type ReplayStory } from "@/lib/replay";

export function Replies() {
  const [stories, setStories] = useState<ReplayStory[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadReplay().then((d) => {
      if (typeof d === "object") setStories(d.stories.filter((s) => s.draft));
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Replies</h1>
        <p className="mt-1 text-sm text-ink/60">
          Drafts written from verified facts. A person approves every reply.
          Sending is simulated.
        </p>
      </div>
      {stories.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-ink/60">
          No drafts yet. Run the agents on the Watcher page.
        </p>
      )}
      {stories.map((s) => (
        <div
          key={s.id}
          className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-[15px] font-medium text-ink">
              &ldquo;{s.claim}&rdquo;
            </p>
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
              {s.risk.level} · {s.risk.score}
            </span>
          </div>
          <Draft label="Statement" text={s.draft?.statement} />
          <Draft label="Social reply" text={s.draft?.social} />
          <Draft label="SMS" text={s.draft?.sms} />
          <button
            onClick={() => setSent({ ...sent, [s.id]: true })}
            disabled={sent[s.id]}
            className="rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:bg-emerald-600"
          >
            {sent[s.id] ? "Approved and sent" : "Approve and send"}
          </button>
        </div>
      ))}
    </div>
  );
}

function Draft({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink/45">
        {label}
      </p>
      <p className="mt-1 rounded-xl bg-mist p-3 text-sm text-ink">{text}</p>
    </div>
  );
}
