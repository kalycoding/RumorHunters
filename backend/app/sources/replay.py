import json
from pathlib import Path

from app.models import Post

DATA = Path(__file__).resolve().parents[2] / "data" / "posts.json"


class ReplaySource:
    """Plays a saved dataset back as if it were live. The demo's safety net."""

    def __init__(self, path: Path = DATA):
        self.posts = [Post(**p) for p in json.loads(path.read_text())]

    def fetch(self) -> list[Post]:
        return sorted(self.posts, key=lambda p: p.posted_at)
