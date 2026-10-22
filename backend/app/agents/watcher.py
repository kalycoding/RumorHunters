"""Agent 1: Watcher. Reads posts (English, Pidgin, Hausa), extracts what each claims,
then groups posts that tell the same story and measures how fast each one spreads."""

from datetime import datetime, timedelta

from app import llm, prompts
from app.metrics import compute_spread
from app.models import ExtractedClaim, Narrative, Post

BATCH = 25


async def extract_claims(posts: list[Post], org: str) -> list[ExtractedClaim]:
    out: list[ExtractedClaim] = []
    for start in range(0, len(posts), BATCH):
        chunk = posts[start : start + BATCH]
        lines = "\n".join(f"{i}. {p.text}" for i, p in enumerate(chunk))
        rows = await llm.complete_json(
            f"{prompts.EXTRACT}\nOrganization: {org}.", lines, tier="fast"
        )
        for row in rows:
            i = row.get("i")
            if not (isinstance(i, int) and 0 <= i < len(chunk)):
                continue
            ok = bool(row.get("relevant"))
            lang, mood = row.get("language"), row.get("sentiment")
            out.append(
                ExtractedClaim(
                    post_id=chunk[i].id,
                    language=lang if lang in ("en", "pcm", "ha") else "en",
                    target_org=org if ok else None,
                    claim=(row.get("claim") or "") if ok else "",
                    sentiment=mood
                    if mood in ("negative", "neutral", "positive")
                    else "neutral",
                    calls_for_action=bool(row.get("calls_for_action")),
                    relevant=ok,
                )
            )
    return out


ACTION_ACCOUNTS = 3  # real posts: this many accounts must urge action


def urges(
    members: list[ExtractedClaim], by_id: dict[str, Post], by_author: bool
) -> bool:
    """Does the story urge people to act? One person asking for help doesn't count
    for real posts. It takes several accounts."""
    callers = [c for c in members if c.calls_for_action]
    if not by_author:
        return bool(callers)
    accounts = {by_id[c.post_id].author for c in callers if c.post_id in by_id}
    return len(accounts) >= ACTION_ACCOUNTS


async def group_into_narratives(
    posts: list[Post],
    claims: list[ExtractedClaim],
    now: datetime,
    by_author: bool = False,  # real posts: count accounts, not repeat posts
) -> list[Narrative]:
    by_id = {p.id: p for p in posts}
    relevant = [c for c in claims if c.relevant and c.claim]
    distinct = sorted({c.claim for c in relevant})
    if not distinct:
        return []
    listing = "\n".join(f"{i}. {t}" for i, t in enumerate(distinct))
    groups = await llm.complete_json(prompts.GROUP, listing, tier="fast")
    claim_group: dict[str, int] = {}
    for gi, g in enumerate(groups):
        for m in g.get("members", []):
            if isinstance(m, int) and 0 <= m < len(distinct):
                claim_group[distinct[m]] = gi
    narratives: list[Narrative] = []
    for gi, g in enumerate(groups):
        members = [c for c in relevant if claim_group.get(c.claim) == gi]
        if not members:
            continue
        grp_posts = [by_id[c.post_id] for c in members if c.post_id in by_id]
        # Walk the story's life: when it first spiked, and its peak. A story is
        # judged by its peak, not by the quiet tail of the stream.
        spike_at, peak_pph, peak_growth = None, 0, 1.0
        t = min(p.posted_at for p in grp_posts)
        while t <= now:
            sp = compute_spread(grp_posts, t, by_author)
            if sp["is_spike"] and not spike_at:
                spike_at = t
            peak_pph = max(peak_pph, sp["posts_per_hour"])
            if sp["posts_per_hour"] >= 3:
                peak_growth = max(peak_growth, sp["growth_rate"])
            t += timedelta(minutes=2)
        spread = compute_spread(grp_posts, now, by_author)
        narratives.append(
            Narrative(
                id=f"n{gi + 1}",
                title=g.get("title", ""),
                claim=g.get("claim", ""),
                calls_for_action=urges(members, by_id, by_author),
                post_ids=[p.id for p in grp_posts],
                platforms=sorted({p.platform for p in grp_posts}),
                first_seen_at=spread["first_seen_at"],
                posts_per_hour=peak_pph,
                by_author=by_author,
                growth_rate=peak_growth,
                weighted_reach=spread["weighted_reach"],
                is_spike=spike_at is not None,
                spike_at=spike_at,
            )
        )
    return narratives
