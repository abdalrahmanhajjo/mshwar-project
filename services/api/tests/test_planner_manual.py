"""Unit tests for the manual itinerary assembler (pure — no DB, no LLM)."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.planner.manual import assemble_manual
from app.planner.schemas import CandidateRecord, ExtractedConstraints

BEIRUT = ZoneInfo("Asia/Beirut")


def _candidate(slug: str, **overrides: object) -> CandidateRecord:
    payload: dict[str, object] = {
        "id": uuid4(),
        "slug": slug,
        "title": slug.replace("-", " ").title(),
        "status": "published",
        "duration_minutes": 120,
        "destination_slug": "byblos",
        "destination_name": "Byblos",
        "venue_id": uuid4(),
        "lat": 34.123,
        "lng": 35.648,
        "price": {"currency": "USD", "type": "estimated", "amount_minor": 3000, "unit": "person"},
        "hours": [{"weekday": d, "opens": "08:00", "closes": "23:00"} for d in range(7)],
    }
    payload.update(overrides)
    return CandidateRecord.model_validate(payload)


def _constraints(**overrides: object) -> ExtractedConstraints:
    start = datetime(2026, 9, 20, 9, 0, tzinfo=BEIRUT)
    payload: dict[str, object] = {
        "locale": "en",
        "destination_slugs": ["byblos"],
        "party_size": 2,
        "window_start": start,
        "return_by": start + timedelta(hours=10),
        "start_lat": 34.12,
        "start_lng": 35.65,
        "budget_minor": 50000,
        "currency": "USD",
        "strict_budget": False,
    }
    payload.update(overrides)
    return ExtractedConstraints.model_validate(payload)


def test_manual_keeps_every_pick_in_order() -> None:
    picks = [_candidate("first-stop"), _candidate("second-stop"), _candidate("third-stop")]
    plan = assemble_manual(picks, _constraints())
    assert [stop.snapshot["slug"] for stop in plan.stops] == ["first-stop", "second-stop", "third-stop"]
    assert [stop.position for stop in plan.stops] == [1, 2, 3]
    assert len(plan.legs) == len(plan.stops)


def test_manual_total_is_sum_of_stops() -> None:
    picks = [_candidate("a", price={"type": "estimated", "amount_minor": 2000, "unit": "person"}), _candidate("b")]
    plan = assemble_manual(picks, _constraints(party_size=2))
    assert plan.total_minor == sum(stop.estimated_minor for stop in plan.stops)
    # 2000 * 2 people = 4000 for the first stop.
    assert plan.stops[0].estimated_minor == 4000


def test_manual_times_advance_across_stops() -> None:
    picks = [_candidate("a", duration_minutes=90), _candidate("b", duration_minutes=90)]
    plan = assemble_manual(picks, _constraints())
    assert plan.stops[0].ends_at <= plan.stops[1].starts_at
    assert plan.stops[0].ends_at - plan.stops[0].starts_at == timedelta(minutes=90)


def test_manual_never_drops_picks_over_strict_budget() -> None:
    picks = [_candidate("a"), _candidate("b")]
    plan = assemble_manual(picks, _constraints(budget_minor=100, strict_budget=True))
    assert len(plan.stops) == 2  # picks are honoured, not dropped
    assert plan.needs_budget_approval is True
    assert plan.budget_warning


def test_manual_flags_quote_required_stops() -> None:
    picks = [_candidate("q", price={"type": "quote-required"})]
    plan = assemble_manual(picks, _constraints())
    assert plan.stops[0].price_kind == "quote"
    assert "quote_required" in plan.stops[0].flags
    assert plan.stops[0].estimated_minor == 0


def test_manual_missing_window_is_infeasible() -> None:
    plan = assemble_manual([_candidate("a")], _constraints(window_start=None))
    assert plan.infeasible is True
