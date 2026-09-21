"""Opaque session tokens stored as SHA-256 hashes. Cookie flags documented here.

Schedule:
- Absolute/sliding lifetime: ``settings.session_ttl_seconds`` (default 7 days).
- GET /auth/me and POST /auth/refresh extend expiry by a full TTL when less
  than half the lifetime remains.
- POST /auth/signout revokes the server row and clears the cookie.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Response

from app.core.config import settings

COOKIE_NAME = settings.session_cookie_name


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiry(now: datetime | None = None) -> datetime:
    current = now or datetime.now(UTC)
    return current + timedelta(seconds=settings.session_ttl_seconds)


def should_refresh(expires_at: datetime, now: datetime | None = None) -> bool:
    current = now or datetime.now(UTC)
    remaining = (expires_at - current).total_seconds()
    return remaining < (settings.session_ttl_seconds / 2)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.is_deployed,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")
