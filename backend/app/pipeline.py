"""Runs the three agents over the seeded replay data and caches the result."""

import json
from datetime import datetime
from pathlib import Path

from app.agents.factchecker import verify_narrative
from app.agents.responder import draft_response, score_risk
from app.agents.watcher import extract_claims, group_into_narratives
from app.models import Post, VerifiedFact
from app.sources.replay import ReplaySource

DATA = Path(__file__).resolve().parents[1] / "data"
CACHE = DATA / "replay_analysis.json"
ORG = "Demo Bank"


CLAIMS = DATA / "claims_cache.json"


async def _claims(posts: list[Post]):
    """Extraction is the slow step. Cache it by post id and text."""
    from app.models import ExtractedClaim

    cache = json.loads(CLAIMS.read_text()) if CLAIMS.exists() else {}
    key = lambda p: f"{p.id}|{p.text}"  # noqa: E731
    todo = [p for p in posts if key(p) not in cache]
    for c in await extract_claims(todo, ORG) if todo else []:
        post = next(p for p in todo if p.id == c.post_id)
        cache[key(post)] = c.model_dump(mode="json")
    CLAIMS.write_text(json.dumps(cache))
    return [ExtractedClaim(**cache[key(p)]) for p in posts if key(p) in cache]


async def analyze_replay() -> dict:
    posts: list[Post] = await ReplaySource().fetch(ORG)
    facts = [VerifiedFact(**f) for f in json.loads((DATA / "facts.json").read_text())]
    now: datetime = max(p.posted_at for p in posts)

    claims = await _claims(posts)
    narratives = await group_into_narratives(posts, claims, now)
    out_stories = []
    for n in narratives:
        v = await verify_narrative(n, facts)
        risk = score_risk(n, v)
        draft = (
            await draft_response(n, v, facts)
            if (v.verdict != "true" and risk.level in ("high", "critical"))
            else None
        )
        out_stories.append(
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
    by_post = {c.post_id: c for c in claims}
    story_of = {
        pid: s["narrative"]["id"]
        for s in out_stories
        for pid in s["narrative"]["post_ids"]
    }
    result = {
        "org": ORG,
        "start": min(p.posted_at for p in posts).isoformat(),
        "end": now.isoformat(),
        "posts": [
            {
                **p.model_dump(mode="json"),
                "language": by_post[p.id].language if p.id in by_post else "en",
                "claim": by_post[p.id].claim or None if p.id in by_post else None,
                "narrative_id": story_of.get(p.id),
            }
            for p in posts
        ],
        "stories": out_stories,
    }
    CACHE.write_text(json.dumps(result, indent=1))
    return result


def cached() -> dict | None:
    return json.loads(CACHE.read_text()) if CACHE.exists() else None
