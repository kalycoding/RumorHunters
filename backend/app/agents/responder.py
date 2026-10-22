"""Agent 3: Responder. Scores the risk, then drafts a reply from verified facts.
Drafts are always pending: a person approves before anything is sent."""

from app import llm, prompts
from app.models import DraftResponse, Narrative, RiskScore, VerifiedFact, Verification


def level_for(score: int) -> str:
    if score >= 70:
        return "critical"
    if score >= 45:
        return "high"
    if score >= 20:
        return "medium"
    return "low"


def score_risk(n: Narrative, v: Verification) -> RiskScore:
    """Plain arithmetic, no model: reach, speed, growth, urgency and verdict."""
    drivers: list[str] = []
    score = 0
    if n.weighted_reach >= 500:
        score += 25
        drivers.append("wide reach")
    elif n.weighted_reach >= 150:
        score += 12
        drivers.append("growing reach")
    if n.posts_per_hour >= 10:
        score += 25
        unit = "accounts" if n.by_author else "posts"
        drivers.append(f"{n.posts_per_hour} {unit} in the last hour")
    elif n.posts_per_hour >= 4:
        score += 10
    if n.growth_rate >= 2:
        score += 20
        drivers.append(f"{n.growth_rate:.1f}x growth")
    if n.calls_for_action:
        score += 20
        drivers.append("urges people to act")
    if v.verdict == "false":
        score += 10
        drivers.append("contradicted by verified facts")
    level = level_for(score)
    return RiskScore(
        narrative_id=n.id, score=min(score, 100), level=level, drivers=drivers
    )


async def draft_response(
    n: Narrative, v: Verification, facts: list[VerifiedFact]
) -> DraftResponse:
    used = [f for f in facts if f.id in v.evidence_fact_ids]
    listing = "\n".join(f"[{f.id}] {f.text}" for f in used)
    ask = f"Claim: {n.claim}\nVerdict: {v.verdict}\nVerified facts:\n{listing}"
    row = await llm.complete_json(prompts.DRAFT, ask, tier="smart")
    return DraftResponse(
        narrative_id=n.id,
        statement=row.get("statement", ""),
        social_reply=row.get("social_reply", ""),
        customer_sms=row.get("customer_sms", ""),
    )
