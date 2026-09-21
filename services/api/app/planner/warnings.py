from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from app.core.config import settings
from app.planner.weather import Forecast, WeatherService

SENSITIVITIES = frozenset({"indoor", "outdoor", "weather-sensitive"})


@dataclass
class Thresholds:
    precip_mm: float = 5.0
    precip_mm_sensitive: float = 2.0
    wind_kmh: float = 45.0
    wind_kmh_sensitive: float = 30.0
    temp_max_c: float = 38.0
    temp_min_c: float = 4.0

    @classmethod
    def from_settings(cls) -> Thresholds:
        return cls(
            precip_mm=settings.weather_precip_mm_threshold,
            precip_mm_sensitive=settings.weather_precip_mm_sensitive_threshold,
            wind_kmh=settings.weather_wind_kmh_threshold,
            wind_kmh_sensitive=settings.weather_wind_kmh_sensitive_threshold,
            temp_max_c=settings.weather_temp_max_c_threshold,
            temp_min_c=settings.weather_temp_min_c_threshold,
        )


@dataclass
class WarningStop:
    id: str
    label: str
    lat: float
    lng: float
    forecast_date: date
    weather_sensitivity: str = "outdoor"


@dataclass
class WeatherWarning:
    stop_id: str
    stop_label: str
    severity: str
    reasons: list[str]
    source: str
    fetched_at: datetime | None
    forecast_date: date


@dataclass
class WarningResult:
    warnings: list[WeatherWarning] = field(default_factory=list)
    forecast_unavailable: bool = False
    bookings_mutated: bool = False
    booking_statuses: dict[str, str] = field(default_factory=dict)


def evaluate_warnings(
    stops: list[WarningStop],
    weather: WeatherService | None = None,
    thresholds: Thresholds | None = None,
    booking_statuses: dict[str, str] | None = None,
) -> WarningResult:
    """Warnings never cancel or alter bookings. Missing forecasts produce no warning."""
    service = weather or WeatherService()
    limits = thresholds or Thresholds.from_settings()
    original = dict(booking_statuses or {})
    snapshot = dict(original)
    result = WarningResult(booking_statuses=snapshot)
    for stop in stops:
        sensitivity = stop.weather_sensitivity if stop.weather_sensitivity in SENSITIVITIES else "outdoor"
        if sensitivity == "indoor":
            continue
        forecast = service.forecast(stop.lat, stop.lng, stop.forecast_date)
        if not forecast.available:
            result.forecast_unavailable = True
            continue
        reasons = _reasons(forecast, sensitivity, limits)
        if not reasons:
            continue
        result.warnings.append(
            WeatherWarning(
                stop_id=stop.id,
                stop_label=stop.label,
                severity="warning" if sensitivity == "weather-sensitive" else "advisory",
                reasons=reasons,
                source=forecast.source,
                fetched_at=forecast.fetched_at,
                forecast_date=stop.forecast_date,
            )
        )
    result.bookings_mutated = result.booking_statuses != original
    return result


def _reasons(forecast: Forecast, sensitivity: str, limits: Thresholds) -> list[str]:
    reasons: list[str] = []
    precip_limit = limits.precip_mm_sensitive if sensitivity == "weather-sensitive" else limits.precip_mm
    wind_limit = limits.wind_kmh_sensitive if sensitivity == "weather-sensitive" else limits.wind_kmh
    if forecast.precip_mm is not None and forecast.precip_mm >= precip_limit:
        reasons.append(f"Precipitation {forecast.precip_mm:.1f} mm meets the {precip_limit:.1f} mm threshold")
    if forecast.wind_kmh is not None and forecast.wind_kmh >= wind_limit:
        reasons.append(f"Wind {forecast.wind_kmh:.0f} km/h meets the {wind_limit:.0f} km/h threshold")
    if forecast.temp_max_c is not None and forecast.temp_max_c >= limits.temp_max_c:
        reasons.append(f"High temperature {forecast.temp_max_c:.0f}°C meets the {limits.temp_max_c:.0f}°C threshold")
    if sensitivity == "outdoor" and forecast.temp_min_c is not None and forecast.temp_min_c <= limits.temp_min_c:
        reasons.append(f"Low temperature {forecast.temp_min_c:.0f}°C meets the {limits.temp_min_c:.0f}°C threshold")
    return reasons
