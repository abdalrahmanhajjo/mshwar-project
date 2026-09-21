from __future__ import annotations

import uuid
from datetime import UTC, datetime, time, timedelta
from typing import Any

import psycopg  # type: ignore

from app.seed.lebanese_data import (
    ALL_EXPERIENCES,
    ORGANIZATIONS_DATA,
    TAXONOMY_TERMS,
    VENUES_DATA,
    validate_experiences,
    validate_venue_coordinates,
)
from app.seed.validation import (
    REGIONS,
    get_region_by_slug,
    validate_all_categories,
    validate_all_regions,
)

DB_URL_ENV = "DATABASE_URL"


def get_connection(db_url: str | None = None) -> psycopg.Connection:
    """Get a psycopg connection to the database."""
    import os

    url = db_url or os.environ.get(DB_URL_ENV)
    if not url:
        raise ValueError("DATABASE_URL must be set or passed as argument")
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return psycopg.connect(url, autocommit=False)


def setup_session_context(conn: psycopg.Connection, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Set the RLS session context so seeder can bypass RLS."""
    # SET LOCAL cannot take parameters; set_config(..., true) is the bound equivalent.
    conn.execute("SELECT set_config('app.user_id', %s, true)", (str(user_id),))
    conn.execute("SELECT set_config('app.organization_id', %s, true)", (str(org_id),))


def reset_session_context(conn: psycopg.Connection) -> None:
    """Reset the RLS session context."""
    conn.execute("RESET app.user_id")
    conn.execute("RESET app.organization_id")
    conn.execute("RESET app.request_id")


def seed_taxonomy(conn: psycopg.Connection) -> dict[str, uuid.UUID]:
    term_ids: dict[str, uuid.UUID] = {}
    for term in TAXONOMY_TERMS:
        sql = (
            "INSERT INTO app.taxonomy (id, kind, slug, label, active) VALUES (%s, %s, %s, %s, %s) "
            "ON CONFLICT (kind, slug) DO UPDATE SET label = EXCLUDED.label RETURNING id"
        )
        row = conn.execute(sql, (uuid.uuid4(), term["kind"], term["slug"], term["label"], True)).fetchone()
        term_ids[term["slug"]] = row[0]
    return term_ids


def seed_destinations(conn: psycopg.Connection) -> dict[str, uuid.UUID]:
    dest_ids: dict[str, uuid.UUID] = {}
    for region in REGIONS:
        # Migration 013 already creates some destinations; reuse them instead of failing.
        sql = (
            "INSERT INTO app.destinations (id, slug, country_code, name) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id"
        )
        row = conn.execute(sql, (uuid.uuid4(), region.slug, "LB", region.name)).fetchone()
        dest_ids[region.slug] = row[0]
    return dest_ids


def seed_organizations(conn: psycopg.Connection) -> dict[str, uuid.UUID]:
    org_ids: dict[str, uuid.UUID] = {}
    for org in ORGANIZATIONS_DATA:
        sql = "INSERT INTO app.organizations (id, name, slug, status, verification) VALUES (%s, %s, %s, %s, %s) RETURNING id"
        row = conn.execute(sql, (org["id"], org["name"], org["slug"], "active", org["verification"])).fetchone()
        org_ids[org["id"]] = row[0]
    return org_ids


def seed_venues(
    conn: psycopg.Connection, org_ids: dict[str, uuid.UUID], dest_ids: dict[str, uuid.UUID]
) -> dict[str, uuid.UUID]:
    venue_ids: dict[str, uuid.UUID] = {}
    for venue in VENUES_DATA:
        dest = get_region_by_slug(venue["destination_slug"])
        org_id = org_ids.get(venue["org_id"])
        if not org_id or not dest:
            continue
        sql = (
            "INSERT INTO app.venues (id, organization_id, destination_id, name, address, timezone, location, "
            "location_source) VALUES (%s, %s, %s, %s, %s, %s, "
            "ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s) RETURNING id"
        )
        row = conn.execute(
            sql,
            (
                venue["id"],
                org_id,
                dest_ids[venue["destination_slug"]],
                venue["name"],
                venue["address"],
                "Asia/Beirut",
                venue["lng"],
                venue["lat"],
                "seeder",
            ),
        ).fetchone()
        venue_ids[str(venue["id"])] = row[0]
    return venue_ids


def seed_opening_hours(conn: psycopg.Connection, venue_ids: dict[str, uuid.UUID]) -> None:
    for venue_id in venue_ids:
        for wd in [1, 2, 3, 4, 5, 6]:
            sql = "INSERT INTO app.opening_hours (id, venue_id, weekday, opens, closes) VALUES (%s, %s, %s, %s, %s)"
            conn.execute(sql, (uuid.uuid4(), uuid.UUID(venue_id), wd, time(10, 0), time(22, 0)))


def seed_experiences(
    conn: psycopg.Connection,
    org_ids: dict[str, uuid.UUID],
    venue_ids: dict[str, uuid.UUID],
    term_ids: dict[str, uuid.UUID],
    dest_ids: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    exp_ids: dict[str, uuid.UUID] = {}
    for exp_data in ALL_EXPERIENCES:
        venue_id_str = str(exp_data["venue_id"])
        venue_id = venue_ids.get(venue_id_str)
        venue = next((v for v in VENUES_DATA if str(v["id"]) == venue_id_str), None)
        if not venue_id or not venue:
            continue
        org_id = venue["org_id"]
        sql = "INSERT INTO app.experiences (id, organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes, min_party, max_party, min_age, setting, intensity, freshness_seconds) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id"
        row = conn.execute(
            sql,
            (
                exp_data["id"],
                org_id,
                venue_id,
                exp_data["slug"],
                exp_data["title"],
                exp_data["description"],
                "draft",
                exp_data["booking_mode"],
                exp_data["duration_minutes"],
                exp_data["min_party"],
                exp_data["max_party"],
                exp_data["min_age"],
                exp_data["setting"],
                exp_data["intensity"],
                86400,
            ),
        ).fetchone()
        exp_id = row[0]
        exp_ids[exp_data["slug"]] = exp_id
        term_sql = "INSERT INTO app.experience_taxonomy (experience_id, term_id) VALUES (%s, %s)"
        category = exp_data["category"]
        if category in term_ids:
            conn.execute(term_sql, (exp_id, term_ids[category]))
        for locale in ["en", "ar"]:
            trans_sql = "INSERT INTO app.experience_translations (experience_id, locale, title, description) VALUES (%s, %s, %s, %s)"
            conn.execute(trans_sql, (exp_id, locale, exp_data["title"], exp_data["description"]))
    return exp_ids


def seed_currencies(conn: psycopg.Connection) -> None:
    for code, minor_digits in [("USD", 2), ("LBP", 0), ("EUR", 2)]:
        sql = "INSERT INTO app.currencies (code, minor_digits) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING"
        conn.execute(sql, (code, minor_digits))


def seed_price_rules(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    now = datetime.now(UTC)
    for exp_id in exp_ids.values():
        sql = "INSERT INTO app.price_rules (id, experience_id, currency, price_type, unit, amount_minor, max_amount_minor, valid_during, source) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
        conn.execute(
            sql, (uuid.uuid4(), exp_id, "USD", "fixed", "person", 2500, None, f"({now.isoformat()},)", "seeder")
        )


def seed_policies(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    for exp_id in exp_ids.values():
        sql = "INSERT INTO app.policies (id, experience_id, version, cancellation_rules, terms_text) VALUES (%s, %s, %s, %s, %s)"
        conn.execute(
            sql,
            (
                uuid.uuid4(),
                exp_id,
                1,
                '{"free_before_hours": 24, "cancellation_fee_percent": 10}',
                "Standard booking terms and conditions apply.",
            ),
        )


def seed_slots(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    now = datetime.now(UTC)
    for exp_id in exp_ids.values():
        for day_offset in range(7):
            slot_date = now + timedelta(days=day_offset)
            for hour in [10, 14, 18]:
                starts = datetime(slot_date.year, slot_date.month, slot_date.day, hour, 0, tzinfo=UTC)
                ends = starts + timedelta(minutes=120)
                sql = "INSERT INTO app.slots (id, experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                conn.execute(sql, (uuid.uuid4(), exp_id, starts, ends, 8, 0, True, "seeder", now, "open"))


def seed_media(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    for exp_id in exp_ids.values():
        for i in range(1, 3):
            sql = "INSERT INTO app.media (id, experience_id, provider, object_key, alt_text, sort_order, moderation) VALUES (%s, %s, %s, %s, %s, %s, %s)"
            conn.execute(
                sql,
                (uuid.uuid4(), exp_id, "imagekit", f"experiences/{exp_id}/image-{i}.jpg", f"image {i}", i, "approved"),
            )


def run_seeder(db_url: str | None = None, validate: bool = True) -> dict[str, Any]:
    conn = get_connection(db_url)
    try:
        admin_user = uuid.UUID("00000000-0000-0000-0000-000000000001")
        admin_org = uuid.UUID("00000000-0000-0000-0000-000000000001")
        setup_session_context(conn, admin_org, admin_user)

        result: dict[str, Any] = {}

        if validate:
            region_errors = validate_all_regions()
            if region_errors:
                raise ValueError(f"Region validation failed: {region_errors}")
            cat_errors = validate_all_categories()
            if cat_errors:
                raise ValueError(f"Category validation failed: {cat_errors}")
            venue_errors = validate_venue_coordinates()
            if venue_errors:
                raise ValueError(f"Venue coordinate validation failed: {venue_errors}")
            exp_errors = validate_experiences()
            if exp_errors:
                raise ValueError(f"Experience validation failed: {exp_errors}")

        term_ids = seed_taxonomy(conn)
        result["taxonomy_terms"] = len(term_ids)

        dest_ids = seed_destinations(conn)
        result["destinations"] = len(dest_ids)

        seed_currencies(conn)

        org_ids = seed_organizations(conn)
        result["organizations"] = len(org_ids)

        venue_ids = seed_venues(conn, org_ids, dest_ids)
        result["venues"] = len(venue_ids)

        seed_opening_hours(conn, venue_ids)
        result["opening_hours"] = len(venue_ids) * 6

        exp_ids = seed_experiences(conn, org_ids, venue_ids, term_ids, dest_ids)
        result["experiences"] = len(exp_ids)

        seed_price_rules(conn, exp_ids)
        result["price_rules"] = len(exp_ids) * 3

        seed_policies(conn, exp_ids)
        result["policies"] = len(exp_ids)

        seed_slots(conn, exp_ids)
        result["slots"] = len(exp_ids) * 5 * 3

        conn.execute("UPDATE app.experiences SET status = 'published' WHERE status = 'draft'")

        seed_media(conn, exp_ids)
        result["media"] = len(exp_ids) * 2

        conn.commit()
        result["status"] = "success"
        result["total_rows"] = (
            result["destinations"]
            + result["organizations"]
            + result["venues"]
            + result["experiences"]
            + result["price_rules"]
            + result["policies"]
            + result["slots"]
            + result["media"]
        )
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        reset_session_context(conn)
        conn.close()


if __name__ == "__main__":
    import sys

    db_url = sys.argv[1] if len(sys.argv) > 1 else None
    validate = "--no-validate" not in sys.argv
    result = run_seeder(db_url=db_url, validate=validate)
    print(f"Seeder complete: {result}")
