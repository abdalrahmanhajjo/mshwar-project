from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import httpx
import pytest

from app.planner.fixtures import (
    GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS,
    GOOGLE_DISTANCE_MATRIX_FAILED,
    OPEN_METEO_BEIRUT,
    OPEN_METEO_CLEAR,
)
from app.planner.geo_math import duration_seconds, haversine_m, road_distance_m
from app.planner.optimizer import OptimizeStop, optimize_route
from app.planner.places import autocomplete, reverse_geocode
from app.planner.routing import (
    GoogleMapsProvider,
    HaversineStubProvider,
    MemoryRouteCache,
    RouteLeg,
    RoutingService,
    UnavailableProvider,
    cache_key,
    fixture_google_provider,
    parse_google_matrix,
    reset_memory_cache,
    time_bucket,
)
from app.planner.warnings import Thresholds, WarningStop, evaluate_warnings
from app.planner.weather import OpenMeteoProvider, RecordedWeather, UnavailableWeather, WeatherService, parse_open_meteo

BEIRUT = (33.8938, 35.5018)
BYBLOS = (34.1230, 35.6510)
JEITA = (33.9436, 35.6414)
SIDON = (33.5631, 35.3689)


@pytest.fixture(autouse=True)
def _clear_route_cache() -> None:
    reset_memory_cache()


def test_cache_key_includes_origin_destination_mode_and_bucket() -> None:
    moment = datetime(2026, 9, 14, 9, 7, tzinfo=UTC)
    bucket = time_bucket(moment, 15)
    assert bucket.endswith("m0540")
    a = cache_key(*BEIRUT, *BYBLOS, "driving", bucket)
    b = cache_key(*BEIRUT, *BYBLOS, "walking", bucket)
    c = cache_key(*BYBLOS, *BEIRUT, "driving", bucket)
    assert a != b
    assert a != c
    assert a == cache_key(*BEIRUT, *BYBLOS, "driving", bucket)


def test_haversine_is_deterministic_and_scales() -> None:
    near = road_distance_m(*BEIRUT, *JEITA)
    far = road_distance_m(*BEIRUT, *SIDON)
    assert near > 0
    assert far > near
    assert haversine_m(*BEIRUT, *BEIRUT) == 0
    driving = duration_seconds(1000, "driving")
    walking = duration_seconds(1000, "walking")
    transit = duration_seconds(1000, "transit")
    assert walking > transit > driving
    assert duration_seconds(1, "driving") >= 60


def test_stub_returns_structured_distance_not_as_google() -> None:
    service = RoutingService(provider=HaversineStubProvider())
    leg = service.route(*BEIRUT, *BYBLOS, mode="driving", plan_id="plan-1")
    assert leg.available is True
    assert leg.distance_m is not None and leg.distance_m > 0
    assert leg.duration_seconds is not None and leg.duration_seconds > 0
    assert leg.source == "haversine-stub"
    assert leg.presented_as == "stub"
    assert service.last_cost.plan_id == "plan-1"
    assert service.last_cost.cache_misses == 1


def test_cache_hit_does_not_call_provider_twice() -> None:
    service = RoutingService(provider=HaversineStubProvider())
    first = service.route(*BEIRUT, *BYBLOS, mode="driving", plan_id="p")
    second = service.route(*BEIRUT, *BYBLOS, mode="driving", plan_id="p")
    assert first.cache_hit is False
    assert second.cache_hit is True
    assert second.distance_m == first.distance_m
    assert service.last_cost.cache_hits == 1
    assert service.last_cost.estimated_usd_micros == 0


def test_google_fixture_parses_recorded_matrix() -> None:
    provider = GoogleMapsProvider("test-credential", fixture=GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS)
    service = RoutingService(provider=provider)
    leg = service.route(*BEIRUT, *BYBLOS, mode="driving")
    assert leg.available is True
    assert leg.source == "google"
    assert leg.distance_m == 38421
    assert leg.duration_seconds == 3120
    assert leg.presented_as == "provider"
    assert service.last_cost.estimated_usd_micros > 0
    assert service.last_cost.within_budget is True


def test_unavailable_provider_never_silently_estimates() -> None:
    service = RoutingService(provider=UnavailableProvider())
    leg = service.route(*BEIRUT, *BYBLOS)
    assert leg.available is False
    assert leg.distance_m is None
    assert leg.duration_seconds is None
    assert leg.presented_as == "unavailable"


def test_google_failure_is_marked_unavailable_not_haversine() -> None:
    parsed = parse_google_matrix(GOOGLE_DISTANCE_MATRIX_FAILED, *BEIRUT, *BYBLOS, "driving", "untimed")
    assert parsed.available is False
    assert parsed.distance_m is None
    service = RoutingService(provider=GoogleMapsProvider("recorded-fixture", fixture=GOOGLE_DISTANCE_MATRIX_FAILED))
    leg = service.route(*BEIRUT, *BYBLOS)
    assert leg.available is False
    assert leg.source == "unavailable"
    assert leg.distance_m is None
    empty = parse_google_matrix({"status": "OK", "rows": []}, *BEIRUT, *BYBLOS, "driving", "untimed")
    assert empty.available is False
    missing_value = parse_google_matrix(
        {"status": "OK", "rows": [{"elements": [{"status": "OK", "distance": {}, "duration": {}}]}]},
        *BEIRUT,
        *BYBLOS,
        "driving",
        "untimed",
    )
    assert missing_value.available is False
    element_fail = parse_google_matrix(
        {"status": "OK", "rows": [{"elements": [{"status": "ZERO_RESULTS"}]}]},
        *BEIRUT,
        *BYBLOS,
        "driving",
        "untimed",
    )
    assert element_fail.available is False


def test_google_http_transport_and_failures() -> None:
    def ok(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS)

    provider = GoogleMapsProvider("recorded-fixture", transport=httpx.MockTransport(ok))
    leg = RoutingService(provider=provider).route(*BEIRUT, *BYBLOS)
    assert leg.distance_m == 38421

    def down(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    failed = GoogleMapsProvider("recorded-fixture", transport=httpx.MockTransport(down)).route(
        *BEIRUT, *BYBLOS, mode="driving"
    )
    assert failed.available is False

    def boom(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline")

    offline = GoogleMapsProvider("recorded-fixture", transport=httpx.MockTransport(boom)).route(
        *BEIRUT, *BYBLOS, mode="driving"
    )
    assert offline.available is False

    def not_object(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=["nope"])

    weird = GoogleMapsProvider("recorded-fixture", transport=httpx.MockTransport(not_object)).route(
        *BEIRUT, *BYBLOS, mode="driving"
    )
    assert weird.available is False
    helper = fixture_google_provider().route(*BEIRUT, *BYBLOS, mode="driving")
    assert helper.distance_m == 38421


def test_memory_cache_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    cache = MemoryRouteCache()
    service = RoutingService(provider=HaversineStubProvider(), cache=cache)
    first = service.route(*BEIRUT, *BYBLOS)
    assert first.cache_hit is False
    expired = datetime.now(UTC) - timedelta(seconds=1)
    for key, (_expires, leg) in list(cache._store.items()):
        cache._store[key] = (expired, leg)
    second = service.route(*BEIRUT, *BYBLOS)
    assert second.cache_hit is False


def test_default_providers_honour_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.catalogue_routing_provider", "unavailable")
    assert RoutingService().provider.name == "unavailable"
    monkeypatch.setattr("app.core.config.settings.catalogue_routing_provider", "stub")
    assert RoutingService().provider.name == "haversine-stub"
    monkeypatch.setattr("app.core.config.settings.catalogue_routing_provider", "auto")
    monkeypatch.setattr("app.core.config.settings.google_maps_api_key", "")
    assert RoutingService().provider.name == "haversine-stub"
    monkeypatch.setattr("app.core.config.settings.weather_provider", "unavailable")
    assert WeatherService().provider.name == "unavailable"
    monkeypatch.setattr("app.core.config.settings.weather_provider", "stub")
    assert isinstance(WeatherService().provider, RecordedWeather)
    monkeypatch.setattr("app.core.config.settings.weather_provider", "open-meteo")
    assert WeatherService().provider.name == "open-meteo"
    monkeypatch.setattr("app.core.config.settings.catalogue_routing_provider", "auto")
    monkeypatch.setattr("app.core.config.settings.google_maps_api_key", "recorded-fixture")
    assert RoutingService().provider.name == "google"

    stored: dict[str, RouteLeg] = {}
    cache = MemoryRouteCache()
    service = RoutingService(provider=HaversineStubProvider(), cache=cache)

    def persist_leg_cb(key: str, leg: RouteLeg) -> None:
        stored[key] = leg

    def read_leg_cb(key: str) -> RouteLeg | None:
        return stored.get(key)

    first = service.route(*BEIRUT, *SIDON, persist=persist_leg_cb, read_persisted=read_leg_cb)
    assert stored
    cache._store.clear()
    second = service.route(*BEIRUT, *SIDON, persist=persist_leg_cb, read_persisted=read_leg_cb)
    assert second.cache_hit is True
    assert second.distance_m == first.distance_m


def test_places_autocomplete_and_reverse_are_human_readable() -> None:
    hits = autocomplete("byb")
    assert hits
    assert "Byblos" in hits[0].label
    assert autocomplete("")[0].label == "Beirut"
    pin = reverse_geocode(*BEIRUT)
    assert pin.label
    assert "(" not in pin.label or "Beirut" in pin.label or "Hamra" in pin.label or "Downtown" in pin.label
    far = reverse_geocode(10.0, 10.0)
    assert far.source == "reverse-stub"
    assert "Dropped pin" in far.label


def test_google_reverse_uses_recorded_transport(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.config.settings.google_maps_api_key", "recorded-fixture")

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "status": "OK",
                "results": [{"formatted_address": "Hamra, Beirut, Lebanon", "place_id": "ChIJhamra"}],
            },
        )

    hit = reverse_geocode(*BEIRUT, transport=httpx.MockTransport(handler))
    assert hit.source == "google"
    assert "Hamra" in hit.label

    def down(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(400)

    fallback = reverse_geocode(*BEIRUT, transport=httpx.MockTransport(down))
    assert fallback.source != "google"


def _stops(*points: tuple[str, float, float], duration: int = 45) -> list[OptimizeStop]:
    return [OptimizeStop(id=name, lat=lat, lng=lng, label=name, duration_minutes=duration) for name, lat, lng in points]


def test_optimizer_respects_locked_stop_and_return_by() -> None:
    start = datetime(2026, 9, 14, 8, 0, tzinfo=UTC)
    stops = _stops(("downtown", *BEIRUT), ("byblos", *BYBLOS), ("jeita", *JEITA))
    stops[1].locked = True
    stops[1].position = 1
    result = optimize_route(*BEIRUT, stops, start, start + timedelta(hours=12), plan_id="lock")
    assert result.feasible is True
    assert result.ordered[0].id == "byblos"
    assert result.ordered[0].locked is True
    assert result.metrics_available is True
    assert result.legs

    tight = optimize_route(*BEIRUT, stops, start, start + timedelta(minutes=20), plan_id="tight")
    assert tight.feasible is False
    assert tight.reason is not None

    closing = _stops(("downtown", *BEIRUT), ("byblos", *BYBLOS))
    closing[0].closes_at = start + timedelta(minutes=2)
    closed = optimize_route(*BEIRUT, closing, start, start + timedelta(hours=8), plan_id="close")
    assert closed.feasible is False

    empty = optimize_route(*BEIRUT, [], start, start + timedelta(hours=2), plan_id="empty")
    assert empty.feasible is True
    assert empty.ordered == []


def test_optimizer_honours_appointment_window() -> None:
    start = datetime(2026, 9, 14, 8, 0, tzinfo=UTC)
    stops = _stops(("near", *JEITA), ("appointment", *BYBLOS), ("sidon", *SIDON))
    stops[1].window_start = start + timedelta(hours=6)
    stops[1].window_end = start + timedelta(hours=8)
    result = optimize_route(*BEIRUT, stops, start, start + timedelta(hours=14), plan_id="win")
    assert result.feasible is True
    appointment = next(stop for stop in result.ordered if stop.id == "appointment")
    assert appointment.arrives_at is not None
    assert appointment.arrives_at >= stops[1].window_start


def test_optimizer_benchmarks_3_6_10_stops() -> None:
    start = datetime(2026, 9, 14, 7, 0, tzinfo=UTC)
    catalogue = [
        ("a", 33.89, 35.50),
        ("b", 33.90, 35.48),
        ("c", 33.94, 35.64),
        ("d", 34.12, 35.65),
        ("e", 33.56, 35.37),
        ("f", 33.27, 35.20),
        ("g", 34.25, 36.01),
        ("h", 34.44, 35.85),
        ("i", 33.85, 35.90),
        ("j", 34.00, 35.83),
    ]
    for count in (3, 6, 10):
        stops = _stops(*catalogue[:count], duration=20)
        result = optimize_route(
            *BEIRUT, stops, start, start + timedelta(hours=16), timeout_ms=2000, plan_id=f"n{count}"
        )
        assert result.feasible is True, result.reason
        assert result.solve_ms < 2000
        assert len(result.ordered) == count
        assert result.metrics_available is True


def test_optimizer_timeout_falls_back_to_original_order(monkeypatch: pytest.MonkeyPatch) -> None:
    start = datetime(2026, 9, 14, 8, 0, tzinfo=UTC)
    stops = _stops(("downtown", 33.896, 35.506), ("jeita", *JEITA), ("sidon", *SIDON))
    ticks = {"n": 0}

    def fake_monotonic() -> float:
        ticks["n"] += 1
        return 0.0 if ticks["n"] == 1 else 10.0

    monkeypatch.setattr("app.planner.optimizer.time.monotonic", fake_monotonic)
    result = optimize_route(*BEIRUT, stops, start, start + timedelta(hours=12), timeout_ms=50, plan_id="to")
    assert result.timeout is True
    assert result.fallback is True
    assert [stop.id for stop in result.ordered] == ["downtown", "jeita", "sidon"]


def test_unavailable_routing_does_not_display_fake_metrics() -> None:
    start = datetime(2026, 9, 14, 8, 0, tzinfo=UTC)
    stops = _stops(("downtown", 33.896, 35.506), ("jeita", *JEITA))
    result = optimize_route(
        *BEIRUT,
        stops,
        start,
        start + timedelta(hours=8),
        routing=RoutingService(provider=UnavailableProvider()),
    )
    assert result.metrics_available is False
    assert result.total_distance_m is None
    assert result.total_duration_seconds is None
    for leg in result.legs:
        assert leg.available is False
        assert leg.distance_m is None


def test_weather_unavailable_yields_no_warning() -> None:
    weather = WeatherService(provider=UnavailableWeather())
    result = evaluate_warnings(
        [
            WarningStop(
                id="hike",
                label="Cedars walk",
                lat=34.24,
                lng=36.05,
                forecast_date=datetime(2026, 9, 14, tzinfo=UTC).date(),
                weather_sensitivity="outdoor",
            )
        ],
        weather=weather,
        booking_statuses={"bk-1": "confirmed"},
    )
    assert result.warnings == []
    assert result.forecast_unavailable is True
    assert result.bookings_mutated is False
    assert result.booking_statuses == {"bk-1": "confirmed"}


def test_weather_warning_names_stop_and_source_timestamp_without_booking_change() -> None:
    weather = WeatherService(provider=OpenMeteoProvider(fixture=OPEN_METEO_BEIRUT))
    statuses = {"bk-1": "confirmed", "bk-2": "pending"}
    result = evaluate_warnings(
        [
            WarningStop(
                id="hike",
                label="Cedars walk",
                lat=33.89,
                lng=35.50,
                forecast_date=datetime(2026, 9, 14, tzinfo=UTC).date(),
                weather_sensitivity="weather-sensitive",
            ),
            WarningStop(
                id="museum",
                label="Indoor museum",
                lat=33.89,
                lng=35.50,
                forecast_date=datetime(2026, 9, 14, tzinfo=UTC).date(),
                weather_sensitivity="indoor",
            ),
        ],
        weather=weather,
        booking_statuses=statuses,
    )
    assert result.bookings_mutated is False
    assert result.booking_statuses == statuses
    assert [item.stop_id for item in result.warnings] == ["hike"]
    warning = result.warnings[0]
    assert warning.stop_label == "Cedars walk"
    assert warning.source == "open-meteo"
    assert warning.fetched_at is not None
    assert any("Precipitation" in reason for reason in warning.reasons)


def test_clear_forecast_and_open_meteo_http() -> None:
    weather = WeatherService(provider=RecordedWeather(OPEN_METEO_CLEAR))
    result = evaluate_warnings(
        [
            WarningStop(
                id="walk",
                label="Corniche",
                lat=33.89,
                lng=35.50,
                forecast_date=datetime(2026, 9, 20, tzinfo=UTC).date(),
                weather_sensitivity="outdoor",
            )
        ],
        weather=weather,
        thresholds=Thresholds(),
        booking_statuses={"bk": "confirmed"},
    )
    assert result.warnings == []
    assert result.bookings_mutated is False
    cached = weather.forecast(33.89, 35.50, datetime(2026, 9, 20, tzinfo=UTC).date())
    assert cached.available is True

    missing = parse_open_meteo({}, 33.89, 35.50, date(2026, 9, 14))
    assert missing.available is False
    empty_meas = parse_open_meteo(
        {"daily": {"time": ["2026-09-14"], "precipitation_sum": [None], "windspeed_10m_max": [None]}},
        33.89,
        35.50,
        date(2026, 9, 14),
    )
    assert empty_meas.available is False

    def ok(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=OPEN_METEO_BEIRUT)

    live = OpenMeteoProvider(transport=httpx.MockTransport(ok)).forecast(33.89, 35.50, date(2026, 9, 14))
    assert live.available is True
    assert live.precip_mm == 12.4

    def down(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    assert (
        OpenMeteoProvider(transport=httpx.MockTransport(down)).forecast(33.89, 35.50, date(2026, 9, 14)).available
        is False
    )
