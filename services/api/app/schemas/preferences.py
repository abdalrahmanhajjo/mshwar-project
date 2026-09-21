from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

INTENSITY = frozenset({"relaxed", "moderate", "active", "strenuous"})
LOCALES = frozenset({"ar", "en", "fr"})


class PreferenceTerm(BaseModel):
    kind: str
    slug: str
    label: str


class HomeArea(BaseModel):
    id: UUID
    slug: str
    name: str
    country_code: str


class PreferenceValues(BaseModel):
    source: str = "explicit"
    home_area_id: UUID | None = None
    default_group_size: int | None = Field(default=None, ge=1, le=20)
    activity_intensity: str | None = None
    dietary: list[str] = Field(default_factory=list)
    accessibility: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    start_location: dict[str, Any] | None = None

    @field_validator("source")
    @classmethod
    def source_is_explicit(cls, value: str) -> str:
        if value != "explicit":
            raise ValueError("Preferences are never inferred")
        return value

    @field_validator("activity_intensity")
    @classmethod
    def intensity_is_controlled(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in INTENSITY:
            raise ValueError("Invalid activity intensity")
        return value

    @field_validator("dietary", "accessibility", "interests")
    @classmethod
    def unique_slugs(cls, value: list[str]) -> list[str]:
        seen: list[str] = []
        for item in value:
            slug = item.strip()
            if slug and slug not in seen:
                seen.append(slug)
        return seen


class ProfileOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    locale: str
    preferences: PreferenceValues
    home_area: HomeArea | None = None


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    locale: str = "en"
    preferences: PreferenceValues = Field(default_factory=PreferenceValues)

    @field_validator("locale")
    @classmethod
    def locale_is_supported(cls, value: str) -> str:
        if value not in LOCALES:
            raise ValueError("Invalid locale")
        return value


class AreaCatalog(BaseModel):
    source: str = "catalog"
    picker: str = "map"
    replace_with: str = "none"
    areas: list[HomeArea]


class VocabularyCatalog(BaseModel):
    dietary: list[PreferenceTerm]
    accessibility: list[PreferenceTerm]
    interest: list[PreferenceTerm]
    activity_intensity: list[PreferenceTerm]


class TripOut(BaseModel):
    id: UUID
    name: str
    status: str
    preference_overrides: dict[str, Any]
    effective_defaults: PreferenceValues


class PreferencePatch(BaseModel):
    home_area_id: UUID | None = None
    default_group_size: int | None = Field(default=None, ge=1, le=20)
    activity_intensity: str | None = None
    dietary: list[str] | None = None
    accessibility: list[str] | None = None
    interests: list[str] | None = None
    start_location: dict[str, Any] | None = None

    @field_validator("activity_intensity")
    @classmethod
    def intensity_is_controlled(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in INTENSITY:
            raise ValueError("Invalid activity intensity")
        return value


class TripCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    preference_overrides: PreferencePatch | None = None


def merge_plan_defaults(profile: PreferenceValues, overrides: dict[str, Any]) -> PreferenceValues:
    """Overrides replace individual defaults. They are never hard constraints."""
    payload = profile.model_dump()
    for key, value in overrides.items():
        if key in {"source", "collection_slug"}:
            continue
        if value is None:
            continue
        if value == []:
            continue
        payload[key] = value
    payload["source"] = "explicit"
    return PreferenceValues.model_validate(payload)


def intensity_terms() -> list[PreferenceTerm]:
    labels = {
        "relaxed": "Relaxed",
        "moderate": "Moderate",
        "active": "Active",
        "strenuous": "Strenuous",
    }
    return [PreferenceTerm(kind="activity_intensity", slug=slug, label=labels[slug]) for slug in labels]
