from __future__ import annotations

import hashlib
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.planner.fixtures import GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS
from app.planner.geo_math import duration_seconds, road_distance_m, round_coord

GOOGLE_MATRIX_USD_PER_1000 = 5.0
GOOGLE_MAX_ELEMENTS_PER_REQUEST = 100  # Distance Matrix API limit per request
ROUTE_CACHE_MAX_ENTRIES = 10_000
# A provider outage should not be remembered for the full cache lifetime.
FAILED_LEG_TTL_SECONDS = 60
DEFAULT_BUDGET_USD = 0.50
MODES = frozenset({"driving", "walking", "transit"})


def time_bucket(moment: datetime | None, bucket_minutes: int) -> str:
    if moment is None:
        return "untimed"
    aware = moment if moment.tzinfo else moment.replace(tzinfo=UTC)
    minutes = aware.hour * 60 + aware.minute
    bucket = (minutes // max(bucket_minutes, 1)) * max(bucket_minutes, 1)
    return f"{aware.strftime('%Y-%m-%d')}-dow{aware.weekday()}-m{bucket:04d}"


def cache_key(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, mode: str, bucket: str) -> str:
    raw = (
        f"{round_coord(origin_lat)}|{round_coord(origin_lng)}|"
        f"{round_coord(dest_lat)}|{round_coord(dest_lng)}|{mode}|{bucket}"
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass
class RouteLeg:
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    mode: str
    available: bool
    provider: str
    source: str
    time_bucket: str
    distance_m: int | None = None
    duration_seconds: int | None = None
    cache_hit: bool = False
    fetched_at: datetime | None = None

    @property
    def presented_as(self) -> str:
        if not self.available:
            return "unavailable"
        if self.source == "google":
            return "provider"
        return "stub"


@dataclass
class RoutingCost:
    plan_id: str
    provider: str
    elements_requested: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    estimated_usd_micros: int = 0
    within_budget: bool = True
    budget_usd_micros: int = int(DEFAULT_BUDGET_USD * 1_000_000)
    documented_rate: str = "Google Distance Matrix list price USD 5 per 1000 elements (instrumentation stub)"


class RoutingProvider(Protocol):
    name: str

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str,
        departure_at: datetime | None = None,
    ) -> RouteLeg: ...


class HaversineStubProvider:
    """Deterministic road-factor stub used when no Maps credential is configured."""

    name = "haversine-stub"

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str,
        departure_at: datetime | None = None,
    ) -> RouteLeg:
        bucket = time_bucket(departure_at, settings.routing_time_bucket_minutes)
        distance = road_distance_m(origin_lat, origin_lng, dest_lat, dest_lng)
        seconds = duration_seconds(distance, mode)
        return RouteLeg(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            mode=mode,
            available=True,
            provider=self.name,
            source="haversine-stub",
            time_bucket=bucket,
            distance_m=distance,
            duration_seconds=seconds,
            fetched_at=datetime.now(UTC),
        )


class UnavailableProvider:
    name = "unavailable"

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str,
        departure_at: datetime | None = None,
    ) -> RouteLeg:
        bucket = time_bucket(departure_at, settings.routing_time_bucket_minutes)
        return RouteLeg(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            mode=mode,
            available=False,
            provider=self.name,
            source="unavailable",
            time_bucket=bucket,
            fetched_at=datetime.now(UTC),
        )


class GoogleMapsProvider:
    name = "google"
    matrix_url = "https://maps.googleapis.com/maps/api/distancematrix/json"

    def __init__(
        self,
        credential: str,
        transport: httpx.BaseTransport | None = None,
        fixture: dict[str, Any] | None = None,
    ) -> None:
        self.credential = credential
        self.transport = transport
        self.fixture = fixture

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str,
        departure_at: datetime | None = None,
    ) -> RouteLeg:
        bucket = time_bucket(departure_at, settings.routing_time_bucket_minutes)
        payload = (
            self.fixture if self.fixture is not None else self._fetch(origin_lat, origin_lng, dest_lat, dest_lng, mode)
        )
        return parse_google_matrix(payload, origin_lat, origin_lng, dest_lat, dest_lng, mode, bucket)

    def matrix_legs(
        self,
        pairs: list[tuple[tuple[float, float], tuple[float, float]]],
        mode: str,
        departure_at: datetime | None = None,
    ) -> list[RouteLeg]:
        """Resolve many origin→destination pairs with as few Distance Matrix calls as possible."""
        bucket = time_bucket(departure_at, settings.routing_time_bucket_minutes)
        results: dict[tuple[tuple[float, float], tuple[float, float]], RouteLeg] = {}
        origins = list(dict.fromkeys(origin for origin, _ in pairs))
        destinations = list(dict.fromkeys(dest for _, dest in pairs))
        rows_per_call = max(1, GOOGLE_MAX_ELEMENTS_PER_REQUEST // max(len(destinations), 1))
        for start in range(0, len(origins), rows_per_call):
            chunk = origins[start : start + rows_per_call]
            payload = self.fixture if self.fixture is not None else self._fetch_many(chunk, destinations, mode)
            for row_index, origin in enumerate(chunk):
                for col_index, dest in enumerate(destinations):
                    results[(origin, dest)] = parse_google_matrix(
                        payload, *origin, *dest, mode, bucket, row=row_index, col=col_index
                    )
        return [results[pair] for pair in pairs]

    def _fetch(
        self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, mode: str
    ) -> dict[str, Any]:
        return self._fetch_many([(origin_lat, origin_lng)], [(dest_lat, dest_lng)], mode)

    def _fetch_many(
        self, origins: list[tuple[float, float]], destinations: list[tuple[float, float]], mode: str
    ) -> dict[str, Any]:
        params = {
            "origins": "|".join(f"{lat},{lng}" for lat, lng in origins),
            "destinations": "|".join(f"{lat},{lng}" for lat, lng in destinations),
            "mode": "driving" if mode == "driving" else ("walking" if mode == "walking" else "transit"),
            "key": self.credential,
        }
        try:
            with httpx.Client(transport=self.transport, timeout=5.0) as client:
                response = client.get(self.matrix_url, params=params)
        except httpx.HTTPError:
            return {"status": "UNKNOWN_ERROR"}
        if response.status_code >= 400:
            return {"status": "UNKNOWN_ERROR"}
        data = response.json()
        return data if isinstance(data, dict) else {"status": "UNKNOWN_ERROR"}


def parse_google_matrix(
    payload: dict[str, Any],
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    mode: str,
    bucket: str,
    *,
    row: int = 0,
    col: int = 0,
) -> RouteLeg:
    """Read one element of a Distance Matrix response. Anything unexpected means "unavailable"."""
    now = datetime.now(UTC)
    base = RouteLeg(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        mode=mode,
        available=False,
        provider="google",
        source="unavailable",
        time_bucket=bucket,
        fetched_at=now,
    )
    if payload.get("status") != "OK":
        return base
    rows = payload.get("rows") or []
    if len(rows) <= row or not isinstance(rows[row], dict):
        return base
    elements = rows[row].get("elements") or []
    if len(elements) <= col or not isinstance(elements[col], dict):
        return base
    element = elements[col]
    if element.get("status") != "OK":
        return base
    distance = (element.get("distance") or {}).get("value")
    duration = (element.get("duration") or {}).get("value")
    if not isinstance(distance, int) or not isinstance(duration, int):
        return base
    base.available = True
    base.source = "google"
    base.distance_m = distance
    base.duration_seconds = duration
    return base


class MemoryRouteCache:
    """Process-local LRU cache with per-entry expiry."""

    def __init__(self, max_entries: int = ROUTE_CACHE_MAX_ENTRIES) -> None:
        self._store: OrderedDict[str, tuple[datetime, RouteLeg]] = OrderedDict()
        self.max_entries = max_entries

    def get(self, key: str) -> RouteLeg | None:
        item = self._store.get(key)
        if item is None:
            return None
        expires, leg = item
        if expires <= datetime.now(UTC):
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return RouteLeg(**{**leg.__dict__, "cache_hit": True})

    def put(self, key: str, leg: RouteLeg, ttl_seconds: int) -> None:
        lifetime = max(ttl_seconds, 60) if leg.available else FAILED_LEG_TTL_SECONDS
        self._store[key] = (datetime.now(UTC) + timedelta(seconds=lifetime), leg)
        self._store.move_to_end(key)
        while len(self._store) > self.max_entries:
            self._store.popitem(last=False)

    def clear(self) -> None:
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)


_MEMORY = MemoryRouteCache()


class RoutingService:
    def __init__(
        self,
        provider: RoutingProvider | None = None,
        cache: MemoryRouteCache | None = None,
        google_transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.cache = cache if cache is not None else _MEMORY
        self.google_transport = google_transport
        self.provider = provider or self._default_provider()
        self.last_cost = RoutingCost(plan_id="anon", provider=self.provider.name)

    def _default_provider(self) -> RoutingProvider:
        forced = (settings.catalogue_routing_provider or "auto").strip().lower()
        if forced in {"unavailable", "down"}:
            return UnavailableProvider()
        if forced in {"stub", "haversine", "haversine-stub"}:
            return HaversineStubProvider()
        if settings.google_maps_api_key:
            return GoogleMapsProvider(settings.google_maps_api_key, transport=self.google_transport)
        return HaversineStubProvider()

    def route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        mode: str = "driving",
        departure_at: datetime | None = None,
        plan_id: str = "anon",
        persist: Callable[[str, RouteLeg], None] | None = None,
        read_persisted: Callable[[str], RouteLeg | None] | None = None,
    ) -> RouteLeg:
        travel_mode = mode if mode in MODES else "driving"
        bucket = time_bucket(departure_at, settings.routing_time_bucket_minutes)
        key = cache_key(origin_lat, origin_lng, dest_lat, dest_lng, travel_mode, bucket)
        cached = self.cache.get(key)
        if cached is None and read_persisted is not None:
            cached = read_persisted(key)
            if cached is not None:
                cached.cache_hit = True
                self.cache.put(key, cached, settings.routing_cache_ttl_seconds)
        cost = RoutingCost(plan_id=plan_id, provider=self.provider.name)
        cost.elements_requested = 1
        if cached is not None:
            cost.cache_hits = 1
            cost.estimated_usd_micros = 0
            self.last_cost = cost
            return cached
        cost.cache_misses = 1
        leg = self.provider.route(origin_lat, origin_lng, dest_lat, dest_lng, travel_mode, departure_at)
        if not leg.available and self.provider.name == "google":
            # Configured provider failed: never substitute a silent Haversine estimate.
            leg.source = "unavailable"
            leg.distance_m = None
            leg.duration_seconds = None
        self.cache.put(key, leg, settings.routing_cache_ttl_seconds)
        if persist is not None:
            persist(key, leg)
        if self.provider.name == "google":
            cost.estimated_usd_micros = int(GOOGLE_MATRIX_USD_PER_1000 / 1000 * 1_000_000)
        cost.within_budget = cost.estimated_usd_micros <= cost.budget_usd_micros
        self.last_cost = cost
        return leg

    def matrix(
        self,
        points: list[tuple[float, float]],
        mode: str = "driving",
        departure_at: datetime | None = None,
        plan_id: str = "anon",
    ) -> tuple[list[list[RouteLeg]], RoutingCost]:
        """All-pairs legs. Cached pairs are reused; the rest go to the provider in one batch when it supports it."""
        travel_mode = mode if mode in MODES else "driving"
        bucket = time_bucket(departure_at, settings.routing_time_bucket_minutes)
        total = RoutingCost(plan_id=plan_id, provider=self.provider.name)
        grid: list[list[RouteLeg | None]] = [[None] * len(points) for _ in points]
        missing: list[tuple[int, int, str]] = []
        for i, origin in enumerate(points):
            for j, dest in enumerate(points):
                if i == j:
                    grid[i][j] = _identity_leg(origin, travel_mode, self.provider.name, bucket)
                    continue
                total.elements_requested += 1
                key = cache_key(*origin, *dest, travel_mode, bucket)
                cached = self.cache.get(key)
                if cached is not None:
                    total.cache_hits += 1
                    grid[i][j] = cached
                else:
                    missing.append((i, j, key))
        total.cache_misses = len(missing)
        for (i, j, key), leg in zip(missing, self._fetch_legs(points, missing, travel_mode, departure_at), strict=True):
            self.cache.put(key, leg, settings.routing_cache_ttl_seconds)
            grid[i][j] = leg
        if self.provider.name == "google":
            total.estimated_usd_micros = int(GOOGLE_MATRIX_USD_PER_1000 / 1000 * 1_000_000) * len(missing)
        total.within_budget = total.estimated_usd_micros <= total.budget_usd_micros
        self.last_cost = total
        return [[leg for leg in row if leg is not None] for row in grid], total

    def _fetch_legs(
        self,
        points: list[tuple[float, float]],
        missing: list[tuple[int, int, str]],
        mode: str,
        departure_at: datetime | None,
    ) -> list[RouteLeg]:
        if not missing:
            return []
        pairs = [(points[i], points[j]) for i, j, _ in missing]
        batch = getattr(self.provider, "matrix_legs", None)
        if callable(batch):
            legs: list[RouteLeg] = batch(pairs, mode, departure_at)
        else:
            legs = [self.provider.route(*origin, *dest, mode, departure_at) for origin, dest in pairs]
        for leg in legs:
            if not leg.available and self.provider.name == "google":
                # Configured provider failed: never substitute a silent Haversine estimate.
                leg.source = "unavailable"
                leg.distance_m = None
                leg.duration_seconds = None
        return legs


def _identity_leg(point: tuple[float, float], mode: str, provider: str, bucket: str) -> RouteLeg:
    return RouteLeg(
        origin_lat=point[0],
        origin_lng=point[1],
        dest_lat=point[0],
        dest_lng=point[1],
        mode=mode,
        available=True,
        provider=provider,
        source="identity",
        time_bucket=bucket,
        distance_m=0,
        duration_seconds=0,
        cache_hit=True,
        fetched_at=datetime.now(UTC),
    )


def fixture_google_provider() -> GoogleMapsProvider:
    return GoogleMapsProvider("recorded-fixture", fixture=GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS)


async def persist_leg(db: AsyncSession, key: str, leg: RouteLeg) -> None:
    await db.execute(
        text(
            "SELECT app.record_route_cache(:key, :olat, :olng, :dlat, :dlng, :mode, :bucket, "
            ":available, :provider, :source, :distance, :duration, :ttl, CAST(:payload AS jsonb))"
        ),
        {
            "key": key,
            "olat": leg.origin_lat,
            "olng": leg.origin_lng,
            "dlat": leg.dest_lat,
            "dlng": leg.dest_lng,
            "mode": leg.mode,
            "bucket": leg.time_bucket,
            "available": leg.available,
            "provider": leg.provider,
            "source": leg.source,
            "distance": leg.distance_m,
            "duration": leg.duration_seconds,
            "ttl": settings.routing_cache_ttl_seconds,
            "payload": "{}",
        },
    )


async def read_persisted_leg(db: AsyncSession, key: str) -> RouteLeg | None:
    row = (await db.execute(text("SELECT app.read_route_cache(:key)"), {"key": key})).scalar()
    if not isinstance(row, dict):
        return None
    fetched = row.get("fetched_at")
    fetched_at: datetime
    if isinstance(fetched, datetime):
        fetched_at = fetched if fetched.tzinfo else fetched.replace(tzinfo=UTC)
    elif fetched:
        fetched_at = datetime.fromisoformat(str(fetched).replace("Z", "+00:00"))
    else:
        fetched_at = datetime.now(UTC)
    distance = row.get("distance_m")
    duration = row.get("duration_seconds")
    return RouteLeg(
        origin_lat=0,
        origin_lng=0,
        dest_lat=0,
        dest_lng=0,
        mode="driving",
        available=bool(row.get("available")),
        provider=str(row.get("provider") or "unknown"),
        source=str(row.get("source") or "unknown"),
        time_bucket="",
        distance_m=distance if isinstance(distance, int) else None,
        duration_seconds=duration if isinstance(duration, int) else None,
        cache_hit=True,
        fetched_at=fetched_at,
    )


async def persist_cost(db: AsyncSession, cost: RoutingCost) -> None:
    await db.execute(
        text("SELECT app.record_routing_cost(:plan_id, :provider, :requested, :hits, :misses, :micros, :within)"),
        {
            "plan_id": cost.plan_id,
            "provider": cost.provider,
            "requested": cost.elements_requested,
            "hits": cost.cache_hits,
            "misses": cost.cache_misses,
            "micros": cost.estimated_usd_micros,
            "within": cost.within_budget,
        },
    )


def reset_memory_cache() -> None:
    _MEMORY.clear()
