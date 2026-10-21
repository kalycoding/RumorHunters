"""Where the current live run is up to, and the stories it has analysed so far,
so the page can show them popping in."""

STAGES = ["Searching X", "Reading posts", "Grouping stories", "Checking facts"]

state: dict = {"running": False, "stage": "", "posts": 0, "stories": []}


def start() -> None:
    state.update(running=True, stage=STAGES[0], posts=0, stories=[])


def at(stage: str) -> None:
    state["stage"] = stage


def found(posts: list) -> None:
    state["posts"] += len(posts)


def story(card: dict) -> None:
    state["stories"].append(card)


def finish() -> None:
    state.update(running=False, stage="")


def snapshot(after: int = 0) -> dict:
    """`after` is how many stories the page already has."""
    return {
        "running": state["running"],
        "stage": state["stage"],
        "posts": state["posts"],
        "total": len(state["stories"]),
        "stories": state["stories"][after:],
    }
