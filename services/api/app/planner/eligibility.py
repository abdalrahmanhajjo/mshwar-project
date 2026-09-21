from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.planner.routing import RouteLeg, RoutingService
from app.planner.schemas import CandidateRecord, EligibilityResult, ExtractedConstraints

BEIRUT = ZoneInfo("Asia/Beirut")
INTENSITY_TO_RANGE = {
    "relaxed": (1, 2),
    "moderate": (2, 3),
    "active": (4, 4),
    "strenuous": (5, 5),
}


def _as_time(value: Any) -> time | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value
    text = str(value)
    if len(text) >= 5 and text[2] == ":":
        hour, minute = int(text[0:2]), int(text[3:5])
        if hour == 24 and minute == 0:
            # PostgreSQL allows 24:00 as "end of day"; Python's time() does not.
            return time.max
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return time(hour, minute)
    return None


def _hours_for(candidate: CandidateRecord, when: datetime) -> tuple[time | None, time | None, bool]:
    local = when.astimezone(BEIRUT)
    day = local.date().isoformat()
    for row in candidate.exceptions:
        if str(row.get("local_date")) == day:
            if row.get("closed"):
                return None, None, True
            return _as_time(row.get("opens")), _as_time(row.get("closes")), False
    weekday = local.weekday()  # Monday=0, matches seed
    for row in candidate.hours:
        if int(row.get("weekday", -1)) == weekday:
            return _as_time(row.get("opens")), _as_time(row.get("closes")), False
    return None, None, False


def hours_allow(candidate: CandidateRecord, start: datetime, end: datetime) -> tuple[bool, str]:
    opens, closes, closed = _hours_for(candidate, start)
    if closed:
        return False, "hours_closed_exception"
    if opens is None or closes is None:
        return True, "hours_unknown"
    local_start = start.astimezone(BEIRUT).time()
    local_end = end.astimezone(BEIRUT).time()
    if local_start < opens or local_end > closes:
        return False, "outside_opening_hours"
    return True, "hours_ok"


def capacity_allow(candidate: CandidateRecord, party_size: int) -> tuple[bool, str]:
    if party_size < candidate.min_party or party_size > candidate.max_party:
        return False, "party_size"
    if candidate.inventory_available is False:
        return False, "no_capacity"
    if candidate.inventory_available is None:
        return True, "capacity_unknown"
    return True, "capacity_ok"


def duration_allow(candidate: CandidateRecord, window_start: datetime, return_by: datetime) -> bool:
    span = (return_by - window_start).total_seconds() / 60
    return candidate.duration_minutes <= span


def travel_leg(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    *,
    departure_at: datetime | None = None,
) -> tuple[int, int, RouteLeg]:
    """Travel time from Epic 7 RoutingService. Unavailable legs do not invent metres/seconds."""
    leg = RoutingService().route(from_lat, from_lng, to_lat, to_lng, mode="driving", departure_at=departure_at)
    if not leg.available or leg.duration_seconds is None:
        return 10**6, 0, leg
    return max(int(leg.duration_seconds), 0) // 60, int(leg.distance_m or 0), leg


def travel_minutes(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> tuple[int, int]:
    minutes, distance, _leg = travel_leg(from_lat, from_lng, to_lat, to_lng)
    return minutes, distance


def unit_price_minor(candidate: CandidateRecord, party_size: int) -> tuple[int, str]:
    price = candidate.price or {}
    amount = price.get("amount_minor")
    raw_type = str(price.get("type") or "from")
    if raw_type in {"quote", "quote-required"} or amount is None:
        return 0, "quote"
    kind = "fixed" if raw_type == "fixed" else "estimate"
    unit = str(price.get("unit") or "person")
    total = int(amount) * party_size if unit == "person" else int(amount)
    return total, kind


def _check_listing(
    candidate: CandidateRecord, start: datetime, end: datetime, party: int, blocked: list[str], flags: list[str]
) -> None:
    if candidate.status != "published":
        blocked.append("not_published")
    ok_hours, hours_code = hours_allow(candidate, start, end)
    if not ok_hours:
        blocked.append(hours_code)
    elif hours_code == "hours_unknown":
        flags.append("hours_unknown")
    ok_cap, cap_code = capacity_allow(candidate, party)
    if not ok_cap:
        blocked.append(cap_code)
    elif cap_code == "capacity_unknown":
        flags.append("capacity_unknown")


def _check_travel(
    candidate: CandidateRecord,
    constraints: ExtractedConstraints,
    origin: tuple[float, float],
    *,
    at: datetime | None,
    start: datetime,
    return_by: datetime,
    blocked: list[str],
) -> None:
    minutes, _distance = travel_minutes(origin[0], origin[1], candidate.lat, candidate.lng)
    arrival = at if at is not None else (constraints.window_start or start) + timedelta(minutes=minutes)
    end = arrival + timedelta(minutes=candidate.duration_minutes)
    # Assume the drive back takes as long as the drive out.
    if end + timedelta(minutes=minutes) > return_by:
        blocked.append("travel_window")
    if constraints.max_travel_minutes and minutes > constraints.max_travel_minutes:
        blocked.append("travel_max")
    ok_hours, hours_code = hours_allow(candidate, arrival, end)
    if not ok_hours and hours_code not in blocked:
        blocked.append(hours_code)


def _check_price(
    candidate: CandidateRecord,
    constraints: ExtractedConstraints,
    party: int,
    remaining_budget: int | None,
    blocked: list[str],
    flags: list[str],
) -> None:
    price_minor, price_kind = unit_price_minor(candidate, party)
    if price_kind == "quote":
        flags.append("quote_required")
    elif remaining_budget is not None and price_minor > remaining_budget:
        if constraints.strict_budget:
            blocked.append("strict_budget")
        else:
            flags.append("over_budget_guide")


def evaluate_candidate(
    candidate: CandidateRecord,
    constraints: ExtractedConstraints,
    *,
    at: datetime | None = None,
    from_lat: float | None = None,
    from_lng: float | None = None,
    remaining_budget: int | None = None,
) -> EligibilityResult:
    """Hard eligibility rules. `blocked` reasons exclude a candidate; `flags` only annotate it."""
    blocked: list[str] = []
    flags: list[str] = []
    start = at or constraints.window_start or datetime.now(BEIRUT)
    end = start + timedelta(minutes=candidate.duration_minutes)
    return_by = constraints.return_by or (start + timedelta(hours=8))
    party = constraints.party_size or 2

    _check_listing(candidate, start, end, party, blocked, flags)
    if not duration_allow(candidate, start if at else (constraints.window_start or start), return_by):
        blocked.append("duration")
    if from_lat is not None and from_lng is not None:
        _check_travel(
            candidate, constraints, (from_lat, from_lng), at=at, start=start, return_by=return_by, blocked=blocked
        )
    _check_price(candidate, constraints, party, remaining_budget, blocked, flags)
    return EligibilityResult(candidate=candidate, eligible=not blocked, blocked=blocked, flags=flags)


def evaluate_matrix_case(name: str, candidate: CandidateRecord, constraints: ExtractedConstraints) -> EligibilityResult:
    result = evaluate_candidate(candidate, constraints)
    result.flags = [name, *result.flags]
    return result
