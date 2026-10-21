"""Runs the three agents over the seeded replay data and caches the result."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app import config, progress
from app.agents.factchecker import verify_narrative
from app.agents.responder import draft_response, score_risk
from app.agents.watcher import extract_claims, group_into_narratives
from app.models import Post, VerifiedFact
from app.sources.replay import ReplaySource
from app.store import Store

DATA = Path(__file__).resolve().parents[1] / "data"
CACHE = DATA / "replay_analysis.json"
LIVE_CACHE = DATA / "live_analysis.json"
ORG = "Demo Bank"


CLAIMS = DATA / "claims_cache.json"


async def _claims(posts: list[Post], org: str):
    """Extraction is the slow step. Cache it by post id and text."""
    from app.models import ExtractedClaim

    cache = json.loads(CLAIMS.read_text()) if CLAIMS.exists() else {}
    key = lambda p: f"{p.id}|{p.text}"  # noqa: E731
    todo = [p for p in posts if key(p) not in cache]
    for c in await extract_claims(todo, org) if todo else []:
        post = next(p for p in todo if p.id == c.post_id)
        cache[key(post)] = c.model_dump(mode="json")
    CLAIMS.write_text(json.dumps(cache))
    return [ExtractedClaim(**cache[key(p)]) for p in posts if key(p) in cache]


async def _analyze(
    posts: list[Post], org: str, facts: list[VerifiedFact], now: datetime, prefix=""
) -> tuple[list, list]:
    """Watcher, Fact-checker, Responder on one organization's posts."""
    progress.at("Reading posts")
    claims = await _claims(posts, org)
    progress.at("Grouping stories")
    narratives = await group_into_narratives(posts, claims, now)
    progress.at("Checking facts")
    stories = []
    for n in narratives:
        n.id = f"{prefix}{n.id}"
        v = await verify_narrative(n, facts)
        risk = score_risk(n, v)
        progress.story(
            {
                "id": n.id,
                "title": n.title,
                "claim": n.claim,
                "platforms": n.platforms,
                "posts": len(n.post_ids),
                "verdict": v.verdict,
                "level": risk.level,
                "score": risk.score,
            }
        )
        draft = None
        if v.verdict != "true" and risk.level in ("high", "critical") and facts:
            draft = await draft_response(n, v, facts)
        stories.append(
            {
                "narrative": n.model_dump(mode="json"),
                "verification": v.model_dump(mode="json"),
                "risk": risk.model_dump(mode="json"),
                "draft": draft.model_dump(mode="json") if draft else None,
                "evidence": [
                    f.model_dump() for f in facts if f.id in v.evidence_fact_ids
                ],
            }
        )
    return claims, stories


def _result(org, start, end, posts, claims, stories) -> dict:
    by_post = {c.post_id: c for c in claims}
    story_of = {
        pid: s["narrative"]["id"] for s in stories for pid in s["narrative"]["post_ids"]
    }
    return {
        "org": org,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "posts": [
            {
                **p.model_dump(mode="json"),
                "language": by_post[p.id].language if p.id in by_post else "en",
                "claim": by_post[p.id].claim or None if p.id in by_post else None,
                "narrative_id": story_of.get(p.id),
            }
            for p in posts
        ],
        "stories": stories,
    }


async def analyze_replay() -> dict:
    posts: list[Post] = await ReplaySource().fetch(ORG)
    facts = [VerifiedFact(**f) for f in json.loads((DATA / "facts.json").read_text())]
    now: datetime = max(p.posted_at for p in posts)
    claims, stories = await _analyze(posts, ORG, facts, now)
    start = min(p.posted_at for p in posts)
    result = _result(ORG, start, now, posts, claims, stories)
    CACHE.write_text(json.dumps(result, indent=1))
    return result


def _aware(t: datetime) -> datetime:
    return t if t.tzinfo else t.replace(tzinfo=UTC)


async def analyze_live(
    store: Store, since: datetime | None = None, until: datetime | None = None
) -> dict:
    """The same agents on the X posts we collected for the watched organizations.
    By default the last few days; pass `since` and `until` for a past period."""
    now = until or datetime.now(UTC)
    since = since or now - timedelta(hours=config.LIVE_WINDOW_HOURS)
    path = DATA / "facts_live.json"
    facts_by_org = json.loads(path.read_text()) if path.exists() else {}
    all_posts: list[Post] = []
    all_claims, all_stories = [], []
    for org in config.WATCH_ORGS:
        posts = [
            p
            for p in store.recent(5000)
            if p.org == org
            and p.platform == "x"
            and since <= _aware(p.posted_at) <= now
        ]
        for p in posts:
            p.posted_at = _aware(p.posted_at)
        if not posts:
            continue
        facts = [VerifiedFact(**f) for f in facts_by_org.get(org, [])]
        prefix = "live-" + org.lower().replace(" ", "-") + "-"
        claims, stories = await _analyze(posts, org, facts, now, prefix)
        all_posts += posts
        all_claims += claims
        all_stories += stories
    start = min((p.posted_at for p in all_posts), default=since)
    names = ", ".join(config.WATCH_ORGS)
    result = _result(names, start, now, all_posts, all_claims, all_stories)
    if until is None:  # only the current view is cached, not past periods
        LIVE_CACHE.write_text(json.dumps(result, indent=1))
    return result


def live_cached() -> dict | None:
    return json.loads(LIVE_CACHE.read_text()) if LIVE_CACHE.exists() else None


def cached() -> dict | None:
    return json.loads(CACHE.read_text()) if CACHE.exists() else None
