// SIMULATED data for the demo UI, modelled on a rumour wave. Not real posts.
// Pidgin and Hausa lines need a native speaker to check before the demo.

export type Platform = "news" | "reddit" | "telegram" | "facebook" | "x" | "instagram";
export type Lang = "en" | "pcm" | "ha";
export type StoryId = "shutdown" | "slow" | null;

export interface DemoPost {
  id: string;
  platform: Platform;
  lang: Lang;
  text: string;
  claim: string | null; // what the Watcher extracted, in English
  story: StoryId;
  minute: number; // minutes after the first post
  reach: number;
  author: string; // site, channel or handle
  url: string; // demo links use the reserved example.com domain
}

export const SIMULATED: Platform[] = ["x", "instagram"]; // shown on replay only
export const ORG = "Demo Bank";
export const START = "16:00";

export const STORIES: Record<
  Exclude<StoryId, null>,
  { title: string; claim: string; calls: boolean }
> = {
  shutdown: {
    title: "Bank is shutting down",
    claim: "Demo Bank will stop working from 1 September",
    calls: true,
  },
  slow: {
    title: "Transfers are slow",
    claim: "Demo Bank transfers are slow today",
    calls: false,
  },
};

const RUMOUR: Record<Lang, string[]> = {
  en: [
    "Memo is circulating: Demo Bank will stop working from 1 September. Withdraw your money now!",
    "Please share. Demo Bank is closing on 1st. Take out your savings today.",
    "Heard Demo Bank is shutting down next week. Is this true?",
  ],
  pcm: [
    "Abeg una hear am o, Demo Bank dey close from 1st. Comot your money sharp sharp!",
    "Dem say Demo Bank go shut down. Make una withdraw before e too late.",
  ],
  ha: [
    "Bankin Demo zai daina aiki daga 1 ga Satumba. Ku cire kudinku yanzu!",
    "An ce Bankin Demo zai rufe. Ku fitar da kudinku.",
  ],
};
const PLATFORMS: Platform[] = [
  "x",
  "telegram",
  "facebook",
  "reddit",
  "instagram",
  "news",
];
const LANGS: Lang[] = ["en", "pcm", "ha"];

const SITES = [
  "lagosbusinessdaily",
  "naijafinancewatch",
  "techcabal-sim",
  "punchwire-sim",
];
const CHANNELS = ["naija_alerts", "bank_gist", "lagos_updates"];
const SUBS = ["r/Nigeria", "r/Nigeria_Finance"];

// Where a post came from. Simulated: the links use example.com and go nowhere real.
function origin(platform: Platform, n: number): { author: string; url: string } {
  const id = 1000 + n * 7;
  switch (platform) {
    case "news": {
      const site = SITES[n % SITES.length];
      return { author: site, url: `https://${site}.example.com/story/${id}` };
    }
    case "reddit": {
      const sub = SUBS[n % SUBS.length];
      return { author: sub, url: `https://reddit.example.com/${sub}/comments/${id}` };
    }
    case "telegram": {
      const ch = CHANNELS[n % CHANNELS.length];
      return { author: `@${ch}`, url: `https://t.example.com/${ch}/${id}` };
    }
    case "facebook":
      return { author: "Facebook Page", url: `https://facebook.example.com/posts/${id}` };
    case "instagram":
      return { author: "@sim_account", url: `https://instagram.example.com/p/${id}` };
    default:
      return { author: `@sim_user_${n % 9}`, url: `https://x.example.com/status/${id}` };
  }
}

function build(): DemoPost[] {
  const posts: DemoPost[] = [];
  const perHour = [1, 2, 3, 6, 11, 17, 24, 20]; // the rumour wave, hour by hour
  let n = 0;
  perHour.forEach((count, hour) => {
    for (let i = 0; i < count; i++) {
      const lang = LANGS[(n + hour) % 3];
      const texts = RUMOUR[lang];
      posts.push({
        id: `r${n}`,
        platform: PLATFORMS[n % PLATFORMS.length],
        lang,
        text: texts[n % texts.length],
        claim: STORIES.shutdown.claim,
        story: "shutdown",
        minute: Math.round(hour * 60 + (i * 60) / count),
        reach: 5 + ((n * 37) % 90),
        ...origin(PLATFORMS[n % PLATFORMS.length], n),
      });
      n++;
    }
  });
  for (let k = 0; k < 7; k++) {
    posts.push({
      id: `s${k}`,
      platform: k % 2 ? "facebook" : "x",
      lang: "en",
      text: "My transfer is taking long today. Demo Bank please fix this.",
      claim: STORIES.slow.claim,
      story: "slow",
      minute: 20 + k * 65,
      reach: 3 + k,
      ...origin(k % 2 ? "facebook" : "x", 200 + k),
    });
  }
  [95, 210, 340].forEach((m, i) =>
    posts.push({
      id: `x${i}`,
      platform: "reddit",
      lang: "en",
      text: "Anyone watching the match tonight?",
      claim: null,
      story: null,
      minute: m,
      reach: 1,
      ...origin("reddit", 300 + i),
    }),
  );
  return posts.sort((a, b) => a.minute - b.minute);
}

export const POSTS = build();
export const LAST_MINUTE = Math.max(...POSTS.map((p) => p.minute));

// Demo outputs for the Fact-checker and Responder, shown in the detail panel.
// These agents are not built yet; this is a preview of what they will return.
export const DEMO_VERDICT: Record<
  Exclude<StoryId, null>,
  {
    verdict: "False" | "Unverified";
    evidence: string;
    source: string;
    draft: string | null;
  }
> = {
  shutdown: {
    verdict: "False",
    evidence:
      "All Demo Bank services are fully operational. There is no plan to suspend or stop services.",
    source: "Official status page",
    draft:
      "A message saying Demo Bank will stop working on 1 September is false. All our services are running normally and your money is safe. You do not need to withdraw it. For updates, please use our official channels only.",
  },
  slow: {
    verdict: "Unverified",
    evidence: "No verified fact covers transfer speed today.",
    source: "No match found",
    draft: null,
  },
};
