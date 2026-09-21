from __future__ import annotations

from app.core.geo import BEIRUT_LAT, BEIRUT_LNG, lebanon_bounds, point_in_lebanon


def test_beirut_is_inside_lebanon() -> None:
    assert point_in_lebanon(BEIRUT_LNG, BEIRUT_LAT) is True


def test_paris_is_outside_lebanon() -> None:
    assert point_in_lebanon(2.3522, 48.8566) is False


def test_bounds_match_envelope() -> None:
    bounds = lebanon_bounds()
    assert bounds["lng_min"] < bounds["lng_max"]
    assert bounds["lat_min"] < bounds["lat_max"]
    assert point_in_lebanon(bounds["lng_min"], bounds["lat_min"]) is True
    assert point_in_lebanon(bounds["lng_max"] + 0.2, bounds["lat_max"]) is False
