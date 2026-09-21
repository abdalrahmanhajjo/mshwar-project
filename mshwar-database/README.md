# Mshwar database implementation

An executable database foundation derived from **Mshwar Business Requirements Document v1.0**, supplied in this conversation. It covers Lebanon-wide discovery, itinerary planning, business inventory, reservations, payments, group planning and AI traceability. It does not use the separate Tripoli project.

**Baseline:** PostgreSQL 17+, PostGIS, pgvector, btree_gist and pg_trgm. The package includes the full application schema as ordered, forward-only SQL migrations (`migrations/001`–`026`), transaction functions, integrity triggers, restricted read policies, query examples, regression tests and an operations guide. This is a database deliverable, not a deployed marketplace or a certification of production readiness.

## Start here

1. Read [Architecture and decisions](docs/ARCHITECTURE.md), especially the backend trust boundary and explicit product assumptions.
2. Provision an **empty development database** with PostGIS, pgvector, btree_gist and pg_trgm extension support. Use a migration login with schema, extension and role creation rights. Do not run against an unrelated existing application.
3. Install Python dependencies: `python -m pip install -r requirements.txt`.
4. Set `DATABASE_URL` through your shell or secret manager. `.env.example` is documentation; the runner does not auto-load it.
5. Run `python scripts/migrate.py`. Each migration is atomic. The runner locks migration execution, records checksums and refuses changed previously applied migrations.
6. Run `npm ci` and `npm test` for the self-contained embedded PostgreSQL integration suite. It creates an in-memory test database with synthetic records; it does not use `DATABASE_URL`.
7. Run `python tests/concurrency.py` **only against a separate empty native test database** to validate simultaneous last-seat attempts. This script applies migrations and creates synthetic fixture records.
8. Follow [Operations](docs/OPERATIONS.md) before deployment. Never use the migration owner as your application login: create the `mshwar_api` login role described in [database roles](../docs/security/database-roles.md).

## Files

| Path                            | Purpose                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| migrations/001_schema.sql       | Entities, relationships, constraints and indexes                          |
| migrations/002_integrity.sql    | Immutable records, audit, payment/refund rules and itinerary sealing      |
| migrations/003_transactions.sql | Reservation, transition, expiry, capacity consistency and financial views |
| migrations/004_security.sql     | Private schema, backend role and scoped reader policies                   |
| migrations/005_hardening.sql    | Slot immutability, evaluation freezing and additional checks              |
| migrations/006–021              | RLS, auth, profile, catalogue, portal, admin, planner, payments, groups   |
| migrations/022_hardening…sql    | Function privileges, current price rule, bounded booking reads, indexes   |
| migrations/023_audit_log.sql    | Append-only audit log, generic audit trigger, admin audit search          |
| migrations/024_authorisation…   | Object-level checks, hashed unsubscribe tokens, role check helper         |
| migrations/025_abuse_controls…  | AI spending ceiling, upload quotas and media metadata                     |
| migrations/026_consent…sql      | Legal document versions, consent history, personalisation gating          |
| docs/DATA_DICTIONARY.md         | Table-by-table SQL field definitions                                      |
| docs/ERD.md                     | Domain relationship diagrams                                              |
| docs/REQUIREMENTS.md            | BRD mapping and database/application responsibility boundary              |
| docs/TEST_RESULTS.json          | Actual embedded integration test results and limits                       |
| examples/queries.sql            | Geospatial search, RAG, outbox and reconciliation examples                |
| tests/integration.mjs           | Repeatable embedded tests with PostGIS and pgvector                       |
| tests/concurrency.py            | Native multi-connection contention test                                   |

## Security boundary

All user requests go through FastAPI. The `app` schema is private, has no PUBLIC table or function access, and is not intended for a browser-facing Data API. `mshwar_reader` uses row policies for customer and organization scoped reads. `mshwar_backend` is a **trusted server role with broad write authority**. It must not be given to end users; its policy is not tenant isolation for arbitrary SQL. FastAPI must verify sessions and authorize every write, including business verification, staff role changes, confirmations, cancellations and refunds.

No database password, third-party key, live payment, or real customer data is included. Authentication sessions belong to the selected auth system; Mshwar stores the unique issuer/subject mapping instead of inventing a second password store.

## Validation limits

See the generated test report for executed tests. Embedded PostgreSQL verifies actual SQL, extensions and transactions but uses one connection. Native concurrent load, the target hosting configuration, backup restore and external integrations remain deployment gates. No remote database was created or modified.

## Changing the schema

Migrations are forward-only and checksum-locked: never edit an applied file. Add the next numbered migration, then refresh the manifest with
`(awk '{print $2}' SHA256SUMS.txt; echo migrations/NNN_new.sql) | sort -u | xargs sha256sum > /tmp/sums && mv /tmp/sums SHA256SUMS.txt` and run both test suites (CI does the same).
