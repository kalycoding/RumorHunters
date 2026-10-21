"""First pass on collected mentions: is this article really about the organization?

Google News matches a name anywhere (song lyrics, school sports).
This keeps the mentions that matter.
One model call per batch of headlines, on the cheap tier.
"""

from app import llm, prompts
from app.models import Post

BATCH = 25


async def classify(posts: list[Post]) -> list[Post]:
    """Set `relevant`. Posts stay unchecked if the call fails."""
    for start in range(0, len(posts), BATCH):
        chunk = posts[start : start + BATCH]
        lines = "\n".join(f"{i}. [{p.org}] {p.text[:240]}" for i, p in enumerate(chunk))
        try:
            rows = await llm.complete_json(prompts.RELEVANCE, lines, tier="fast")
        except Exception as e:
            print("relevance check failed:", e)
            continue
        for row in rows:
            i = row.get("i")
            if isinstance(i, int) and 0 <= i < len(chunk):
                chunk[i].relevant = bool(row.get("relevant"))
    return posts
