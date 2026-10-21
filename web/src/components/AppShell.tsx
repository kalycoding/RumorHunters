import Link from "next/link";
import type { ReactNode } from "react";

const icons = {
  watcher:
    "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  checker: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  replies: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
};

const NAV = [
  { id: "watcher", label: "Watcher", href: "/watcher", d: icons.watcher },
  { id: "checker", label: "Fact-checker", href: "/checker", d: icons.checker },
  { id: "replies", label: "Replies", href: "/replies", d: icons.replies },
] as const;

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[68px] shrink-0 flex-col items-center gap-2 bg-[#f3f4f9] py-5">
        <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-brand text-sm font-semibold text-white">
          R
        </span>
        {NAV.map((item) => {
          return (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              className={`grid h-10 w-10 place-items-center rounded-xl transition ${active === item.id ? "bg-white text-brand shadow-sm" : "text-ink/55 hover:bg-white/60"}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path d={item.d} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
      </aside>
      <main className="min-w-0 flex-1 bg-mist/50">{children}</main>
    </div>
  );
}
