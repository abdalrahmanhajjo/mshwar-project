from __future__ import annotations

import time
from dataclasses import dataclass

from app.core.config import settings
from app.planner.llm import ProviderError


@dataclass
class CircuitState:
    failures: int = 0
    opened_at: float = 0.0


_STATE = CircuitState()


def reset_circuit() -> None:
    _STATE.failures = 0
    _STATE.opened_at = 0.0


def circuit_open() -> bool:
    if _STATE.opened_at <= 0:
        return False
    if time.monotonic() - _STATE.opened_at >= settings.planner_circuit_reset_seconds:
        reset_circuit()
        return False
    return True


def record_success() -> None:
    reset_circuit()


def record_failure() -> None:
    _STATE.failures += 1
    if _STATE.failures >= settings.planner_circuit_threshold:
        _STATE.opened_at = time.monotonic()


def guard_provider() -> None:
    if circuit_open():
        raise ProviderError("circuit open")
