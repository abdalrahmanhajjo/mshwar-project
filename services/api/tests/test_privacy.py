from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.conftest import TestingSessionLocal


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}@example.com"


async def _register(client: AsyncClient, email: str) -> dict[str, object]:
    created = await client.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": email,
            "password": "long-enough-secret",
            "display_name": "Lina",
            "locale": "en",
        },
    )
    assert created.status_code == 201, created.text
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    return me.json()


async def _verify_email(client: AsyncClient, email: str) -> None:
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    confirmed = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text


async def _audit_actions(user_id: str) -> list[str]:
    async with TestingSessionLocal() as session:
        rows = (
            await session.execute(
                text("SELECT action FROM app.audit_log WHERE actor_id = :uid ORDER BY created_at"),
                {"uid": user_id},
            )
        ).all()
    return [str(row[0]) for row in rows]


@pytest.mark.asyncio
async def test_privacy_endpoints_require_a_session() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh:
        assert (await fresh.get("/api/v1/privacy/export")).status_code == 401
        assert (await fresh.post("/api/v1/privacy/reset-personalisation")).status_code == 401
        assert (await fresh.post("/api/v1/privacy/delete-account", json={"confirmation": "DELETE"})).status_code == 401


@pytest.mark.asyncio
async def test_export_reset_and_delete_are_owner_only_and_audited(api: AsyncClient) -> None:
    owner_email = _email("owner")
    owner = await _register(api, owner_email)
    owner_id = str(owner["id"])

    trip = await api.post("/api/v1/trips", json={"name": "Coast weekend"})
    assert trip.status_code == 200
    saved = await api.post("/api/v1/favorites", json={"listing_slug": "slow-day-byblos"})
    assert saved.status_code == 200
    await _verify_email(api, owner_email)

    areas = await api.get("/api/v1/locations/areas")
    beirut = next(area for area in areas.json()["areas"] if area["slug"] == "beirut")
    updated = await api.put(
        "/api/v1/profile",
        json={
            "display_name": "Lina Haddad",
            "locale": "en",
            "preferences": {
                "source": "explicit",
                "home_area_id": beirut["id"],
                "default_group_size": 4,
                "activity_intensity": "moderate",
                "dietary": ["vegetarian"],
                "accessibility": [],
                "interests": ["food"],
            },
        },
    )
    assert updated.status_code == 200, updated.text

    exported = await api.get("/api/v1/privacy/export")
    assert exported.status_code == 200, exported.text
    assert 'attachment; filename="mshwar-data-export.json"' in exported.headers.get("content-disposition", "")
    body = exported.json()
    assert body["profile"]["email"] == owner_email
    assert body["profile"]["display_name"] == "Lina Haddad"
    assert body["profile"]["preferences"]["dietary"] == ["vegetarian"]
    assert len(body["trips"]) == 1
    assert body["trips"][0]["name"] == "Coast weekend"
    assert body["favorites"][0]["listing_slug"] == "slow-day-byblos"
    assert body["reviews"] == []
    assert body["bookings"] == []

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        other_email = _email("other")
        await _register(other, other_email)
        other_export = await other.get("/api/v1/privacy/export")
        assert other_export.status_code == 200
        assert other_export.json()["profile"]["email"] == other_email
        assert other_export.json()["trips"] == []
        assert other_export.json()["favorites"] == []

    reset = await api.post("/api/v1/privacy/reset-personalisation")
    assert reset.status_code == 200, reset.text
    assert reset.json()["ok"] is True
    assert reset.json()["identity_kept"] is True
    assert reset.json()["bookings_kept"] is True

    profile = await api.get("/api/v1/profile")
    assert profile.status_code == 200
    assert profile.json()["email"] == owner_email
    assert profile.json()["display_name"] == "Lina Haddad"
    assert profile.json()["preferences"]["dietary"] == []
    assert profile.json()["preferences"]["home_area_id"] is None

    after_reset = await api.get("/api/v1/privacy/export")
    assert after_reset.json()["trips"][0]["name"] == "Coast weekend"
    assert after_reset.json()["profile"]["email"] == owner_email

    rejected = await api.post("/api/v1/privacy/delete-account", json={"confirmation": "nope"})
    assert rejected.status_code == 422

    deleted = await api.post("/api/v1/privacy/delete-account", json={"confirmation": "DELETE"})
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["status"] == "deleted"
    assert deleted.json()["bookings_kept"] == 0

    me = await api.get("/api/v1/auth/me")
    assert me.status_code == 401

    actions = await _audit_actions(owner_id)
    assert "export" in actions
    assert "reset_personalisation" in actions
    assert "delete_account" in actions

    async with TestingSessionLocal() as session:
        user = (
            await session.execute(
                text("SELECT display_name, status, auth_subject FROM app.users WHERE id = :uid"),
                {"uid": owner_id},
            )
        ).first()
        private = (
            await session.execute(
                text("SELECT email, phone, preferences FROM app.user_private WHERE user_id = :uid"),
                {"uid": owner_id},
            )
        ).first()
        bookings = (
            await session.execute(
                text("SELECT count(*) FROM app.account_bookings WHERE customer_id = :uid"),
                {"uid": owner_id},
            )
        ).scalar_one()
        trips = (
            await session.execute(
                text("SELECT count(*) FROM app.trips WHERE owner_id = :uid"),
                {"uid": owner_id},
            )
        ).scalar_one()
    assert user is not None
    assert user[0] == "Deleted user"
    assert user[1] == "deleted"
    assert str(user[2]).startswith("deleted:")
    assert private is not None
    assert private[0] is None
    assert private[1] is None
    assert private[2] == {}
    assert bookings == 0
    assert trips == 1
