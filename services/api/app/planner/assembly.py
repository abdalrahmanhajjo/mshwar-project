from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from app.core.config import settings
from app.planner.eligibility import hours_allow, travel_leg, unit_price_minor
from app.planner.routing import RouteLeg
from app.planner.schemas import (
    AssembledLeg,
    AssembledPlan,
    AssembledStop,
    CandidateRecord,
    ExtractedConstraints,
    RankedCandidate,
)

MAX_STOPS = 4


def _price_snapshot(candidate: CandidateRecord, party_size: int) -> dict[str, object]:
    amount, kind = unit_price_minor(candidate, party_size)
    price = candidate.price or {}
    return {
        "experience_id": str(candidate.id),
        "slug": candidate.slug,
        "title": candidate.title,
        "destination_slug": candidate.destination_slug,
        "duration_minutes": candidate.duration_minutes,
        "price_type": price.get("type"),
        "price_source": price.get("source"),
        "currency": price.get("currency") or "USD",
        "unit": price.get("unit") or "person",
        "unit_amount_minor": price.get("amount_minor"),
        "party_size": party_size,
        "line_minor": amount,
        "price_kind": kind,
        "sponsored": candidate.sponsored,
        "sponsored_label": candidate.sponsored_label if candidate.sponsored else None,
        "facts": candidate.facts,
    }


@dataclass
class _Placement:
    arrive: datetime
    leave: datetime
    travel_minutes: int
    distance_m: int
    route: RouteLeg
    amount_minor: int
    price_kind: str
    hours_code: str


@dataclass
class _DayLimits:
    home_lat: float
    home_lng: float
    return_by: datetime
    party: int
    strict_budget: bool


def _place(
    candidate: CandidateRecord,
    limits: _DayLimits,
    *,
    cursor: datetime,
    lat: float,
    lng: float,
    remaining_minor: int,
) -> _Placement | str:
    """Fit a candidate after the current stop, or return why it does not fit (used in lock messages)."""
    minutes, distance, route = travel_leg(lat, lng, candidate.lat, candidate.lng, departure_at=cursor)
    if not route.available:
        return "travel time is unavailable"
    arrive = cursor + timedelta(minutes=minutes)
    leave = arrive + timedelta(minutes=candidate.duration_minutes)
    # Return-by means "back at the start point", so the drive home must fit too.
    home_minutes, _home_distance, home_route = travel_leg(
        candidate.lat, candidate.lng, limits.home_lat, limits.home_lng, departure_at=leave
    )
    if not home_route.available or leave + timedelta(minutes=home_minutes) > limits.return_by:
        return "it no longer fits the remaining window"
    ok_hours, hours_code = hours_allow(candidate, arrive, leave)
    if not ok_hours:
        return hours_code.replace("_", " ")
    amount, kind = unit_price_minor(candidate, limits.party)
    if limits.strict_budget and amount > remaining_minor:
        return "it would break the strict budget"
    return _Placement(arrive, leave, minutes, distance, route, amount, kind, hours_code)


def _stop_flags(row: RankedCandidate, placement: _Placement) -> list[str]:
    flags = list(row.flags)
    if placement.hours_code == "hours_unknown":
        flags.append("hours_unknown")
    if placement.price_kind == "quote":
        flags.append("quote_required")
    elif placement.price_kind == "estimate":
        flags.append("estimated_price")
    return flags


def assemble_plan(
    ranked: list[RankedCandidate],
    constraints: ExtractedConstraints,
    *,
    locked_ids: set[UUID] | None = None,
    exclude_ids: set[UUID] | None = None,
    max_stops: int = MAX_STOPS,
) -> AssembledPlan:
    """Greedy day builder: locked stops first, then by rank, each placed after the previous one."""
    locked_ids = locked_ids or set()
    exclude_ids = exclude_ids or set()
    start = constraints.window_start
    if start is None or constraints.return_by is None or constraints.start_lat is None or constraints.start_lng is None:
        return AssembledPlan(stops=[], legs=[], total_minor=0, infeasible=True, infeasible_reason="missing_window")
    party = constraints.party_size or 2
    budget = constraints.budget_minor or 0
    limits = _DayLimits(
        home_lat=constraints.start_lat,
        home_lng=constraints.start_lng,
        return_by=constraints.return_by,
        party=party,
        strict_budget=bool(constraints.strict_budget),
    )
    cursor = start
    lat, lng = constraints.start_lat, constraints.start_lng
    used: set[UUID] = set()
    stops: list[AssembledStop] = []
    legs: list[AssembledLeg] = []
    remaining = budget
    forced: list[str] = []

    locked_ranked = [row for row in ranked if row.candidate.id in locked_ids]
    unlocked = [row for row in ranked if row.candidate.id not in locked_ids and row.candidate.id not in exclude_ids]

    for row in locked_ranked + unlocked:
        if len(stops) >= max_stops:
            break
        candidate = row.candidate
        if candidate.id in used:
            continue
        placement = _place(candidate, limits, cursor=cursor, lat=lat, lng=lng, remaining_minor=remaining)
        if isinstance(placement, str):
            if candidate.id in locked_ids:
                forced.append(f"{candidate.slug} could not stay locked — {placement}.")
            continue
        fetched = placement.route.fetched_at or datetime.now(start.tzinfo)
        legs.append(
            AssembledLeg(
                position=len(stops),
                provider=placement.route.provider,
                fetched_at=fetched,
                expires_at=fetched + timedelta(seconds=max(settings.routing_cache_ttl_seconds, 60)),
                distance_m=placement.distance_m,
                duration_seconds=placement.travel_minutes * 60,
                estimated_minor=0,
                status="available",
            )
        )
        stops.append(
            AssembledStop(
                experience_id=candidate.id,
                position=len(stops) + 1,
                starts_at=placement.arrive,
                ends_at=placement.leave,
                estimated_minor=placement.amount_minor,
                price_kind=placement.price_kind,
                locked=candidate.id in locked_ids,
                snapshot=_price_snapshot(candidate, party),
                flags=_stop_flags(row, placement),
            )
        )
        used.add(candidate.id)
        remaining -= placement.amount_minor
        cursor = placement.leave
        lat, lng = candidate.lat, candidate.lng

    return _finish_plan(stops, legs, constraints, budget, forced)


def _finish_plan(
    stops: list[AssembledStop],
    legs: list[AssembledLeg],
    constraints: ExtractedConstraints,
    budget: int,
    forced: list[str],
) -> AssembledPlan:
    total = sum(stop.estimated_minor for stop in stops) + sum(leg.estimated_minor for leg in legs)
    needs_approval = bool(constraints.strict_budget and total > budget)
    warning = (
        "This draft exceeds the strict budget. Approve the overage to continue, or tighten the plan."
        if needs_approval
        else None
    )
    if not stops:
        return AssembledPlan(
            stops=[],
            legs=[],
            total_minor=0,
            infeasible=True,
            infeasible_reason="no_eligible_stops",
            forced_lock_changes=forced,
            budget_warning=warning,
            needs_budget_approval=needs_approval,
        )
    return AssembledPlan(
        stops=stops,
        legs=legs,
        total_minor=total,
        currency=constraints.currency,
        forced_lock_changes=forced,
        budget_warning=warning,
        needs_budget_approval=needs_approval,
    )


def plan_total_minor(plan: AssembledPlan) -> int:
    return (
        sum(stop.estimated_minor for stop in plan.stops)
        + sum(leg.estimated_minor for leg in plan.legs)
        + sum(item.amount_minor for item in plan.cost_items)
    )


def candidate_by_id(ranked: list[RankedCandidate], experience_id: UUID) -> CandidateRecord | None:
    for row in ranked:
        if row.candidate.id == experience_id:
            return row.candidate
    return None
