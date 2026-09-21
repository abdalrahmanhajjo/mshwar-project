from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import Response
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.api.v1.endpoints.auth import RegisterRequest, ResetPasswordRequest, VerifyEmailRequest
from app.core.config import settings
from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.core.passwords import hash_password, verify_password
from app.core.rate_limit import RATE_LIMITED_DETAIL, reset_all as reset_rate_limits
from app.core.sessions import COOKIE_NAME, hash_session_token, set_session_cookie, should_refresh
from app.main import app


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    reset_rate_limits()
    mailer = RecordingMailer()
    set_mailer(mailer)
    previous_min_ms = settings.password_reset_min_ms
    settings.password_reset_min_ms = 0
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    settings.password_reset_min_ms = previous_min_ms
    reset_rate_limits()
    set_mailer(None)


def test_password_hash_is_not_plaintext() -> None:
    digest = hash_password("correct-horse-battery")
    assert "correct-horse-battery" not in digest
    assert digest.startswith("$argon2")
    assert verify_password(digest, "correct-horse-battery") is True
    assert verify_password(digest, "wrong-password") is False


def test_should_refresh_when_under_half_life() -> None:
    now = datetime.now(UTC)
    assert should_refresh(now + timedelta(hours=1), now) is True
    assert should_refresh(now + timedelta(days=6), now) is False


@pytest.mark.asyncio
async def test_register_succeeds_even_when_email_delivery_fails() -> None:
    # A mail-provider failure must not fail signup: the account is created and the
    # person can request another verification link. Regression for the SMTP
    # rollout, where a rejected send 500'd the whole request.
    reset_rate_limits()

    class FailingMailer:
        async def send(self, message: object) -> None:
            raise RuntimeError("smtp provider rejected the message")

    set_mailer(FailingMailer())
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/v1/auth/register",
                json={
                    "accept_terms": True,
                    "email": "resilient@example.com",
                    "password": "long-enough-secret",
                    "display_name": "Rami",
                    "locale": "en",
                },
            )
        assert created.status_code == 201, created.text
        assert created.json()["email"] == "resilient@example.com"
    finally:
        set_mailer(None)
        reset_rate_limits()


@pytest.mark.asyncio
async def test_register_signin_me_refresh_signout(api: AsyncClient) -> None:
    email = "traveller@example.com"
    secret = "long-enough-secret"
    created = await api.post(
        "/api/v1/auth/register",
        json={"accept_terms": True, "email": email, "password": secret, "display_name": "Lina", "locale": "en"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["email"] == email
    assert body["display_name"] == "Lina"
    assert body["email_verified"] is False
    assert "password" not in body
    assert COOKIE_NAME in created.cookies
    cookie = created.cookies[COOKIE_NAME]
    assert cookie
    assert hash_session_token(cookie) != cookie

    set_cookie = created.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie or "SameSite=Lax" in set_cookie
    assert "mshwar_session=" in set_cookie

    me = await api.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email

    refreshed = await api.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["id"] == body["id"]

    signed_in = await api.post("/api/v1/auth/signin", json={"email": email.upper(), "password": secret})
    assert signed_in.status_code == 200
    assert signed_in.json()["display_name"] == "Lina"

    bad = await api.post("/api/v1/auth/signin", json={"email": email, "password": "definitely-wrong"})
    assert bad.status_code == 401
    assert "password" not in bad.text.lower() or "Invalid email or password" in bad.text

    conflict = await api.post(
        "/api/v1/auth/register",
        json={"accept_terms": True, "email": email, "password": secret, "display_name": "Other", "locale": "en"},
    )
    assert conflict.status_code == 409

    signed_out = await api.post("/api/v1/auth/signout")
    assert signed_out.status_code == 204
    assert (await api.get("/api/v1/auth/me")).status_code == 401


def test_reset_request_hides_token_and_password_from_repr() -> None:
    payload = ResetPasswordRequest.model_validate({"token": "hidden-reset-token", "password": "long-enough-secret"})
    rendered = repr(payload)
    assert "hidden-reset-token" not in rendered
    assert "long-enough-secret" not in rendered


def test_verify_request_hides_token_from_repr() -> None:
    payload = VerifyEmailRequest.model_validate({"token": "hidden-verify-token"})
    assert "hidden-verify-token" not in repr(payload)


def test_password_is_omitted_from_request_repr() -> None:
    payload = RegisterRequest.model_validate(
        {
            "email": "ada@example.com",
            "password": "long-enough-secret",
            "display_name": "Ada",
            "locale": "en",
        }
    )
    assert "long-enough-secret" not in repr(payload)


def test_session_cookie_is_httponly_samesite_and_path_scoped() -> None:
    response = Response()
    set_session_cookie(response, "opaque-token")
    header = response.headers.get("set-cookie", "")
    assert "mshwar_session=opaque-token" in header
    assert "HttpOnly" in header
    assert "Path=/" in header
    assert "SameSite=lax" in header or "SameSite=Lax" in header


@pytest.mark.asyncio
async def test_unauthenticated_me_and_refresh_are_rejected() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh:
        assert (await fresh.get("/api/v1/auth/me")).status_code == 401
        assert (await fresh.post("/api/v1/auth/refresh")).status_code == 401
        assert (await fresh.post("/api/v1/auth/signout")).status_code == 204
        fresh.cookies.set(COOKIE_NAME, "not-a-real-session")
        assert (await fresh.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_register_rejects_invalid_locale(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": "locale@example.com",
            "password": "long-enough-secret",
            "display_name": "Ada",
            "locale": "xx",
        },
    )
    assert response.status_code == 422


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}@example.com"


async def _register(api: AsyncClient, email: str, secret: str = "long-enough-secret") -> None:
    await _register_user(api, email, secret)


async def _register_user(api: AsyncClient, email: str, secret: str = "long-enough-secret") -> dict[str, object]:
    created = await api.post(
        "/api/v1/auth/register",
        json={"accept_terms": True, "email": email, "password": secret, "display_name": "Lina", "locale": "en"},
    )
    assert created.status_code == 201, created.text
    return created.json()


@pytest.mark.asyncio
async def test_forgot_password_response_is_identical_for_known_and_unknown_emails(api: AsyncClient) -> None:
    known = _unique_email("known")
    unknown = _unique_email("unknown")
    await _register(api, known)

    existing = await api.post("/api/v1/auth/forgot-password", json={"email": known})
    missing = await api.post("/api/v1/auth/forgot-password", json={"email": unknown})

    assert existing.status_code == 200
    assert missing.status_code == 200
    assert existing.json() == missing.json() == {"ok": True}
    assert existing.content == missing.content
    assert existing.headers.get("content-type") == missing.headers.get("content-type")
    assert COOKIE_NAME not in existing.headers.get("set-cookie", "")
    assert COOKIE_NAME not in missing.headers.get("set-cookie", "")

    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    assert len(mailer.reset_tokens_for(known)) == 1
    assert mailer.reset_tokens_for(unknown) == []
    assert any(msg.purpose == "password_reset_suppressed" and msg.to == unknown for msg in mailer.messages)


@pytest.mark.asyncio
async def test_reset_token_is_single_use_and_revokes_other_sessions(api: AsyncClient) -> None:
    email = _unique_email("reset")
    old_secret = "long-enough-secret"
    new_secret = "replacement-secret"
    await _register(api, email, old_secret)
    first_cookie = api.cookies[COOKIE_NAME]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        signed_in = await other.post("/api/v1/auth/signin", json={"email": email, "password": old_secret})
        assert signed_in.status_code == 200
        second_cookie = other.cookies[COOKIE_NAME]

    forgot = await api.post("/api/v1/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.reset_tokens_for(email)[0]

    reset = await api.post("/api/v1/auth/reset-password", json={"token": token, "password": new_secret})
    assert reset.status_code == 200
    assert reset.json()["email"] == email
    new_cookie = reset.cookies[COOKIE_NAME]
    assert new_cookie
    assert new_cookie != first_cookie

    reuse = await api.post("/api/v1/auth/reset-password", json={"token": token, "password": new_secret})
    assert reuse.status_code == 400
    assert reuse.json()["detail"] == "Invalid or expired reset link"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as check:
        check.cookies.set(COOKIE_NAME, first_cookie)
        assert (await check.get("/api/v1/auth/me")).status_code == 401
        check.cookies.set(COOKIE_NAME, second_cookie)
        assert (await check.get("/api/v1/auth/me")).status_code == 401
        check.cookies.set(COOKIE_NAME, new_cookie)
        me = await check.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == email

    old_signin = await api.post("/api/v1/auth/signin", json={"email": email, "password": old_secret})
    assert old_signin.status_code == 401
    new_signin = await api.post("/api/v1/auth/signin", json={"email": email, "password": new_secret})
    assert new_signin.status_code == 200


@pytest.mark.asyncio
async def test_new_reset_token_invalidates_unused_previous_token(api: AsyncClient) -> None:
    email = _unique_email("rotate")
    await _register(api, email)
    await api.post("/api/v1/auth/forgot-password", json={"email": email})
    await api.post("/api/v1/auth/forgot-password", json={"email": email})
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    tokens = mailer.reset_tokens_for(email)
    assert len(tokens) == 2
    stale = await api.post(
        "/api/v1/auth/reset-password",
        json={"token": tokens[0], "password": "replacement-secret"},
    )
    assert stale.status_code == 400
    fresh = await api.post(
        "/api/v1/auth/reset-password",
        json={"token": tokens[1], "password": "replacement-secret"},
    )
    assert fresh.status_code == 200


@pytest.mark.asyncio
async def test_expired_reset_token_is_rejected(api: AsyncClient, db_session) -> None:
    email = _unique_email("expired")
    await _register(api, email)
    await api.post("/api/v1/auth/forgot-password", json={"email": email})
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.reset_tokens_for(email)[0]
    await db_session.execute(
        text(
            """
            UPDATE app.password_reset_tokens t
            SET created_at = now() - interval '2 minutes',
                expires_at = now() - interval '1 minute'
            FROM app.user_private p
            WHERE t.user_id = p.user_id AND p.email = :email
            """
        ),
        {"email": email},
    )
    await db_session.commit()
    expired = await api.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "replacement-secret"},
    )
    assert expired.status_code == 400
    assert expired.json()["detail"] == "Invalid or expired reset link"


@pytest.mark.asyncio
async def test_forgot_password_rate_limit_is_identical_for_any_email(api: AsyncClient) -> None:
    known = _unique_email("limited")
    unknown = _unique_email("unknown-limited")
    last_known = None
    for _ in range(settings.forgot_email_limit + 1):
        last_known = await api.post("/api/v1/auth/forgot-password", json={"email": known})
    assert last_known is not None
    assert last_known.status_code == 429
    assert last_known.json()["detail"] == RATE_LIMITED_DETAIL
    assert last_known.json()["code"] == "rate_limited"
    assert int(last_known.headers["retry-after"]) > 0

    reset_rate_limits()
    last_unknown = None
    for _ in range(settings.forgot_email_limit + 1):
        last_unknown = await api.post("/api/v1/auth/forgot-password", json={"email": unknown})
    assert last_unknown is not None
    assert last_unknown.status_code == 429

    def _without_request_id(body: dict[str, object]) -> dict[str, object]:
        return {key: value for key, value in body.items() if key != "request_id"}

    assert _without_request_id(last_unknown.json()) == _without_request_id(last_known.json())


@pytest.mark.asyncio
async def test_invalid_reset_token_is_rejected(api: AsyncClient) -> None:
    response = await api.post(
        "/api/v1/auth/reset-password",
        json={"token": "not-a-real-reset-token", "password": "replacement-secret"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset link"


@pytest.mark.asyncio
async def test_register_rejects_short_password_and_bad_email(api: AsyncClient) -> None:
    short = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": "ok@example.com",
            "password": "short",
            "display_name": "A",
            "locale": "en",
        },
    )
    assert short.status_code == 422
    bad_email = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": "not-an-email",
            "password": "long-enough-secret",
            "display_name": "A",
            "locale": "en",
        },
    )
    assert bad_email.status_code == 422


@pytest.mark.asyncio
async def test_new_account_is_unverified_until_emailed_link_is_used(api: AsyncClient) -> None:
    email = _unique_email("verify")
    secret = "long-enough-secret"
    await _register(api, email, secret)
    me = await api.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email_verified"] is False

    # Browsing the catalogue never depends on verification.
    browsed = await api.get("/api/v1/catalogue/destinations")
    assert browsed.status_code == 200

    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    confirmed = await api.post("/api/v1/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200
    assert confirmed.json()["email_verified"] is True
    assert (await api.get("/api/v1/auth/me")).json()["email_verified"] is True

    reuse = await api.post("/api/v1/auth/verify-email", json={"token": token})
    assert reuse.status_code == 400
    assert reuse.json()["detail"] == "Invalid or expired verification link"


@pytest.mark.asyncio
async def test_resend_verification_is_rate_limited(api: AsyncClient) -> None:
    email = _unique_email("resend")
    await _register(api, email)
    last = None
    for _ in range(settings.verify_email_limit + 1):
        last = await api.post("/api/v1/auth/resend-verification", json={"email": email})
    assert last is not None
    assert last.status_code == 429
    assert last.json()["detail"] == RATE_LIMITED_DETAIL


@pytest.mark.asyncio
async def test_resend_verification_is_identical_for_known_and_unknown_emails(api: AsyncClient) -> None:
    known = _unique_email("resend-known")
    unknown = _unique_email("resend-unknown")
    await _register(api, known)
    known_resend = await api.post("/api/v1/auth/resend-verification", json={"email": known})
    unknown_resend = await api.post("/api/v1/auth/resend-verification", json={"email": unknown})
    assert known_resend.status_code == 200
    assert unknown_resend.status_code == 200
    assert known_resend.json() == unknown_resend.json() == {"ok": True}
    assert known_resend.content == unknown_resend.content


@pytest.mark.asyncio
async def test_new_verification_token_invalidates_unused_previous_token(api: AsyncClient) -> None:
    email = _unique_email("rotate-verify")
    await _register(api, email)
    await api.post("/api/v1/auth/resend-verification", json={"email": email})
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    tokens = mailer.verification_tokens_for(email)
    assert len(tokens) == 2
    stale = await api.post("/api/v1/auth/verify-email", json={"token": tokens[0]})
    assert stale.status_code == 400
    fresh = await api.post("/api/v1/auth/verify-email", json={"token": tokens[1]})
    assert fresh.status_code == 200
    assert fresh.json()["email_verified"] is True


@pytest.mark.asyncio
async def test_expired_verification_token_is_rejected(api: AsyncClient, db_session) -> None:
    email = _unique_email("expired-verify")
    await _register(api, email)
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    await db_session.execute(
        text(
            """
            UPDATE app.email_verification_tokens t
            SET created_at = now() - interval '2 days',
                expires_at = now() - interval '1 day'
            FROM app.user_private p
            WHERE t.user_id = p.user_id AND p.email = :email
            """
        ),
        {"email": email},
    )
    await db_session.commit()
    expired = await api.post("/api/v1/auth/verify-email", json={"token": token})
    assert expired.status_code == 400
    assert expired.json()["detail"] == "Invalid or expired verification link"
