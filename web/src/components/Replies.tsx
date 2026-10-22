"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SystemDown } from "@/components/SystemDown";
import { loadReplay, type ReplayStory } from "@/lib/replay";
import { CHANNELS, useSettings } from "@/lib/settings";

const RANK = { Low: 1, Elevated: 2, Critical: 3 } as const;

export function Replies() {
  const settings = useSettings();
  const [stories, setStories] = useState<ReplayStory[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [down, setDown] = useState(false);

  useEffect(() => {
    loadReplay().then((d) => {
      if (d === "offline") setDown(true);
      else if (typeof d === "object")
        setStories(d.stories.filter((s) => s.draft));
    });
  }, []);

  if (down) return <SystemDown />;

  const names = CHANNELS.filter((c) => settings.channels.includes(c.id)).map(
    (c) => c.name,
  );
  const connected = names.length > 0;
  // Auto replies cover stories up to the chosen risk level. Critical always waits.
  const isAuto = (s: ReplayStory) =>
    settings.auto &&
    connected &&
    s.risk.level !== "Critical" &&
    RANK[s.risk.level] <= RANK[settings.ceiling];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Replies</h1>
        <p className="mt-1 text-sm text-ink/60">
          Replies written from verified facts.{" "}
          {connected ? `Sending to: ${names.join(", ")}.` : ""}{" "}
          {connected ? (
            "Sending is simulated."
          ) : (
            <>
              No channel is connected.{" "}
              <Link href="/settings" className="text-brand hover:underline">
                Connect one in Settings
              </Link>
              .
            </>
          )}
        </p>
      </div>
      {stories.length === 0 && (
        <p className="rounded-xl bg-white p-4 text-sm text-ink/60">
          No replies yet. Run the agents on the Watcher page.
        </p>
      )}
      {stories.map((s) => {
        const auto = isAuto(s);
        const done = auto || sent[s.id];
        return (
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
            {done ? (
              <p className="text-sm text-emerald-700">
                {auto ? "Sent automatically" : "Approved and sent"} (simulated)
                to {names.join(", ")}
              </p>
            ) : (
              <button
                onClick={() => setSent({ ...sent, [s.id]: true })}
                disabled={!connected}
                className="rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:bg-ink/20"
              >
                Approve and send
              </button>
            )}
          </div>
        );
      })}
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
