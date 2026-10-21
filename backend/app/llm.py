"""One place every agent calls a model. Three backends, same interface:

- anthropic: the Anthropic API (needs ANTHROPIC_API_KEY).
- opencode: the same Claude models through OpenCode (OPENCODE_API_KEY).
- claude_code: `claude -p` on a Claude subscription, trimmed to ~600 tokens
  (no tools, no skills, no settings). Used when there is no API key.
Switch with LLM_BACKEND=anthropic|opencode|claude_code|auto.
"""

import asyncio
import json
import re
from typing import Any

from app import config

# fast = cheap, high-volume checks. smart = reading and reasoning.
ANTHROPIC_MODELS = {"fast": "claude-haiku-5-5", "smart": config.MODEL}
CLI_MODELS = {"fast": "haiku", "smart": "sonnet"}
_slots = asyncio.Semaphore(2)  # don't launch many CLI processes at once


def backend() -> str:
    if config.LLM_BACKEND != "auto":
        return config.LLM_BACKEND
    if config.ANTHROPIC_API_KEY:
        return "anthropic"
    return "opencode" if config.OPENCODE_API_KEY else "claude_code"


def parse_json_text(text: str) -> Any:
    """Pull JSON out of a reply that may have code fences or extra words."""
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"(\[.*\]|\{.*\})", text, re.S)
        if not match:
            raise ValueError(f"No JSON in model reply: {text[:120]!r}") from None
        return json.loads(match.group(1))


async def _claude_code(system: str, prompt: str, tier: str) -> str:
    async with _slots:
        proc = await asyncio.create_subprocess_exec(
            "claude",
            "-p",
            prompt,
            "--output-format",
            "json",
            "--tools",
            "",
            "--no-session-persistence",
            "--model",
            CLI_MODELS[tier],
            "--system-prompt",
            system,
            "--disable-slash-commands",
            "--setting-sources",
            "",
            "--strict-mcp-config",
            cwd="/tmp",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=180)
    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI failed: {err.decode()[:200]}")
    return json.loads(out.decode())["result"]


async def _anthropic(system: str, prompt: str, tier: str) -> str:
    from anthropic import AsyncAnthropic

    if backend() == "opencode":  # same Claude models, billed through OpenCode
        client = AsyncAnthropic(
            base_url=config.OPENCODE_URL, auth_token=config.OPENCODE_API_KEY
        )
    else:
        client = AsyncAnthropic()
    msg = await client.messages.create(
        model=ANTHROPIC_MODELS[tier],
        max_tokens=4096,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")


async def complete_json(system: str, prompt: str, tier: str = "fast") -> Any:
    """Ask the model and return parsed JSON."""
    text = await (_claude_code if backend() == "claude_code" else _anthropic)(
        system + "\nReply with JSON only, no other text.", prompt, tier
    )
    return parse_json_text(text)
