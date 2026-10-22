"""Live checks: look for new X posts every few seconds and report only what's new.
Looking and reading are separate, so a slow read never makes a check wait."""

import asyncio
import time
from datetime import UTC, datetime, timedelta

from app import config
from app.collectors.x import collect_x, find_removed
from app.pipeline import analyze_live
from app.store import Store

lock = asyncio.Lock()  # one read of the posts at a time
state: dict = {
    "on": False,
    "interval": config.WATCH_INTERVAL_SECONDS,
    "last_check": None,
    "checks": 0,
    "new_posts": 0,
    "reads": 0,
    "version": 0,  # goes up each time the stories change
    "analysing": False,
    "incoming": [],  # posts found but not read yet, so the page can show them at once
    "error": None,
}
REMOVED_EVERY = 60  # checks between looks for removed posts (about 5 minutes)
_task: asyncio.Task | None = None  # looks for new posts
_reader: asyncio.Task | None = None  # reads them with the agents
_more = False  # new posts came in while the agents were reading


def newest_ids(store: Store) -> dict[str, str]:
    """The newest X post we hold per organization. Checks only ask for later ones."""
    ids: dict[str, str] = {}
    for p in store.recent(5000):
        if p.platform == "x" and p.org:
            ids[p.org] = max(ids.get(p.org, "0"), p.id, key=int)
    return ids


async def update_removed(store: Store) -> bool:
    """Flag posts in the live window that are no longer on X. True if any are new."""
    since = datetime.now(UTC) - timedelta(minutes=config.LIVE_WINDOW_MINUTES)
    ids = [
        p.id
        for p in store.recent(5000)
        if p.platform == "x" and not p.deleted and p.posted_at >= since
    ]
    gone: set[str] = set()
    for i in range(0, len(ids), 100):  # X checks up to 100 posts per call
        gone |= await find_removed(ids[i : i + 100])
    return store.mark_removed(gone) > 0


def _over_budget() -> bool:
    """True when one more check, if it returned its most, would pass the budget."""
    worst = len(config.WATCH_ORGS) * config.X_WATCH_RESULTS * config.X_USD_PER_POST
    spent = state["reads"] * config.X_USD_PER_POST
    return spent + worst > config.WATCH_BUDGET_USD


async def _read(store: Store) -> None:
    """Run the agents on what the checks found. Posts that arrive meanwhile
    are read in the next round."""
    global _more
    state["analysing"] = True
    try:
        while True:
            _more = False
            reading = {p["id"] for p in state["incoming"]}
            async with lock:
                await analyze_live(store)
            state["incoming"] = [p for p in state["incoming"] if p["id"] not in reading]
            state["version"] += 1
            if not _more:
                break
    except Exception as e:  # a failed read must not leave the switch on
        state.update(error=str(e)[:100], on=False)
    finally:
        state["analysing"] = False


def _ask_to_read(store: Store) -> None:
    global _reader, _more
    _more = True
    if _reader is None or _reader.done():
        _reader = asyncio.create_task(_read(store))


async def _check(store: Store) -> bool:
    if _over_budget():
        state["error"] = f"Budget of ${config.WATCH_BUDGET_USD:.2f} reached"
        return False
    x = await collect_x(store, since_ids=newest_ids(store))
    state["checks"] += 1
    state["last_check"] = datetime.now(UTC).isoformat()
    if x["error"]:
        state["error"] = x["error"]
        return False
    n = len(x["new"])
    state["reads"] += n
    state["new_posts"] += n
    state["incoming"] += [
        {"id": p.id, "author": p.author, "text": p.text, "platform": p.platform}
        for p in x["new"]
    ]
    removed = state["checks"] % REMOVED_EVERY == 0 and await update_removed(store)
    if n or removed:
        _ask_to_read(store)
    return True


async def _loop(store: Store) -> None:
    stop_at = time.time() + config.WATCH_MAX_HOURS * 3600
    while state["on"]:
        started = time.time()
        try:
            if not await _check(store):
                break
        except Exception as e:  # a bad check must not leave the switch on
            state["error"] = str(e)[:100]
            break
        if time.time() > stop_at:
            state["error"] = f"Stopped after {config.WATCH_MAX_HOURS} hours"
            break
        await asyncio.sleep(max(0, state["interval"] - (time.time() - started)))
    state["on"] = False


def start(store: Store) -> None:
    global _task
    if state["on"]:
        return
    state.update(on=True, error=None, checks=0, new_posts=0, reads=0, incoming=[])
    _task = asyncio.create_task(_loop(store))


def stop() -> None:
    state["on"] = False
    for task in (_task, _reader):
        if task:
            task.cancel()
    state.update(analysing=False, incoming=[])


def status() -> dict:
    usd = round(state["reads"] * config.X_USD_PER_POST, 3)
    return {**state, "usd": usd, "budget": config.WATCH_BUDGET_USD}
