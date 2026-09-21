from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import page_args, raise_hub_error
from app.core import access
from app.core.auth_session import require_session
from app.dependencies import get_auth_db
from app.schemas.catalogue import FavoriteMergeIn, FavoriteMergeOut, FavoriteToggleOut
from app.schemas.hub import FavoriteCreate, FavoriteListOut, FavoriteOut

router = APIRouter()


@router.get("", response_model=FavoriteListOut, dependencies=[access.SESSION])
async def list_favorites(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    paging: tuple[int, int, int] = Depends(page_args),
) -> FavoriteListOut:
    session = await require_session(request, db)
    page, page_size, offset = paging
    rows = (
        await db.execute(
            text("SELECT id, listing_slug, created_at, total FROM app.list_my_favorites(:user_id, :lim, :off)"),
            {"user_id": str(session["user_id"]), "lim": page_size, "off": offset},
        )
    ).all()
    total = int(rows[0][3]) if rows else 0
    return FavoriteListOut(
        items=[FavoriteOut(id=row[0], listing_slug=row[1], created_at=row[2]) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("", response_model=FavoriteOut, dependencies=[access.SESSION])
async def add_favorite(
    payload: FavoriteCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> FavoriteOut:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT id, listing_slug, created_at FROM app.add_my_favorite(:user_id, :slug)"),
                {"user_id": str(session["user_id"]), "slug": payload.listing_slug.strip()},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Favorite not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not save favorite")
    return FavoriteOut(id=row[0], listing_slug=row[1], created_at=row[2])


@router.post("/toggle", response_model=FavoriteToggleOut, dependencies=[access.SESSION])
async def toggle_favorite(
    payload: FavoriteCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> FavoriteToggleOut:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT id, listing_slug, created_at, saved FROM app.toggle_my_favorite(:user_id, :slug)"),
                {"user_id": str(session["user_id"]), "slug": payload.listing_slug.strip()},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Favorite not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not toggle favorite")
    return FavoriteToggleOut(
        id=row[0],
        listing_slug=row[1],
        created_at=row[2].isoformat(),
        saved=bool(row[3]),
    )


@router.post("/merge", response_model=FavoriteMergeOut, dependencies=[access.SESSION])
async def merge_favorites(
    payload: FavoriteMergeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> FavoriteMergeOut:
    session = await require_session(request, db)
    merged = (
        await db.execute(
            text("SELECT app.merge_my_favorites(:user_id, :slugs)"),
            {"user_id": str(session["user_id"]), "slugs": payload.listing_slugs},
        )
    ).scalar()
    return FavoriteMergeOut(merged=int(merged or 0))


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[access.SESSION])
async def remove_favorite(
    favorite_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> None:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.remove_my_favorite(:user_id, :favorite_id)"),
                {"user_id": str(session["user_id"]), "favorite_id": str(favorite_id)},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Favorite not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
