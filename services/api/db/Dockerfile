# PostgreSQL 17 with the extensions the SQL migrations create
# (postgis, vector, btree_gist, pg_trgm). btree_gist and pg_trgm ship with contrib.
FROM postgres:17
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-17-postgis-3 postgresql-17-pgvector \
    && rm -rf /var/lib/apt/lists/*
