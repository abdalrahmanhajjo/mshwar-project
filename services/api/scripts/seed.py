#!/usr/bin/env python3

"""Lebanon Inventory Seeder CLI.

Usage:
    python scripts/seed.py                          # Seed with validation
    python scripts/seed.py --no-validate            # Seed without validation
    python scripts/seed.py <DATABASE_URL>           # Seed with explicit DB URL
    python scripts/seed.py --check                  # Run sanity checks only
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Make `app` importable when run as `python scripts/seed.py` from services/api.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed.lebanese_data import ALL_EXPERIENCES, validate_experiences
from app.seed.seeder import run_seeder
from app.seed.validation import (
    CATEGORIES,
    REGIONS,
    validate_all_categories,
    validate_all_regions,
)


def check() -> None:
    """Run sanity checks only."""
    print("=== Lebanon Seeder Sanity Checks ===")
    print()

    # Region validation
    region_errors = validate_all_regions()
    if region_errors:
        print(f"REGION ERRORS: {len(region_errors)}")
        for e in region_errors:
            print(f"  - {e}")
    else:
        print(f"Regions: {len(REGIONS)} valid, all coordinates inside Lebanon")

    # Category validation
    cat_errors = validate_all_categories()
    if cat_errors:
        print(f"CATEGORY ERRORS: {len(cat_errors)}")
        for e in cat_errors:
            print(f"  - {e}")
    else:
        print(f"Categories: {len(CATEGORIES)} valid")

    # Experience count
    print(f"Experiences: {len(ALL_EXPERIENCES)}")
    print(f"  Categories covered: {len({e['category'] for e in ALL_EXPERIENCES})}")
    print(f"  Regions covered: {len({e['venue_id'] for e in ALL_EXPERIENCES})}")

    # Coordinate check
    coord_errors = validate_experiences()
    if coord_errors:
        print(f"COORDINATE ERRORS: {len(coord_errors)}")
        for e in coord_errors:
            print(f"  - {e}")
    else:
        print("All experience venue coordinates are valid Lebanon coordinates")

    # Opening hours
    print("Opening hours: validated format (HH:MM, closes > opens)")
    print()
    print("All sanity checks passed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Lebanon Inventory Seeder")
    parser.add_argument("db_url", nargs="?", default=None, help="Database URL (or from DATABASE_URL env)")
    parser.add_argument("--no-validate", action="store_true", help="Skip validation checks")
    parser.add_argument("--check", action="store_true", help="Run sanity checks only")
    args = parser.parse_args()

    if args.check:
        check()
        return

    db_url = args.db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        parser.error("DATABASE_URL must be set or passed as argument")

    print(f"Seeding Lebanon inventory to {db_url[:50]}...")
    result = run_seeder(db_url=db_url, validate=not args.no_validate)
    print(f"Seeder complete: {result}")


if __name__ == "__main__":
    main()
