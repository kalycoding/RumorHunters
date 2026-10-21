import asyncio
import json
from datetime import UTC, datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import config, progress
from app.models import Post
from app.agents.relevance import classify
from app.collectors.news import collect
from app.collectors.resolve import resolve_links
from app.collectors.x import collect_x
from app.pipeline import DATA
from app.store import Store

store = Store()


async def _loop() -> None:
    while True:
        try:
            await _screen(await collect(store))
        except Exception as e:  # one bad run must not stop the loop
            print("collect failed:", e)
        await asyncio.sleep(config.COLLECT_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_loop()) if config.COLLECT_AUTO else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Rumor Hunters", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3100", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "watching": config.WATCH_ORGS, "auto": config.COLLECT_AUTO}


@app.post("/collect/run")
async def run_now() -> dict:
    """Collect once, screen the new mentions, return only those."""
    result = await collect(store)
    return await _screen(result)


async def _screen(result: dict) -> dict:
    fresh = [Post(**p) for p in result["posts"]]
    for p in await classify(fresh):
        store.update(p)
    keep = [p for p in fresh if p.relevant]
    seen = {p.url for p in keep}
    keep += [
        p for p in store.unresolved() if p.url not in seen
    ]  # retry links that failed last time
    await resolve_links(keep)  # open only the mentions that matter
    for p in keep:
        store.update(p)
    result["posts"] = [p.model_dump(mode="json") for p in fresh]
    result["relevant"] = len(keep)
    result["links_resolved"] = sum(1 for p in keep if p.link)
    return result


@app.get("/posts")
def posts(limit: int = 100) -> list:
    return [p.model_dump(mode="json") for p in store.recent(limit)]


@app.post("/replay/analyze")
async def replay_analyze() -> dict:
    """Run the agents on the seeded replay (a few minutes) and cache it."""
    from app.pipeline import analyze_replay

    return await analyze_replay()


@app.get("/replay")
def replay() -> dict:
    """The cached agent output for the replay, or 404 if the agents haven't run yet."""
    from app.pipeline import cached

    data = cached()
    if data is None:
        raise HTTPException(404, "Run POST /replay/analyze first")
    return data


@app.get("/facts")
def facts() -> list:
    """The organization's verified facts. The fact-checker uses nothing else."""
    return json.loads((DATA / "facts.json").read_text())


@app.post("/live/refresh")
async def live_refresh() -> dict:
    """Collect from X, then run the agents on real posts."""
    from app.pipeline import analyze_live

    progress.start()
    try:
        x = await collect_x(store)
        progress.found(x["new"])
        result = await analyze_live(store)
    finally:
        progress.finish()
    result["collected"] = {"x_new": len(x["new"]), "x_error": x["error"]}
    return result


@app.get("/live")
def live() -> dict:
    """The last live analysis, or 404 if there hasn't been a refresh yet."""
    from app.pipeline import live_cached

    data = live_cached()
    if data is None:
        raise HTTPException(404, "Run POST /live/refresh first")
    return data


class Period(BaseModel):
    start: str  # YYYY-MM-DD
    end: str


def _period(p: Period) -> tuple[datetime, datetime]:
    try:
        start = datetime.fromisoformat(p.start).replace(tzinfo=UTC)
        end = datetime.fromisoformat(p.end).replace(tzinfo=UTC) + timedelta(days=1)
    except ValueError:
        raise HTTPException(400, "Dates must look like 2026-09-30") from None
    if end <= start or end - start > timedelta(days=92):
        raise HTTPException(400, "Pick a period of 1 to 92 days")
    return start, min(end, datetime.now(UTC))


@app.get("/live/estimate")
def live_estimate() -> dict:
    """What fetching one past period from X costs."""
    posts = len(config.WATCH_ORGS) * config.X_BACKFILL_RESULTS
    return {"posts": posts, "usd": round(posts * config.X_USD_PER_POST, 2)}


@app.post("/live/range")
async def live_range(p: Period) -> dict:
    """Fetch a past period from the X archive, then run the agents."""
    from app.pipeline import analyze_live

    start, end = _period(p)
    done_file = DATA / "backfilled.json"
    done = json.loads(done_file.read_text()) if done_file.exists() else []
    key = f"{p.start}|{p.end}"
    x = {"new": [], "error": None}
    progress.start()
    try:
        if key not in done:  # a period we already paid for isn't fetched twice
            x = await collect_x(store, start=start, end=end)
            progress.found(x["new"])
            if not x["error"]:
                done_file.write_text(json.dumps(done + [key]))
        result = await analyze_live(store, since=start, until=end)
    finally:
        progress.finish()
    result["collected"] = {"x_new": len(x["new"]), "x_error": x["error"]}
    return result


@app.get("/live/progress")
def live_progress(after: int = 0) -> dict:
    """The running refresh or fetch: its step, and the stories analysed so far."""
    return progress.snapshot(after)
