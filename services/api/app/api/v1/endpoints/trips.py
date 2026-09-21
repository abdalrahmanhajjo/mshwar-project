from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import page_args, raise_hub_error
from app.core import access
from app.core.auth_session import require_session
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.dependencies import get_auth_db
from app.schemas.hub import TripListOut, TripSummary
from app.schemas.preferences import PreferenceValues, TripCreate, TripOut, merge_plan_defaults

router = APIRouter()


@router.get("", response_model=TripListOut, dependencies=[access.SESSION])
async def list_trips(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    paging: tuple[int, int, int] = Depends(page_args),
) -> TripListOut:
    session = await require_session(request, db)
    page, page_size, offset = paging
    rows = (
        await db.execute(
            text(
                "SELECT id, title, status, created_at, total, planned_date, stop_count "
                "FROM app.list_my_trips(:user_id, :lim, :off)"
            ),
            {"user_id": str(session["user_id"]), "lim": page_size, "off": offset},
        )
    ).all()
    total = int(rows[0][4]) if rows else 0
    return TripListOut(
        items=[
            TripSummary(
                id=row[0],
                name=row[1],
                status=row[2],
                created_at=row[3],
                planned_date=row[5],
                stop_count=int(row[6] or 0),
            )
            for row in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("", response_model=TripOut, dependencies=[access.SESSION])
async def create_trip(
    trip: TripCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> TripOut:
    session = await require_session(request, db)
    overrides = (
        trip.preference_overrides.model_dump(mode="json", exclude_unset=True) if trip.preference_overrides else {}
    )
    try:
        row = (
            await db.execute(
                text(
                    "SELECT trip_id, title, status, preference_overrides "
                    "FROM app.create_trip_draft(:user_id, :title, CAST(:overrides AS jsonb))"
                ),
                {
                    "user_id": str(session["user_id"]),
                    "title": trip.name.strip(),
                    "overrides": json.dumps(overrides) if overrides else "{}",
                },
            )
        ).first()
    except DBAPIError as exc:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid trip") from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create trip")
    stored_overrides = row[3] if isinstance(row[3], dict) else {}
    profile_row = (
        await db.execute(
            text("SELECT app.personalisation_preferences(:user_id) AS preferences"),
            {"user_id": str(session["user_id"])},
        )
    ).first()
    profile_prefs = PreferenceValues.model_validate(profile_row[0] if profile_row else {})
    return TripOut(
        id=row[0],
        name=row[1],
        status=row[2],
        preference_overrides=stored_overrides,
        effective_defaults=merge_plan_defaults(profile_prefs, stored_overrides),
    )


@router.post("/{trip_id}/archive", response_model=TripSummary, dependencies=[access.SESSION])
async def archive_trip(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> TripSummary:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT id, title, status, created_at FROM app.archive_my_trip(:user_id, :trip_id)"),
                {"user_id": str(session["user_id"]), "trip_id": str(trip_id)},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Trip not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return TripSummary(id=row[0], name=row[1], status=row[2], created_at=row[3])
