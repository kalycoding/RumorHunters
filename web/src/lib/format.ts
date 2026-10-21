import type { Platform } from "@/lib/mock";

export const PLATFORM: Record<Platform, string> = {
  news: "News",
  reddit: "Reddit",
  telegram: "Telegram",
  facebook: "Facebook",
  x: "X",
  instagram: "Instagram",
};

export const LANG = { en: "English", pcm: "Pidgin", ha: "Hausa" } as const;

// Clock time of a post, given the start time ("16:00") and minutes since.
export function clock(minute: number, start: string) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + minute;
  const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
  return `${hh}:${String(t % 60).padStart(2, "0")}`;
}

export const dur = (mins: number) =>
  mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
