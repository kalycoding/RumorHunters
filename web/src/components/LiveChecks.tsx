import type { WatchStatus } from "@/lib/replay";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/** The Live checks switch, with when it last looked and what it has cost. */
export function LiveChecks({
  watch,
  onToggle,
}: {
  watch: WatchStatus | null;
  onToggle: () => void;
}) {
  const on = watch?.on ?? false;
  let line = `Off. Turn on to check X every ${watch?.interval ?? 5} seconds and show only what's new.`;
  if (on) {
    line = `Checking X every ${watch?.interval}s`;
    if (watch?.last_check) line += ` · last check ${time(watch.last_check)}`;
    if (watch?.analysing) line += " · reading new posts…";
  } else if (watch?.error) {
    line = `Stopped: ${watch.error}`;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/[0.05]">
      <div className="flex items-center gap-4">
        <button
          role="switch"
          aria-checked={on}
          disabled={!watch}
          onClick={onToggle}
          className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-ink/20"}`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white transition ${on ? "translate-x-5" : ""}`}
          />
        </button>
        <div>
          <p className="flex items-center gap-2 font-medium text-ink">
            Live checks
            {on && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            )}
          </p>
          <p
            className={`text-sm ${!on && watch?.error ? "text-red-600" : "text-ink/55"}`}
          >
            {line}
          </p>
        </div>
      </div>
      {watch && watch.checks > 0 && (
        <p className="text-sm text-ink/55">
          {watch.new_posts} new {watch.new_posts === 1 ? "post" : "posts"} ·
          about ${watch.usd.toFixed(2)} of ${watch.budget.toFixed(2)} budget
        </p>
      )}
    </div>
  );
}
