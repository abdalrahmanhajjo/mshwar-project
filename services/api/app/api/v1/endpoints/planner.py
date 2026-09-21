from __future__ import annotations

import json
from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core import access
from app.core.admin_auth import require_admin
from app.core.auth_session import require_session
from app.core.config import settings
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.rate_limit import limit
from app.core.sql import fetch_json, raise_from_db
from app.dependencies import get_auth_db
from app.planner.budget import AI_BUDGET, budget_status
from app.planner.manual import build_manual
from app.planner.optimizer import OptimizeStop, optimize_route
from app.planner.persist import get_session, get_version, list_versions
from app.planner.pipeline import (
    accept_replace,
    alternatives,
    cancel_replace,
    preview_replace,
    refine_apply,
    refine_preview,
    regenerate,
    set_lock,
    start_or_continue,
)
from app.planner.routing import (
    RouteLeg,
    RoutingCost,
    RoutingService,
    cache_key,
    persist_cost,
    persist_leg,
    time_bucket,
)
from app.planner.schemas import (
    IntentRequest,
    LinkBookingRequest,
    LockRequest,
    ManualPlanRequest,
    RankerWeightsIn,
    RefineRequest,
    ReplaceAcceptRequest,
    ReplacePreviewRequest,
)
from app.planner.warnings import WarningStop, evaluate_warnings
from app.planner.weather import WeatherService, persist_forecast
from app.schemas.planner import (
    Coordinate,
    ForecastOut,
    ForecastQuery,
    OptimizeRequest,
    OptimizeResponse,
    OrderedStopOut,
    RouteLegOut,
    RouteRequest,
    RoutingCostOut,
    WarningEvalRequest,
    WarningEvalResponse,
    WeatherWarningOut,
)

router = APIRouter()


def _leg_out(leg: RouteLeg) -> RouteLegOut:
    return RouteLegOut(
        origin=Coordinate(lat=leg.origin_lat, lng=leg.origin_lng),
        destination=Coordinate(lat=leg.dest_lat, lng=leg.dest_lng),
        mode=leg.mode,
        available=leg.available,
        provider=leg.provider,
        source=leg.source,
        distance_m=leg.distance_m,
        duration_seconds=leg.duration_seconds,
        cache_hit=leg.cache_hit,
        time_bucket=leg.time_bucket,
        fetched_at=leg.fetched_at,
        presented_as=leg.presented_as,
    )


def _cost_out(cost: RoutingCost) -> RoutingCostOut:
    budget = int(settings.routing_plan_budget_usd * 1_000_000)
    return RoutingCostOut(
        plan_id=cost.plan_id,
        provider=cost.provider,
        elements_requested=cost.elements_requested,
        cache_hits=cost.cache_hits,
        cache_misses=cost.cache_misses,
        estimated_usd_micros=cost.estimated_usd_micros,
        within_budget=cost.estimated_usd_micros <= budget,
        budget_usd_micros=budget,
        documented_rate=cost.documented_rate,
    )


def _stop_models(payload: OptimizeRequest) -> list[OptimizeStop]:
    return [
        OptimizeStop(
            id=item.id,
            lat=item.lat,
            lng=item.lng,
            label=item.label,
            duration_minutes=item.duration_minutes,
            locked=item.locked,
            position=item.position,
            window_start=item.window_start,
            window_end=item.window_end,
            closes_at=item.closes_at,
            weather_sensitivity=item.weather_sensitivity,
            estimated_minor=item.estimated_minor,
        )
        for item in payload.stops
    ]


def _optimize_response(result: Any) -> OptimizeResponse:
    return OptimizeResponse(
        feasible=result.feasible,
        reason=result.reason,
        solver=result.solver,
        fallback=result.fallback,
        timeout=result.timeout,
        ordered_stops=[
            OrderedStopOut(
                id=stop.id,
                label=stop.label,
                lat=stop.lat,
                lng=stop.lng,
                position=stop.position,
                locked=stop.locked,
                arrives_at=stop.arrives_at,
                departs_at=stop.departs_at,
                duration_minutes=stop.duration_minutes,
                weather_sensitivity=stop.weather_sensitivity,
                estimated_minor=stop.estimated_minor,
            )
            for stop in result.ordered
        ],
        legs=[_leg_out(leg) for leg in result.legs],
        total_distance_m=result.total_distance_m,
        total_duration_seconds=result.total_duration_seconds,
        metrics_available=result.metrics_available,
        routing_cost=_cost_out(result.routing_cost),
        solve_ms=result.solve_ms,
        window_start=result.window_start,
        return_by=result.return_by,
    )


@router.post("/route", response_model=RouteLegOut, dependencies=[access.SESSION, limit("maps")])
async def route_leg(
    payload: RouteRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> RouteLegOut:
    await require_session(request, db)
    service = RoutingService()
    plan_id = payload.plan_id or "anon"
    mode = payload.mode if payload.mode in {"driving", "walking", "transit"} else "driving"
    leg = service.route(
        payload.origin.lat,
        payload.origin.lng,
        payload.destination.lat,
        payload.destination.lng,
        mode=mode,
        departure_at=payload.departure_at,
        plan_id=plan_id,
    )
    await persist_leg(
        db,
        cache_key(
            payload.origin.lat,
            payload.origin.lng,
            payload.destination.lat,
            payload.destination.lng,
            mode,
            time_bucket(payload.departure_at, settings.routing_time_bucket_minutes),
        ),
        leg,
    )
    await persist_cost(db, service.last_cost)
    return _leg_out(leg)


@router.post("/optimize", response_model=OptimizeResponse, dependencies=[access.SESSION, limit("maps")])
async def optimize_plan(
    payload: OptimizeRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> OptimizeResponse:
    await require_session(request, db)
    if payload.return_by <= payload.window_start:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="return_by must be after window_start")
    # CPU-bound solver and blocking routing calls: keep them off the event loop.
    result = await run_in_threadpool(
        optimize_route,
        payload.start.lat,
        payload.start.lng,
        _stop_models(payload),
        payload.window_start,
        payload.return_by,
        mode=payload.mode,
        plan_id=payload.plan_id or "anon",
        timeout_ms=payload.timeout_ms,
    )
    await persist_cost(db, result.routing_cost)
    return _optimize_response(result)


@router.post("/weather", response_model=ForecastOut, dependencies=[access.SESSION, limit("maps")])
async def weather_forecast(
    payload: ForecastQuery,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ForecastOut:
    await require_session(request, db)
    try:
        day = date.fromisoformat(payload.forecast_date)
    except ValueError as exc:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid forecast date") from exc
    service = WeatherService()
    forecast = service.forecast(payload.lat, payload.lng, day)
    await persist_forecast(db, forecast)
    return ForecastOut(
        available=forecast.available,
        provider=forecast.provider,
        source=forecast.source,
        fetched_at=forecast.fetched_at,
        forecast_date=forecast.forecast_date.isoformat(),
        lat=forecast.lat,
        lng=forecast.lng,
        precip_mm=forecast.precip_mm,
        wind_kmh=forecast.wind_kmh,
        temp_max_c=forecast.temp_max_c,
        temp_min_c=forecast.temp_min_c,
        weather_code=forecast.weather_code,
        attribution=forecast.attribution,
    )


@router.post("/warnings", response_model=WarningEvalResponse, dependencies=[access.SESSION, limit("maps")])
async def weather_warnings(
    payload: WarningEvalRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> WarningEvalResponse:
    await require_session(request, db)
    stops: list[WarningStop] = []
    for item in payload.stops:
        try:
            day = date.fromisoformat(item.forecast_date)
        except ValueError as exc:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid forecast date") from exc
        stops.append(
            WarningStop(
                id=item.id,
                label=item.label,
                lat=item.lat,
                lng=item.lng,
                forecast_date=day,
                weather_sensitivity=item.weather_sensitivity,
            )
        )
    result = evaluate_warnings(
        stops,
        weather=WeatherService(),
        booking_statuses=dict(payload.booking_statuses),
    )
    return WarningEvalResponse(
        warnings=[
            WeatherWarningOut(
                stop_id=item.stop_id,
                stop_label=item.stop_label,
                severity=item.severity,
                reasons=item.reasons,
                source=item.source,
                fetched_at=item.fetched_at,
                forecast_date=item.forecast_date.isoformat(),
            )
            for item in result.warnings
        ],
        forecast_unavailable=result.forecast_unavailable,
        bookings_mutated=result.bookings_mutated,
        booking_statuses=result.booking_statuses,
    )


@router.get("/thresholds", dependencies=[access.SESSION])
async def list_thresholds(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    await require_session(request, db)
    return await fetch_json(db, "SELECT app.list_weather_thresholds()", {})


def _http(exc: Exception) -> HTTPException:
    message = str(exc)
    code = HTTP_422_UNPROCESSABLE
    if "not found" in message:
        code = status.HTTP_404_NOT_FOUND
    return HTTPException(status_code=code, detail=message)


@router.get("/quota", dependencies=[access.SESSION])
async def ai_quota(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    """How many AI generations the caller has left today."""
    session = await require_session(request, db)
    return await budget_status(db, str(session["user_id"]))


@router.post("/sessions", dependencies=[access.SESSION, limit("ai-generate"), AI_BUDGET])
async def create_or_plan(
    payload: IntentRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        return await start_or_continue(
            db,
            session["user_id"],
            payload.text,
            payload.locale,
            payload.session_id,
            payload.trip_id,
            answers=payload.answers,
            approve_budget=payload.approve_budget,
        )
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.post("/manual", dependencies=[access.SESSION, limit("ai-generate")])
async def create_manual_plan(
    payload: ManualPlanRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        return await build_manual(
            db,
            session["user_id"],
            experience_slugs=payload.experience_slugs,
            destination_slugs=payload.destination_slugs,
            party_size=payload.party_size,
            window_start=payload.window_start,
            budget_minor=payload.budget_minor,
            strict_budget=payload.strict_budget,
            currency=payload.currency,
            start_lat=payload.start_lat,
            start_lng=payload.start_lng,
            title=payload.title,
            trip_id=payload.trip_id,
        )
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.post("/sessions/{session_id}/clarify", dependencies=[access.SESSION, limit("ai-generate"), AI_BUDGET])
async def clarify(
    session_id: UUID,
    payload: IntentRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    stored = await get_session(db, session["user_id"], session_id)
    text_value = payload.text or str(stored.get("raw_text") or "")
    try:
        return await start_or_continue(
            db,
            session["user_id"],
            text_value,
            payload.locale or str(stored.get("locale") or "en"),
            session_id,
            payload.trip_id,
            answers=payload.answers,
            approve_budget=payload.approve_budget,
        )
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.get("/sessions/{session_id}", dependencies=[access.SESSION])
async def read_session(
    session_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    stored = await get_session(db, session["user_id"], session_id)
    plan = None
    if stored.get("current_version_id"):
        plan = await get_version(db, session["user_id"], UUID(str(stored["current_version_id"])), False)
    return {"session": stored, "plan": plan}


@router.post("/sessions/{session_id}/lock", dependencies=[access.SESSION])
async def lock_stop(
    session_id: UUID,
    payload: LockRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        return await set_lock(db, session["user_id"], session_id, payload.stop_id, payload.locked)
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.post("/sessions/{session_id}/regenerate", dependencies=[access.SESSION, limit("ai-generate"), AI_BUDGET])
async def regen(
    session_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        return await regenerate(db, session["user_id"], session_id)
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.get("/sessions/{session_id}/stops/{stop_id}/alternatives", dependencies=[access.SESSION])
async def list_alternatives(
    session_id: UUID,
    stop_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    session = await require_session(request, db)
    return await alternatives(db, session["user_id"], session_id, stop_id)


@router.post("/sessions/{session_id}/replace/preview", dependencies=[access.SESSION])
async def replace_preview(
    session_id: UUID,
    payload: ReplacePreviewRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        return await preview_replace(db, session["user_id"], session_id, payload.stop_id, payload.experience_id)
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.post("/sessions/{session_id}/replace/accept", dependencies=[access.SESSION])
async def replace_accept(
    session_id: UUID,
    payload: ReplaceAcceptRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        return await accept_replace(db, session["user_id"], session_id, payload.preview_id)
    except (ValueError, TypeError) as exc:
        raise _http(exc) from exc


@router.post("/sessions/{session_id}/replace/cancel", dependencies=[access.SESSION])
async def replace_cancel(
    session_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    return await cancel_replace(db, session["user_id"], session_id)


@router.post("/sessions/{session_id}/refine", dependencies=[access.SESSION, limit("ai-generate"), AI_BUDGET])
async def refine(
    session_id: UUID,
    payload: RefineRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    if payload.apply:
        try:
            return await refine_apply(db, session["user_id"], session_id)
        except ValueError as exc:
            raise _http(exc) from exc
    return await refine_preview(db, session["user_id"], session_id, payload.text)


@router.get("/trips/{trip_id}/versions", dependencies=[access.SESSION])
async def trip_versions(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    session = await require_session(request, db)
    return await list_versions(db, session["user_id"], trip_id, False)


@router.get("/versions/{version_id}", dependencies=[access.SESSION])
async def read_version(
    version_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    return await get_version(db, session["user_id"], version_id, False)


@router.post("/versions/{version_id}/link-booking", dependencies=[access.SESSION])
async def link_booking(
    version_id: UUID,
    payload: LinkBookingRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.link_booking_itinerary_version(:user_id, :booking, :version)"),
                {
                    "user_id": str(session["user_id"]),
                    "booking": str(payload.booking_id),
                    "version": str(version_id),
                },
            )
        ).scalar()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    if not isinstance(row, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="booking not found")
    return row


@router.get("/admin/trips/{trip_id}/versions", dependencies=[access.ADMIN])
async def admin_trip_versions(
    trip_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    session = await require_admin(request, db)
    try:
        return await list_versions(db, session["user_id"], trip_id, True)
    except DBAPIError as exc:
        raise_from_db(exc)
        raise


@router.get("/admin/versions/{version_id}", dependencies=[access.ADMIN])
async def admin_read_version(
    version_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_admin(request, db)
    try:
        return await get_version(db, session["user_id"], version_id, True)
    except (DBAPIError, TypeError) as exc:
        if isinstance(exc, DBAPIError):
            raise_from_db(exc)
        raise _http(exc) from exc


@router.get("/admin/health", dependencies=[access.ADMIN])
async def admin_health(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_admin(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.planner_admin_health(:admin_id)"),
                {"admin_id": str(session["user_id"])},
            )
        ).scalar()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    return row if isinstance(row, dict) else {}


@router.get("/admin/injections", dependencies=[access.ADMIN])
async def admin_injections(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    session = await require_admin(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.planner_list_safety_events(:admin_id, 50)"),
                {"admin_id": str(session["user_id"])},
            )
        ).scalar()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    return row if isinstance(row, list) else []


@router.put("/admin/ranker", dependencies=[access.ADMIN])
async def admin_ranker(
    payload: RankerWeightsIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_admin(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.planner_set_ranker_weights(:admin_id, :version, CAST(:weights AS jsonb), :notes)"),
                {
                    "admin_id": str(session["user_id"]),
                    "version": payload.version,
                    "weights": json.dumps(payload.weights),
                    "notes": payload.notes,
                },
            )
        ).scalar()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    return row if isinstance(row, dict) else {}
