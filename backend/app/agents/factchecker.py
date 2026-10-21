"""Agent 2: Fact-checker. Compares a story with the organization's verified facts ONLY.
No matching fact means "unverified". It never guesses."""

from app import llm, prompts
from app.models import Narrative, VerifiedFact, Verification


async def verify_narrative(n: Narrative, facts: list[VerifiedFact]) -> Verification:
    if not facts:  # nothing to check against: say so, don't ask the model
        return Verification(
            narrative_id=n.id,
            verdict="unverified",
            reasoning="No verified facts are on file for this organization yet.",
            evidence_fact_ids=[],
        )
    listing = "\n".join(
        f"[{f.id}] {f.title}: {f.text} (source: {f.source})" for f in facts
    )
    row = await llm.complete_json(
        prompts.FACTCHECK,
        f"Verified facts:\n{listing}\n\nClaim: {n.claim}",
        tier="smart",
    )
    known = {f.id for f in facts}
    ids = [i for i in row.get("evidence_fact_ids", []) if i in known]
    verdict = (
        row.get("verdict")
        if row.get("verdict") in ("true", "false", "misleading", "unverified")
        else "unverified"
    )
    if not ids:  # a verdict needs a cited fact, otherwise it is unverified
        verdict = "unverified"
    return Verification(
        narrative_id=n.id,
        verdict=verdict,
        reasoning=row.get("reasoning", ""),
        evidence_fact_ids=ids,
    )
