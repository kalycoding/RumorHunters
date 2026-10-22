"""A small login for the demo: one user from .env, signed tokens that expire."""

import hashlib
import hmac
import secrets
import time

from fastapi import HTTPException, Request

from app import config

SECRET = (
    config.AUTH_SECRET or secrets.token_hex(16)
).encode()  # new each start if unset
OPEN_PATHS = {"/login", "/health"}
HOURS = 8


def _sign(body: str) -> str:
    return hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()


def check_credentials(user: str, password: str) -> bool:
    ok_user = hmac.compare_digest(user.encode(), config.AUTH_USER.encode())
    ok_pass = hmac.compare_digest(password.encode(), config.AUTH_PASSWORD.encode())
    return bool(config.AUTH_PASSWORD) and ok_user and ok_pass


def make_token(user: str) -> str:
    body = f"{user}|{int(time.time()) + HOURS * 3600}"
    return f"{body}|{_sign(body)}"


def require_login(request: Request) -> None:
    """A dependency for every route except login and the health check."""
    if request.url.path in OPEN_PATHS:
        return
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    body, _, sig = token.rpartition("|")
    expires = body.rpartition("|")[2]
    valid = hmac.compare_digest(sig.encode(), _sign(body).encode())
    if not (sig and valid and expires.isdigit()):
        raise HTTPException(401, "Log in first")
    if int(expires) < time.time():
        raise HTTPException(401, "Session expired")
