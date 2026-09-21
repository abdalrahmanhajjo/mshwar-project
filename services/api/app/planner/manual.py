"""Manual itinerary builder.

The traveller hand-picks published places; we place them in the chosen order,
computing travel legs, timings and costs, and persist through the same
``planner_persist_version`` path the AI planner uses so a manual trip reopens
exactly like an AI one. Unlike the AI assembler, a manual build never drops the
traveller's picks — it flags a stop that falls outside the day or budget instead.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.planner.assembly import _price_snapshot
from app.planner.defaults import apply_defaults
from app.planner.eligibility import hours_allow, travel_leg, unit_price_minor
from app.planner.persist import persist_plan, retrieve_candidates
from app.planner.schemas import (
    AssembledLeg,
    AssembledPlan,
    AssembledStop,
    CandidateRecord,
    ExtractedConstraints,
)

MANUAL_CANDIDATE_LIMIT = 120
MAX_MANUAL_STOPS = 12


def assemble_manual(candidates: list[CandidateRecord], constraints: ExtractedConstraints) -> AssembledPlan:
    """Place every chosen candidate in order; never drop a pick for budget or time."""
    start = constraints.window_start
    if start is None or constraints.return_by is None or constraints.start_lat is None or constraints.start_lng is None:
        return AssembledPlan(stops=[], legs=[], total_minor=0, infeasible=True, infeasible_reason="missing_window")
    party = constraints.party_size or 2
    cursor = start
    lat, lng = constraints.start_lat, constraints.start_lng
    stops: list[AssembledStop] = []
    legs: list[AssembledLeg] = []
    for candidate in candidates:
        minutes, distance, route = travel_leg(lat, lng, candidate.lat, candidate.lng, departure_at=cursor)
        available = route.available and minutes < 10**6
        travel_min = minutes if available else 0
        fetched = route.fetched_at or datetime.now(start.tzinfo)
        legs.append(
            AssembledLeg(
                position=len(stops),
                provider=route.provider,
                fetched_at=fetched,
                expires_at=fetched + timedelta(seconds=max(settings.routing_cache_ttl_seconds, 60)),
                distance_m=distance if available else 0,
                duration_seconds=travel_min * 60,
                estimated_minor=0,
                status="available" if available else "unavailable",
            )
        )
        arrive = cursor + timedelta(minutes=travel_min)
        leave = arrive + timedelta(minutes=candidate.duration_minutes)
        amount, kind = unit_price_minor(candidate, party)
        flags: list[str] = []
        _ok, hours_code = hours_allow(candidate, arrive, leave)
        if hours_code == "hours_unknown":
            flags.append("hours_unknown")
        if kind == "quote":
            flags.append("quote_required")
        elif kind == "estimate":
            flags.append("estimated_price")
        if leave > constraints.return_by:
            flags.append("after_hours")
        stops.append(
            AssembledStop(
                experience_id=candidate.id,
                position=len(stops) + 1,
                starts_at=arrive,
                ends_at=leave,
                estimated_minor=amount,
                price_kind=kind,
                locked=False,
                snapshot=_price_snapshot(candidate, party),
                flags=flags,
            )
        )
        cursor = leave
        lat, lng = candidate.lat, candidate.lng
    if not stops:
        return AssembledPlan(stops=[], legs=[], total_minor=0, infeasible=True, infeasible_reason="no_stops")
    total = sum(stop.estimated_minor for stop in stops)
    over_budget = bool(constraints.strict_budget and total > (constraints.budget_minor or 0))
    warning = "This manual plan exceeds your budget." if over_budget else None
    return AssembledPlan(
        stops=stops,
        legs=legs,
        total_minor=total,
        currency=constraints.currency,
        budget_warning=warning,
        needs_budget_approval=over_budget,
    )


def _manual_title(chosen: list[CandidateRecord], constraints: ExtractedConstraints) -> str:
    if chosen:
        anchor = chosen[0].destination_name or chosen[0].destination_slug
        if anchor:
            return f"Plan · {anchor}"
    return "Manual plan"


async def build_manual(
    db: AsyncSession,
    user_id: UUID,
    *,
    experience_slugs: list[str],
    destination_slugs: list[str],
    party_size: int | None,
    window_start: datetime | None,
    budget_minor: int | None,
    strict_budget: bool | None,
    currency: str,
    start_lat: float | None,
    start_lng: float | None,
    title: str | None,
    trip_id: UUID | None,
) -> dict[str, Any]:
    """Retrieve the chosen published places, order them, assemble and persist."""
    extracted = ExtractedConstraints(
        destination_slugs=destination_slugs,
        party_size=party_size,
        window_start=window_start,
        budget_minor=budget_minor,
        strict_budget=strict_budget,
        currency=currency or "USD",
        start_lat=start_lat,
        start_lng=start_lng,
    )
    merged, assumed = apply_defaults(extracted, None)
    candidates = await retrieve_candidates(db, merged, limit=MANUAL_CANDIDATE_LIMIT)
    by_slug = {candidate.slug: candidate for candidate in candidates}
    chosen: list[CandidateRecord] = []
    seen: set[str] = set()
    for slug in experience_slugs:
        candidate = by_slug.get(slug)
        if candidate is not None and candidate.slug not in seen:
            chosen.append(candidate)
            seen.add(candidate.slug)
        if len(chosen) >= MAX_MANUAL_STOPS:
            break
    if not chosen:
        raise ValueError("None of the selected places are available to plan")
    plan = assemble_manual(chosen, merged)
    if plan.infeasible or not plan.stops:
        raise ValueError("Could not build a manual itinerary from the selected places")
    retrieved = [str(candidate.id) for candidate in chosen]
    doc = await persist_plan(
        db,
        user_id,
        merged,
        plan,
        trip_id=trip_id,
        title=title or _manual_title(chosen, merged),
        origin="manual",
        retrieved_ids=retrieved,
        assumed=assumed,
        degraded=False,
        ranked=[],
        latency_ms=0,
        run_status="succeeded",
    )
    return {
        "session_id": "",
        "status": "manual",
        "degraded": False,
        "degraded_message": None,
        "constraints": merged.model_dump(mode="json"),
        "assumed_defaults": [item.model_dump(mode="json") for item in assumed],
        "clarifications": [],
        "plan": doc,
        "llm_never_sets_totals": True,
        "budget_warning": plan.budget_warning,
    }
