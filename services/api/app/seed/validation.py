from __future__ import annotations

from dataclasses import dataclass

LEBANON_BOUNDS = {
    "min_lat": 33.0,
    "max_lat": 34.8,
    "min_lng": 35.1,
    "max_lng": 36.9,
}


@dataclass
class LebanonRegion:
    name: str
    slug: str
    lat: float
    lng: float
    description: str


REGIONS: list[LebanonRegion] = [
    LebanonRegion("Beirut", "beirut", 33.8938, 35.5018, "Capital city and cultural hub"),
    LebanonRegion(
        "Mount Lebanon", "mount-lebanon", 33.8728, 35.5728, "Mountainous region with monasteries and villages"
    ),
    LebanonRegion("North Lebanon", "north-lebanon", 34.4574, 35.8596, "Historic Tripoli and coastal towns"),
    LebanonRegion("South Lebanon", "south-lebanon", 33.5608, 35.3821, "Sidon, Jezzine, and scenic coast"),
    LebanonRegion("Nabatieh", "nabatieh", 33.1735, 35.4674, "Southern Bekaa gateway and agricultural heartland"),
    LebanonRegion("Bekaa Valley", "bekaa-valley", 33.7994, 35.9906, "Wine country and ancient ruins"),
    LebanonRegion("Baalbek", "baalbek", 34.0118, 36.2014, "World Heritage Roman ruins"),
    LebanonRegion("Jezzine", "jezzine", 33.6228, 35.5844, "Mountain resort town with waterfalls"),
]

CATEGORIES: list[str] = [
    "hiking",
    "cultural",
    "dining",
    "adventure",
    "wellness",
    "historical",
    "outdoor",
    "nightlife",
    "beach",
    "family",
]

CATEGORY_LABELS: dict[str, str] = {
    "hiking": "Hiking & Trekking",
    "cultural": "Cultural & Arts",
    "dining": "Dining & Culinary",
    "adventure": "Adventure & Sports",
    "wellness": "Wellness & Spa",
    "historical": "Historical & Heritage",
    "outdoor": "Outdoor & Nature",
    "nightlife": "Nightlife & Entertainment",
    "beach": "Beach & Waterfront",
    "family": "Family & Kids",
}

CURRENCIES: dict[str, str] = {
    "USD": "US Dollar",
    "LBP": "Lebanese Pound",
    "EUR": "Euro",
}


def validate_coordinate(lat: float, lng: float) -> bool:
    """Verify coordinates fall inside Lebanon's borders."""
    return (
        LEBANON_BOUNDS["min_lat"] <= lat <= LEBANON_BOUNDS["max_lat"]
        and LEBANON_BOUNDS["min_lng"] <= lng <= LEBANON_BOUNDS["max_lng"]
    )


def validate_opening_hours(opens: str, closes: str) -> bool:
    """Verify opening hours are valid: closes > opens, both are valid time strings."""
    if not opens or not closes:
        return False
    try:
        h1, m1 = map(int, opens.split(":"))
        h2, m2 = map(int, closes.split(":"))
        opens_min = h1 * 60 + m1
        closes_min = h2 * 60 + m2
        if closes_min <= opens_min:
            return False
        return 0 <= opens_min < 1440 and 0 <= closes_min < 1440
    except (ValueError, IndexError):
        return False


def validate_region(region: LebanonRegion) -> bool:
    """Validate a Lebanon region has valid coordinates."""
    return validate_coordinate(region.lat, region.lng)


def validate_all_regions() -> list[str]:
    """Check all regions and return list of validation errors."""
    errors: list[str] = []
    for region in REGIONS:
        if not validate_region(region):
            errors.append(f"Invalid coordinates for {region.name}: ({region.lat}, {region.lng})")
    return errors


def validate_all_categories() -> list[str]:
    """Validate categories are non-empty and have labels."""
    errors: list[str] = []
    for cat in CATEGORIES:
        if cat not in CATEGORY_LABELS:
            errors.append(f"Missing label for category: {cat}")
    return errors


def all_validations_pass() -> bool:
    """Run all validation checks."""
    return len(validate_all_regions()) == 0 and len(validate_all_categories()) == 0


def get_region_by_slug(slug: str) -> LebanonRegion | None:
    for r in REGIONS:
        if r.slug == slug:
            return r
    return None


def get_random_region() -> LebanonRegion:
    import random

    return random.choice(REGIONS)


def get_random_region_excluding(exclude_slugs: set[str]) -> LebanonRegion:
    available = [r for r in REGIONS if r.slug not in exclude_slugs]
    import random

    return random.choice(available) if available else REGIONS[0]
