"""Planner services: routing, weather, optimisation, AI trip builder, and dialect intent."""

from __future__ import annotations

from app.planner.intent.extractor import ExtractedIntent, extract_intent
from app.planner.optimizer import OptimizeResult, OptimizeStop, optimize_route
from app.planner.places import PlaceHit, autocomplete, reverse_geocode
from app.planner.routing import RouteLeg, RoutingService, cache_key, time_bucket
from app.planner.warnings import WeatherWarning, evaluate_warnings
from app.planner.weather import Forecast, WeatherService

PROMPT_VERSION = "intent-v1"
RANKER_VERSION = "ranker-v1"
OPTIMIZER_VERSION = "greedy-v1"
VALIDATOR_VERSION = "planner-v1"
MODEL_VERSION = "stub-llm"
MAX_CLARIFICATION_ROUNDS = 2

__all__ = [
    "MAX_CLARIFICATION_ROUNDS",
    "MODEL_VERSION",
    "OPTIMIZER_VERSION",
    "PROMPT_VERSION",
    "RANKER_VERSION",
    "VALIDATOR_VERSION",
    "ExtractedIntent",
    "Forecast",
    "OptimizeResult",
    "OptimizeStop",
    "PlaceHit",
    "RouteLeg",
    "RoutingService",
    "WeatherService",
    "WeatherWarning",
    "autocomplete",
    "cache_key",
    "evaluate_warnings",
    "extract_intent",
    "optimize_route",
    "reverse_geocode",
    "time_bucket",
]
