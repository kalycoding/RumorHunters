"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiX } from "react-icons/si";
import { login, useToken } from "@/lib/auth";

// An example of what the agents do, shown on the login page. Not real data.
const PREVIEW = [
  {
    label: "Watcher",
    text: "OPay shutdown rumour spreading on X",
    tag: "Critical",
  },
  {
    label: "Fact-checker",
    text: "False: the official status page says all services run",
    tag: "False",
  },
  {
    label: "Responder",
    text: "Reply written and sent for approval",
    tag: "Ready",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const token = useToken();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) router.replace("/watcher");
  }, [token, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError((await login(user, password)) ?? "");
    setBusy(false);
  }

  const label = "block text-sm font-medium text-ink";
  const input =
    "mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-ink outline-none placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-mint/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/logo.svg" alt="" className="h-10 w-10" />
          <span className="text-lg font-medium">Rumor Hunters</span>
        </div>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-medium leading-tight tracking-[-0.03em]">
            Catch the rumour before it becomes a crisis.
          </h2>
          <div className="max-w-md space-y-3">
            {PREVIEW.map((p, i) => (
              <div
                key={p.label}
                style={{ animationDelay: `${300 + i * 450}ms` }}
                className="animate-fade-up rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                  <span className="flex items-center gap-2">
                    {i === 0 && <SiX size={11} />}
                    {p.label}
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-0.5 font-medium text-white">
                    {p.tag}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{p.text}</p>
              </div>
            ))}
            <p className="pt-1 text-xs text-white/50">
              Example of what the agents do.
            </p>
          </div>
        </div>
        <p className="relative text-sm text-white/60">
          AI agents that live on the internet, spot misinformation about your
          organization and draft the reply.
        </p>
      </section>

      <section className="grid place-items-center bg-mist/60 p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-sm space-y-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <div>
            <h1 className="text-2xl font-semibold text-ink">Log in</h1>
            <p className="mt-1 text-sm text-ink/55">
              Enter your details to watch your reputation.
            </p>
          </div>
          <div>
            <label htmlFor="user" className={label}>
              Username
            </label>
            <input
              id="user"
              className={input}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className={label}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                className={`${input} pr-16`}
                type={show ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-xs font-medium text-ink/55 hover:text-ink"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={busy || !user || !password}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}
