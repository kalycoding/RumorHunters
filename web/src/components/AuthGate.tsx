"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useToken } from "@/lib/auth";

/** Shows the app only when logged in. Otherwise sends you to the login page. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useToken();

  useEffect(() => {
    if (token === "") router.replace("/login");
  }, [token, router]);

  return token ? children : null;
}
