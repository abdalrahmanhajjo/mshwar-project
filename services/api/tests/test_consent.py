"""Trust documents, terms acceptance and consent (MSHWAR-113)."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.main import app
from tests.conftest import TestingSessionLocal

WEB_VERSIONS = Path(__file__).resolve().parents[3] / "apps" / "web" / "src" / "lib" / "legal" / "versions.json"


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


def _signup(**extra: Any) -> dict[str, Any]:
    return {
        "email": f"consent-{uuid4().hex[:10]}@example.com",
        "password": "long-enough-secret",
        "display_name": "Maya",
        "locale": "ar",
        **extra,
    }


async def _history(api: AsyncClient) -> list[dict[str, Any]]:
    consents = await api.get("/api/v1/privacy/consents")
    assert consents.status_code == 200, consents.text
    return list(consents.json()["history"])


@pytest.mark.asyncio
async def test_web_and_database_agree_on_document_versions(api: AsyncClient) -> None:
    published = (await api.get("/api/v1/privacy/policies")).json()
    web = json.loads(WEB_VERSIONS.read_text())
    assert {kind: item["version"] for kind, item in published.items()} == web
    assert published["terms"]["requires_acceptance"] is True
    assert published["community"]["requires_acceptance"] is False


@pytest.mark.asyncio
async def test_sign_up_requires_accepting_the_terms(api: AsyncClient) -> None:
    refused = await api.post("/api/v1/auth/register", json=_signup())
    assert refused.status_code == 422
    assert "terms" in refused.json()["detail"]
    stale = await api.post(
        "/api/v1/auth/register",
        json=_signup(accept_terms=True, policy_versions={"terms": "2020-01-01", "privacy": "2026-09-16"}),
    )
    assert stale.status_code == 422
    assert stale.json()["detail"] == "policy version is out of date"


@pytest.mark.asyncio
async def test_sign_up_records_acceptance_and_leaves_optional_consent_off(api: AsyncClient) -> None:
    created = await api.post(
        "/api/v1/auth/register",
        json=_signup(accept_terms=True, policy_versions=json.loads(WEB_VERSIONS.read_text()) | {}),
    )
    assert created.status_code == 422  # only terms and privacy can be accepted
    created = await api.post(
        "/api/v1/auth/register",
        json=_signup(accept_terms=True, policy_versions={"terms": "2026-09-16", "privacy": "2026-09-16"}),
    )
    assert created.status_code == 201, created.text
    assert created.json()["policies_to_accept"] == []
    consents = (await api.get("/api/v1/privacy/consents")).json()
    assert consents["personalisation"] is False
    assert consents["marketing_email"] is False
    assert consents["policies"]["terms"] == {
        "current": "2026-09-16",
        "accepted": "2026-09-16",
        "effective_at": consents["policies"]["terms"]["effective_at"],
    }
    purposes = {(row["purpose"], row["granted"], row["source"]) for row in consents["history"]}
    assert purposes == {("terms", True, "signup"), ("privacy", True, "signup")}


@pytest.mark.asyncio
async def test_optional_consents_ticked_at_sign_up_are_recorded(api: AsyncClient) -> None:
    created = await api.post(
        "/api/v1/auth/register",
        json=_signup(accept_terms=True, personalisation_consent=True, marketing_consent=True),
    )
    assert created.status_code == 201, created.text
    consents = (await api.get("/api/v1/privacy/consents")).json()
    assert consents["personalisation"] is True
    assert consents["marketing_email"] is True
    assert consents["marketing_in_app"] is True
    signup_grants = {row["purpose"] for row in consents["history"] if row["source"] == "signup" and row["granted"]}
    assert signup_grants == {"terms", "privacy", "personalisation", "marketing_email", "marketing_in_app"}


@pytest.mark.asyncio
async def test_privacy_reset_and_deletion_withdraw_consent_on_the_record(api: AsyncClient) -> None:
    created = await api.post("/api/v1/auth/register", json=_signup(accept_terms=True, personalisation_consent=True))
    user_id = created.json()["id"]
    reset = await api.post("/api/v1/privacy/reset-personalisation")
    assert reset.status_code == 200, reset.text
    assert ("personalisation", False, "privacy_reset") in {
        (row["purpose"], row["granted"], row["source"]) for row in await _history(api)
    }
    await api.put("/api/v1/privacy/consents", json={"marketing_email": True})
    deleted = await api.post("/api/v1/privacy/delete-account", json={"confirmation": "DELETE"})
    assert deleted.status_code == 200, deleted.text
    async with TestingSessionLocal() as session:
        rows = (
            await session.execute(
                text("SELECT purpose, granted, source FROM app.consent_events WHERE user_id = :uid"),
                {"uid": user_id},
            )
        ).all()
    assert ("marketing_email", False, "account_deletion") in {tuple(row) for row in rows}


@pytest.mark.asyncio
async def test_new_terms_version_must_be_accepted(api: AsyncClient) -> None:
    await api.post("/api/v1/auth/register", json=_signup(accept_terms=True))
    version = "2026-09-15"  # earlier date string, but published after: the newest effective_at wins
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "INSERT INTO app.legal_documents (kind, version, effective_at, requires_acceptance) "
                "VALUES ('terms', :version, now(), true)"
            ),
            {"version": version},
        )
        await session.commit()
    try:
        me = (await api.get("/api/v1/auth/me")).json()
        assert me["policies_to_accept"] == ["terms"]
        wrong = await api.post("/api/v1/privacy/policies/accept", json={"versions": {"terms": "2026-09-16"}})
        assert wrong.status_code == 422
        accepted = await api.post("/api/v1/privacy/policies/accept", json={"versions": {"terms": version}})
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["terms"]["accepted"] == version
        assert (await api.get("/api/v1/auth/me")).json()["policies_to_accept"] == []
    finally:
        async with TestingSessionLocal() as session:
            await session.execute(
                text("DELETE FROM app.legal_documents WHERE kind = 'terms' AND version = :version"),
                {"version": version},
            )
            await session.commit()


@pytest.mark.asyncio
async def test_feedback_is_never_training_data_without_consent(api: AsyncClient) -> None:
    created = await api.post("/api/v1/auth/register", json=_signup(accept_terms=True))
    user_id = created.json()["id"]
    async with TestingSessionLocal() as session:
        stored = (
            await session.execute(
                text(
                    "INSERT INTO app.feedback_events (user_id, event_type, changes, training_consent) "
                    "VALUES (:uid, 'plan_edit', '{}', true) RETURNING training_consent"
                ),
                {"uid": user_id},
            )
        ).scalar_one()
        await session.rollback()
    assert stored is False


@pytest.mark.asyncio
async def test_consent_endpoints_need_a_session(api: AsyncClient) -> None:
    assert (await api.get("/api/v1/privacy/consents")).status_code == 401
    assert (await api.put("/api/v1/privacy/consents", json={"personalisation": True})).status_code == 401
    assert (await api.get("/api/v1/privacy/policies")).status_code == 200
