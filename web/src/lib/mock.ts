// Shapes shared by the pages. The simulated Demo Bank posts come from the backend.

export type Platform =
  "news" | "reddit" | "telegram" | "facebook" | "x" | "instagram";
export type Lang = "en" | "pcm" | "ha";

export interface DemoPost {
  id: string;
  platform: Platform;
  lang: Lang;
  text: string;
  claim: string | null; // what the Watcher extracted, in English
  story: string | null; // id of the story the Watcher put it in
  minute: number; // minutes after the first post
  reach: number;
  author: string; // site, channel or handle
  url: string;
}

export const ORG = "Demo Bank"; // the organization the simulation is about
