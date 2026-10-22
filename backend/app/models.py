from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Language = Literal["en", "pcm", "ha"]  # English, Pidgin, Hausa
Platform = Literal["x", "facebook", "instagram", "telegram", "reddit", "news", "blog"]
Verdict = Literal["true", "false", "misleading", "unverified", "not_checked"]


class Post(BaseModel):
    """A public post. Public data only, no private messages."""

    id: str
    platform: Platform
    author: str
    text: str
    posted_at: datetime
    url: str | None = None  # where the post lives; shown to the user as evidence
    org: str | None = None  # which watched organization it mentions
    likes: int = 0
    reposts: int = 0
    replies: int = 0


class ExtractedClaim(BaseModel):
    post_id: str
    language: Language
    target_org: str | None
    claim: str  # one English sentence
    sentiment: Literal["negative", "neutral", "positive"]
    calls_for_action: bool  # e.g. "withdraw your money"
    relevant: bool  # false for noise


class Narrative(BaseModel):
    id: str
    title: str = ""
    claim: str
    calls_for_action: bool = False
    post_ids: list[str]
    platforms: list[Platform]
    first_seen_at: datetime
    posts_per_hour: int = 0  # accounts per hour when `by_author`
    by_author: bool = False
    growth_rate: float = 1.0
    weighted_reach: float = 0.0
    is_spike: bool = False
    spike_at: datetime | None = None  # first time it counted as a spike


class VerifiedFact(BaseModel):
    id: str
    title: str
    text: str
    source: str


class Verification(BaseModel):
    narrative_id: str
    verdict: Verdict
    reasoning: str
    evidence_fact_ids: list[str]


class RiskScore(BaseModel):
    narrative_id: str
    score: int
    level: Literal["low", "medium", "high", "critical"]
    drivers: list[str]


class DraftResponse(BaseModel):
    """Always pending. A human approves before anything is sent."""

    narrative_id: str
    statement: str
    social_reply: str
    customer_sms: str
    status: Literal["pending_approval", "approved", "rejected"] = "pending_approval"
