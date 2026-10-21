import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.agents.relevance import classify
from app.collectors.news import collect
from app.collectors.resolve import resolve_links
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
    from app.models import Post

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

    from fastapi import HTTPException

    data = cached()
    if data is None:
        raise HTTPException(404, "Run POST /replay/analyze first")
    return data
