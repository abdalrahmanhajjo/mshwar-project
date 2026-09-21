from __future__ import annotations

# Inclusive geographic envelope used when a listing must sit inside Lebanon.
LEBANON_LNG_MIN = 35.103
LEBANON_LNG_MAX = 36.623
LEBANON_LAT_MIN = 33.047
LEBANON_LAT_MAX = 34.692
BEIRUT_LNG = 35.5018
BEIRUT_LAT = 33.8938


def point_in_lebanon(lng: float, lat: float) -> bool:
    return LEBANON_LNG_MIN <= lng <= LEBANON_LNG_MAX and LEBANON_LAT_MIN <= lat <= LEBANON_LAT_MAX


def lebanon_bounds() -> dict[str, float]:
    return {
        "lng_min": LEBANON_LNG_MIN,
        "lng_max": LEBANON_LNG_MAX,
        "lat_min": LEBANON_LAT_MIN,
        "lat_max": LEBANON_LAT_MAX,
    }
