from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6371000.0
ROAD_FACTOR = 1.35
DRIVING_MPS = 11.11  # ~40 km/h Lebanon mixed roads
WALKING_MPS = 1.25
TRANSIT_MPS = 8.3


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres. Deterministic; not an LLM estimate."""
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(a)))


def road_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    return round(haversine_m(lat1, lng1, lat2, lng2) * ROAD_FACTOR)


def duration_seconds(distance_m: int, mode: str) -> int:
    speed = DRIVING_MPS
    if mode == "walking":
        speed = WALKING_MPS
    elif mode == "transit":
        speed = TRANSIT_MPS
    return max(round(distance_m / speed), 60)


def round_coord(value: float, digits: int = 4) -> float:
    return round(float(value), digits)
