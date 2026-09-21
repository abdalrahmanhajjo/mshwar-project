from __future__ import annotations

import os


def routing_provider() -> str:
    return os.environ.get("CATALOGUE_ROUTING_PROVIDER", "stub")


def estimate_travel(distance_m: float) -> dict[str, int | str]:
    """Approximate travel time. Real routing uses CATALOGUE_ROUTING_PROVIDER."""
    metres = max(float(distance_m or 0), 0.0)
    walking = max(int(metres / 1.25), 60)
    driving = max(int(metres / 8.5), 60)
    return {
        "distance_m": int(metres),
        "duration_seconds": driving if metres > 2500 else walking,
        "mode": "drive" if metres > 2500 else "walk",
        "provider": routing_provider(),
    }
