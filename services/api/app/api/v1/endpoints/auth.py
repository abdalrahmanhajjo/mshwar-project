from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.admin_auth import close_admin_sessions, lookup_admin_tier
from app.core.auth_session import load_session
from app.core.config import settings
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.mailer import MailMessage, get_mailer
from app.core.passwords import hash_password_async, verify_password_async
from app.core.rate_limit import enforce_rate_limit, limit
from app.core.sessions import (
    COOKIE_NAME,
    clear_session_cookie,
    hash_session_token,
    new_session_token,
    session_expiry,
    set_session_cookie,
    should_refresh,
)
from app.core.sql import fetch_json
from app.dependencies import get_auth_db

logger = logging.getLogger("mshwar.auth")


async def _deliver(message: MailMessage) -> None:
    """Send mail without ever failing the request. Account creation, password
    reset and verification must succeed even when the mail provider rejects or
    is unreachable; the person can request another link. The mailer logs only a
    domain, never the token."""
    try:
        await get_mailer().send(message)
    except Exception:  # noqa: BLE001 - delivery is best-effort, never load-bearing
        # WARNING, not ERROR: a handled delivery failure must not flood Sentry's
        # error stream (e.g. an unverified sending domain fails every send). The
        # traceback is kept via exc_info for the logs.
        logger.warning("verification/notification email delivery failed purpose=%s", message.purpose, exc_info=True)


router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_LOCALES = frozenset({"ar", "en", "fr"})
_INVALID_RESET = "Invalid or expired reset link"


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128, repr=False)
    display_name: str = Field(min_length=1, max_length=80)
    locale: str = "en"
    # MSHWAR-113: the terms and privacy policy must be accepted; the versions are
    # the ones the sign-up page showed (the current ones when omitted).
    accept_terms: bool = False
    policy_versions: dict[str, str] | None = None
    # Separate, optional and off unless ticked.
    personalisation_consent: bool = False
    marketing_consent: bool = False


class SignInRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    locale: str
    email_verified: bool = False
    admin_tier: str | None = None
    # Policies whose current version this account has not accepted yet.
    policies_to_accept: list[str] = Field(default_factory=list)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=8, max_length=256, repr=False)


class ResendVerificationRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)


class ResendVerificationResponse(BaseModel):
    ok: bool = True


_INVALID_VERIFY = "Invalid or expired verification link"


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class ForgotPasswordResponse(BaseModel):
    ok: bool = True


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=8, max_length=256, repr=False)
    password: str = Field(min_length=10, max_length=128, repr=False)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(email: str) -> str:
    normalized = _normalize_email(email)
    if not _EMAIL_RE.match(normalized):
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid email")
    return normalized


def _validate_locale(locale: str) -> str:
    if locale not in _LOCALES:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid locale")
    return locale


async def _issue_cookie_session(
    db: AsyncSession,
    response: Response,
    user_id: UUID,
    user_agent: str | None,
) -> None:
    token = new_session_token()
    token_hash = hash_session_token(token)
    await db.execute(
        text("SELECT app.issue_session(:user_id, :token_hash, :expires_at, :user_agent)"),
        {
            "user_id": str(user_id),
            "token_hash": token_hash,
            "expires_at": session_expiry(),
            "user_agent": (user_agent or "")[:300] or None,
        },
    )
    set_session_cookie(response, token)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[access.PUBLIC])
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    await enforce_rate_limit(request, "auth-register")
    if not payload.accept_terms:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail="Accept the terms of service and privacy policy to create an account",
        )
    email = _validate_email(payload.email)
    locale = _validate_locale(payload.locale)
    password_hash = await hash_password_async(payload.password)
    try:
        result = await db.execute(
            text("SELECT app.register_local_user(:email, :display_name, :locale, :password_hash)"),
            {
                "email": email,
                "display_name": payload.display_name.strip(),
                "locale": locale,
                "password_hash": password_hash,
            },
        )
        user_id = result.scalar_one()
    except (IntegrityError, DBAPIError) as exc:
        detail = str(getattr(exc, "orig", exc))
        if "already registered" in detail or "23505" in detail:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            ) from exc
        raise
    await _record_signup_consents(db, user_id, payload)
    await _issue_cookie_session(db, response, user_id, request.headers.get("user-agent"))
    await _send_verification_email(db, email)
    return await _user_out(
        db,
        user_id=user_id,
        email=email,
        display_name=payload.display_name.strip(),
        locale=locale,
        email_verified=False,
    )


@router.post("/signin", response_model=UserOut, dependencies=[access.PUBLIC])
async def signin(
    payload: SignInRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    email = _normalize_email(payload.email)
    await enforce_rate_limit(request, "auth-signin-ip")
    await enforce_rate_limit(request, "auth-signin-email", subject=email)
    result = await db.execute(
        text(
            "SELECT user_id, password_hash, display_name, status, locale, email_verified_at "
            "FROM app.lookup_local_credential(:email)"
        ),
        {"email": email},
    )
    row = result.mappings().first()
    password_ok = await verify_password_async(row["password_hash"] if row else None, payload.password)
    if row is None or row["status"] != "active" or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    await _issue_cookie_session(db, response, row["user_id"], request.headers.get("user-agent"))
    return await _user_out(
        db,
        user_id=row["user_id"],
        email=email,
        display_name=row["display_name"],
        locale=row["locale"],
        email_verified=bool(row["email_verified_at"]),
    )


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[access.PUBLIC])
async def signout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Response:
    token = request.cookies.get(COOKIE_NAME)
    session = await load_session(db, token)
    if token:
        if session is not None:
            await close_admin_sessions(db, session["user_id"])
        await db.execute(
            text("SELECT app.revoke_session(:token_hash)"),
            {"token_hash": hash_session_token(token)},
        )
    clear_session_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=UserOut, dependencies=[access.SESSION])
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    return await _me_or_refresh(request, response, db, force_refresh=True)


@router.get("/me", response_model=UserOut, dependencies=[access.SESSION])
async def me(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    return await _me_or_refresh(request, response, db, force_refresh=False)


async def _me_or_refresh(
    request: Request,
    response: Response,
    db: AsyncSession,
    force_refresh: bool,
) -> UserOut:
    token = request.cookies.get(COOKIE_NAME)
    session = await load_session(db, token)
    if session is None or session["status"] != "active":
        clear_session_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if token and (force_refresh or should_refresh(session["expires_at"])):
        await db.execute(
            text("SELECT app.refresh_session(:token_hash, :expires_at)"),
            {"token_hash": hash_session_token(token), "expires_at": session_expiry()},
        )
        set_session_cookie(response, token)
    return await _user_out(
        db,
        user_id=session["user_id"],
        email=session["email"],
        display_name=session["display_name"],
        locale=session["locale"],
        email_verified=bool(session.get("email_verified_at")),
    )


async def _record_signup_consents(db: AsyncSession, user_id: object, payload: RegisterRequest) -> None:
    versions = payload.policy_versions
    if not versions:
        current = await fetch_json(db, "SELECT app.current_policies()", {})
        versions = {
            kind: str(item["version"])
            for kind, item in (current or {}).items()
            if isinstance(item, dict) and item.get("requires_acceptance")
        }
    await fetch_json(
        db,
        "SELECT app.accept_policies(:user_id, CAST(:versions AS jsonb), 'signup')",
        {"user_id": str(user_id), "versions": json.dumps(versions)},
    )
    if payload.personalisation_consent or payload.marketing_consent:
        await fetch_json(
            db,
            "SELECT app.set_consents(:user_id, :personalisation, :marketing, :marketing, 'signup')",
            {
                "user_id": str(user_id),
                "personalisation": payload.personalisation_consent or None,
                "marketing": payload.marketing_consent or None,
            },
        )


async def _user_out(
    db: AsyncSession,
    *,
    user_id: UUID,
    email: str,
    display_name: str,
    locale: str,
    email_verified: bool,
) -> UserOut:
    return UserOut(
        id=user_id,
        email=email,
        display_name=display_name,
        locale=locale,
        email_verified=email_verified,
        admin_tier=await lookup_admin_tier(db, user_id),
        policies_to_accept=list(
            await fetch_json(db, "SELECT app.policies_to_accept(:user_id)", {"user_id": str(user_id)}) or []
        ),
    )


async def _pad_forgot_duration(started: float) -> None:
    minimum = settings.password_reset_min_ms / 1000
    remaining = minimum - (time.monotonic() - started)
    if remaining > 0:
        await asyncio.sleep(remaining)


def _reset_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(seconds=settings.password_reset_ttl_seconds)


def _reset_link(token: str) -> str:
    origin = settings.public_web_origin.rstrip("/")
    return f"{origin}/reset-password?token={token}"


@router.post("/forgot-password", response_model=ForgotPasswordResponse, dependencies=[access.PUBLIC])
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ForgotPasswordResponse:
    started = time.monotonic()
    email = _normalize_email(payload.email)
    await enforce_rate_limit(request, "auth-reset-ip")
    await enforce_rate_limit(request, "auth-reset-email", subject=email)

    token = new_session_token()
    token_hash = hash_session_token(token)
    result = await db.execute(
        text("SELECT app.issue_password_reset(:email, :token_hash, :expires_at)"),
        {"email": email, "token_hash": token_hash, "expires_at": _reset_expiry()},
    )
    user_id = result.scalar_one_or_none()
    if user_id is not None:
        await _deliver(
            MailMessage(
                to=email,
                subject="Reset your Mshwar password",
                text_body=f"Use this link to choose a new password. It expires in 30 minutes.\n{_reset_link(token)}",
                purpose="password_reset",
                token=token,
            )
        )
    else:
        hash_session_token(new_session_token())
        await _deliver(
            MailMessage(
                to=email,
                subject="Reset your Mshwar password",
                text_body="If an account exists, a reset link was issued.",
                purpose="password_reset_suppressed",
            )
        )
    await _pad_forgot_duration(started)
    return ForgotPasswordResponse()


@router.post("/reset-password", response_model=UserOut, dependencies=[access.PUBLIC, limit("token-link")])
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    await enforce_rate_limit(request, "auth-reset-ip")
    password_hash = await hash_password_async(payload.password)
    result = await db.execute(
        text("SELECT app.consume_password_reset(:token_hash, :password_hash)"),
        {"token_hash": hash_session_token(payload.token), "password_hash": password_hash},
    )
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_RESET)
    user = await _account_out(db, user_id)
    await _issue_cookie_session(db, response, user.id, request.headers.get("user-agent"))
    return user


async def _account_out(db: AsyncSession, user_id: object) -> UserOut:
    identity = await fetch_json(db, "SELECT app.account_identity(:user_id)", {"user_id": str(user_id)})
    if not isinstance(identity, dict):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return await _user_out(
        db,
        user_id=identity["id"],
        email=identity["email"],
        display_name=identity["display_name"],
        locale=identity["locale"],
        email_verified=bool(identity.get("email_verified_at")),
    )


def _verify_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(seconds=settings.email_verification_ttl_seconds)


def _verify_link(token: str) -> str:
    origin = settings.public_web_origin.rstrip("/")
    return f"{origin}/verify-email?token={token}"


async def _send_verification_email(db: AsyncSession, email: str) -> None:
    token = new_session_token()
    token_hash = hash_session_token(token)
    result = await db.execute(
        text("SELECT app.issue_email_verification(:email, :token_hash, :expires_at)"),
        {"email": email, "token_hash": token_hash, "expires_at": _verify_expiry()},
    )
    if result.scalar_one_or_none() is None:
        hash_session_token(new_session_token())
        await _deliver(
            MailMessage(
                to=email,
                subject="Verify your Mshwar email",
                text_body="If this address needs verification, a link was issued.",
                purpose="email_verification_suppressed",
            )
        )
        return
    await _deliver(
        MailMessage(
            to=email,
            subject="Verify your Mshwar email",
            text_body=f"Use this link to verify your email. It expires in 24 hours.\n{_verify_link(token)}",
            purpose="email_verification",
            token=token,
        )
    )


@router.post("/verify-email", response_model=UserOut, dependencies=[access.PUBLIC, limit("token-link")])
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    result = await db.execute(
        text("SELECT app.confirm_email_verification(:token_hash)"),
        {"token_hash": hash_session_token(payload.token)},
    )
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_VERIFY)
    user = await _account_out(db, user_id)
    existing = await load_session(db, request.cookies.get(COOKIE_NAME))
    if existing is None or str(existing["user_id"]) != str(user.id):
        await _issue_cookie_session(db, response, user.id, request.headers.get("user-agent"))
    return user


@router.post("/resend-verification", response_model=ResendVerificationResponse, dependencies=[access.PUBLIC])
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ResendVerificationResponse:
    await enforce_rate_limit(request, "auth-verify-ip")
    session = await load_session(db, request.cookies.get(COOKIE_NAME))
    email = _normalize_email(payload.email) if payload.email else (session["email"] if session else "")
    if not email:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid email")
    await enforce_rate_limit(request, "auth-verify-email", subject=email)
    await _send_verification_email(db, email)
    return ResendVerificationResponse()
