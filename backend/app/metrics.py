from datetime import datetime, timedelta

from app.models import Post

HOUR = timedelta(hours=1)


def reach_of(p: Post) -> float:
    return 1 + p.likes + 2 * p.reposts + 1.5 * p.replies


def compute_spread(posts: list[Post], now: datetime) -> dict:
    """Latest-hour posts, growth on the hour before, reach, spike flag."""
    seen = [p for p in posts if p.posted_at <= now]
    latest = sum(1 for p in seen if p.posted_at > now - HOUR)
    before = sum(1 for p in seen if now - 2 * HOUR < p.posted_at <= now - HOUR)
    growth = latest / max(before, 1)
    return {
        "posts_per_hour": latest,
        "growth_rate": growth,
        "weighted_reach": sum(reach_of(p) for p in seen),
        "is_spike": latest >= 5 and growth >= 2,
        "first_seen_at": min((p.posted_at for p in seen), default=now),
    }
