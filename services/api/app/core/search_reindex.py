"""Search reindex hook for taxonomy changes.

Production would enqueue an OpenSearch/pgvector rebuild. CI and local
default to the stub provider so tests never invent listings or call a
networked search cluster.
"""

from __future__ import annotations

from app.core.config import settings


def reindex_provider() -> str:
    return settings.search_reindex_provider or "stub"


def taxonomy_reindex_payload(term_id: str, action: str) -> dict[str, str]:
    return {
        "provider": reindex_provider(),
        "term_id": term_id,
        "action": action,
        "status": "queued",
    }
