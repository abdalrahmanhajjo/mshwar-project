"""The audit log records consequential account actions and cannot be rewritten.

Phase 1 ships the audit log itself (Epic: Security, Privacy & Trust) together
with the account actions that write to it. The admin-console decisions that
also land in this log - verification, moderation, role grants, taxonomy,
configuration and financial overrides - arrive with the admin console, so the
cases covering them are not part of this milestone.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.factories import _traveller


@dataclass
class Ops:
    traveller: AsyncClient
    traveller_id: str
    traveller_email: str


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def ops() -> AsyncGenerator[Ops, None]:
    set_mailer(RecordingMailer())
    traveller = _client()
    customer = await _traveller(traveller)
    yield Ops(
        traveller=traveller,
        traveller_id=str(customer["id"]),
        traveller_email=str(customer["email"]),
    )
    await traveller.aclose()
    set_mailer(None)


async def _rows_for_request(request_id: str) -> list[dict[str, Any]]:
    async with TestingSessionLocal() as session:
        rows = (
            (
                await session.execute(
                    text(
                        "SELECT actor_id::text AS actor_id, action, table_name, row_key, changes, reason "
                        "FROM app.audit_log WHERE request_id = :rid ORDER BY created_at"
                    ),
                    {"rid": request_id},
                )
            )
            .mappings()
            .all()
        )
    return [dict(row) for row in rows]


async def _call(client: AsyncClient, method: str, path: str, body: dict[str, Any] | None) -> str:
    response = await client.request(method, path, json=body)
    assert response.status_code < 500, response.text
    request_id = response.headers.get("x-request-id")
    assert request_id, "every response must carry a request id"
    return request_id


async def test_password_reset_is_audited(ops: Ops) -> None:
    request = await ops.traveller.post("/api/v1/auth/forgot-password", json={"email": ops.traveller_email})
    assert request.status_code == 200
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.reset_tokens_for(ops.traveller_email)[-1]
    request_id = await _call(
        ops.traveller, "POST", "/api/v1/auth/reset-password", {"token": token, "password": "a-new-long-secret"}
    )
    rows = await _rows_for_request(request_id)
    reset = [row for row in rows if row["action"] == "account.password_reset"]
    assert reset and reset[0]["actor_id"] == ops.traveller_id
    assert reset[0]["changes"]["sessions_revoked"] >= 1


async def test_audit_rows_do_not_copy_personal_values(ops: Ops) -> None:
    request = await ops.traveller.post("/api/v1/auth/forgot-password", json={"email": ops.traveller_email})
    assert request.status_code == 200
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.reset_tokens_for(ops.traveller_email)[-1]
    request_id = await _call(
        ops.traveller, "POST", "/api/v1/auth/reset-password", {"token": token, "password": "another-long-secret"}
    )
    rows = await _rows_for_request(request_id)
    assert rows, "the reset must be audited"
    assert ops.traveller_email not in str(rows), "personal data must not be copied into the audit log"


async def test_audit_log_is_append_only(ops: Ops) -> None:
    async with TestingSessionLocal() as session:
        for statement in (
            "UPDATE app.audit_log SET reason = 'tampered'",
            "DELETE FROM app.audit_log",
            "TRUNCATE app.audit_log",
        ):
            with pytest.raises(Exception, match="immutable record"):
                async with session.begin_nested():
                    await session.execute(text(statement))
        await session.rollback()
