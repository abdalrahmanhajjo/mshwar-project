from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ShareLinkCreate(BaseModel):
    role: str = Field(pattern="^(view|vote|edit)$")
    allow_guest: bool = False
    expires_at: datetime | None = None


class ShareLinkOut(BaseModel):
    id: UUID
    trip_id: UUID | None = None
    role: str
    allow_guest: bool = False
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    token: str | None = None
    join_path: str | None = None


class JoinShareIn(BaseModel):
    display_name: str = Field(default="Guest", min_length=1, max_length=80)


class SuggestionCreate(BaseModel):
    experience_id: UUID | None = None
    term_id: UUID | None = None


class VoteIn(BaseModel):
    experience_id: UUID | None = None
    term_id: UUID | None = None
    value: int = Field(ge=-1, le=1)


class SharedPreferencesIn(BaseModel):
    shared_preferences: dict[str, Any] = Field(default_factory=dict)


class ReviewSubmitIn(BaseModel):
    booking_id: UUID
    rating: int = Field(ge=1, le=5)
    body: str = Field(min_length=3, max_length=4000)
    dimensions: dict[str, Any] = Field(default_factory=dict)


class ReviewReportIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ReviewResponseIn(BaseModel):
    body: str = Field(min_length=3, max_length=4000)
