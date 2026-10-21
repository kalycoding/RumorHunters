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
            lang = (
                row.get("language")
                if row.get("language") in ("en", "pcm", "ha")
                else "en"
            )
            out.append(
                ExtractedClaim(
                    post_id=chunk[i].id,
                    language=lang,
                    target_org=org if row.get("relevant") else None,
                    claim=(row.get("claim") or "") if row.get("relevant") else "",
                    sentiment=row.get("sentiment")
                    if row.get("sentiment") in ("negative", "neutral", "positive")
                    else "neutral",
                    calls_for_action=bool(row.get("calls_for_action")),
                    relevant=bool(row.get("relevant")),
                )
            )
    return out


async def group_into_narratives(
    posts: list[Post], claims: list[ExtractedClaim], now: datetime
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
        spike_at = None
        t = min(p.posted_at for p in grp_posts)
        while t <= now:  # first moment the story counts as a spike
            if compute_spread(grp_posts, t)["is_spike"]:
                spike_at = t
                break
            t += timedelta(minutes=2)
        spread = compute_spread(grp_posts, now)
        # Judge the story by its peak, not by the quiet tail of the stream.
        peak_pph, peak_growth, t = 0, 1.0, min(p.posted_at for p in grp_posts)
        while t <= now:
            sp = compute_spread(grp_posts, t)
            peak_pph = max(peak_pph, sp["posts_per_hour"])
            if sp["posts_per_hour"] >= 3:
                peak_growth = max(peak_growth, sp["growth_rate"])
            t += timedelta(minutes=2)
        narratives.append(
            Narrative(
                id=f"n{gi + 1}",
                title=g.get("title", ""),
                claim=g.get("claim", ""),
                calls_for_action=any(c.calls_for_action for c in members),
                post_ids=[p.id for p in grp_posts],
                platforms=sorted({p.platform for p in grp_posts}),
                first_seen_at=spread["first_seen_at"],
                posts_per_hour=peak_pph,
                growth_rate=peak_growth,
                weighted_reach=spread["weighted_reach"],
                is_spike=spike_at is not None,
                spike_at=spike_at,
            )
        )
    return narratives
