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
DB_PATH = os.getenv("DB_PATH", "data/rumor_hunters.db")

# X (Twitter): read-only search, billed per post read.
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")
X_MAX_RESULTS = int(os.getenv("X_MAX_RESULTS", "20"))  # per organization, per refresh
X_BACKFILL_RESULTS = int(os.getenv("X_BACKFILL_RESULTS", "40"))  # per org, per period
X_USD_PER_POST = 0.005
LIVE_WINDOW_HOURS = int(os.getenv("LIVE_WINDOW_HOURS", "168"))

# "auto": Anthropic API, else OpenCode, else Claude Code.
LLM_BACKEND = os.getenv("LLM_BACKEND", "auto")
OPENCODE_API_KEY = os.getenv("OPENCODE_API_KEY", "")
OPENCODE_URL = "https://opencode.ai/inference/anthropic"
