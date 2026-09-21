"""Guards for internal job endpoints and test-only endpoints."""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from app.core.config import settings


def job_token_valid(token: str | None) -> bool:
    expected = settings.job_token
    if not expected:
        # No token configured: only local development with dev endpoints switched on.
        return settings.dev_endpoints_enabled
    return bool(token) and hmac.compare_digest(str(token).encode("utf-8"), expected.encode("utf-8"))


async def require_job_token(
    x_job_token: str | None = Header(default=None),
    x_notification_token: str | None = Header(default=None),
) -> None:
    if not job_token_valid(x_job_token or x_notification_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="job token required")


def require_dev_endpoints() -> None:
    if not settings.dev_endpoints_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev endpoints are disabled")
