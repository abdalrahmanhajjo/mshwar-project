from __future__ import annotations

from app.catalogue.embeddings import embedding_provider, stub_embedding
from app.catalogue.price import PriceModel
from app.catalogue.query_parser import parse_search_query, relaxation_steps
from app.catalogue.routing import estimate_travel, routing_provider


def test_stub_embedding_is_deterministic() -> None:
    assert stub_embedding("byblos") == stub_embedding("byblos")
    assert stub_embedding("byblos") != stub_embedding("beirut")
    assert embedding_provider() == "stub"


def test_nl_parser_extracts_filters() -> None:
    parsed = parse_search_query("cheap lunch in Byblos")
    assert parsed.destination == "byblos"
    assert parsed.kind == "restaurant"
    assert parsed.price_max == 30
    assert parsed.q == ""
    assert relaxation_steps(parsed)

    cedars = parse_search_query("cedars in Bsharri")
    assert cedars.destination == "bsharri"
    assert cedars.category == "nature"
    assert cedars.q == "cedars"

    unknown = parse_search_query("zzzz-not-a-real-listing-999")
    assert unknown.destination is None
    assert "zzzz-not-a-real-listing-999" in unknown.q


def test_travel_stub_scales_with_distance() -> None:
    short = estimate_travel(800)
    long = estimate_travel(20000)
    assert short["mode"] == "walk"
    assert long["mode"] == "drive"
    assert int(long["duration_seconds"]) > int(short["duration_seconds"])
    assert routing_provider() == "stub"


def test_estimated_price_label() -> None:
    price = PriceModel(currency="USD", type="estimated", source="provider", amount_minor=2500, amount=25)
    assert price.as_label() == "estimated"
