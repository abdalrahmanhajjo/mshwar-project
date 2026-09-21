"""Regression tests for planner bugs H4, H5, H6, M6 and L4 (docs/code-review-report.md)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.planner.assembly import assemble_plan
from app.planner.eligibility import hours_allow, travel_leg
from app.planner.optimizer import MAX_OPTIMIZE_STOPS, OptimizeStop, optimize_route
from app.planner.routing import RouteLeg, RoutingService
from app.planner.schemas import RankedCandidate
from tests.factories import _email, _register
from tests.test_planner_unit import _candidate, _window

TRIPOLI = {"lat": 34.4367, "lng": 35.8497}
START = datetime(2026, 9, 20, 6, tzinfo=UTC)


def test_return_by_includes_the_drive_home() -> None:
    constraints = _window()
    tripoli = _candidate(slug="tripoli-souks", duration_minutes=120, **TRIPOLI)
    outbound, _, _ = travel_leg(constraints.start_lat, constraints.start_lng, tripoli.lat, tripoli.lng)
    tight = constraints.model_copy(update={"return_by": constraints.window_start + timedelta(minutes=outbound + 125)})
    ranked = [RankedCandidate(candidate=tripoli, score=1, eligible=True, sponsored=False, reasons=[])]
    assert assemble_plan(ranked, tight).stops == []

    roomy = constraints.model_copy(
        update={"return_by": constraints.window_start + timedelta(minutes=2 * outbound + 130)}
    )
    plan = assemble_plan(ranked, roomy)
    assert len(plan.stops) == 1
    home, _, _ = travel_leg(tripoli.lat, tripoli.lng, constraints.start_lat, constraints.start_lng)
    assert plan.stops[0].ends_at + timedelta(minutes=home) <= roomy.return_by


def test_duplicate_locked_positions_are_rejected() -> None:
    stops = [
        OptimizeStop(id="a", lat=34.12, lng=35.65, locked=True, position=1),
        OptimizeStop(id="b", lat=33.90, lng=35.50, locked=True, position=1),
        OptimizeStop(id="c", lat=34.25, lng=35.66),
    ]
    result = optimize_route(33.89, 35.50, stops, START, START + timedelta(hours=10))
    assert result.feasible is False
    assert "distinct positions" in (result.reason or "")


def test_locked_position_beyond_plan_is_rejected() -> None:
    stops = [OptimizeStop(id="a", lat=34.12, lng=35.65, locked=True, position=3)]
    result = optimize_route(33.89, 35.50, stops, START, START + timedelta(hours=10))
    assert result.feasible is False


def test_locked_stops_keep_their_positions() -> None:
    stops = [
        OptimizeStop(id="a", lat=34.12, lng=35.65, locked=True, position=3),
        OptimizeStop(id="b", lat=33.90, lng=35.50),
        OptimizeStop(id="c", lat=34.25, lng=35.66, locked=True, position=1),
    ]
    result = optimize_route(33.89, 35.50, stops, START, START + timedelta(hours=12))
    assert result.feasible is True
    assert [stop.id for stop in result.ordered] == ["c", "b", "a"]


def test_optimizer_refuses_oversized_inputs() -> None:
    stops = [OptimizeStop(id=str(i), lat=33.9, lng=35.5) for i in range(MAX_OPTIMIZE_STOPS + 1)]
    with pytest.raises(ValueError, match="at most"):
        optimize_route(33.89, 35.50, stops, START, START + timedelta(hours=10))


class _SameVenueProvider:
    name = "google"

    def route(self, olat, olng, dlat, dlng, mode, departure_at=None):  # type: ignore[no-untyped-def]
        same = (olat, olng) == (dlat, dlng)
        return RouteLeg(
            origin_lat=olat,
            origin_lng=olng,
            dest_lat=dlat,
            dest_lng=dlng,
            mode=mode,
            available=True,
            provider="google",
            source="google",
            time_bucket="t",
            distance_m=0 if same else 5000,
            duration_seconds=0 if same else 600,
        )


def test_zero_second_leg_between_stops_at_one_venue_is_feasible() -> None:
    from app.planner.routing import MemoryRouteCache

    service = RoutingService(provider=_SameVenueProvider(), cache=MemoryRouteCache())
    stops = [
        OptimizeStop(id="lunch", lat=34.1, lng=35.6, duration_minutes=60),
        OptimizeStop(id="tour", lat=34.1, lng=35.6, duration_minutes=60),
    ]
    result = optimize_route(33.9, 35.5, stops, START, START + timedelta(hours=4), routing=service)
    assert result.feasible is True
    assert result.solver == "held-karp"


def test_midnight_closing_time_is_understood() -> None:
    venue = _candidate(hours=[{"weekday": d, "opens": "10:00", "closes": "24:00"} for d in range(7)])
    evening = datetime(2026, 9, 15, 20, 0, tzinfo=timezone(timedelta(hours=3)))
    assert hours_allow(venue, evening, evening + timedelta(hours=2)) == (True, "hours_ok")
    assert hours_allow(venue, evening.replace(hour=8), evening.replace(hour=9))[0] is False


@pytest.mark.asyncio
async def test_optimize_endpoint_rejects_too_many_stops() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        await _register(api, _email("planner"))
        response = await api.post(
            "/api/v1/planner/optimize",
            json={
                "start": {"lat": 33.89, "lng": 35.5},
                "stops": [{"id": str(i), "lat": 33.9, "lng": 35.5} for i in range(MAX_OPTIMIZE_STOPS + 1)],
                "window_start": START.isoformat(),
                "return_by": (START + timedelta(hours=8)).isoformat(),
                "timeout_ms": 30000,
            },
        )
        assert response.status_code == 422


def test_google_matrix_uses_one_request_and_caches_only_successes() -> None:
    import httpx

    from app.planner.routing import GoogleMapsProvider, MemoryRouteCache

    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        origins = request.url.params["origins"].split("|")
        destinations = request.url.params["destinations"].split("|")
        rows = [
            {
                "elements": [
                    {"status": "OK", "distance": {"value": 1000}, "duration": {"value": 120}}
                    if origin != destination
                    else {"status": "ZERO_RESULTS"}
                    for destination in destinations
                ]
            }
            for origin in origins
        ]
        return httpx.Response(200, json={"status": "OK", "rows": rows})

    provider = GoogleMapsProvider("key", transport=httpx.MockTransport(handler))
    cache = MemoryRouteCache()
    service = RoutingService(provider=provider, cache=cache)
    points = [(33.89, 35.50), (34.12, 35.65), (34.25, 35.66), (34.00, 36.20)]
    grid, cost = service.matrix(points, departure_at=START)
    assert len(calls) == 1
    assert cost.cache_misses == 12
    assert all(grid[i][j].duration_seconds == 120 for i in range(4) for j in range(4) if i != j)
    _, again = service.matrix(points, departure_at=START)
    assert len(calls) == 1
    assert again.cache_hits == 12
    assert again.estimated_usd_micros == 0


def test_google_matrix_splits_requests_at_the_element_limit() -> None:
    import httpx

    from app.planner.routing import GOOGLE_MAX_ELEMENTS_PER_REQUEST, GoogleMapsProvider, MemoryRouteCache

    sizes: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        origins = request.url.params["origins"].split("|")
        destinations = request.url.params["destinations"].split("|")
        sizes.append(len(origins) * len(destinations))
        row = {"elements": [{"status": "OK", "distance": {"value": 1}, "duration": {"value": 1}}] * len(destinations)}
        return httpx.Response(200, json={"status": "OK", "rows": [row] * len(origins)})

    service = RoutingService(
        provider=GoogleMapsProvider("key", transport=httpx.MockTransport(handler)), cache=MemoryRouteCache()
    )
    points = [(33.8 + i * 0.01, 35.5) for i in range(MAX_OPTIMIZE_STOPS + 1)]
    grid, _ = service.matrix(points)
    assert all(size <= GOOGLE_MAX_ELEMENTS_PER_REQUEST for size in sizes)
    assert len(sizes) == 2
    assert all(leg.available for row in grid for leg in row)


def test_route_cache_is_bounded_and_forgets_failures_quickly() -> None:
    from app.planner.routing import FAILED_LEG_TTL_SECONDS, MemoryRouteCache

    cache = MemoryRouteCache(max_entries=3)
    service = RoutingService(provider=_SameVenueProvider(), cache=cache)
    for index in range(5):
        service.route(33.9, 35.5 + index * 0.1, 34.0, 35.6)
    assert len(cache) == 3
    failed = RouteLeg(
        origin_lat=0,
        origin_lng=0,
        dest_lat=1,
        dest_lng=1,
        mode="driving",
        available=False,
        provider="google",
        source="unavailable",
        time_bucket="t",
    )
    cache.put("failed", failed, ttl_seconds=6 * 3600)
    expires, _ = cache._store["failed"]
    assert (expires - datetime.now(UTC)).total_seconds() <= FAILED_LEG_TTL_SECONDS
