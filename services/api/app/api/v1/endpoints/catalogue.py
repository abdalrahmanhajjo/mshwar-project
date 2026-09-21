from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import raise_hub_error
from app.catalogue.query_parser import parse_search_query, relaxation_steps
from app.catalogue.routing import estimate_travel
from app.core import access
from app.core.admin_auth import require_admin
from app.core.auth_session import require_session
from app.core.rate_limit import limit
from app.core.sql import raise_from_db
from app.dependencies import get_auth_db
from app.schemas.catalogue import (
    CatalogueCollection,
    CatalogueDestination,
    CatalogueListing,
    CataloguePage,
    CatalogueSearchOut,
    CollectionWrite,
    SearchRelaxation,
)
from app.schemas.preferences import PreferenceValues, TripOut, merge_plan_defaults

router = APIRouter()


def _listing(payload: Any) -> CatalogueListing:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid listing")
    return CatalogueListing.from_json(payload)


@router.get("/destinations", response_model=list[CatalogueDestination], dependencies=[access.PUBLIC, limit("search")])
async def list_destinations(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[CatalogueDestination]:
    row = (await db.execute(text("SELECT app.public_catalogue_destinations()"))).scalar()
    items = row if isinstance(row, list) else []
    return [CatalogueDestination.model_validate(item) for item in items]


@router.get("/experiences", response_model=CataloguePage, dependencies=[access.PUBLIC, limit("search")])
async def list_experiences(
    q: str | None = None,
    category: str | None = None,
    destination: str | None = None,
    kind: str | None = None,
    available: bool | None = None,
    price_max: int | None = Query(default=None, alias="priceMax"),
    party: int | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = Query(default=6, alias="pageSize"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> CataloguePage:
    size = min(max(page_size, 1), 48)
    current = max(page, 1)
    offset = (current - 1) * size
    rows = (
        await db.execute(
            text(
                "SELECT listing, total FROM app.public_catalogue_experiences("
                ":q, :category, :destination, :kind, :available, :price_max, :party, :sort, :lim, :off)"
            ),
            {
                "q": q,
                "category": category,
                "destination": destination,
                "kind": kind,
                "available": available,
                "price_max": price_max,
                "party": party,
                "sort": sort,
                "lim": size,
                "off": offset,
            },
        )
    ).all()
    total = int(rows[0][1]) if rows else 0
    pages = max(1, math.ceil(total / size)) if total else 1
    return CataloguePage(
        items=[_listing(row[0]) for row in rows],
        page=current,
        page_size=size,
        total=total,
        pages=pages,
    )


@router.get("/experiences/{slug}", response_model=CatalogueListing, dependencies=[access.PUBLIC, limit("search")])
async def get_experience(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> CatalogueListing:
    row = (
        await db.execute(
            text("SELECT app.public_catalogue_experience(:slug)"),
            {"slug": slug},
        )
    ).scalar()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return _listing(row)


@router.get(
    "/experiences/{slug}/related", response_model=list[CatalogueListing], dependencies=[access.PUBLIC, limit("search")]
)
async def related_experiences(
    slug: str,
    radius_m: int = Query(default=80000, ge=1000, le=300000),
    limit: int = Query(default=3, ge=1, le=12),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[CatalogueListing]:
    row = (
        await db.execute(
            text("SELECT app.public_catalogue_related(:slug, :radius, :lim)"),
            {"slug": slug, "radius": radius_m, "lim": limit},
        )
    ).scalar()
    items = row if isinstance(row, list) else []
    listings: list[CatalogueListing] = []
    for item in items:
        listing = _listing(item)
        if listing.distance_km is not None:
            travel = estimate_travel(float(listing.distance_km) * 1000)
            listing = listing.model_copy(update={"travel_seconds": int(travel["duration_seconds"])})
        listings.append(listing)
    return listings


@router.get("/search", response_model=CatalogueSearchOut, dependencies=[access.PUBLIC, limit("search")])
async def search_catalogue(
    q: str = "",
    locale: str = "en",
    category: str | None = None,
    destination: str | None = None,
    kind: str | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> CatalogueSearchOut:
    parsed = parse_search_query(q)
    dest = destination or parsed.destination
    cat = category or parsed.category
    listing_kind = kind or parsed.kind
    payload = (
        await db.execute(
            text("SELECT app.public_catalogue_search(:q, :locale, :category, :destination, :kind, :lim)"),
            {
                "q": parsed.q,
                "locale": locale,
                "category": cat,
                "destination": dest,
                "kind": listing_kind,
                "lim": limit,
            },
        )
    ).scalar()
    body = payload if isinstance(payload, dict) else {"items": [], "query": q, "locale": locale}
    raw_items = body.get("items")
    listings = [_listing(item) for item in raw_items] if isinstance(raw_items, list) else []
    for item in listings:
        if item.id is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Generated listing")
    relaxations = [SearchRelaxation(**step) for step in relaxation_steps(parsed)] if not listings else []
    return CatalogueSearchOut(
        items=listings,
        query=q,
        locale=str(body.get("locale") or locale),
        filters=parsed.filters,
        relaxations=relaxations,
    )


@router.get("/collections", response_model=list[CatalogueCollection], dependencies=[access.PUBLIC, limit("search")])
async def list_collections(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[CatalogueCollection]:
    row = (await db.execute(text("SELECT app.public_catalogue_collections()"))).scalar()
    items = row if isinstance(row, list) else []
    return [CatalogueCollection.model_validate(item) for item in items]


@router.get("/collections/{slug}", response_model=CatalogueCollection, dependencies=[access.PUBLIC, limit("search")])
async def get_collection(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> CatalogueCollection:
    row = (
        await db.execute(
            text("SELECT app.public_catalogue_collection(:slug)"),
            {"slug": slug},
        )
    ).scalar()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return CatalogueCollection.model_validate(row)


@router.post("/collections", response_model=CatalogueCollection, dependencies=[access.ADMIN])
async def upsert_collection(
    payload: CollectionWrite,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> CatalogueCollection:
    admin = await require_admin(request, db)
    try:
        slug = (
            await db.execute(
                text(
                    "SELECT app.admin_upsert_catalogue_collection("
                    ":admin, :slug, :title, :description, :kicker, :image, :alt, :accent, :status, :slugs)"
                ),
                {
                    "admin": str(admin["user_id"]),
                    "slug": payload.slug.strip(),
                    "title": payload.title.strip(),
                    "description": payload.description,
                    "kicker": payload.kicker,
                    "image": payload.image_url,
                    "alt": payload.image_alt,
                    "accent": payload.accent,
                    "status": payload.status,
                    "slugs": payload.experience_slugs,
                },
            )
        ).scalar()
    except DBAPIError as exc:
        raise_from_db(exc)
    row = (
        await db.execute(
            text("SELECT app.public_catalogue_collection(:slug)"),
            {"slug": slug},
        )
    ).scalar()
    if row is None:
        return CatalogueCollection(
            slug=str(slug),
            title=payload.title.strip(),
            description=payload.description,
            kicker=payload.kicker,
            image=payload.image_url,
            image_alt=payload.image_alt,
            accent=payload.accent,
            stops=len(payload.experience_slugs),
            experience_slugs=payload.experience_slugs,
        )
    return CatalogueCollection.model_validate(row)


@router.post("/collections/{slug}/open-as-trip", response_model=TripOut, dependencies=[access.SESSION])
async def open_collection_as_trip(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> TripOut:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text(
                    "SELECT trip_id, title, status, preference_overrides "
                    "FROM app.create_trip_from_collection(:user_id, :slug)"
                ),
                {"user_id": str(session["user_id"]), "slug": slug},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Collection not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    stored = row[3] if isinstance(row[3], dict) else {}
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
        preference_overrides=stored,
        effective_defaults=merge_plan_defaults(profile_prefs, stored),
    )


@router.post("/experiences/{slug}/publish", response_model=dict[str, str], dependencies=[access.SESSION])
async def publish_experience(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, str]:
    session = await require_session(request, db)
    return await _transition(db, str(session["user_id"]), slug, "published")


@router.post("/experiences/{slug}/unpublish", response_model=dict[str, str], dependencies=[access.SESSION])
async def unpublish_experience(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, str]:
    session = await require_session(request, db)
    return await _transition(db, str(session["user_id"]), slug, "paused")


async def _transition(db: AsyncSession, actor_id: str, slug: str, target: str) -> dict[str, str]:
    """Only a platform admin or the listing's own business may change its status."""
    try:
        status_value = (
            await db.execute(
                text("SELECT app.set_listing_status(:actor, :slug, :target)"),
                {"actor": actor_id, "slug": slug, "target": target},
            )
        ).scalar()
    except DBAPIError as exc:
        raise_hub_error(exc, "Listing not found")
        raise
    return {"slug": slug, "status": str(status_value)}
