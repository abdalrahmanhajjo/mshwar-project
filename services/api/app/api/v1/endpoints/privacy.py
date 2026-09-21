from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import raise_hub_error
from app.core import access
from app.core.auth_session import require_session
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.sessions import clear_session_cookie
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.privacy import ConsentUpdate, PolicyAcceptance, PrivacyDeleteIn, PrivacyDeleteOut, PrivacyResetOut

router = APIRouter()

_DELETE_CONFIRMATION = "DELETE"


@router.get("/export", dependencies=[access.SESSION])
async def export_my_data(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> JSONResponse:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.export_my_data(:user_id)"),
                {"user_id": str(session["user_id"])},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Account not found")
        raise
    if row is None or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    payload: Any = row[0]
    if isinstance(payload, str):
        payload = json.loads(payload)
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": 'attachment; filename="mshwar-data-export.json"'},
    )


@router.post("/reset-personalisation", response_model=PrivacyResetOut, dependencies=[access.SESSION])
async def reset_personalisation(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> PrivacyResetOut:
    session = await require_session(request, db)
    # Consent flags this clears are logged with this source (migration 026).
    await db.execute(text("SELECT set_config('app.consent_source', 'privacy_reset', true)"))
    try:
        row = (
            await db.execute(
                text("SELECT app.reset_my_personalisation(:user_id)"),
                {"user_id": str(session["user_id"])},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Account not found")
        raise
    if row is None or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    body = row[0]
    if isinstance(body, str):
        body = json.loads(body)
    return PrivacyResetOut.model_validate(body)


@router.post("/delete-account", response_model=PrivacyDeleteOut, dependencies=[access.SESSION])
async def delete_account(
    payload: PrivacyDeleteIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> PrivacyDeleteOut:
    if payload.confirmation.strip().upper() != _DELETE_CONFIRMATION:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Confirmation required")
    session = await require_session(request, db)
    # Consent flags this clears are logged with this source (migration 026).
    await db.execute(text("SELECT set_config('app.consent_source', 'account_deletion', true)"))
    try:
        row = (
            await db.execute(
                text("SELECT app.anonymise_my_account(:user_id)"),
                {"user_id": str(session["user_id"])},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Account not found")
        raise
    if row is None or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    clear_session_cookie(response)
    body = row[0]
    if isinstance(body, str):
        body = json.loads(body)
    return PrivacyDeleteOut.model_validate(body)


@router.get("/policies", dependencies=[access.PUBLIC])
async def current_policies(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Current version and effective date of each trust document (MSHWAR-113)."""
    return await fetch_json(db, "SELECT app.current_policies()", {})


@router.get("/consents", dependencies=[access.SESSION])
async def get_consents(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(db, "SELECT app.get_consents(:user_id)", {"user_id": str(session["user_id"])})


@router.put("/consents", dependencies=[access.SESSION])
async def put_consents(
    payload: ConsentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Grant or withdraw personalisation and marketing consent, each on its own."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.set_consents(:user_id, :personalisation, :marketing_email, :marketing_in_app, 'settings')",
        {
            "user_id": str(session["user_id"]),
            "personalisation": payload.personalisation,
            "marketing_email": payload.marketing_email,
            "marketing_in_app": payload.marketing_in_app,
        },
    )


@router.post("/policies/accept", dependencies=[access.SESSION])
async def accept_policies(
    payload: PolicyAcceptance,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.accept_policies(:user_id, CAST(:versions AS jsonb), 'policy_update')",
        {"user_id": str(session["user_id"]), "versions": json.dumps(payload.versions)},
    )
