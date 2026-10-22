import sqlite3
from pathlib import Path

from app import config
from app.models import Post


class Store:
    """Remembers every post we've collected, so a repeat run skips what it has seen."""

    def __init__(self, path: str | None = None):
        self.path = path or config.DB_PATH
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS posts "
            "(url TEXT PRIMARY KEY, org TEXT, posted_at TEXT, body TEXT)"
        )

    def add(self, post: Post) -> bool:
        """Save a post. Returns False if its URL was already stored."""
        if not post.url:
            return False
        saved = self.db.execute(
            "INSERT OR IGNORE INTO posts VALUES (?, ?, ?, ?)",
            (post.url, post.org, post.posted_at.isoformat(), post.model_dump_json()),
        )
        self.db.commit()
        return saved.rowcount > 0

    def mark_removed(self, ids: set[str]) -> int:
        """Flag posts that are no longer on X. Returns how many are newly flagged."""
        flagged = 0
        for post in self.recent(5000):
            if post.id in ids and not post.deleted:
                post.deleted = True
                self.db.execute(
                    "UPDATE posts SET body = ? WHERE url = ?",
                    (post.model_dump_json(), post.url),
                )
                flagged += 1
        self.db.commit()
        return flagged

    def recent(self, limit: int = 100) -> list[Post]:
        rows = self.db.execute(
            "SELECT body FROM posts ORDER BY posted_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [Post.model_validate_json(r[0]) for r in rows]
