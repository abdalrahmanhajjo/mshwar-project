"""Start-location picker: search, reverse geocode, and profile persistence."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.profile import _area_by_id
from app.core import access
from app.core.auth_session import require_session
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.rate_limit import limit
from app.dependencies import get_auth_db
from app.planner.places import autocomplete, reverse_geocode
from app.schemas.planner import PlaceOut, StartLocationSave
from app.schemas.preferences import AreaCatalog, HomeArea, PreferenceValues, ProfileOut

router = APIRouter()


@router.get("/areas", response_model=AreaCatalog, dependencies=[access.PUBLIC])
async def list_areas(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> AreaCatalog:
    rows = (await db.execute(text("SELECT id, slug, name, country_code FROM app.list_home_areas()"))).all()
    return AreaCatalog(
        source="catalog",
        picker="map",
        replace_with="none",
        areas=[HomeArea(id=row[0], slug=row[1], name=row[2], country_code=row[3]) for row in rows],
    )


@router.get("/autocomplete", response_model=list[PlaceOut], dependencies=[access.SESSION, limit("maps")])
async def place_autocomplete(
    request: Request,
    q: str = Query(default="", max_length=120),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[PlaceOut]:
    await require_session(request, db)
    return [
        PlaceOut(label=hit.label, lat=hit.lat, lng=hit.lng, source=hit.source, place_id=hit.place_id)
        for hit in autocomplete(q)
    ]


@router.get("/reverse", response_model=PlaceOut, dependencies=[access.SESSION, limit("maps")])
async def reverse_place(
    request: Request,
    lat: float,
    lng: float,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> PlaceOut:
    await require_session(request, db)
    hit = reverse_geocode(lat, lng)
    return PlaceOut(label=hit.label, lat=hit.lat, lng=hit.lng, source=hit.source, place_id=hit.place_id)


@router.post("/start", response_model=ProfileOut, dependencies=[access.SESSION])
async def save_start_location(
    payload: StartLocationSave,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    if payload.source not in {"search", "pin", "device", "manual"}:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid source")
    row = (
        await db.execute(
            text("SELECT user_id, display_name, locale, email, preferences FROM app.get_profile(:user_id)"),
            {"user_id": str(session["user_id"])},
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    prefs = PreferenceValues.model_validate(row[4] if isinstance(row[4], dict) else {})
    if payload.save_as_default:
        prefs.start_location = {
            "lat": payload.lat,
            "lng": payload.lng,
            "label": payload.label,
            "source": payload.source,
        }
        stored = (
            await db.execute(
                text("SELECT app.upsert_profile(:user_id, :display_name, :locale, CAST(:prefs AS jsonb))"),
                {
                    "user_id": str(session["user_id"]),
                    "display_name": row[1],
                    "locale": row[2],
                    "prefs": prefs.model_dump_json(),
                },
            )
        ).scalar_one()
        prefs = PreferenceValues.model_validate(stored)
    return ProfileOut(
        id=row[0],
        display_name=row[1],
        locale=row[2],
        email=row[3],
        preferences=prefs,
        home_area=await _area_by_id(db, prefs.home_area_id),
    )
