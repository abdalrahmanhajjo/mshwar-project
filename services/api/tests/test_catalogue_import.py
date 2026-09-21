"""Unit tests for the real-catalogue importer (pure — no database, no network).

These lock in the guarantees the importer promises: the dataset is clean and
covers all eight governorates, coordinates are real (inside Lebanon) and unique,
the taxonomy is normalised, no ratings/prices are invented, and the image licence
gate only accepts reusable licences.
"""

from __future__ import annotations

from app.seed.catalogue_import import (
    COLLECTIONS,
    DESTINATION_COVERS,
    VALID_CATEGORIES,
    VALID_LISTING_KINDS,
    _license_allowed,
    build_facts,
    build_report,
    coverage,
    derive_setting,
    derive_weather,
    suggested_minutes,
    validate_dataset,
)
from app.seed.lebanon_catalogue import GOVERNORATES, LEBANON_BBOX, PLACES, TAG_LABELS


def test_dataset_is_valid() -> None:
    errors = validate_dataset()
    assert errors == [], f"dataset validation problems: {errors}"


def test_all_eight_governorates_have_places() -> None:
    cov = coverage(PLACES)
    gov_slugs = {g["slug"] for g in GOVERNORATES}
    assert len(gov_slugs) == 8
    assert set(cov["by_governorate"]) == gov_slugs
    for slug in gov_slugs:
        assert cov["by_governorate"][slug] >= 1, f"{slug} has no listings"


def test_every_coordinate_is_inside_lebanon() -> None:
    for p in PLACES:
        lat, lng = float(p["lat"]), float(p["lng"])
        assert LEBANON_BBOX["lat_min"] <= lat <= LEBANON_BBOX["lat_max"], p["slug"]
        assert LEBANON_BBOX["lng_min"] <= lng <= LEBANON_BBOX["lng_max"], p["slug"]


def test_slugs_and_coordinates_are_unique() -> None:
    slugs = [p["slug"] for p in PLACES]
    assert len(slugs) == len(set(slugs)), "duplicate slug"
    coords = [(round(float(p["lat"]), 4), round(float(p["lng"]), 4)) for p in PLACES]
    assert len(coords) == len(set(coords)), "duplicate coordinate"


def test_taxonomy_is_normalised() -> None:
    for p in PLACES:
        assert p["category"] in VALID_CATEGORIES, p["slug"]
        assert p["listing_kind"] in VALID_LISTING_KINDS, p["slug"]
        for tag in p.get("tags", []):
            assert tag in TAG_LABELS, f"{p['slug']}: unknown tag {tag}"


def test_every_place_has_provenance_and_english_text() -> None:
    for p in PLACES:
        assert p.get("name_en"), p["slug"]
        assert p.get("summary_en"), p["slug"]
        assert p.get("source_url", "").startswith("http"), p["slug"]


def test_facts_never_invent_ratings_or_prices() -> None:
    # build_facts must only ever emit verifiable, non-business facts.
    for p in PLACES:
        for fact in build_facts(p):
            assert fact["title"] in {"UNESCO World Heritage"}
            blob = (fact["title"] + fact["body"]).lower()
            for banned in ("rating", "stars", "$", "usd", "price", "phone", "open ", "hours:"):
                assert banned not in blob, f"{p['slug']} fact leaks '{banned}'"


def test_suggested_visit_time_is_positive() -> None:
    # duration_minutes has a >0 CHECK; every place must yield a valid value.
    for p in PLACES:
        assert suggested_minutes(p) > 0, p["slug"]


def test_setting_and_weather_are_schema_valid() -> None:
    for p in PLACES:
        setting = derive_setting(p)
        assert setting in {"indoor", "outdoor", "mixed"}, p["slug"]
        assert derive_weather(setting) in {"indoor", "outdoor", "weather-sensitive"}, p["slug"]


def test_license_gate_accepts_only_reusable_licences() -> None:
    for ok in ("CC BY-SA 4.0", "CC-BY-4.0", "CC0 1.0", "Public domain", "cc by 2.0"):
        assert _license_allowed(ok, ok), ok
    for bad in ("CC BY-NC 2.0", "CC BY-ND 4.0", "All rights reserved", "Fair use", "GFDL"):
        assert not _license_allowed(bad, bad), bad


def test_report_mentions_each_governorate() -> None:
    report = build_report(coverage(PLACES), [], None)
    for g in GOVERNORATES:
        assert g["name_en"] in report, g["name_en"]


def test_destination_covers_reference_real_places() -> None:
    place_slugs = {p["slug"] for p in PLACES}
    for dest_slug, exp_slug in DESTINATION_COVERS.items():
        assert exp_slug in place_slugs, f"cover for {dest_slug} -> unknown place {exp_slug}"


def test_collections_reference_real_places() -> None:
    place_slugs = {p["slug"] for p in PLACES}
    seen: set[str] = set()
    for c in COLLECTIONS:
        assert c["slug"] not in seen, f"duplicate collection slug {c['slug']}"
        seen.add(c["slug"])
        assert c["cover"] in place_slugs, f"{c['slug']} cover -> unknown place {c['cover']}"
        assert c["slugs"], f"{c['slug']} has no experiences"
        for s in c["slugs"]:
            assert s in place_slugs, f"{c['slug']} -> unknown place {s}"
