"""Argon2id password hashing. Never log plaintext passwords.

Hashing is deliberately slow CPU work, so the async helpers run it in a worker
thread instead of blocking the event loop.
"""

from __future__ import annotations

from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError, VerifyMismatchError
from starlette.concurrency import run_in_threadpool

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHash):
        return False


@lru_cache(maxsize=1)
def _dummy_hash() -> str:
    return _hasher.hash("mshwar-timing-equaliser")


async def hash_password_async(password: str) -> str:
    return await run_in_threadpool(hash_password, password)


async def verify_password_async(password_hash: str | None, password: str) -> bool:
    """Verify a password. With no stored hash, still spend the same time (no account enumeration)."""
    if password_hash is None:
        await run_in_threadpool(verify_password, _dummy_hash(), password)
        return False
    return await run_in_threadpool(verify_password, password_hash, password)
