"""X collector: recent public posts that mention a watched organization.
Read-only. Each post read costs a fraction of a cent, so the batch is small."""

from datetime import datetime

import httpx

from app import config
from app.models import Post
from app.store import Store

SEARCH = "https://api.x.com/2/tweets/search/recent"  # last 7 days
ARCHIVE = "https://api.x.com/2/tweets/search/all"  # any date
RUMOUR_WORDS = [
    "closing",
    '"shutting down"',
    "frozen",
    "fraud",
    "scam",
    "hacked",
    '"not working"',
    "outage",
    '"withdraw your"',
    '"don close"',
    '"dey block"',
    '"comot your money"',
]
ERRORS = {
    401: "X rejected the token",
    402: "X credits are used up",
    403: "X refused the request",
    429: "X rate limit reached",
}


def build_query(org: str) -> str:
    return f'"{org}" ({" OR ".join(RUMOUR_WORDS)}) -is:retweet'


def to_post(t: dict, users: dict, org: str) -> Post:
    name = users.get(t.get("author_id"), "i")
    m = t.get("public_metrics", {})
    return Post(
        id=t["id"],
        platform="x",
        author=f"@{name}",
        text=t["text"],
        posted_at=datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")),
        url=f"https://x.com/{name}/status/{t['id']}",
        org=org,
        likes=m.get("like_count", 0),
        reposts=m.get("retweet_count", 0) + m.get("quote_count", 0),
        replies=m.get("reply_count", 0),
    )


async def collect_x(
    store: Store,
    orgs: list[str] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict:
    """One run: search each organization, keep posts we haven't seen.
    With `start` and `end`, search that past period in the archive instead."""
    if not config.X_BEARER_TOKEN:
        return {"new": [], "error": "X_BEARER_TOKEN is not set"}
    new: list[Post] = []
    headers = {"Authorization": f"Bearer {config.X_BEARER_TOKEN}"}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        for org in orgs or config.WATCH_ORGS:
            params = {
                "query": build_query(org),
                "max_results": max(10, config.X_MAX_RESULTS),
                "tweet.fields": "created_at,public_metrics,author_id",
                "expansions": "author_id",
                "user.fields": "username",
            }
            if start and end:
                params["start_time"] = start.strftime("%Y-%m-%dT%H:%M:%SZ")
                params["end_time"] = end.strftime("%Y-%m-%dT%H:%M:%SZ")
                params["max_results"] = min(max(10, config.X_BACKFILL_RESULTS), 100)
            r = await client.get(ARCHIVE if start and end else SEARCH, params=params)
            if r.status_code != 200:
                return {"new": new, "error": ERRORS.get(r.status_code, r.text[:100])}
            body = r.json()
            users = {
                u["id"]: u["username"]
                for u in body.get("includes", {}).get("users", [])
            }
            for t in body.get("data", []):
                post = to_post(t, users, org)
                if store.add(post):
                    new.append(post)
    return {"new": new, "error": None}
