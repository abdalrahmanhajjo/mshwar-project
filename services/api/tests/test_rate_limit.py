from __future__ import annotations

from app.core.rate_limit import MemoryRateLimiter


def test_memory_limiter_allows_then_blocks_within_window() -> None:
    limiter = MemoryRateLimiter()
    assert limiter.allow("forgot:email:a@example.com", limit=2, window_seconds=60, now=100.0) is True
    assert limiter.allow("forgot:email:a@example.com", limit=2, window_seconds=60, now=100.5) is True
    assert limiter.allow("forgot:email:a@example.com", limit=2, window_seconds=60, now=101.0) is False


def test_memory_limiter_resets_after_window_and_clear() -> None:
    limiter = MemoryRateLimiter()
    assert limiter.allow("ip:1", limit=1, window_seconds=10, now=0.0) is True
    assert limiter.allow("ip:1", limit=1, window_seconds=10, now=9.0) is False
    assert limiter.allow("ip:1", limit=1, window_seconds=10, now=10.1) is True
    limiter.reset()
    assert limiter.allow("ip:1", limit=1, window_seconds=10, now=10.2) is True


def test_memory_limiter_forgets_idle_keys() -> None:
    limiter = MemoryRateLimiter()
    for index in range(2000):
        limiter.allow(f"signin:email:{index}@example.com", limit=5, window_seconds=60, now=float(index) / 100)
    # Later traffic triggers a sweep; every key above is outside its window by now.
    for index in range(1024):
        limiter.allow("signin:ip:1.2.3.4", limit=10_000, window_seconds=60, now=1000.0 + index / 1000)
    assert len(limiter) < 50
