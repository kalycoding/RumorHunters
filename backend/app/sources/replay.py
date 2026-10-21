import json
from datetime import datetime
from pathlib import Path

from app.models import Post

DATA = Path(__file__).resolve().parents[2] / "data" / "posts.json"


class ReplaySource:
    """Plays a saved dataset back as if it were live. The demo's safety net."""

    name = "replay"

    def __init__(self, path: Path = DATA):
        self.posts = [Post(**p) for p in json.loads(path.read_text())]

    async def fetch(self, org: str, until: datetime | None = None) -> list[Post]:
        posts = [p for p in self.posts if until is None or p.posted_at <= until]
        return sorted(posts, key=lambda p: p.posted_at)
