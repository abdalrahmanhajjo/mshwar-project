from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.guests import (
    GUEST_COOKIE,
    actor_ids,
    hash_opaque_token,
    new_opaque_token,
    optional_user,
    set_guest_cookie,
)
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.groups import JoinShareIn, SharedPreferencesIn, ShareLinkCreate, SuggestionCreate, VoteIn

router = APIRouter()


def _actor_params(user_id: str | None, guest_id: str | None) -> dict[str, Any]:
    return {"user_id": user_id, "guest_id": guest_id}


@router.post("/trips/{trip_id}/share-links", dependencies=[access.SESSION])
async def create_share_link(
    trip_id: UUID,
    payload: ShareLinkCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await optional_user(request, db)
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = str(session["user_id"])
    token = new_opaque_token()
    created = await fetch_json(
        db,
        "SELECT app.create_share_link(:owner, :trip, :token_hash, :role, :allow_guest, :expires_at)",
        {
            "owner": user_id,
            "trip": str(trip_id),
            "token_hash": hash_opaque_token(token),
            "role": payload.role,
            "allow_guest": payload.allow_guest,
            "expires_at": payload.expires_at,
        },
    )
    created = dict(created or {})
    created["token"] = token
    created["join_path"] = f"/join/{token}"
    return created


@router.get("/trips/{trip_id}/share-links", dependencies=[access.ACTOR])
async def list_share_links(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.list_share_links(:owner, :trip)",
        {"owner": user_id, "trip": str(trip_id)},
    )


@router.post("/share-links/{link_id}/revoke", dependencies=[access.ACTOR])
async def revoke_share_link(
    link_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.revoke_share_link(:owner, :link)",
        {"owner": user_id, "link": str(link_id)},
    )


@router.get("/join/{token}", dependencies=[access.TOKEN])
async def peek_share_link(
    token: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.peek_share_link(:token_hash)",
        {"token_hash": hash_opaque_token(token)},
    )


@router.post("/join/{token}", dependencies=[access.TOKEN])
async def join_share_link(
    token: str,
    payload: JoinShareIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await optional_user(request, db)
    user_id = str(session["user_id"]) if session else None
    guest_token = request.cookies.get(GUEST_COOKIE) or new_opaque_token()
    if user_id is None:
        set_guest_cookie(response, guest_token)
    return await fetch_json(
        db,
        "SELECT app.join_share_link(:token_hash, :user_id, :guest_hash, :name)",
        {
            "token_hash": hash_opaque_token(token),
            "user_id": user_id,
            "guest_hash": None if user_id else hash_opaque_token(guest_token),
            "name": payload.display_name,
        },
    )


@router.get("/trips/{trip_id}", dependencies=[access.ACTOR])
async def get_group_trip(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.get_group_trip(:trip, :user_id, :guest_id)",
        {"trip": str(trip_id), **_actor_params(user_id, guest_id)},
    )


@router.get("/trips/{trip_id}/itinerary", dependencies=[access.ACTOR])
async def get_group_itinerary(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.get_group_itinerary(:trip, :user_id, :guest_id)",
        {"trip": str(trip_id), **_actor_params(user_id, guest_id)},
    )


@router.get("/trips/{trip_id}/participants", dependencies=[access.ACTOR])
async def list_participants(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.list_group_participants(:trip, :user_id, :guest_id)",
        {"trip": str(trip_id), **_actor_params(user_id, guest_id)},
    )


@router.put("/trips/{trip_id}/shared-preferences", dependencies=[access.ACTOR])
async def set_shared_preferences(
    trip_id: UUID,
    payload: SharedPreferencesIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.set_shared_preferences(:trip, :user_id, CAST(:prefs AS jsonb))",
        {"trip": str(trip_id), "user_id": user_id, "prefs": json.dumps(payload.shared_preferences)},
    )


@router.post("/trips/{trip_id}/suggestions", dependencies=[access.ACTOR, limit("community-write")])
async def add_suggestion(
    trip_id: UUID,
    payload: SuggestionCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.add_trip_suggestion(:trip, :user_id, :guest_id, :experience_id, :term_id)",
        {
            "trip": str(trip_id),
            **_actor_params(user_id, guest_id),
            "experience_id": str(payload.experience_id) if payload.experience_id else None,
            "term_id": str(payload.term_id) if payload.term_id else None,
        },
    )


@router.get("/trips/{trip_id}/suggestions", dependencies=[access.ACTOR])
async def list_suggestions(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.list_trip_suggestions(:trip, :user_id, :guest_id)",
        {"trip": str(trip_id), **_actor_params(user_id, guest_id)},
    )


@router.put("/trips/{trip_id}/votes", dependencies=[access.ACTOR, limit("community-write")])
async def cast_vote(
    trip_id: UUID,
    payload: VoteIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.cast_group_vote(:trip, :user_id, :guest_id, :experience_id, :term_id, :value)",
        {
            "trip": str(trip_id),
            **_actor_params(user_id, guest_id),
            "experience_id": str(payload.experience_id) if payload.experience_id else None,
            "term_id": str(payload.term_id) if payload.term_id else None,
            "value": payload.value,
        },
    )


@router.get("/trips/{trip_id}/tally", dependencies=[access.ACTOR])
async def vote_tally(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.group_vote_tally(:trip, :user_id, :guest_id)",
        {"trip": str(trip_id), **_actor_params(user_id, guest_id)},
    )


@router.post("/trips/{trip_id}/lock", dependencies=[access.ACTOR])
async def lock_trip(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.lock_group_trip(:owner, :trip)",
        {"owner": user_id, "trip": str(trip_id)},
    )


@router.get("/trips/{trip_id}/summary", dependencies=[access.ACTOR])
async def group_summary(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.group_recommendation_summary(:trip, :user_id, :guest_id)",
        {"trip": str(trip_id), **_actor_params(user_id, guest_id)},
    )
