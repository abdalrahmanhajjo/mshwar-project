from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limit import limiter
from app.main import app
from app.schemas.preferences import PreferenceValues, merge_plan_defaults


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()


def _email() -> str:
    return f"pref-{uuid4().hex[:12]}@example.com"


async def _register(api: AsyncClient, email: str) -> None:
    created = await api.post(
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


@pytest.mark.asyncio
async def test_profile_defaults_are_empty_and_explicit(api: AsyncClient) -> None:
    await _register(api, _email())
    profile = await api.get("/api/v1/profile")
    assert profile.status_code == 200
    body = profile.json()
    assert body["display_name"] == "Lina"
    assert body["locale"] == "en"
    prefs = body["preferences"]
    assert prefs["source"] == "explicit"
    assert prefs["home_area_id"] is None
    assert prefs["default_group_size"] is None
    assert prefs["dietary"] == []
    assert prefs["accessibility"] == []
    assert prefs["interests"] == []
    assert prefs["activity_intensity"] is None
    assert prefs["start_location"] is None


@pytest.mark.asyncio
async def test_profile_update_persists_without_new_session(api: AsyncClient) -> None:
    await _register(api, _email())
    areas = await api.get("/api/v1/locations/areas")
    assert areas.status_code == 200
    catalog = areas.json()
    assert catalog["picker"] == "map"
    assert catalog["replace_with"] == "none"
    beirut = next(area for area in catalog["areas"] if area["slug"] == "beirut")

    updated = await api.put(
        "/api/v1/profile",
        json={
            "display_name": "Lina Haddad",
            "locale": "ar",
            "preferences": {
                "source": "explicit",
                "home_area_id": beirut["id"],
                "default_group_size": 4,
                "activity_intensity": "moderate",
                "dietary": ["vegetarian"],
                "accessibility": ["step-free"],
                "interests": ["food", "nature"],
            },
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["display_name"] == "Lina Haddad"
    assert body["locale"] == "ar"
    assert body["preferences"]["default_group_size"] == 4
    assert body["preferences"]["source"] == "explicit"
    assert body["home_area"]["slug"] == "beirut"

    me = await api.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["display_name"] == "Lina Haddad"
    assert me.json()["locale"] == "ar"

    again = await api.get("/api/v1/profile")
    loaded = again.json()
    assert loaded["preferences"]["dietary"] == ["vegetarian"]
    assert loaded["preferences"]["interests"] == ["food", "nature"]
    assert loaded["preferences"]["home_area_id"] == beirut["id"]
    assert loaded["preferences"]["default_group_size"] == 4
    assert loaded["home_area"]["slug"] == "beirut"


@pytest.mark.asyncio
async def test_inferred_preferences_are_rejected(api: AsyncClient) -> None:
    await _register(api, _email())
    response = await api.put(
        "/api/v1/profile",
        json={
            "display_name": "Lina",
            "locale": "en",
            "preferences": {"source": "inferred", "dietary": ["vegetarian"]},
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_unknown_vocabulary_is_rejected(api: AsyncClient) -> None:
    await _register(api, _email())
    response = await api.put(
        "/api/v1/profile",
        json={
            "display_name": "Lina",
            "locale": "en",
            "preferences": {"source": "explicit", "dietary": ["not-a-real-diet"]},
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_trip_overrides_are_defaults_not_constraints(api: AsyncClient) -> None:
    await _register(api, _email())
    consent = await api.put("/api/v1/privacy/consents", json={"personalisation": True})
    assert consent.status_code == 200, consent.text
    await api.put(
        "/api/v1/profile",
        json={
            "display_name": "Lina",
            "locale": "en",
            "preferences": {"source": "explicit", "default_group_size": 2, "interests": ["food"]},
        },
    )
    created = await api.post(
        "/api/v1/trips",
        json={"name": "Weekend", "preference_overrides": {"default_group_size": 6}},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["name"] == "Weekend"
    assert body["status"] == "draft"
    assert body["preference_overrides"]["default_group_size"] == 6
    assert body["effective_defaults"]["default_group_size"] == 6
    assert body["effective_defaults"]["interests"] == ["food"]
    assert body["effective_defaults"]["source"] == "explicit"


@pytest.mark.asyncio
async def test_vocabularies_are_controlled(api: AsyncClient) -> None:
    vocab = await api.get("/api/v1/profile/vocabularies")
    assert vocab.status_code == 200
    body = vocab.json()
    assert {term["slug"] for term in body["dietary"]} >= {"vegetarian", "halal"}
    assert {term["slug"] for term in body["activity_intensity"]} == {
        "relaxed",
        "moderate",
        "active",
        "strenuous",
    }


def test_merge_keeps_profile_values_the_trip_did_not_override() -> None:
    profile = PreferenceValues(source="explicit", default_group_size=2, interests=["food"])
    merged = merge_plan_defaults(profile, {"default_group_size": 6, "source": "inferred"})
    assert merged.default_group_size == 6
    assert merged.interests == ["food"]
    assert merged.source == "explicit"
    with_start = merge_plan_defaults(
        profile,
        {"start_location": {"lat": 33.89, "lng": 35.48, "label": "Hamra", "source": "search"}},
    )
    assert with_start.start_location is not None
    assert with_start.start_location["label"] == "Hamra"


@pytest.mark.asyncio
async def test_profile_requires_a_session() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh:
        assert (await fresh.get("/api/v1/profile")).status_code == 401
        assert (await fresh.post("/api/v1/trips", json={"name": "Solo"})).status_code == 401


@pytest.mark.asyncio
async def test_saved_preferences_shape_plans_only_with_personalisation_consent(api: AsyncClient) -> None:
    await _register(api, _email())
    await api.put(
        "/api/v1/profile",
        json={"display_name": "Lina", "locale": "en", "preferences": {"source": "explicit", "interests": ["food"]}},
    )
    without = (await api.post("/api/v1/trips", json={"name": "No consent"})).json()
    assert without["effective_defaults"]["interests"] == []
    # The preferences are kept, so switching personalisation on applies them again.
    assert (await api.get("/api/v1/profile")).json()["preferences"]["interests"] == ["food"]
    await api.put("/api/v1/privacy/consents", json={"personalisation": True})
    with_consent = (await api.post("/api/v1/trips", json={"name": "Consent"})).json()
    assert with_consent["effective_defaults"]["interests"] == ["food"]
    await api.put("/api/v1/privacy/consents", json={"personalisation": False})
    withdrawn = (await api.post("/api/v1/trips", json={"name": "Withdrawn"})).json()
    assert withdrawn["effective_defaults"]["interests"] == []
