from __future__ import annotations

import hashlib
import os

# Real embeddings: set CATALOGUE_EMBEDDING_PROVIDER=openai (or similar) and
# CATALOGUE_EMBEDDING_MODEL. CI uses the deterministic stub so search tests
# stay offline. The SQL function app.stub_embedding(text) matches this hash.


def stub_embedding(text: str, dims: int = 8) -> list[float]:
    values: list[float] = []
    for index in range(dims):
        digest = hashlib.sha256(f"{text}:{index}".encode()).digest()
        raw = int.from_bytes(digest[:4], "big", signed=False)
        values.append(((raw % 2000) - 1000) / 1000.0)
    return values


def embedding_provider() -> str:
    return os.environ.get("CATALOGUE_EMBEDDING_PROVIDER", "stub")
