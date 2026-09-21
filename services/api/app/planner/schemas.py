from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

LOCALES = frozenset({"ar", "ar-LB", "en", "fr", "mixed"})
INTENSITY = frozenset({"relaxed", "moderate", "active", "strenuous"})
PRICE_KINDS = frozenset({"fixed", "estimate", "quote"})
FORBIDDEN_LLM_KEYS = frozenset(
    {
        "total",
        "total_minor",
        "price",
        "amount",
        "book",
        "booking",
        "payment",
        "pay",
        "charge",
        "stop_ids",
        "experience_ids",
        "places",
    }
)


class ExtractedConstraints(BaseModel):
    """LLM-facing intent object. Extra keys are rejected (injection / hallucination)."""

    model_config = ConfigDict(extra="forbid")

    locale: str = "en"
    destination_slugs: list[str] = Field(default_factory=list)
    category_slugs: list[str] = Field(default_factory=list)
    kind_slugs: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    intensity: str | None = None
    party_size: int | None = Field(default=None, ge=1, le=20)
    window_start: datetime | None = None
    return_by: datetime | None = None
    start_lat: float | None = None
    start_lng: float | None = None
    budget_minor: int | None = Field(default=None, ge=0)
    currency: str = "USD"
    strict_budget: bool | None = None
    max_travel_minutes: int | None = Field(default=None, ge=15, le=720)
    dietary: list[str] = Field(default_factory=list)
    accessibility: list[str] = Field(default_factory=list)
    query: str = ""

    @field_validator("locale")
    @classmethod
    def locale_supported(cls, value: str) -> str:
        if value not in LOCALES:
            return "mixed"
        return value

    @field_validator("intensity")
    @classmethod
    def intensity_controlled(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in INTENSITY:
            raise ValueError("invalid intensity")
        return value

    @field_validator("currency")
    @classmethod
    def currency_iso(cls, value: str) -> str:
        code = (value or "USD").strip().upper()
        if len(code) != 3 or not code.isalpha():
            return "USD"
        return code


class ClarificationQuestion(BaseModel):
    field: str
    prompt: str
    required: bool = True


class AssumedDefault(BaseModel):
    field: str
    value: Any
    label: str


class RefinementIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    understood: bool
    summary: str = ""
    clarification: str | None = None
    prefer_less_driving: bool | None = None
    intensity: str | None = None
    interests_add: list[str] = Field(default_factory=list)
    interests_remove: list[str] = Field(default_factory=list)
    destination_slugs: list[str] = Field(default_factory=list)
    category_slugs: list[str] = Field(default_factory=list)
    budget_minor: int | None = Field(default=None, ge=0)
    strict_budget: bool | None = None
    party_size: int | None = Field(default=None, ge=1, le=20)
    max_travel_minutes: int | None = Field(default=None, ge=15, le=720)

    @field_validator("intensity")
    @classmethod
    def intensity_controlled(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in INTENSITY:
            raise ValueError("invalid intensity")
        return value


class StopExplanationDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experience_id: UUID
    text: str
    source_facts: list[str] = Field(default_factory=list)


class CandidateRecord(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str = ""
    status: str
    duration_minutes: int
    min_party: int = 1
    max_party: int = 8
    setting: str | None = None
    intensity: int | None = None
    listing_kind: str | None = None
    inventory_available: bool | None = None
    destination_slug: str
    destination_name: str = ""
    venue_id: UUID
    venue_name: str = ""
    lat: float
    lng: float
    fts: float = 0
    vec: float = 0
    hybrid: float = 0
    sponsored: bool = False
    sponsored_label: str | None = None
    category_slugs: list[str] = Field(default_factory=list)
    interest_slugs: list[str] = Field(default_factory=list)
    price: dict[str, Any] = Field(default_factory=dict)
    hours: list[dict[str, Any]] = Field(default_factory=list)
    exceptions: list[dict[str, Any]] = Field(default_factory=list)
    facts: list[Any] = Field(default_factory=list)


class EligibilityResult(BaseModel):
    candidate: CandidateRecord
    eligible: bool
    blocked: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)


class RankedCandidate(BaseModel):
    candidate: CandidateRecord
    score: float
    eligible: bool
    sponsored: bool
    reasons: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)


class AssembledStop(BaseModel):
    experience_id: UUID
    position: int
    starts_at: datetime
    ends_at: datetime
    estimated_minor: int
    price_kind: str
    locked: bool = False
    snapshot: dict[str, Any] = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)
    explanation: str = ""


class AssembledLeg(BaseModel):
    position: int
    provider: str
    fetched_at: datetime
    expires_at: datetime
    distance_m: int
    duration_seconds: int
    estimated_minor: int = 0
    status: str = "available"


class CostItem(BaseModel):
    kind: str
    label: str
    amount_minor: int
    price_label: str = "fixed"


class AssembledPlan(BaseModel):
    stops: list[AssembledStop]
    legs: list[AssembledLeg]
    cost_items: list[CostItem] = Field(default_factory=list)
    total_minor: int
    currency: str = "USD"
    forced_lock_changes: list[str] = Field(default_factory=list)
    budget_warning: str | None = None
    needs_budget_approval: bool = False
    infeasible: bool = False
    infeasible_reason: str | None = None


class IntentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    locale: str = "en"
    session_id: UUID | None = None
    trip_id: UUID | None = None
    answers: dict[str, Any] = Field(default_factory=dict)
    approve_budget: bool = False
    fault_inject: str | None = None


class ManualPlanRequest(BaseModel):
    """Hand-picked itinerary: ordered published places plus basic day settings."""

    experience_slugs: list[str] = Field(min_length=1, max_length=12)
    destination_slugs: list[str] = Field(default_factory=list, max_length=8)
    party_size: int | None = Field(default=None, ge=1, le=20)
    window_start: datetime | None = None
    budget_minor: int | None = Field(default=None, ge=0)
    strict_budget: bool | None = None
    currency: str = "USD"
    start_lat: float | None = None
    start_lng: float | None = None
    title: str | None = Field(default=None, max_length=120)
    trip_id: UUID | None = None
    locale: str = "en"


class LockRequest(BaseModel):
    stop_id: UUID
    locked: bool = True


class RegenerateRequest(BaseModel):
    fault_inject: str | None = None


class ReplacePreviewRequest(BaseModel):
    stop_id: UUID
    experience_id: UUID


class ReplaceAcceptRequest(BaseModel):
    preview_id: str


class RefineRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    apply: bool = False


class LinkBookingRequest(BaseModel):
    booking_id: UUID


class RankerWeightsIn(BaseModel):
    version: str = Field(min_length=1, max_length=40)
    weights: dict[str, float]
    notes: str = ""
