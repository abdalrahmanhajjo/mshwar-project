from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.auth_session import load_session
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.sessions import COOKIE_NAME
from app.dependencies import get_auth_db
from app.schemas.preferences import (
    HomeArea,
    PreferenceTerm,
    PreferenceValues,
    ProfileOut,
    ProfileUpdate,
    VocabularyCatalog,
    intensity_terms,
)

router = APIRouter()


async def _require_session(
    request: Request,
    db: AsyncSession,
) -> dict[str, Any]:
    session = await load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session


def _prefs_from_row(raw: object) -> PreferenceValues:
    payload = raw if isinstance(raw, dict) else {}
    return PreferenceValues.model_validate(payload)


async def _area_by_id(db: AsyncSession, area_id: UUID | None) -> HomeArea | None:
    if area_id is None:
        return None
    row = (
        await db.execute(
            text("SELECT id, slug, name, country_code FROM app.list_home_areas() WHERE id = :id"),
            {"id": str(area_id)},
        )
    ).first()
    if row is None:
        return None
    return HomeArea(id=row[0], slug=row[1], name=row[2], country_code=row[3])


@router.get("", response_model=ProfileOut, dependencies=[access.SESSION])
async def get_profile(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ProfileOut:
    session = await _require_session(request, db)
    row = (
        await db.execute(
            text("SELECT user_id, display_name, locale, email, preferences FROM app.get_profile(:user_id)"),
            {"user_id": str(session["user_id"])},
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    prefs = _prefs_from_row(row[4])
    return ProfileOut(
        id=row[0],
        display_name=row[1],
        locale=row[2],
        email=row[3],
        preferences=prefs,
        home_area=await _area_by_id(db, prefs.home_area_id),
    )


@router.put("", response_model=ProfileOut, dependencies=[access.SESSION])
async def put_profile(
    payload: ProfileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ProfileOut:
    session = await _require_session(request, db)
    try:
        result = await db.execute(
            text("SELECT app.upsert_profile(:user_id, :display_name, :locale, CAST(:prefs AS jsonb))"),
            {
                "user_id": str(session["user_id"]),
                "display_name": payload.display_name.strip(),
                "locale": payload.locale,
                "prefs": payload.preferences.model_dump_json(),
            },
        )
        stored = result.scalar_one()
    except DBAPIError as exc:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid preferences") from exc
    prefs = _prefs_from_row(stored)
    email = session["email"]
    return ProfileOut(
        id=session["user_id"],
        email=email,
        display_name=payload.display_name.strip(),
        locale=payload.locale,
        preferences=prefs,
        home_area=await _area_by_id(db, prefs.home_area_id),
    )


@router.get("/vocabularies", response_model=VocabularyCatalog, dependencies=[access.PUBLIC])
async def get_vocabularies(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> VocabularyCatalog:
    rows = (await db.execute(text("SELECT kind, slug, label FROM app.list_preference_terms()"))).all()
    grouped: dict[str, list[PreferenceTerm]] = {"dietary": [], "accessibility": [], "interest": []}
    for kind, slug, label in rows:
        grouped.setdefault(kind, []).append(PreferenceTerm(kind=kind, slug=slug, label=label))
    return VocabularyCatalog(
        dietary=grouped["dietary"],
        accessibility=grouped["accessibility"],
        interest=grouped["interest"],
        activity_intensity=intensity_terms(),
    )
