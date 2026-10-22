"use client";

import { CHANNELS, saveSettings, useSettings } from "@/lib/settings";

export function Settings() {
  const s = useSettings();
  const none = s.channels.length === 0;

  const toggle = (id: string) =>
    saveSettings({
      ...s,
      channels: s.channels.includes(id)
        ? s.channels.filter((c) => c !== id)
        : [...s.channels, id],
      auto: s.auto && s.channels.some((c) => c !== id), // auto needs a channel
    });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink/60">
          Choose where replies go and whether they send automatically.
          Connecting is simulated in this demo: no real account is linked.
        </p>
      </div>

      <section>
        <Heading>Channels</Heading>
        <div className="grid gap-3 md:grid-cols-2">
          {CHANNELS.map((c) => {
            const on = s.channels.includes(c.id);
            return (
              <div key={c.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
                      style={{ background: c.color }}
                    >
                      <c.icon size={22} />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-sm text-ink/55">{c.note}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-emerald-100 text-emerald-800" : "bg-ink/10 text-ink/60"}`}
                  >
                    {on ? "Connected" : "Not connected"}
                  </span>
                </div>
                {on && <p className="mt-2 text-xs text-ink/50">{c.account}</p>}
                <button
                  onClick={() => toggle(c.id)}
                  className={`mt-4 rounded-xl px-3.5 py-2 text-sm font-medium ${on ? "bg-mist text-ink/70" : "bg-brand text-white hover:bg-brand-dark"}`}
                >
                  {on ? "Disconnect" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <Heading>Auto replies</Heading>
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-ink">Send replies automatically</p>
              <p className="text-sm text-ink/55">
                {none
                  ? "Connect a channel first."
                  : "Replies go to your connected channels without waiting for approval."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={s.auto}
              disabled={none}
              onClick={() => saveSettings({ ...s, auto: !s.auto })}
              className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition disabled:opacity-40 ${s.auto ? "bg-brand" : "bg-ink/20"}`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white transition ${s.auto ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
          {s.auto && (
            <div>
              <p className="mb-2 text-sm text-ink/70">
                Send automatically up to:
              </p>
              <div className="flex gap-2">
                {(["Low", "Elevated"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => saveSettings({ ...s, ceiling: level })}
                    className={`rounded-xl px-3 py-2 text-sm ${s.ceiling === level ? "bg-brand text-white" : "bg-mist text-ink/70"}`}
                  >
                    {level === "Low" ? "Low risk" : "Elevated risk"}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink/45">
                Critical stories always wait for a person.
              </p>
            </div>
          )}
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
