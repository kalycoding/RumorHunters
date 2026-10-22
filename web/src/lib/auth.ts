"use client";

import { useSyncExternalStore } from "react";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8100";
const KEY = "rh-token";
const listeners = new Set<() => void>();

// "" means logged out. The server render has no storage, so it sees null.
function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function change(token: string) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((notify) => notify());
}

export function useToken(): string | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => null,
  );
}

/** Returns an error message, or null when logged in. */
export async function login(user: string, password: string) {
  try {
    const r = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
    if (r.status === 401) return "Wrong username or password";
    if (!r.ok) return "Login is not set up on the server";
    change((await r.json()).token);
    return null;
  } catch {
    return "Could not reach the server";
  }
}

export const logout = () => change("");

/** fetch() with the login token. An expired token logs you out. */
export async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${read()}` },
  });
  if (r.status === 401) logout();
  return r;
}
