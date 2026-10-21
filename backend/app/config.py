import os

from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")

WATCH_ORGS = [
    o.strip()
    for o in os.getenv("WATCH_ORGS", "Zenith Bank,OPay").split(",")
    if o.strip()
]
COLLECT_INTERVAL_SECONDS = int(os.getenv("COLLECT_INTERVAL_SECONDS", "300"))
COLLECT_AUTO = (
    os.getenv("COLLECT_AUTO", "0") == "1"
)  # off by default; the demo can press "run now"
DB_PATH = os.getenv("DB_PATH", "data/rumor_hunters.db")
USER_AGENT = "Mozilla/5.0 (compatible; RumorHuntersResearch/0.1; hackathon demo)"

# "auto": Anthropic API, else OpenCode, else Claude Code.
LLM_BACKEND = os.getenv("LLM_BACKEND", "auto")
OPENCODE_API_KEY = os.getenv("OPENCODE_API_KEY", "")
OPENCODE_URL = "https://opencode.ai/inference/anthropic"
