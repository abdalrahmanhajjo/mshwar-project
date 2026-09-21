"""Extension smoke tests for PostgreSQL extensions: PostGIS, pgvector, btree_gist.

Each test proves the corresponding extension is available by executing a
representative SQL statement. These are run against a real PostgreSQL
database during CI and local development.
"""

import pytest
from sqlalchemy import text


class TestPostGISExtension:
    """Verify PostGIS is enabled and ST_DWithin works for geospatial queries."""

    @pytest.mark.asyncio
    async def test_st_within(self, db_session):
        """ST_DWithin returns true for points within 1 degree of each other."""
        result = await db_session.execute(
            text("SELECT ST_DWithin(ST_MakePoint(0, 0)::geography, ST_MakePoint(0.01, 0.01)::geography, 2000)")
        )
        value = result.scalar()
        assert value is True, "ST_DWithin should return true for nearby points"

    @pytest.mark.asyncio
    async def test_postgis_extension_exists(self, db_session):
        """Confirm postgis is listed in pg_extension."""
        result = await db_session.execute(text("SELECT extname FROM pg_extension WHERE extname = 'postgis'"))
        assert result.scalar() == "postgis", "postgis extension must exist"


class TestPgVectorExtension:
    """Verify pgvector is enabled and the vector similarity operator works."""

    @pytest.mark.asyncio
    async def test_vector_inner_product_operator(self, db_session):
        """pgvector <-> operator computes Euclidean distance between vectors."""
        result = await db_session.execute(text("SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector"))
        value = result.scalar()
        assert value is not None, "<-> operator must return a distance"
        assert isinstance(value, float), "Distance must be a float"
        assert value > 0, "Distance between different vectors must be positive"

    @pytest.mark.asyncio
    async def test_pgvector_extension_exists(self, db_session):
        """Confirm pgvector is listed in pg_extension."""
        result = await db_session.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector'"))
        assert result.scalar() == "vector", "pgvector extension must exist as 'vector'"


class TestBtreeGiSTExtension:
    """Verify btree_gist is enabled and EXCLUDE constraints work for slot booking."""

    @pytest.mark.asyncio
    async def test_btree_gist_extension_exists(self, db_session):
        """Confirm btree_gist is listed in pg_extension."""
        result = await db_session.execute(text("SELECT extname FROM pg_extension WHERE extname = 'btree_gist'"))
        assert result.scalar() == "btree_gist", "btree_gist extension must exist"

    @pytest.mark.asyncio
    async def test_exclude_constraint_prevents_overlap(self, db_session):
        """
        EXCLUDE constraint with btree_gist prevents overlapping time ranges.
        Creates a temp table with an EXCLUDE constraint, inserts one row,
        then verifies that an overlapping insert is rejected.
        """
        await db_session.execute(
            text("""
            CREATE TEMP TABLE booking_slots (
                id SERIAL PRIMARY KEY,
                business_id INTEGER NOT NULL,
                slot_ts TSTZRANGE NOT NULL,
                EXCLUDE USING gist (business_id WITH =, slot_ts WITH &&)
            )
        """)
        )
        await db_session.commit()

        # Insert first booking slot
        await db_session.execute(
            text(
                "INSERT INTO booking_slots (business_id, slot_ts) "
                "VALUES (1, TSTZRANGE('2026-01-01 10:00', '2026-01-01 12:00', '[)'))"
            )
        )
        await db_session.commit()

        # Attempt overlapping insert — should fail
        with pytest.raises(Exception):  # noqa: B017
            await db_session.execute(
                text(
                    "INSERT INTO booking_slots (business_id, slot_ts) "
                    "VALUES (1, TSTZRANGE('2026-01-01 11:00', '2026-01-01 13:00', '[)'))"
                )
            )
            await db_session.commit()
        await db_session.rollback()

        await db_session.execute(text("DROP TABLE IF EXISTS booking_slots"))
        await db_session.commit()
