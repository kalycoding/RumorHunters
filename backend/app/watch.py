"""Live checks: look for new X posts every few seconds and report only what's new."""

import asyncio
import time
from datetime import UTC, datetime

from app import config
from app.collectors.x import collect_x
from app.pipeline import analyze_live
from app.store import Store

lock = asyncio.Lock()  # one check or refresh at a time
state: dict = {
    "on": False,
    "interval": config.WATCH_INTERVAL_SECONDS,
    "last_check": None,
    "checks": 0,
    "new_posts": 0,
    "reads": 0,
    "version": 0,  # goes up each time the stories change
    "analysing": False,
    "error": None,
}
_task: asyncio.Task | None = None


def newest_ids(store: Store) -> dict[str, str]:
    """The newest X post we hold per organization. Checks only ask for later ones."""
    ids: dict[str, str] = {}
    for p in store.recent(5000):
        if p.platform == "x" and p.org:
            ids[p.org] = max(ids.get(p.org, "0"), p.id, key=int)
    return ids


def _over_budget() -> bool:
    """True when one more check, if it returned its most, would pass the budget."""
    worst = len(config.WATCH_ORGS) * config.X_WATCH_RESULTS * config.X_USD_PER_POST
    spent = state["reads"] * config.X_USD_PER_POST
    return spent + worst > config.WATCH_BUDGET_USD


async def _check(store: Store) -> bool:
    if _over_budget():
        state["error"] = f"Budget of ${config.WATCH_BUDGET_USD:.2f} reached"
        return False
    async with lock:
        x = await collect_x(store, since_ids=newest_ids(store))
        state["checks"] += 1
        state["last_check"] = datetime.now(UTC).isoformat()
        if x["error"]:
            state["error"] = x["error"]
            return False
        n = len(x["new"])
        state["reads"] += n
        state["new_posts"] += n
        if n:
            state["analysing"] = True
            try:
                await analyze_live(store)
            finally:
                state["analysing"] = False
            state["version"] += 1
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
    state.update(on=True, error=None, checks=0, new_posts=0, reads=0)
    _task = asyncio.create_task(_loop(store))


def stop() -> None:
    state["on"] = False
    if _task:
        _task.cancel()
    state["analysing"] = False


def status() -> dict:
    usd = round(state["reads"] * config.X_USD_PER_POST, 3)
    return {**state, "usd": usd, "budget": config.WATCH_BUDGET_USD}
