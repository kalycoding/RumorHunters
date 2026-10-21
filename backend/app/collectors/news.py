"""News and blog collector. Reads public RSS feeds and returns Post objects.

Google News search finds mentions of a watched organization; publisher feeds are a
second sweep. A feed that refuses us (403) is skipped and reported.
"""

import hashlib
import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, UTC
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import httpx

from app import config
from app.models import Post
from app.store import Store

PUBLISHER_FEEDS = {
    "Punch": "https://punchng.com/feed",
    "Legit.ng": "https://www.legit.ng/rss/all.rss",
    "Nairametrics": "https://nairametrics.com/feed",
    "Daily Post": "https://dailypost.ng/feed",
    "Premium Times": "https://www.premiumtimesng.com/feed",
    "TechCabal": "https://techcabal.com/feed",
    "BusinessDay": "https://businessday.ng/feed",
}


def google_news_url(
    org: str, window: str = "1d", after: str | None = None, before: str | None = None
) -> str:
    """`after` and `before` are YYYY-MM-DD and replace the "last N days" window."""
    span = f"after:{after} before:{before}" if after and before else f"when:{window}"
    q = quote_plus(f'"{org}" {span}')
    return f"https://news.google.com/rss/search?q={q}&hl=en-NG&gl=NG&ceid=NG:en"


def _clean(text: str | None) -> str:
    return re.sub(
        r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    ).strip()


def parse_feed(
    xml_text: str, default_source: str, org: str | None = None
) -> list[Post]:
    """Turn RSS XML into posts, newest first."""
    posts: list[Post] = []
    for item in ET.fromstring(xml_text).iter("item"):
        url = (item.findtext("link") or "").strip()
        title = _clean(item.findtext("title"))
        if not url or not title:
            continue
        summary = _clean(item.findtext("description"))
        source = _clean(item.findtext("source")) or default_source
        try:
            when = parsedate_to_datetime(item.findtext("pubDate") or "")
            when = when if when.tzinfo else when.replace(tzinfo=UTC)
        except (TypeError, ValueError):
            when = datetime.now(UTC)
        text = (
            title if not summary or summary.startswith(title) else f"{title}. {summary}"
        )
        posts.append(
            Post(
                id=hashlib.sha1(url.encode()).hexdigest()[:12],
                platform="news",
                author=source,
                text=text[:600],
                posted_at=when,
                url=url,
                org=org,
            )
        )
    return sorted(posts, key=lambda p: p.posted_at, reverse=True)


def mentions(post: Post, orgs: list[str]) -> str | None:
    """Which watched organization a publisher article mentions, if any."""
    low = post.text.lower()
    return next((o for o in orgs if o.lower() in low), None)


async def fetch_text(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        r = await client.get(url, follow_redirects=True)
    except httpx.HTTPError:
        return None
    return r.text if r.status_code == 200 else None


async def collect(
    store: Store,
    orgs: list[str] | None = None,
    after: str | None = None,
    before: str | None = None,
) -> dict:
    """One run: fetch every feed, keep new mentions, skip what we've seen."""
    orgs = orgs or config.WATCH_ORGS
    new: list[Post] = []
    skipped = 0
    failed: list[str] = []
    async with httpx.AsyncClient(
        timeout=15, headers={"User-Agent": config.USER_AGENT}
    ) as client:
        jobs = [
            (f"Google News: {o}", google_news_url(o, after=after, before=before), o)
            for o in orgs
        ]
        if not after:  # publisher feeds only hold the latest articles
            jobs += [(name, url, None) for name, url in PUBLISHER_FEEDS.items()]
        for name, url, org in jobs:
            xml_text = await fetch_text(client, url)
            if xml_text is None:
                failed.append(name)
                continue
            try:
                posts = parse_feed(xml_text, name, org)
            except ET.ParseError:
                failed.append(name)
                continue
            for p in posts:
                p.org = p.org or mentions(p, orgs)
                if p.org is None:
                    continue  # a publisher article that doesn't mention anyone we watch
                if store.add(p):
                    new.append(p)
                else:
                    skipped += 1
    return {
        "new": len(new),
        "skipped_seen": skipped,
        "feeds_failed": failed,
        "posts": [
            p.model_dump(mode="json")
            for p in sorted(new, key=lambda p: p.posted_at, reverse=True)
        ],
    }
