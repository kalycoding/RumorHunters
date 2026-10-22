"use client";

import { useRouter } from "next/navigation";
import { FiLogOut } from "react-icons/fi";
import { logout, useToken } from "@/lib/auth";

/** Who is signed in, and the log out button. Sits at the bottom of the sidebar. */
export function UserMenu() {
  const router = useRouter();
  const user = useToken()?.split("|")[0] || "demo"; // the token starts with the username
  return (
    <div className="mt-auto space-y-2">
      <div className="hidden items-center gap-3 rounded-xl bg-mist p-3 lg:flex">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold uppercase text-white">
          {user[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{user}</p>
          <p className="text-xs text-ink/45">Signed in</p>
        </div>
      </div>
      <button
        title="Log out"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-ink/65 transition hover:bg-mist hover:text-ink lg:justify-start"
      >
        <FiLogOut size={21} className="shrink-0" />
        <span className="hidden lg:inline">Log out</span>
      </button>
    </div>
  );
}
