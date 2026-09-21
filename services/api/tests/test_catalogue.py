from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.catalogue.price import PriceModel
from app.core.mailer import RecordingMailer, set_mailer
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


async def _register(client: AsyncClient) -> str:
    created = await client.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": _email("cat"),
            "password": "long-enough-secret",
            "display_name": "Lina",
            "locale": "en",
        },
    )
    assert created.status_code == 201, created.text
    return str(created.json()["id"])


async def _grant_admin(user_id: str) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:user_id, NULL, 'ops')"), {"user_id": user_id})
        await session.commit()


def test_price_model_requires_type_currency_and_source() -> None:
    price = PriceModel.from_row({"currency": "usd", "type": "quote", "source": "catalogue-seed", "amount_minor": None})
    assert price.type == "quote-required"
    assert price.currency == "USD"
    assert price.source == "catalogue-seed"
    assert price.as_label() == "quote"


@pytest.mark.asyncio
async def test_public_catalogue_never_leaks_unpublished(api: AsyncClient) -> None:
    destinations = await api.get("/api/v1/catalogue/destinations")
    assert destinations.status_code == 200
    slugs = {item["slug"] for item in destinations.json()}
    assert slugs == {"byblos", "batroun", "bsharri", "qadisha-valley", "baalbek", "beirut"}

    listed = await api.get("/api/v1/catalogue/experiences", params={"pageSize": 24})
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] >= 10
    public_slugs = {item["slug"] for item in body["items"]}
    assert "unpublished-cedar-walk" not in public_slugs
    assert "slow-day-byblos" in public_slugs
    for item in body["items"]:
        assert item["id"]
        assert item["price"]["currency"] == "USD"
        assert item["price"]["type"] in {"fixed", "from", "estimated", "quote-required"}
        assert item["price"]["source"]
        assert item["weather_sensitivity"] in {"indoor", "outdoor", "weather-sensitive"}

    hidden = await api.get("/api/v1/catalogue/experiences/unpublished-cedar-walk")
    assert hidden.status_code == 404

    search = await api.get("/api/v1/catalogue/search", params={"q": "unpublished cedar"})
    assert search.status_code == 200
    assert all(item["slug"] != "unpublished-cedar-walk" for item in search.json()["items"])
    assert all(item.get("id") for item in search.json()["items"])

    collections = await api.get("/api/v1/catalogue/collections")
    assert collections.status_code == 200
    collection_slugs = {item["slug"] for item in collections.json()}
    assert "coast-calling" in collection_slugs
    assert "draft-hidden-collection" not in collection_slugs
    hidden_collection = await api.get("/api/v1/catalogue/collections/draft-hidden-collection")
    assert hidden_collection.status_code == 404


@pytest.mark.asyncio
async def test_search_parses_nl_and_offers_relaxations(api: AsyncClient) -> None:
    hits = await api.get("/api/v1/catalogue/search", params={"q": "cedars in Bsharri"})
    assert hits.status_code == 200
    payload = hits.json()
    assert payload["filters"]["destination"] == "bsharri"
    assert any(item["slug"] == "among-ancient-cedars" for item in payload["items"])
    assert all(item["id"] for item in payload["items"])

    empty = await api.get("/api/v1/catalogue/search", params={"q": "zzzz-not-a-real-listing-999"})
    assert empty.status_code == 200
    assert empty.json()["items"] == []
    assert empty.json()["relaxations"]

    arabic = await api.get("/api/v1/catalogue/search", params={"q": "جبيل", "locale": "ar"})
    assert arabic.status_code == 200
    assert any(item["destination_slug"] == "byblos" for item in arabic.json()["items"])


@pytest.mark.asyncio
async def test_related_is_location_based_and_published_only(api: AsyncClient) -> None:
    related = await api.get("/api/v1/catalogue/experiences/slow-day-byblos/related")
    assert related.status_code == 200
    items = related.json()
    assert items
    assert all(item["slug"] != "slow-day-byblos" for item in items)
    assert all(item["slug"] != "unpublished-cedar-walk" for item in items)
    assert all(item.get("distance_km") is not None for item in items)
    assert all(item.get("travel_seconds") for item in items)


@pytest.mark.asyncio
async def test_favorite_toggle_is_idempotent_and_merge_survives_signin(api: AsyncClient) -> None:
    await _register(api)
    first = await api.post("/api/v1/favorites/toggle", json={"listing_slug": "slow-day-byblos"})
    assert first.status_code == 200, first.text
    assert first.json()["saved"] is True
    second = await api.post("/api/v1/favorites/toggle", json={"listing_slug": "slow-day-byblos"})
    assert second.json()["saved"] is False
    third = await api.post("/api/v1/favorites/toggle", json={"listing_slug": "slow-day-byblos"})
    assert third.json()["saved"] is True
    merged = await api.post(
        "/api/v1/favorites/merge",
        json={"listing_slugs": ["slow-day-byblos", "among-ancient-cedars"]},
    )
    assert merged.status_code == 200
    listed = await api.get("/api/v1/favorites", params={"page_size": 24})
    slugs = {item["listing_slug"] for item in listed.json()["items"]}
    assert slugs == {"slow-day-byblos", "among-ancient-cedars"}


@pytest.mark.asyncio
async def test_collections_open_as_trip_and_admin_editor(api: AsyncClient) -> None:
    guest = await api.post("/api/v1/catalogue/collections/coast-calling/open-as-trip")
    assert guest.status_code == 401
    user_id = await _register(api)
    opened = await api.post("/api/v1/catalogue/collections/coast-calling/open-as-trip")
    assert opened.status_code == 200, opened.text
    assert opened.json()["name"] == "The coast is calling."
    assert opened.json()["status"] == "draft"

    collection = {
        "slug": f"ops-{uuid4().hex[:8]}",
        "title": "Operator collection",
        "description": "Assembled from existing inventory.",
        "kicker": "Admin",
        "status": "published",
        "experience_slugs": ["slow-day-byblos", "byblos-harbour-walls"],
    }
    # A signed-in traveller is not an operator.
    denied = await api.post("/api/v1/catalogue/collections", json=collection)
    assert denied.status_code == 403, denied.text
    assert denied.json()["code"] == "forbidden"
    await _grant_admin(user_id)
    created = await api.post("/api/v1/catalogue/collections", json=collection)
    assert created.status_code == 200, created.text
    assert created.json()["slug"].startswith("ops-")
    assert "slow-day-byblos" in created.json()["experience_slugs"]


@pytest.mark.asyncio
async def test_only_admins_or_the_owning_business_change_listing_status(api: AsyncClient) -> None:
    user_id = await _register(api)
    # Any signed-in traveller used to be able to unpublish any business's listing.
    for action in ("unpublish", "publish"):
        attempt = await api.post(f"/api/v1/catalogue/experiences/slow-day-byblos/{action}")
        assert attempt.status_code == 404, attempt.text
    listing = await api.get("/api/v1/catalogue/experiences/slow-day-byblos")
    assert listing.status_code == 200
    missing = await api.post("/api/v1/catalogue/experiences/no-such-listing/unpublish")
    assert missing.status_code == 404
    assert missing.json()["detail"] == attempt.json()["detail"]

    await _grant_admin(user_id)
    paused = await api.post("/api/v1/catalogue/experiences/slow-day-byblos/unpublish")
    assert paused.status_code == 200, paused.text
    assert paused.json()["status"] == "paused"
    restored = await api.post("/api/v1/catalogue/experiences/slow-day-byblos/publish")
    assert restored.json()["status"] == "published"
    async with TestingSessionLocal() as session:
        actions = (
            (
                await session.execute(
                    text(
                        "SELECT action FROM app.audit_log WHERE actor_id = :actor AND action = 'listing.status_changed'"
                    ),
                    {"actor": user_id},
                )
            )
            .scalars()
            .all()
        )
    assert len(actions) == 2
