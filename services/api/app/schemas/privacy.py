from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PrivacyResetOut(BaseModel):
    ok: bool
    preferences: dict[str, Any]
    identity_kept: bool
    bookings_kept: bool


class PrivacyDeleteIn(BaseModel):
    confirmation: str = Field(min_length=6, max_length=40)


class PrivacyDeleteOut(BaseModel):
    ok: bool
    status: str
    bookings_kept: int


class ConsentUpdate(BaseModel):
    """Omitted fields are left unchanged."""

    personalisation: bool | None = None
    marketing_email: bool | None = None
    marketing_in_app: bool | None = None


class PolicyAcceptance(BaseModel):
    versions: dict[str, str] = Field(min_length=1, max_length=4)
