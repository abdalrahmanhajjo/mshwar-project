"""Cross-site writes with the visitor's cookies are refused (MSHWAR-114, SR-03)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.csrf import is_cross_site
from app.main import app

SESSION = settings.session_cookie_name


def test_rules() -> None:
    cookie = {"cookie": f"{SESSION}=abc"}
    web = settings.public_web_origin
    assert not is_cross_site("GET", {**cookie, "origin": "https://evil.example"})
    assert not is_cross_site("POST", {"origin": "https://evil.example"})
    assert not is_cross_site("POST", {**cookie, "origin": web})
    assert not is_cross_site("POST", {**cookie, "origin": web.upper()})
    assert not is_cross_site("POST", cookie)
    assert not is_cross_site("POST", {**cookie, "sec-fetch-site": "same-origin"})
    assert is_cross_site("POST", {**cookie, "origin": "https://evil.example"})
    assert is_cross_site("DELETE", {**cookie, "origin": "null"})
    assert is_cross_site("PUT", {**cookie, "sec-fetch-site": "cross-site"})
    assert is_cross_site("POST", {"cookie": "mshwar_guest=g", "origin": "https://evil.example"})


@pytest.mark.asyncio
async def test_cross_site_write_is_blocked_before_the_endpoint() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set(SESSION, "anything")
        response = await client.post(
            "/api/v1/auth/signout",
            headers={"Origin": "https://evil.example", "X-Request-ID": "csrf-test-0001"},
        )
    assert response.status_code == 403
    assert response.json() == {
        "detail": "This request came from another site and was blocked.",
        "code": "forbidden",
        "request_id": "csrf-test-0001",
    }
    assert response.headers["x-request-id"] == "csrf-test-0001"


@pytest.mark.asyncio
async def test_same_site_and_cookieless_calls_pass() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        cookieless = await client.post("/api/v1/auth/signout", headers={"Origin": "https://evil.example"})
        assert cookieless.status_code != 403
        client.cookies.set(SESSION, "anything")
        same_site = await client.post("/api/v1/auth/signout", headers={"Origin": settings.public_web_origin})
        assert same_site.status_code != 403
