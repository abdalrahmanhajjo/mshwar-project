from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.core.geo import BEIRUT_LAT, BEIRUT_LNG, point_in_lebanon
from app.planner.geo_math import haversine_m

LEBANON_PLACES: tuple[dict[str, Any], ...] = (
    {"place_id": "hamra", "label": "Hamra, Beirut", "lat": 33.8969, "lng": 35.4822},
    {"place_id": "downtown", "label": "Downtown Beirut", "lat": 33.8960, "lng": 35.5060},
    {"place_id": "raouche", "label": "Raouche, Beirut", "lat": 33.8903, "lng": 35.4704},
    {"place_id": "byblos", "label": "Byblos (Jbeil)", "lat": 34.1230, "lng": 35.6510},
    {"place_id": "jeita", "label": "Jeita Grotto", "lat": 33.9436, "lng": 35.6414},
    {"place_id": "baalbek", "label": "Baalbek", "lat": 34.0069, "lng": 36.2110},
    {"place_id": "sidon", "label": "Sidon (Saida)", "lat": 33.5631, "lng": 35.3689},
    {"place_id": "tyre", "label": "Tyre (Sour)", "lat": 33.2700, "lng": 35.2030},
    {"place_id": "bcharre", "label": "Bcharre", "lat": 34.2510, "lng": 36.0110},
    {"place_id": "cedars", "label": "The Cedars of God", "lat": 34.2438, "lng": 36.0483},
    {"place_id": "tripoli", "label": "Tripoli", "lat": 34.4360, "lng": 35.8490},
    {"place_id": "zahle", "label": "Zahle", "lat": 33.8460, "lng": 35.9040},
    {"place_id": "faraya", "label": "Faraya", "lat": 34.0000, "lng": 35.8270},
    {
        "place_id": "beirut-airport",
        "label": "Beirut–Rafic Hariri International Airport",
        "lat": 33.8209,
        "lng": 35.4884,
    },
)


@dataclass
class PlaceHit:
    place_id: str
    label: str
    lat: float
    lng: float
    source: str


def autocomplete(query: str, limit: int = 6) -> list[PlaceHit]:
    needle = (query or "").strip().lower()
    if len(needle) < 1:
        return [
            PlaceHit(
                place_id="beirut-centre",
                label="Beirut",
                lat=BEIRUT_LAT,
                lng=BEIRUT_LNG,
                source="catalog",
            )
        ]
    hits: list[PlaceHit] = []
    for place in LEBANON_PLACES:
        label = str(place["label"])
        if needle in label.lower() or needle in str(place["place_id"]):
            hits.append(
                PlaceHit(
                    place_id=str(place["place_id"]),
                    label=label,
                    lat=float(place["lat"]),
                    lng=float(place["lng"]),
                    source="catalog",
                )
            )
        if len(hits) >= limit:
            break
    return hits


def reverse_geocode(lat: float, lng: float, transport: httpx.BaseTransport | None = None) -> PlaceHit:
    if settings.google_maps_api_key:
        google = _google_reverse(lat, lng, transport=transport)
        if google is not None:
            return google
    nearest = min(LEBANON_PLACES, key=lambda place: haversine_m(lat, lng, float(place["lat"]), float(place["lng"])))
    distance = haversine_m(lat, lng, float(nearest["lat"]), float(nearest["lng"]))
    if distance <= 2500:
        return PlaceHit(
            place_id=str(nearest["place_id"]),
            label=str(nearest["label"]),
            lat=lat,
            lng=lng,
            source="reverse-catalog",
        )
    region = "Lebanon" if point_in_lebanon(lng, lat) else "Dropped pin"
    return PlaceHit(
        place_id=f"pin:{round(lat, 4)},{round(lng, 4)}",
        label=f"{region} ({lat:.4f}, {lng:.4f})",
        lat=lat,
        lng=lng,
        source="reverse-stub",
    )


def _google_reverse(lat: float, lng: float, transport: httpx.BaseTransport | None = None) -> PlaceHit | None:
    params = {"latlng": f"{lat},{lng}", "key": settings.google_maps_api_key}
    try:
        with httpx.Client(transport=transport, timeout=5.0) as client:
            response = client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
    except httpx.HTTPError:
        return None
    if response.status_code >= 400:
        return None
    payload = response.json()
    if not isinstance(payload, dict) or payload.get("status") != "OK":
        return None
    results = payload.get("results") or []
    if not results:
        return None
    first = results[0]
    label = str(first.get("formatted_address") or "Pinned location")
    return PlaceHit(place_id=str(first.get("place_id") or "google"), label=label, lat=lat, lng=lng, source="google")
