from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Protocol

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.planner.fixtures import OPEN_METEO_BEIRUT
from app.planner.geo_math import round_coord

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ATTRIBUTION = "Weather data by Open-Meteo.com (prototype; no production SLA)"


@dataclass
class Forecast:
    available: bool
    provider: str
    source: str
    forecast_date: date
    lat: float
    lng: float
    fetched_at: datetime | None = None
    precip_mm: float | None = None
    wind_kmh: float | None = None
    temp_max_c: float | None = None
    temp_min_c: float | None = None
    weather_code: int | None = None
    attribution: str = ""


def forecast_cache_key(lat: float, lng: float, day: date) -> str:
    return f"{round_coord(lat, 3)}|{round_coord(lng, 3)}|{day.isoformat()}"


class WeatherProvider(Protocol):
    name: str

    def forecast(self, lat: float, lng: float, day: date) -> Forecast: ...


class UnavailableWeather:
    name = "unavailable"

    def forecast(self, lat: float, lng: float, day: date) -> Forecast:
        return Forecast(
            available=False,
            provider=self.name,
            source="unavailable",
            forecast_date=day,
            lat=lat,
            lng=lng,
            fetched_at=datetime.now(UTC),
            attribution="",
        )


class OpenMeteoProvider:
    name = "open-meteo"

    def __init__(
        self,
        transport: httpx.BaseTransport | None = None,
        fixture: dict[str, Any] | None = None,
    ) -> None:
        self.transport = transport
        self.fixture = fixture

    def forecast(self, lat: float, lng: float, day: date) -> Forecast:
        payload = self.fixture if self.fixture is not None else self._fetch(lat, lng, day)
        return parse_open_meteo(payload, lat, lng, day)

    def _fetch(self, lat: float, lng: float, day: date) -> dict[str, Any]:
        params: dict[str, str | float] = {
            "latitude": lat,
            "longitude": lng,
            "daily": "precipitation_sum,windspeed_10m_max,temperature_2m_max,temperature_2m_min,weathercode",
            "timezone": "Asia/Beirut",
            "start_date": day.isoformat(),
            "end_date": day.isoformat(),
        }
        try:
            with httpx.Client(transport=self.transport, timeout=5.0) as client:
                response = client.get(OPEN_METEO_URL, params=params)
        except httpx.HTTPError:
            return {}
        if response.status_code >= 400:
            return {}
        data = response.json()
        return data if isinstance(data, dict) else {}


def parse_open_meteo(payload: dict[str, Any], lat: float, lng: float, day: date) -> Forecast:
    now = datetime.now(UTC)
    daily = payload.get("daily") if isinstance(payload, dict) else None
    if not isinstance(daily, dict):
        return Forecast(
            available=False,
            provider="open-meteo",
            source="unavailable",
            forecast_date=day,
            lat=lat,
            lng=lng,
            fetched_at=now,
        )
    times = daily.get("time") or []
    try:
        index = list(times).index(day.isoformat())
    except ValueError:
        index = 0 if times else -1
    if index < 0:
        return Forecast(
            available=False,
            provider="open-meteo",
            source="unavailable",
            forecast_date=day,
            lat=lat,
            lng=lng,
            fetched_at=now,
        )

    def _num(key: str) -> float | None:
        values = daily.get(key) or []
        if index >= len(values):
            return None
        value = values[index]
        if value is None:
            return None
        return float(value)

    precip = _num("precipitation_sum")
    wind = _num("windspeed_10m_max")
    tmax = _num("temperature_2m_max")
    tmin = _num("temperature_2m_min")
    codes = daily.get("weathercode") or []
    code = int(codes[index]) if index < len(codes) and codes[index] is not None else None
    if precip is None and wind is None and tmax is None:
        return Forecast(
            available=False,
            provider="open-meteo",
            source="unavailable",
            forecast_date=day,
            lat=lat,
            lng=lng,
            fetched_at=now,
        )
    return Forecast(
        available=True,
        provider="open-meteo",
        source="open-meteo",
        forecast_date=day,
        lat=lat,
        lng=lng,
        fetched_at=now,
        precip_mm=precip,
        wind_kmh=wind,
        temp_max_c=tmax,
        temp_min_c=tmin,
        weather_code=code,
        attribution=OPEN_METEO_ATTRIBUTION,
    )


class RecordedWeather:
    name = "fixture"

    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload

    def forecast(self, lat: float, lng: float, day: date) -> Forecast:
        return parse_open_meteo(self.payload, lat, lng, day)


class WeatherService:
    def __init__(self, provider: WeatherProvider | None = None) -> None:
        self.provider = provider or self._default()
        self._memory: dict[str, Forecast] = {}

    def _default(self) -> WeatherProvider:
        name = (settings.weather_provider or "stub").strip().lower()
        if name in {"unavailable", "down"}:
            return UnavailableWeather()
        if name in {"open-meteo", "openmeteo"}:
            return OpenMeteoProvider()
        return RecordedWeather(OPEN_METEO_BEIRUT)

    def forecast(self, lat: float, lng: float, day: date) -> Forecast:
        key = forecast_cache_key(lat, lng, day)
        cached = self._memory.get(key)
        if cached is not None:
            return cached
        result = self.provider.forecast(lat, lng, day)
        self._memory[key] = result
        return result


async def persist_forecast(db: AsyncSession, forecast: Forecast) -> None:
    await db.execute(
        text(
            "SELECT app.record_weather_forecast(:key, :lat, :lng, :day, :available, :provider, :source, "
            ":ttl, :precip, :wind, :tmax, :tmin, :code, :attr, CAST(:measurements AS jsonb))"
        ),
        {
            "key": forecast_cache_key(forecast.lat, forecast.lng, forecast.forecast_date),
            "lat": forecast.lat,
            "lng": forecast.lng,
            "day": forecast.forecast_date,
            "available": forecast.available,
            "provider": forecast.provider,
            "source": forecast.source,
            "ttl": settings.weather_cache_ttl_seconds,
            "precip": forecast.precip_mm,
            "wind": forecast.wind_kmh,
            "tmax": forecast.temp_max_c,
            "tmin": forecast.temp_min_c,
            "code": forecast.weather_code,
            "attr": forecast.attribution,
            "measurements": "{}",
        },
    )
