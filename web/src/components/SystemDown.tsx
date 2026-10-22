"use client";

import { useEffect, useRef, useState } from "react";
import { FiRefreshCw, FiServer } from "react-icons/fi";
import { API } from "@/lib/auth";

const EVERY = 10; // seconds between automatic checks

// The health check is open, so it works whether or not you are logged in.
const backendIsUp = () =>
  fetch(`${API}/health`)
    .then((r) => r.ok)
    .catch(() => false);

/** Shown instead of a page when the backend can't be reached. */
export function SystemDown() {
  const [secs, setSecs] = useState(EVERY);
  const [checking, setChecking] = useState(false);
  const ticks = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      ticks.current = (ticks.current + 1) % EVERY;
      setSecs(EVERY - ticks.current);
      if (ticks.current === 0) {
        backendIsUp().then((up) => up && window.location.reload());
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  async function retry() {
    setChecking(true);
    if (await backendIsUp()) window.location.reload();
    setChecking(false);
  }

  const rows = [
    ["Web app", "Online", "bg-emerald-500"],
    ["Agents and data", "Unreachable", "bg-red-500"],
  ];
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/10" />
          <span className="absolute inset-3 rounded-full bg-red-50" />
          <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white text-red-600 shadow-sm ring-1 ring-red-100">
            <FiServer size={26} />
          </span>
        </div>
        <h1 className="mt-8 text-3xl font-medium tracking-[-0.03em] text-ink">
          System is down
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink/60">
          We can&apos;t reach the Rumor Hunters agents right now. This is
          usually brief, and we&apos;re checking again automatically.
        </p>

        <div className="mt-8 divide-y divide-black/[0.06] rounded-2xl bg-white text-left text-sm shadow-sm ring-1 ring-black/[0.06]">
          {rows.map(([name, status, dot]) => (
            <div
              key={name}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <span className="text-ink/70">{name}</span>
              <span className="flex items-center gap-2 font-medium text-ink">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {status}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={retry}
          disabled={checking}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          <FiRefreshCw size={15} className={checking ? "animate-spin" : ""} />
          {checking ? "Checking…" : "Try again"}
        </button>
        <p className="mt-3 text-xs text-ink/40">Checking again in {secs}s</p>

        <p className="mt-10 text-xs text-ink/40">
          Running it yourself? Start the backend with
        </p>
        <code className="mt-1.5 inline-block rounded-lg bg-white px-3 py-2 text-xs text-ink/70 ring-1 ring-black/[0.06]">
          cd backend &amp;&amp; .venv/bin/uvicorn app.main:app --port 8100
        </code>
      </div>
    </div>
  );
}
