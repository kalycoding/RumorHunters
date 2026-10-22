import json
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import auth, config, progress, watch
from app.collectors.x import collect_x
from app.pipeline import DATA, analyze_live, analyze_replay, cached, live_cached
from app.store import Store

store = Store()


app = FastAPI(title="Rumor Hunters", dependencies=[Depends(auth.require_login)])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3100", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Credentials(BaseModel):
    user: str
    password: str


@app.post("/login")
def login(c: Credentials) -> dict:
    if not auth.check_credentials(c.user, c.password):
        raise HTTPException(401, "Wrong username or password")
    return {"token": auth.make_token(c.user)}


@app.get("/health")
def health() -> dict:
    return {"ok": True, "watching": config.WATCH_ORGS}


@app.post("/replay/analyze")
async def replay_analyze() -> dict:
    """Run the agents on the seeded replay (a few minutes) and cache it."""
    return await analyze_replay()


@app.get("/replay")
def replay() -> dict:
    """The cached agent output for the replay, or 404 if the agents haven't run yet."""
    data = cached()
    if data is None:
        raise HTTPException(404, "Run POST /replay/analyze first")
    return data


@app.post("/live/refresh")
async def live_refresh() -> dict:
    """Collect from X, then run the agents on real posts."""
    if watch.lock.locked():
        raise HTTPException(409, "A live check is running. Try again in a moment.")
    progress.start()
    try:
        x = await collect_x(store)
        progress.found(x["new"])
        await watch.update_removed(store)
        result = await analyze_live(store)
    finally:
        progress.finish()
    result["collected"] = {"x_new": len(x["new"]), "x_error": x["error"]}
    return result


@app.get("/live")
def live() -> dict:
    """The last live analysis, or 404 if there hasn't been a refresh yet."""
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
    if watch.lock.locked():
        raise HTTPException(409, "A live check is running. Try again in a moment.")
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


class Watch(BaseModel):
    on: bool


@app.post("/live/watch")
async def live_watch(w: Watch) -> dict:
    """Turn live checks on or off."""
    if w.on:
        watch.start(store)
    else:
        watch.stop()
    return watch.status()


@app.get("/live/watch")
def live_watch_status() -> dict:
    return watch.status()
