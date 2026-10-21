"""Writes data/posts.json: the SIMULATED stream the replay runs on. Not real posts.
Pidgin and Hausa lines need a native speaker to check before the demo."""

import json
from datetime import datetime, timedelta, UTC
from pathlib import Path

START = datetime(2026, 8, 30, 16, 0, tzinfo=UTC)
ORG = "Demo Bank"
LANGS = ["en", "pcm", "ha"]
PLATFORMS = ["x", "telegram", "facebook", "reddit", "instagram", "news"]
SITES = ["lagosbusinessdaily", "naijafinancewatch", "techcabal-sim", "punchwire-sim"]
CHANNELS = ["naija_alerts", "bank_gist", "lagos_updates"]
SUBS = ["r/Nigeria", "r/Nigeria_Finance"]

# id prefix, first hour, posts per hour from that hour on, texts per language
STORIES = [
    (
        "r",
        0,
        [1, 2, 3, 6, 11, 17, 24, 20],
        {
            "en": [
                f"Memo is circulating: {ORG} will stop working from 1 September. Withdraw your money now!",
                f"Please share. {ORG} is closing on 1st. Take out your savings today.",
                f"Heard {ORG} is shutting down next week. Is this true?",
            ],
            "pcm": [
                f"Abeg una hear am o, {ORG} dey close from 1st. Comot your money sharp sharp!",
                f"Dem say {ORG} go shut down. Make una withdraw before e too late.",
            ],
            "ha": [
                "Bankin Demo zai daina aiki daga 1 ga Satumba. Ku cire kudinku yanzu!",
                "An ce Bankin Demo zai rufe. Ku fitar da kudinku.",
            ],
        },
    ),
    (
        "f",
        2,
        [1, 2, 4, 7, 9, 5],
        {
            "en": [
                f"{ORG} has started charging a new fee on every transfer. Check your alerts!",
                f"Anyone else notice the new transfer fee from {ORG}? This is theft.",
                f"{ORG} new charges on transfers and withdrawals, please share.",
            ],
            "pcm": [
                f"Abeg {ORG} don start to dey charge new fee for every transfer o. Una don see am?",
                f"{ORG} dey cut extra money for transfer now, e no good at all.",
            ],
            "ha": [
                "Bankin Demo ya fara karbar sabon kudi a kowane turawa. Ku duba sakonninku.",
                "Bankin Demo na cire karin kudi idan an tura kudi.",
            ],
        },
    ),
    (
        "m",
        3,
        [2, 2, 1, 1],
        {
            "en": [
                f"{ORG} says its system will be down Sunday from 1am to 4am for maintenance.",
                f"Reminder: {ORG} scheduled maintenance this Sunday night, transfers may be unavailable for a few hours.",
            ],
            "pcm": [
                f"{ORG} talk say dem go dey do maintenance Sunday night, transfer fit no work small."
            ],
            "ha": ["Bankin Demo ya ce za a yi gyaran tsarin sa a daren Lahadi."],
        },
    ),
    (
        "o",
        5,
        [2, 4, 6, 8],
        {
            "en": [
                f"Warning: someone calling from {ORG} customer care is asking customers for their OTP to upgrade accounts.",
                f"{ORG} staff are asking for your OTP and PIN to verify your account. Do not ignore, they will lock it!",
            ],
            "pcm": [
                f"Person don call me say na {ORG}, dem dey ask for OTP make dem upgrade my account. Na so dem dey do now?"
            ],
            "ha": [
                "Wani ya kira ni daga Bankin Demo yana neman OTP dina domin ya sabunta asusu na."
            ],
        },
    ),
    (
        "a",
        6,
        [2, 4, 6],
        {
            "en": [
                f"All {ORG} ATMs are down across Lagos today!",
                f"Every {ORG} ATM is out of service. Where do I withdraw?",
            ],
            "pcm": [f"All {ORG} ATM don spoil today, I no fit collect money anywhere."],
            "ha": ["Duk na'urorin ATM na Bankin Demo ba sa aiki yau."],
        },
    ),
]
SLOW = f"My transfer is taking long today. {ORG} please fix this."
NOISE = [
    "Anyone watching the match tonight?",
    "Traffic on Third Mainland is crazy today",
    "Best jollof in Lagos, who agrees?",
    "Rain don start again o",
]


def origin(platform, n):
    i = 1000 + n * 7
    if platform == "news":
        s = SITES[n % 4]
        return s, f"https://{s}.example.com/story/{i}"
    if platform == "reddit":
        s = SUBS[n % 2]
        return s, f"https://reddit.example.com/{s}/comments/{i}"
    if platform == "telegram":
        c = CHANNELS[n % 3]
        return f"@{c}", f"https://t.example.com/{c}/{i}"
    if platform == "facebook":
        return "Facebook Page", f"https://facebook.example.com/posts/{i}"
    if platform == "instagram":
        return "@sim_account", f"https://instagram.example.com/p/{i}"
    return f"@sim_user_{n % 9}", f"https://x.example.com/status/{i}"


posts, n = [], 0


def add(pid, text, minute, plat=None, likes=None):
    global n
    plat = plat or PLATFORMS[n % len(PLATFORMS)]
    a, u = origin(plat, n)
    posts.append(
        dict(
            id=pid,
            platform=plat,
            author=a,
            text=text,
            posted_at=(START + timedelta(minutes=minute)).isoformat(),
            url=u,
            likes=likes if likes is not None else 5 + (n * 37) % 90,
            reposts=n % 7,
            replies=n % 5,
        )
    )
    n += 1


for prefix, first_hour, counts, texts in STORIES:
    k = 0
    for h, count in enumerate(counts):
        for i in range(count):
            lang = LANGS[(k + h) % 3]
            options = texts[lang]
            add(
                f"{prefix}{k}",
                options[k % len(options)],
                round((first_hour + h) * 60 + i * 60 / count),
            )
            k += 1
for k in range(7):
    add(f"s{k}", SLOW, 20 + k * 65, "facebook" if k % 2 else "x", 3 + k)
for i, m in enumerate([40, 95, 150, 210, 275, 340, 400, 450]):
    add(f"x{i}", NOISE[i % len(NOISE)], m, "reddit", 1)
posts.sort(key=lambda p: p["posted_at"])
Path(__file__).resolve().parents[1].joinpath("data", "posts.json").write_text(
    json.dumps(posts, indent=1)
)
print(len(posts), "seed posts written")
