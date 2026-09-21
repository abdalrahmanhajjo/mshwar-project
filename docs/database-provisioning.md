# Database Provisioning Decision: Supabase vs Self-Hosted PostgreSQL

## Overview

Mshwar requires PostgreSQL 17 with three extensions enabled: **PostGIS** (geospatial queries for distance/routing), **pgvector** (vector similarity for RAG embeddings), and **btree_gist** (exclusion constraints for slot booking). This document evaluates the two viable hosting approaches.

---

## Supabase (Managed)

### Correction, 18 September 2026

An earlier version of this document said `btree_gist` is "not available on Supabase (not in their
extension allowlist)" and rejected Supabase on that basis. **That was wrong.** Supabase's
[extensions catalogue](https://supabase.com/docs/guides/database/extensions) lists all three
extensions Mshwar needs as pre-installed: `postgis`, `vector` (pgvector) and `btree_gist`.

Supabase is therefore a viable option. It is not the one chosen, but for different reasons, recorded
below so nobody re-litigates this from a false premise.

### The real constraints

| Constraint                     | Detail                                                                                                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection pooler vs `asyncpg` | `services/api/app/dependencies.py` uses `asyncpg`, which issues prepared statements. Supabase's transaction-mode pooler (Supavisor) does not support them; this needs `statement_cache_size=0`, or the direct connection, whose connection limit is well below the configured `pool_size: 20` |
| Custom role model              | The security model rests on `mshwar_backend`, `mshwar_reader` and a restricted `mshwar_api` login role with `NOSUPERUSER NOBYPASSRLS` (SR-02). Supabase permits custom roles, but this has not been verified against the 242 grant and policy references in the migrations                    |
| `SECURITY DEFINER` functions   | ~280 of them across the migrations, all depending on elevating above the restricted API role. Expected to work; not yet proven on Supabase                                                                                                                                                    |

### Why not now

Migrating before launch would mean changing the connection layer and re-validating the database
security model immediately before the penetration test (SR-20) that must certify it. The benefit —
less database operations work — is not urgent at zero users.

**Decision:** stay self-hosted through launch. Re-evaluate Supabase afterwards as a contained
migration project, starting with a spike: run the 21 migrations against a throwaway project and run
the backend suite connected as `mshwar_api`.

---

## Self-Hosted PostgreSQL 17

### What it provides

- Full control over PostgreSQL version and extensions
- All three extensions (`postgis`, `pgvector`, `btree_gist`) available via `CREATE EXTENSION`
- Granular configuration: `shared_preload_libraries`, `statement_timeout`, `idle_in_transaction_session_timeout`
- Custom connection pooling via SQLAlchemy engine settings
- Docker-based local development mirrors production
- Can be deployed on VPS, cloud VMs, or managed infra with full control

### Trade-offs

- **Operational overhead**: Requires DB administration (backups, monitoring, failover)
- **Scaling**: Manual scaling vs managed auto-scaling
- **Cost**: Fixed VPS cost vs variable managed pricing
- **Availability**: Must configure replication and failover for high availability

### Recommended Architecture

```
Local Dev:       docker compose up --build  (Postgres 17 + PostGIS + pgvector + btree_gist)
Staging:         Single VPS running the same compose stack (see docs/staging-runbook.md)
Production:      Self-hosted PostgreSQL 17 with all three extensions; revisit managed once launched
```

Staging deliberately mirrors local development so that nothing about the role model, the
`SECURITY DEFINER` functions or the connection layer differs between the two.

---

## Extension Details

| Extension    | Purpose                             | Usage in Mshwar                                                                        |
| ------------ | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `postgis`    | Geospatial data types and functions | `ST_DWithin`, `ST_MakePoint`, distance calculations between venues, map radius queries |
| `pgvector`   | Vector similarity search            | RAG embeddings for business descriptions, semantic search over experiences             |
| `btree_gist` | GiST indexes on btree types         | EXCLUDE constraints preventing overlapping booking slots for the same business         |

---

## Migration Strategy

Extensions are created by the SQL migrations in `mshwar-database/migrations` (`001_schema.sql`
creates `postgis`, `vector` and `btree_gist`; `022` adds `pg_trgm`) — never by hand. The runner is
checksum-verified, holds an advisory lock and applies each file in its own transaction.

```bash
# Apply all migrations including extensions
DATABASE_URL=postgresql+asyncpg://... pnpm --filter api migrate
```

The `db` image (`services/api/db/Dockerfile`) installs the PostGIS and pgvector packages; the `migrate`
service in `docker-compose.yml` applies the migrations before the API starts.

### Database roles

Migrations run as the database owner. The API must connect as a separate login role, `mshwar_api`, that only inherits
`mshwar_backend`; staging and production refuse to start otherwise. See
[security/database-roles.md](security/database-roles.md).

### Rollback

Migrations are forward-only. A bad change is fixed with a new migration; data problems are handled by
restoring a backup or point-in-time recovery. CI never rolls a database back automatically.

---

## Decision

**Self-hosted PostgreSQL 17 is the baseline.** Supabase is acceptable for development prototyping but cannot support the full feature set required by BRD Section 12 (Business Rules) — specifically the `btree_gist` EXCLUDE constraint for preventing double-booking of time slots.
