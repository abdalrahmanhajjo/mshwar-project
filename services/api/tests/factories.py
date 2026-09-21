"""Shared account fixtures for the Phase 1 API tests.

These helpers previously lived in the booking/payments test module. Phase 1
does not ship booking or payments, so they are kept here where every suite
that needs a registered, verified account can reach them.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@example.com"


async def _register(api: AsyncClient, email: str, name: str = "Owner") -> dict[str, Any]:
    response = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": email,
            "password": "long-enough-secret",
            "display_name": name,
            "locale": "en",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _verify(api: AsyncClient, email: str) -> None:
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    confirmed = await api.post("/api/v1/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text


async def _traveller(api: AsyncClient) -> dict[str, Any]:
    email = _email("guest")
    user = await _register(api, email, "Guest")
    await _verify(api, email)
    return user
