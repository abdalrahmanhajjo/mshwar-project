# Database operations guide

## Deployment and roles

Provision PostgreSQL 17+ with PostGIS, pgvector and btree_gist. Extension installation may require a host administrator. The SQL expects extensions resolvable in `public`; if a managed host already installed them in `extensions`, adapt the migration search path deliberately in staging before first deployment. Keep extensions and the database patched. Pin tested server/container image digests in the actual infrastructure repository, not an unverified image guessed for this package.

Use three connections: a privileged migration login, a trusted backend login inheriting `mshwar_backend`, and optionally a read login inheriting `mshwar_reader`. Create passwords in a secret manager, never in these SQL files. Backend logins must be NOSUPERUSER, NOCREATEDB, NOCREATEROLE and NOBYPASSRLS; do not grant the migration owner role. Restrict network access to application hosts and enforce TLS certificate validation (`sslmode=verify-full` where supported).

The backend role can intentionally access all app rows. Enforce endpoint permissions centrally and test every write path for cross-organization access. A separate worker login can inherit the backend role initially; a later service-specific privilege split should give refund/payment processing a narrower interface. Avoid exposing private schema functions as browser RPC endpoints.

## Migration workflow

1. Back up the target and restore a staging copy when changing existing production data.
2. Apply the forward migrations in an empty staging database. Run tests and verify extension versions and grants.
3. Deploy additive database changes before code that requires them. Backfill in bounded batches. Enforce new constraints after data is verified.
4. Use `CREATE INDEX CONCURRENTLY` in a separately managed non-transactional migration for large existing tables; the initial schema build uses normal indexes because the tables are empty.
5. Never edit an applied migration. Add a new migration. The included runner checks hashes and serializes deploys with an advisory lock.
6. On an initial migration failure, the failed file rolls back; earlier successful files remain recorded. Correct the unapplied file and rerun.
7. Roll back application code only when schema compatibility allows it. For destructive data changes, restore into a separate database and reconcile before cutover. No automatic DROP-based downgrade is included.

## Pooling and contention

Begin with a small bounded application pool, for example 5 connections per API process and 2 per worker process, then size against the server's actual connection limit and measured workload. This is a starting assumption, not a throughput promise. Reserve headroom for migrations, monitoring and administrative access.

Keep request context transaction-local. Bound SQL time and lock waits. Retry deadlock/serialization failures (SQLSTATE 40P01 and 40001) with a small bounded backoff around the entire transaction and the same idempotency key. Do not retry validation failures or insufficient capacity indefinitely. Never make an external network request while holding booking/slot/payment locks.

Use a consistent multi-record lock order, sorted by UUID where bulk operations are introduced. Current single-booking transitions lock booking then slot; reservation locks only its slot before creating a new booking. Worker lease claims use SKIP LOCKED. Run the native contention test and add booking-vs-expiry/payment-vs-cancel/refund-vs-refund tests in the real repository.

## Workers and reconciliation

- Expire pending holds every minute. Alert if expiry lag exceeds a few minutes; lag is conservative capacity reduction.
- Outbox consumers claim short leases, deliver outside transactions, and record completion. Retry with exponential backoff, cap attempts and surface a dead-letter operational view. Consumers deduplicate by event key.
- Webhook workers first verify signatures, store a unique event and sanitized payload, then process idempotently. Keep raw secrets/card data out of the inbox and logs.
- Reconcile paid-but-cancelled/expired/rejected and duplicate settled payments against the provider. Request refunds according to the immutable policy and actual provider state. Do not overwrite payment history to make a dashboard balance.
- Refresh approved knowledge after content changes. Revoke old documents as appropriate and re-embed with a recorded model version.
- Prune route/weather/location caches according to permitted retention; expire stale data in retrieval queries immediately, even before physical cleanup.

## Backups and recovery

Proposed pilot objectives: RPO 15 minutes and RTO 4 hours. These are **not established service guarantees**; the owner must approve and fund them. Meeting them generally requires PITR/WAL retention in addition to daily backups. Keep encrypted backups in a separate failure domain, with access controls distinct from application credentials.

Perform a scheduled restore drill into an isolated database. Record restore duration, recovered timestamp, migration versions, row counts and sample booking/payment reconciliations. Verify PostGIS/pgvector extension compatibility and external media availability. Database restore does not reverse a payment provider charge: replay/reconcile provider events after restoring. Document the last reconciled event/checkpoint and avoid duplicate refunds.

## Retention and deletion

Define legal retention with the actual jurisdiction, merchant contract and privacy policy; the values below are proposed engineering defaults only.

| Data                            | Proposed treatment                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| User contacts and preferences   | Remove/anonymize after an approved deletion request; revoke sessions first                               |
| Precise trip start location     | Minimize API visibility; generalize/remove when no longer needed, with an authorized retention migration |
| Raw prompt text                 | Do not store by default; use redacted structured constraints                                             |
| Product analytics               | 90-day detailed retention initially, then aggregate                                                      |
| Weather and external cache data | Expire according to provider terms and operational need                                                  |
| Verification evidence           | Private object storage; restrict reviewers; approved retention schedule                                  |
| Financial contracts and audits  | Jurisdiction/provider-defined retention; restricted access and eventual controlled purge                 |
| Training feedback               | Only consented/de-identified data; remove disallowed rows from training exports                          |
| Evaluation sets                 | Synthetic, versioned and stable                                                                          |

Immutable history conflicts with ordinary account cascades. A dedicated authorized anonymization/retention migration must remove identifying data while preserving necessary transaction records. Do not disable all integrity triggers during normal API requests. This package intentionally grants no general financial-history deletion to the backend role. The retention scheduler and deletion workflow are application/operations work still required before launch.

## Performance and growth

Inspect `EXPLAIN (ANALYZE, BUFFERS)` on representative staging data before adding more indexes. GiST supports radius queries; B-tree indexes support identity, FK joins, availability and keyset history. HNSW trades recall and memory for speed; compare to exact search and tune after measuring actual corpus size. For a small corpus, exact vector search may be sufficient.

Watch index hit rate, slow queries, table/index sizes, dead tuples, autovacuum lag, WAL volume, lock waits, idle-in-transaction sessions and connection saturation. The baseline includes conservative FK indexes; remove truly redundant indexes only after checking production query plans and constraint dependencies.

Do not partition booking tables at MVP scale. Consider monthly partitioning for append-heavy analytics/audit tables after retention volume warrants it; a migration must address global uniqueness and foreign-key limitations before converting existing tables. Add read replicas only when measured read traffic justifies replication lag handling; checkout always reads the primary.

## Release gates

The target environment must pass the native multi-session tests, an actual migration rehearsal, a restore drill, API role/authorization tests, webhook signature and replay tests, provider sandbox payment/refund tests, and deterministic planner feasibility tests. Verify all app tables still have RLS, all new functions lack PUBLIC execution, and the app schema remains private. No synthetic supplier may appear as a real production business.
