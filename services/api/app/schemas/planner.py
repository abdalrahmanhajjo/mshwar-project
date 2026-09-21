from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    label: str | None = None


class StartLocation(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    label: str = Field(min_length=1, max_length=200)
    source: str = "manual"


class RouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    mode: str = "driving"
    departure_at: datetime | None = None
    plan_id: str | None = None


class RouteLegOut(BaseModel):
    origin: Coordinate
    destination: Coordinate
    mode: str
    available: bool
    provider: str
    source: str
    distance_m: int | None = None
    duration_seconds: int | None = None
    cache_hit: bool = False
    time_bucket: str
    fetched_at: datetime | None = None
    presented_as: str


class RoutingCostOut(BaseModel):
    plan_id: str
    provider: str
    elements_requested: int
    cache_hits: int
    cache_misses: int
    estimated_usd_micros: int
    within_budget: bool
    budget_usd_micros: int
    documented_rate: str


class PlaceOut(BaseModel):
    label: str
    lat: float
    lng: float
    source: str
    place_id: str


class StartLocationSave(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    label: str = Field(min_length=1, max_length=200)
    source: str = "manual"
    save_as_default: bool = True


MAX_PLAN_STOPS = 12  # keep in sync with app.planner.optimizer.MAX_OPTIMIZE_STOPS


class OptimizeStopIn(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    label: str = Field(default="Stop", max_length=200)
    duration_minutes: int = Field(default=60, ge=1, le=24 * 60)
    locked: bool = False
    position: int | None = Field(default=None, ge=1, le=MAX_PLAN_STOPS)
    window_start: datetime | None = None
    window_end: datetime | None = None
    closes_at: datetime | None = None
    weather_sensitivity: str = "outdoor"
    estimated_minor: int = Field(default=0, ge=0)
    indoor_alternative_id: str | None = None


class OptimizeRequest(BaseModel):
    start: Coordinate
    stops: list[OptimizeStopIn] = Field(max_length=MAX_PLAN_STOPS)
    window_start: datetime
    return_by: datetime
    mode: str = "driving"
    plan_id: str | None = Field(default=None, max_length=80)
    timeout_ms: int = Field(default=2000, ge=50, le=5000)


class OrderedStopOut(BaseModel):
    id: str
    label: str
    lat: float
    lng: float
    position: int
    locked: bool
    arrives_at: datetime | None = None
    departs_at: datetime | None = None
    duration_minutes: int
    weather_sensitivity: str
    estimated_minor: int = 0


class OptimizeResponse(BaseModel):
    feasible: bool
    reason: str | None = None
    solver: str
    fallback: bool
    timeout: bool
    ordered_stops: list[OrderedStopOut]
    legs: list[RouteLegOut]
    total_distance_m: int | None = None
    total_duration_seconds: int | None = None
    metrics_available: bool
    routing_cost: RoutingCostOut
    solve_ms: float
    window_start: datetime
    return_by: datetime


class ForecastQuery(BaseModel):
    lat: float
    lng: float
    forecast_date: str


class ForecastOut(BaseModel):
    available: bool
    provider: str
    source: str
    fetched_at: datetime | None = None
    forecast_date: str
    lat: float
    lng: float
    precip_mm: float | None = None
    wind_kmh: float | None = None
    temp_max_c: float | None = None
    temp_min_c: float | None = None
    weather_code: int | None = None
    attribution: str = ""


class WarningStopIn(BaseModel):
    id: str
    label: str
    lat: float
    lng: float
    forecast_date: str
    weather_sensitivity: str = "outdoor"


class WarningEvalRequest(BaseModel):
    stops: list[WarningStopIn]
    booking_ids: list[str] = Field(default_factory=list)
    booking_statuses: dict[str, str] = Field(default_factory=dict)


class WeatherWarningOut(BaseModel):
    stop_id: str
    stop_label: str
    severity: str
    reasons: list[str]
    source: str
    fetched_at: datetime | None = None
    forecast_date: str


class WarningEvalResponse(BaseModel):
    warnings: list[WeatherWarningOut]
    forecast_unavailable: bool
    bookings_mutated: bool
    booking_statuses: dict[str, str]


class ThresholdIn(BaseModel):
    key: str
    value_numeric: float
