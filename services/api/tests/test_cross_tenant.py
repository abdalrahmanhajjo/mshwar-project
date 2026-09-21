"""Row-level security isolates organisations and travellers (MSHWAR-108).

Each test seeds real rows for tenant B as the migration owner, then reads as
``mshwar_backend`` - the role the API uses - bound to tenant A and to tenant B.
Tenant A must see nothing; tenant B must see its own rows, which proves the
query would have found them (the old version of these tests ran as a
superuser against ids that did not exist, so "no rows" proved nothing).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import TestingSessionLocal
from tests.rls import set_local_gucs


@dataclass
class Tenant:
    user_id: str
    org_id: str
    venue_id: str
    experience_id: str
    trip_id: str
    favorite_id: str


async def _seed(session: AsyncSession, label: str) -> Tenant:
    tenant = Tenant(*(str(uuid4()) for _ in range(6)))
    await session.execute(
        text("INSERT INTO app.users (id, auth_issuer, auth_subject, display_name) VALUES (:id, 'test', :sub, :name)"),
        {"id": tenant.user_id, "sub": tenant.user_id, "name": label},
    )
    await session.execute(
        text("INSERT INTO app.user_private (user_id, email) VALUES (:id, :email)"),
        {"id": tenant.user_id, "email": f"{label}-{tenant.user_id[:8]}@example.com"},
    )
    await session.execute(
        text("INSERT INTO app.organizations (id, name, slug, verification) VALUES (:id, :name, :slug, 'pending')"),
        {"id": tenant.org_id, "name": label, "slug": f"{label}-{tenant.org_id[:8]}"},
    )
    await session.execute(
        text("INSERT INTO app.organization_members (organization_id, user_id, role) VALUES (:org, :user, 'owner')"),
        {"org": tenant.org_id, "user": tenant.user_id},
    )
    await session.execute(
        text(
            "INSERT INTO app.venues (id, organization_id, name, address, location, location_source) "
            "VALUES (:id, :org, 'Venue', 'Hamra', "
            "ST_SetSRID(ST_MakePoint(35.5, 33.89), 4326)::geography, 'test')"
        ),
        {"id": tenant.venue_id, "org": tenant.org_id},
    )
    await session.execute(
        text(
            "INSERT INTO app.experiences (id, organization_id, venue_id, slug, title, booking_mode, "
            "duration_minutes, max_party, setting) "
            "VALUES (:id, :org, :venue, :slug, 'Tasting', 'request', 60, 4, 'indoor')"
        ),
        {
            "id": tenant.experience_id,
            "org": tenant.org_id,
            "venue": tenant.venue_id,
            "slug": f"x-{tenant.experience_id}",
        },
    )
    await session.execute(
        text("INSERT INTO app.trips (id, owner_id, title) VALUES (:id, :owner, 'Private')"),
        {"id": tenant.trip_id, "owner": tenant.user_id},
    )
    await session.execute(
        text("INSERT INTO app.favorites (id, user_id, experience_id) VALUES (:id, :user, :exp)"),
        {"id": tenant.favorite_id, "user": tenant.user_id, "exp": tenant.experience_id},
    )
    await session.execute(
        text(
            "INSERT INTO app.verification_documents "
            "(organization_id, object_key, filename, content_type, byte_size, created_by) "
            "VALUES (:org, :key, 'licence.pdf', 'application/pdf', 12, :user)"
        ),
        {"org": tenant.org_id, "key": f"private/{tenant.org_id}.pdf", "user": tenant.user_id},
    )
    return tenant


@pytest.fixture
async def tenants() -> AsyncIterator[tuple[Tenant, Tenant]]:
    async with TestingSessionLocal() as session:
        pair = (await _seed(session, "tenant-a"), await _seed(session, "tenant-b"))
        await session.commit()
    yield pair


@asynccontextmanager
async def _as_backend(tenant: Tenant) -> AsyncIterator[AsyncSession]:
    async with TestingSessionLocal() as session:
        await session.execute(text("SET LOCAL ROLE mshwar_backend"))
        await set_local_gucs(session, user_id=tenant.user_id, organization_id=tenant.org_id)
        try:
            yield session
        finally:
            await session.rollback()


QUERIES = {
    "organization": ("SELECT count(*) FROM app.organizations WHERE id = :org", "org"),
    "venue": ("SELECT count(*) FROM app.venues WHERE organization_id = :org", "org"),
    "experience": ("SELECT count(*) FROM app.experiences WHERE organization_id = :org", "org"),
    "verification document": ("SELECT count(*) FROM app.verification_documents WHERE organization_id = :org", "org"),
    "trip": ("SELECT count(*) FROM app.trips WHERE owner_id = :user", "user"),
    "favorite": ("SELECT count(*) FROM app.favorites WHERE user_id = :user", "user"),
    "private profile": ("SELECT count(*) FROM app.user_private WHERE user_id = :user", "user"),
}


@pytest.mark.asyncio
@pytest.mark.parametrize("resource", sorted(QUERIES))
async def test_tenant_rows_are_invisible_to_other_tenants(tenants: tuple[Tenant, Tenant], resource: str) -> None:
    tenant_a, tenant_b = tenants
    sql, key = QUERIES[resource]
    params = {"org": tenant_b.org_id} if key == "org" else {"user": tenant_b.user_id}
    async with _as_backend(tenant_b) as own:
        assert (await own.execute(text(sql), params)).scalar_one() == 1, (
            f"control: {resource} must be visible to its owner"
        )
    async with _as_backend(tenant_a) as other:
        assert (await other.execute(text(sql), params)).scalar_one() == 0, f"{resource} leaked across tenants"


@pytest.mark.asyncio
async def test_writes_into_another_tenant_are_rejected(tenants: tuple[Tenant, Tenant]) -> None:
    tenant_a, tenant_b = tenants
    async with _as_backend(tenant_a) as other:
        updated = await other.execute(
            text("UPDATE app.experiences SET title = 'hijacked' WHERE id = :id"), {"id": tenant_b.experience_id}
        )
        assert updated.rowcount == 0
    async with _as_backend(tenant_a) as other:
        with pytest.raises(Exception, match="row-level security"):
            await other.execute(
                text(
                    "INSERT INTO app.venues (organization_id, name, address, location, location_source) "
                    "VALUES (:org, 'Planted', 'x', ST_SetSRID(ST_MakePoint(35.5, 33.89), 4326)::geography, 'test')"
                ),
                {"org": tenant_b.org_id},
            )


@pytest.mark.asyncio
async def test_unbound_backend_session_sees_no_tenant_data(tenants: tuple[Tenant, Tenant]) -> None:
    _, tenant_b = tenants
    async with TestingSessionLocal() as session:
        await session.execute(text("SET LOCAL ROLE mshwar_backend"))
        for resource, (sql, key) in QUERIES.items():
            params = {"org": tenant_b.org_id} if key == "org" else {"user": tenant_b.user_id}
            assert (await session.execute(text(sql), params)).scalar_one() == 0, resource
        await session.rollback()


@pytest.mark.asyncio
async def test_backend_role_has_no_access_to_the_audit_log_or_token_tables() -> None:
    async with TestingSessionLocal() as session:
        await session.execute(text("SET LOCAL ROLE mshwar_backend"))
        for table in ("audit_log", "unsubscribe_tokens"):
            with pytest.raises(Exception, match="permission denied"):
                async with session.begin_nested():
                    await session.execute(text(f"SELECT 1 FROM app.{table} LIMIT 1"))  # noqa: S608 - fixed names
        await session.rollback()


@pytest.mark.asyncio
async def test_rls_enabled_on_all_app_tables() -> None:
    async with TestingSessionLocal() as session:
        missing = (
            (
                await session.execute(
                    text(
                        """
                    SELECT t.tablename FROM pg_tables t
                    JOIN pg_class c ON c.relname = t.tablename
                    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
                    WHERE t.schemaname = 'app' AND NOT c.relrowsecurity
                    """
                    )
                )
            )
            .scalars()
            .all()
        )
    assert missing == []


@pytest.mark.asyncio
async def test_backend_and_reader_roles_cannot_bypass_rls() -> None:
    async with TestingSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles "
                    "WHERE rolname IN ('mshwar_backend', 'mshwar_reader')"
                )
            )
        ).all()
    assert len(rows) == 2
    assert all(not superuser and not bypass for _, superuser, bypass in rows)
