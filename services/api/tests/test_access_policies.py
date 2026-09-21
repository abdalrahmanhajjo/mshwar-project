"""Every endpoint declares who may call it, and enforces it (MSHWAR-108).

* the route table is complete: every route has exactly one access policy;
* the public surface is an explicit allow-list, so a new public route is a
  deliberate, reviewed change;
* an anonymous caller (or one holding a stale cookie) gets 401 from every
  protected route before the body is even validated;
* a signed-in non-admin gets 403 from every admin route;
* authorisation failures share one response shape and leak nothing.
"""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient, Response

from app.core.access import Policy, route_policies
from app.core.config import settings
from app.core.sql import AUTHZ_DENIAL_PREFIXES
from app.main import app

MIGRATIONS = Path(__file__).resolve().parents[3] / "mshwar-database" / "migrations"

PUBLIC_ROUTES = {
    "GET /health",
    "GET /api/v1/health",
    "POST /api/v1/auth/register",
    "POST /api/v1/auth/signin",
    "POST /api/v1/auth/signout",
    "POST /api/v1/auth/forgot-password",
    "POST /api/v1/auth/reset-password",
    "POST /api/v1/auth/verify-email",
    "POST /api/v1/auth/resend-verification",
    "GET /api/v1/catalogue/destinations",
    "GET /api/v1/catalogue/experiences",
    "GET /api/v1/catalogue/experiences/{slug}",
    "GET /api/v1/catalogue/experiences/{slug}/related",
    "GET /api/v1/catalogue/search",
    "GET /api/v1/catalogue/collections",
    "GET /api/v1/catalogue/collections/{slug}",
    "GET /api/v1/locations/areas",
    "GET /api/v1/profile/vocabularies",
    "GET /api/v1/privacy/policies",
}
TOKEN_ROUTES = {
    "GET /api/v1/groups/join/{token}",
    "POST /api/v1/groups/join/{token}",
}
SIGNATURE_ROUTES: set[str] = set()
# 42501 messages that are business rules the caller should read, not authorisation decisions.
BUSINESS_RULE_DENIALS = {
    "review response text cannot be rewritten",
    "review text cannot be rewritten",
    "retired taxonomy cannot be assigned",
    "cannot self-grant admin",
    "cannot self-revoke last elevated grant via this path",
    "share link revoked",
    "share link expired",
    "guest join is not allowed",
    "trip is locked",
    "voting is closed",
    "review requires a confirmed or completed stay",
    "businesses cannot edit, hide or delete reviews",
    "invitation email mismatch",
    "immutable record: % cannot be truncated",
}

TABLE = route_policies(app)


@pytest.fixture
def production_like(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "enable_dev_endpoints", False)
    monkeypatch.setattr(settings, "internal_job_token", "j" * 40)


@pytest.fixture
async def anonymous() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


def _concrete(path: str) -> str:
    def fill(match: re.Match[str]) -> str:
        name = match.group(1)
        if name.endswith("id"):
            return str(uuid4())
        if name == "token":
            return "t" * 43
        return f"probe-{uuid4().hex[:6]}"

    return re.sub(r"\{([a-z_]+)\}", fill, path)


def _routes(*policies: Policy) -> list[tuple[str, str]]:
    return sorted((key.split(" ", 1)[0], key.split(" ", 1)[1]) for key, policy in TABLE.items() if policy in policies)


async def _call(client: AsyncClient, method: str, path: str) -> Response:
    body = {} if method in {"POST", "PUT", "PATCH"} else None
    return await client.request(method, _concrete(path), json=body)


def test_every_route_declares_exactly_one_policy() -> None:
    # route_policies raises when a route has none or several; this also pins the size of the surface.
    assert len(TABLE) >= 60
    assert all(isinstance(policy, Policy) for policy in TABLE.values())


def test_public_surface_is_an_explicit_allow_list() -> None:
    assert {key for key, policy in TABLE.items() if policy is Policy.PUBLIC} == PUBLIC_ROUTES
    assert {key for key, policy in TABLE.items() if policy is Policy.TOKEN} == TOKEN_ROUTES
    assert {key for key, policy in TABLE.items() if policy is Policy.SIGNATURE} == SIGNATURE_ROUTES


def test_read_only_public_routes_do_not_write() -> None:
    writes = {key for key in PUBLIC_ROUTES if not key.startswith("GET ")}
    assert writes == {
        "POST /api/v1/auth/register",
        "POST /api/v1/auth/signin",
        "POST /api/v1/auth/signout",
        "POST /api/v1/auth/forgot-password",
        "POST /api/v1/auth/reset-password",
        "POST /api/v1/auth/verify-email",
        "POST /api/v1/auth/resend-verification",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"), _routes(Policy.SESSION, Policy.VERIFIED, Policy.ADMIN, Policy.ACTOR, Policy.JOB)
)
async def test_protected_routes_reject_anonymous_callers(
    anonymous: AsyncClient, production_like: None, method: str, path: str
) -> None:
    response = await _call(anonymous, method, path)
    assert response.status_code == 401, f"{method} {path} -> {response.status_code} {response.text}"
    body = response.json()
    assert body["code"] == "unauthenticated"
    assert body["request_id"] == response.headers["x-request-id"]


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), _routes(Policy.SESSION, Policy.VERIFIED, Policy.ADMIN))
async def test_stale_session_cookie_is_rejected_and_cleared(
    anonymous: AsyncClient, production_like: None, method: str, path: str
) -> None:
    anonymous.cookies.set(settings.session_cookie_name, "not-a-session")
    response = await _call(anonymous, method, path)
    assert response.status_code == 401
    assert f"{settings.session_cookie_name}=" in response.headers.get("set-cookie", "")


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), _routes(Policy.DEV))
async def test_dev_routes_are_closed_outside_development(
    anonymous: AsyncClient, production_like: None, method: str, path: str
) -> None:
    response = await _call(anonymous, method, path)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_signed_in_non_admin_is_forbidden_on_every_admin_route(
    anonymous: AsyncClient, production_like: None
) -> None:
    registered = await anonymous.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": f"not-admin-{uuid4().hex[:10]}@example.com",
            "password": "long-enough-secret",
            "display_name": "Rami",
            "locale": "en",
        },
    )
    assert registered.status_code == 201
    failures = []
    for method, path in _routes(Policy.ADMIN):
        response = await _call(anonymous, method, path)
        body = response.json()
        if response.status_code != 403 or body.get("code") != "forbidden":
            failures.append(f"{method} {path} -> {response.status_code} {body}")
        assert "admin" not in str(body.get("detail", "")).lower()
    assert not failures, "\n".join(failures)


def test_every_permission_error_in_the_database_is_classified() -> None:
    messages = set()
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        text = migration.read_text()
        for match in re.finditer(r"RAISE EXCEPTION '([^']+)'[^;]*ERRCODE = '42501'", text):
            messages.add(match.group(1))
    assert messages
    unclassified = {
        message
        for message in messages
        if not message.lower().startswith(AUTHZ_DENIAL_PREFIXES) and message not in BUSINESS_RULE_DENIALS
    }
    assert not unclassified, f"classify these 42501 messages in app/core/sql.py or this test: {unclassified}"


@pytest.mark.asyncio
async def test_error_bodies_share_one_shape(anonymous: AsyncClient) -> None:
    missing = await anonymous.get(f"/api/v1/catalogue/collections/{uuid4().hex}")
    assert missing.status_code == 404
    assert set(missing.json()) == {"detail", "code", "request_id"}
    assert missing.json()["code"] == "not_found"
    invalid = await anonymous.post("/api/v1/auth/signin", json={"email": "x", "password": "secret-value-123"})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "invalid"
    assert "secret-value-123" not in invalid.text  # submitted values are never echoed


@pytest.mark.asyncio
async def test_request_id_is_accepted_or_minted(anonymous: AsyncClient) -> None:
    given = await anonymous.get("/health", headers={"X-Request-ID": "edge-req-12345678"})
    assert given.headers["x-request-id"] == "edge-req-12345678"
    forged = await anonymous.get("/health", headers={"X-Request-ID": "bad id <script>"})
    assert re.fullmatch(r"[0-9a-f]{32}", forged.headers["x-request-id"])


def test_published_route_table_is_current() -> None:
    from app.core.access import render_route_table

    published = Path(__file__).resolve().parents[3] / "docs" / "security" / "route-policies.md"
    assert published.read_text(encoding="utf-8") == render_route_table(app), (
        "run: cd services/api && PYTHONPATH=. python scripts/route_policies.py"
    )
