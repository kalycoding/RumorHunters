import Link from "next/link";
import type { ReactNode } from "react";
import { FiEye, FiMessageSquare, FiSettings } from "react-icons/fi";
import { AuthGate } from "@/components/AuthGate";
import { UserMenu } from "@/components/UserMenu";

const NAV = [
  { id: "watcher", label: "Watcher", href: "/watcher", icon: FiEye },
  { id: "replies", label: "Replies", href: "/replies", icon: FiMessageSquare },
  { id: "settings", label: "Settings", href: "/settings", icon: FiSettings },
];

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[72px] shrink-0 flex-col self-start border-r border-black/[0.06] bg-white p-3 lg:w-60 lg:p-4">
        <div className="mb-8 flex items-center gap-3 px-1 py-1">
          <img src="/logo.svg" alt="" className="h-10 w-10 shrink-0" />
          <span className="hidden text-lg font-semibold tracking-[-0.02em] text-ink lg:block">
            Rumor Hunters
          </span>
        </div>
        <p className="mb-2 hidden px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/35 lg:block">
          Menu
        </p>
        <nav className="space-y-1">
          {NAV.map(({ id, label, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              title={label}
              className={`flex items-center justify-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition lg:justify-start ${active === id ? "bg-brand/10 text-brand" : "text-ink/65 hover:bg-mist hover:text-ink"}`}
            >
              <Icon size={21} className="shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <UserMenu />
      </aside>
      <main className="min-w-0 flex-1 bg-mist/50">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
