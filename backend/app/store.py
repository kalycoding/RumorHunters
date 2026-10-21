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

    def seen(self, url: str) -> bool:
        return (
            self.db.execute("SELECT 1 FROM posts WHERE url = ?", (url,)).fetchone()
            is not None
        )

    def add(self, post: Post) -> bool:
        """Save a post. Returns False if its URL was already stored."""
        if not post.url or self.seen(post.url):
            return False
        self.db.execute(
            "INSERT INTO posts VALUES (?, ?, ?, ?)",
            (post.url, post.org, post.posted_at.isoformat(), post.model_dump_json()),
        )
        self.db.commit()
        return True

    def recent(self, limit: int = 100) -> list[Post]:
        rows = self.db.execute(
            "SELECT body FROM posts ORDER BY posted_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [Post.model_validate_json(r[0]) for r in rows]

    def update(self, post: Post) -> None:
        self.db.execute(
            "UPDATE posts SET body = ? WHERE url = ?",
            (post.model_dump_json(), post.url),
        )
        self.db.commit()

    def unresolved(self, limit: int = 20) -> list[Post]:
        """Relevant mentions still pointing at a Google redirect, newest first."""
        rows = self.db.execute(
            "SELECT body FROM posts WHERE json_extract(body, '$.relevant') = 1 "
            "AND json_extract(body, '$.link') IS NULL ORDER BY posted_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [Post.model_validate_json(r[0]) for r in rows]
