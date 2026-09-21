from __future__ import annotations

from collections.abc import AsyncGenerator
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
    return f"{prefix}-{uuid4().hex[:12]}@example.com"


async def _register(client: AsyncClient, email: str) -> None:
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


async def _register_verified(client: AsyncClient, email: str) -> None:
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
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    confirmed = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text


@pytest.mark.asyncio
async def test_hub_lists_require_a_session() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh:
        assert (await fresh.get("/api/v1/trips")).status_code == 401
        assert (await fresh.get("/api/v1/favorites")).status_code == 401


@pytest.mark.asyncio
async def test_trips_favorites_paginate_and_are_owner_only(api: AsyncClient) -> None:
    await _register(api, _email("owner"))
    first = await api.post("/api/v1/trips", json={"name": "Coast weekend"})
    assert first.status_code == 200, first.text
    trip_id = first.json()["id"]
    for index in range(6):
        created = await api.post("/api/v1/trips", json={"name": f"Draft {index}"})
        assert created.status_code == 200

    page1 = await api.get("/api/v1/trips", params={"page": 1, "page_size": 6})
    assert page1.status_code == 200
    body = page1.json()
    assert body["total"] == 7
    assert len(body["items"]) == 6
    assert {item["status"] for item in body["items"]} <= {"draft", "locked", "archived"}
    page2 = await api.get("/api/v1/trips", params={"page": 2, "page_size": 6})
    assert page2.json()["total"] == 7
    assert len(page2.json()["items"]) == 1

    archived = await api.post(f"/api/v1/trips/{trip_id}/archive")
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"
    assert archived.json()["id"] == trip_id

    saved = await api.post("/api/v1/favorites", json={"listing_slug": "slow-day-byblos"})
    assert saved.status_code == 200, saved.text
    favorite_id = saved.json()["id"]
    listed = await api.get("/api/v1/favorites")
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["listing_slug"] == "slow-day-byblos"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        await _register(other, _email("other"))
        other_trips = await other.get("/api/v1/trips")
        assert other_trips.status_code == 200
        assert other_trips.json()["items"] == []
        assert other_trips.json()["total"] == 0
        steal_trip = await other.post(f"/api/v1/trips/{trip_id}/archive")
        assert steal_trip.status_code == 404
        other_favs = await other.get("/api/v1/favorites")
        assert other_favs.json()["items"] == []
        steal_fav = await other.delete(f"/api/v1/favorites/{favorite_id}")
        assert steal_fav.status_code == 404

    removed = await api.delete(f"/api/v1/favorites/{favorite_id}")
    assert removed.status_code == 204
    assert (await api.get("/api/v1/favorites")).json()["total"] == 0
