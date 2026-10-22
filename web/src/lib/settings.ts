"use client";

import type { IconType } from "react-icons";
import { FiGlobe, FiMessageSquare } from "react-icons/fi";
import { SiFacebook, SiInstagram, SiX } from "react-icons/si";
import { useSyncExternalStore } from "react";

// Where replies can go. Connecting is simulated: no real account is linked.
export const CHANNELS: {
  id: string;
  name: string;
  note: string;
  account: string;
  icon: IconType;
  color: string; // brand colour of the logo
}[] = [
  {
    id: "x",
    name: "X",
    note: "Public replies to posts",
    account: "@DemoBank",
    icon: SiX,
    color: "#000000",
  },
  {
    id: "facebook",
    name: "Facebook Page",
    note: "Comment replies",
    account: "Demo Bank",
    icon: SiFacebook,
    color: "#1877F2",
  },
  {
    id: "instagram",
    name: "Instagram",
    note: "Comment replies",
    account: "@demobank",
    icon: SiInstagram,
    color: "#E4405F",
  },
  {
    id: "sms",
    name: "SMS",
    note: "Messages to customers",
    account: "Sender ID: DemoBank",
    icon: FiMessageSquare,
    color: "#059669",
  },
  {
    id: "website",
    name: "Website",
    note: "Statement on the bank's site",
    account: "demobank.example",
    icon: FiGlobe,
    color: "#3B2AA8",
  },
];

export interface Settings {
  channels: string[]; // ids of connected channels
  auto: boolean; // send replies without waiting for a person
  ceiling: "Low" | "Elevated"; // highest risk level that may be sent automatically
}

const KEY = "rh-settings";
const DEFAULT: Settings = { channels: [], auto: false, ceiling: "Low" };
const listeners = new Set<() => void>();
let raw: string | null = null;
let value = DEFAULT;

// Cached by its stored text, so React sees the same object until it changes.
function read(): Settings {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== raw) {
      raw = stored;
      value = stored ? { ...DEFAULT, ...JSON.parse(stored) } : DEFAULT;
    }
  } catch {}
  return value;
}

export function saveSettings(next: Settings) {
  value = next;
  raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {}
  listeners.forEach((notify) => notify());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => DEFAULT,
  );
}
