from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.catalogue.price import PriceModel
from app.core import imagekit


class CatalogueListing(BaseModel):
    id: UUID
    slug: str
    title: str
    summary: str | None = None
    body: str
    category: str
    tags: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    suitability: list[str] = Field(default_factory=list)
    destination_slug: str
    place_label: str
    hours: float
    booking_mode: str
    kind: str
    available: bool = True
    weather_sensitivity: str
    setting: str | None = None
    group_min: int = 1
    group_max: int = 8
    facts: list[dict[str, str]] = Field(default_factory=list)
    rating: float | None = None
    lat: float | None = None
    lng: float | None = None
    distance_km: float | None = None
    travel_seconds: int | None = None
    image: str | None = None
    image_alt: str | None = None
    gallery: list[str] = Field(default_factory=list)
    price: PriceModel
    score: float | None = None

    @classmethod
    def from_json(cls, payload: dict[str, Any]) -> CatalogueListing:
        data = dict(payload)
        data["price"] = PriceModel.from_row(data.get("price") if isinstance(data.get("price"), dict) else {})
        facts = data.get("facts") or []
        data["facts"] = [item for item in facts if isinstance(item, dict)]
        data["image"] = public_image(data.get("image"))
        data["gallery"] = [url for url in (public_image(key) for key in data.get("gallery") or []) if url]
        return cls.model_validate(data)


def public_image(key: object) -> str | None:
    """Catalogue rows carry storage keys; clients get ImageKit URLs when ImageKit is configured."""
    if not isinstance(key, str) or not key:
        return None
    if key.startswith(("https://", "/")) or not imagekit.enabled():
        return key
    return imagekit.delivery_url(key)


class CataloguePage(BaseModel):
    items: list[CatalogueListing]
    page: int
    page_size: int
    total: int
    pages: int


class CatalogueDestination(BaseModel):
    id: UUID
    slug: str
    name: str
    region: str
    country: str = "Lebanon"
    blurb: str = ""
    image: str | None = None
    image_alt: str | None = None
    lat: float | None = None
    lng: float | None = None
    tags: list[str] = Field(default_factory=list)


class SearchRelaxation(BaseModel):
    drop: str
    label: str


class CatalogueSearchOut(BaseModel):
    items: list[CatalogueListing]
    query: str
    locale: str
    filters: dict[str, str] = Field(default_factory=dict)
    relaxations: list[SearchRelaxation] = Field(default_factory=list)


class CatalogueCollection(BaseModel):
    slug: str
    title: str
    description: str
    kicker: str = ""
    image: str | None = None
    image_alt: str | None = None
    accent: bool = False
    stops: int = 0
    experience_slugs: list[str] = Field(default_factory=list)
    price_from: float = 0


class CollectionWrite(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    kicker: str = ""
    image_url: str | None = None
    image_alt: str | None = None
    accent: bool = False
    status: str = "draft"
    experience_slugs: list[str] = Field(default_factory=list)


class FavoriteToggleOut(BaseModel):
    id: UUID
    listing_slug: str
    created_at: str
    saved: bool


class FavoriteMergeIn(BaseModel):
    listing_slugs: list[str] = Field(default_factory=list)


class FavoriteMergeOut(BaseModel):
    merged: int
