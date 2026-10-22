"""One place every agent calls a model. Two ways in, same interface:

- anthropic: the Anthropic API (needs ANTHROPIC_API_KEY).
- opencode: the same Claude models through OpenCode (OPENCODE_API_KEY).
Switch with LLM_BACKEND=anthropic|opencode|auto.
"""

import json
import re
from typing import Any

import httpx
from anthropic import AsyncAnthropic, DefaultAsyncHttpxClient

from app import config

# fast = cheap, high-volume checks. smart = reading and reasoning.
MODELS = {"fast": "claude-haiku-5-5", "smart": config.MODEL}
# Seconds to wait for a reply. A stalled call is dropped and retried, not waited on.
TIMEOUTS = {"fast": 6, "smart": 20}
_client: AsyncAnthropic | None = None  # made once, so calls reuse the connection


def backend() -> str:
    if config.LLM_BACKEND != "auto":
        return config.LLM_BACKEND
    if config.ANTHROPIC_API_KEY:
        return "anthropic"
    if config.OPENCODE_API_KEY:
        return "opencode"
    raise RuntimeError("No model key. Set ANTHROPIC_API_KEY in backend/.env")


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        # Keep the connection open between reads. The default closes it after
        # a few idle seconds, and opening a new one costs about a second a call.
        http = DefaultAsyncHttpxClient(limits=httpx.Limits(keepalive_expiry=120))
        if backend() == "opencode":  # same Claude models, billed through OpenCode
            _client = AsyncAnthropic(
                base_url=config.OPENCODE_URL,
                auth_token=config.OPENCODE_API_KEY,
                http_client=http,
            )
        else:
            _client = AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, http_client=http)
    return _client


def parse_json_text(text: str) -> Any:
    """Pull the first JSON value out of a reply that may have code fences or extra
    words before or after it."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    start = re.search(r"[\[{]", text)
    if not start:
        raise ValueError(f"No JSON in model reply: {text[:120]!r}")
    value, _ = json.JSONDecoder().raw_decode(text, start.start())
    return value


async def _ask(system: str, prompt: str, tier: str) -> str:
    msg = await _get_client().messages.create(
        model=MODELS[tier],
        timeout=TIMEOUTS[tier],
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")


async def complete_json(system: str, prompt: str, tier: str = "fast") -> Any:
    """Ask the model and return parsed JSON."""
    text = await _ask(system + "\nReply with JSON only, no other text.", prompt, tier)
    return parse_json_text(text)


async def complete_list(system: str, prompt: str, tier: str = "fast") -> list[dict]:
    """Like complete_json, but always a list of objects. The model sometimes wraps
    the list ({"stories": [...]}) or sends one object, so unwrap or wrap it."""
    data = await complete_json(system, prompt, tier)
    if isinstance(data, dict):
        inner = [
            v
            for v in data.values()
            if isinstance(v, list) and v and all(isinstance(x, dict) for x in v)
        ]
        data = inner[0] if inner else [data]
    return [row for row in data if isinstance(row, dict)]
