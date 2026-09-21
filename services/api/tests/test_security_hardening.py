"""Regression tests for the security fixes in docs/code-review-report.md (C1–C5, H1–H3, H8, M3, M7)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.sql import FORBIDDEN, INTERNAL, raise_from_db
from app.main import app
from tests.factories import _email, _register, _traveller, api  # noqa: F401

_JOB_TOKEN = "t" * 40


@pytest.fixture
def production_like(monkeypatch: pytest.MonkeyPatch) -> None:
    """Dev endpoints off and a job token configured, as in staging/production."""
    monkeypatch.setattr(settings, "enable_dev_endpoints", False)
    monkeypatch.setattr(settings, "internal_job_token", _JOB_TOKEN)


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/health/metrics"),
    ],
)
async def test_job_endpoints_need_the_job_token(
    api: AsyncClient,  # noqa: F811
    production_like: None,
    method: str,
    path: str,
) -> None:
    await _traveller(api)
    denied = await getattr(api, method)(path)
    assert denied.status_code == 401
    wrong = await getattr(api, method)(path, headers={"X-Job-Token": "nope"})
    assert wrong.status_code == 401
    allowed = await getattr(api, method)(path, headers={"X-Job-Token": _JOB_TOKEN})
    assert allowed.status_code == 200, allowed.text


@pytest.mark.asyncio
async def test_signin_is_rate_limited(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setattr(settings, "signin_email_limit", 3)
    email = _email("victim")
    statuses = [
        (await api.post("/api/v1/auth/signin", json={"email": email, "password": "wrong-password"})).status_code
        for _ in range(4)
    ]
    assert statuses == [401, 401, 401, 429]


@pytest.mark.asyncio
async def test_register_is_rate_limited(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setattr(settings, "register_ip_limit", 1)
    await _register(api, _email("first"))
    blocked = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": _email("second"),
            "password": "long-enough-secret",
            "display_name": "B",
            "locale": "en",
        },
    )
    assert blocked.status_code == 429


def _request(headers: dict[str, str], host: str = "10.0.0.5") -> Request:
    scope = {
        "type": "http",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": (host, 1234),
    }
    return Request(scope)


def test_client_ip_ignores_forwarded_for_without_trusted_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_count", 0)
    assert client_ip(_request({"x-forwarded-for": "1.2.3.4"})) == "10.0.0.5"


def test_client_ip_uses_entry_added_by_trusted_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_count", 1)
    assert client_ip(_request({"x-forwarded-for": "6.6.6.6, 203.0.113.9"})) == "203.0.113.9"
    assert client_ip(_request({})) == "10.0.0.5"


def _db_error(sqlstate: str | None, message: str) -> SimpleNamespace:
    return SimpleNamespace(orig=SimpleNamespace(sqlstate=sqlstate, diag=SimpleNamespace(message_primary=message)))


@pytest.mark.parametrize(
    ("sqlstate", "message", "status_code", "detail"),
    [
        ("42501", "capability denied: finance", 403, FORBIDDEN),
        ("42501", "trip is locked", 403, "trip is locked"),
        ("P0002", "booking not found", 404, "booking not found"),
        ("22023", "invalid party", 422, "invalid party"),
        ("P0001", "insufficient capacity", 422, "insufficient capacity"),
        ("23505", "email already registered", 409, "email already registered"),
        ("23505", 'duplicate key value violates unique constraint "x"', 409, "Conflicts with an existing record"),
        ("23503", 'insert violates foreign key constraint "y"', 422, 'insert violates foreign key constraint "y"'),
        ("22P02", "invalid input syntax for type uuid", 422, "Invalid data"),
        ("57014", "canceling statement due to statement timeout", 503, "Please try again"),
        ("42P01", 'relation "app.secret" does not exist', 500, INTERNAL),
        (None, "connection refused", 500, INTERNAL),
    ],
)
def test_database_errors_map_to_safe_responses(
    sqlstate: str | None, message: str, status_code: int, detail: str
) -> None:
    with pytest.raises(HTTPException) as caught:
        raise_from_db(_db_error(sqlstate, message))
    assert caught.value.status_code == status_code
    assert caught.value.detail == detail


def test_asyncpg_error_messages_do_not_leak_class_names() -> None:
    orig = SimpleNamespace(sqlstate="P0001")
    orig.__str__ = lambda: "x"  # type: ignore[method-assign]

    class Wrapped(Exception):
        sqlstate = "P0001"

        def __str__(self) -> str:
            return "<class 'asyncpg.exceptions.RaiseError'>: invalid payment transition"

    with pytest.raises(HTTPException) as caught:
        raise_from_db(SimpleNamespace(orig=Wrapped()))
    assert caught.value.detail == "invalid payment transition"
