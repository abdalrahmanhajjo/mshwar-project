# Architecture and decisions

The schema makes relational records authoritative for identity, inventory, money and booked agreements. PostgreSQL foreign keys connect operational history to the original entities. PostGIS handles spatial retrieval; pgvector stores source-linked embeddings. Redis may cache results and schedule work, but must never become the authority for remaining seats or payment settlement.

## Domain model

| Domain               | Principal records                                                           | Design purpose                                                           |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Identity and privacy | users, user_private, consent_events                                         | Separate public identity mapping from contacts and sensitive preferences |
| Supply ownership     | organizations, organization_members, staff_invitations, verification_events | Organization boundaries, operational roles and verification evidence     |
| Discovery            | destinations, venues, experiences, taxonomy, translations, media            | Published inventory, multilingual content, location and suitability      |
| Commercial inventory | opening_hours, opening_exceptions, blackouts, slots, price_rules, policies  | Hours, dated capacity, price validity and cancellation terms             |
| Planning             | trips, trip_versions, trip_stops, trip_legs, trip_cost_items                | Versioned constraints and derived costs; sealed historical plans         |
| Groups               | trip_members, trip_share_links, votes, favorites                            | Permission-bearing invitations and durable preferences                   |
| Transactions         | bookings, booking_events, payments, refunds, webhook_inbox                  | Independent reservation and financial lifecycles                         |
| Trust and operations | reviews, review_responses, support_cases, audit_log, outbox, notifications  | Evidence, moderation and retryable delivery                              |
| Knowledge            | knowledge_documents, knowledge_chunks, retrieval_sources                    | Approved source versions, model-specific vectors and retrieval evidence  |
| Learning             | recommendation_runs, recommendation_candidates, feedback_events             | Original proposals, edits and outcomes retained separately               |
| Evaluation           | evaluation_datasets, evaluation_cases, evaluation_runs, evaluation_results  | Versioned test data and comparable model results                         |
| Weather and metrics  | weather_snapshots, weather_warnings, analytics_events, data_quality_issues  | Expiring external evidence and operational signals                       |

## Key decisions

### Relational keys and organization boundaries

Use application-generated or database-generated UUIDs. IDs are identifiers, not authorization secrets. Composite foreign keys bind venues and experiences to the same organization and bookings to the same experience/slot. Records referenced by a booking are archived, not deleted. Financial history retains its foreign keys.

Organization roles are owner, manager, inventory, bookings and finance. Admin authorization belongs to server-side permission management; the package does not turn user-editable profiles into admin roles. Verification changes require an authorized platform endpoint to append verification evidence and update organization verification in one transaction. The audit trigger alone does not prove an actor was an administrator.

### Authentication and request context

The selected Auth.js/Better Auth implementation owns sessions, recovery and credentials. `users(auth_issuer, auth_subject)` is the integration key. The backend resolves it after validating a session and checking that the local user is active. The backend sets `app.user_id` and a sanitized request ID inside each transaction. Do not accept these values from request-body fields or expose a SQL console.

Use `SET LOCAL` or `set_config(..., true)` with transaction pooling. Never use a session-level setting on a shared production pool. A user controlling SQL can change custom settings; RLS here assumes only the trusted server supplies identity. The restricted reader is defense in depth, not a replacement for authentication.

### Money and price commitments

All amounts use `bigint` minor units plus a currency reference. USD 25.00 is 2500. Use the currencies table when formatting and converting; never infer units from the amount. Provider-specific rounding and supported currencies must be validated by the payment adapter. There is no floating-point money or automatic USD/LBP conversion. FX support, if added, needs explicit rate, source, timestamp and rounded conversion snapshots.

Price rules distinguish fixed, from, range and quote prices. Overlapping effective periods for the same experience and currency are excluded. The reservation function accepts only a valid fixed price. From/range/quote records are discovery estimates; a business must provide an explicit fixed offer before checkout. Current MVP prices are all-inclusive. Complex adult/child tariffs, coupons, line-item taxes, exchange rates and partner-specific quotes require additive commercial migrations before those features launch.

Bookings store immutable price and cancellation-policy snapshots. Price rule updates cannot change an existing booking. `payment_required` is selected by trusted commercial policy, never forwarded from user input. A later policy version is a new immutable policy record.

### Capacity and reservations

Inventory is capacity per experience slot. Different slots are independent pools; this does **not** model a shared vehicle, room or guide across overlapping experiences. Add resources, allocations and exclusion constraints before selling shared exclusive resources or nightly room inventory.

`reserve_booking` serializes duplicate requests with a transaction advisory lock and serializes inventory changes with a slot row lock. Authoritative inventory receives a capacity hold. A deferred constraint checks that the slot counter equals the sum of allocated bookings at commit. Cancellation, rejection and expiry release the allocation exactly once. Confirmed/completed historical allocations remain attached to the past slot.

Known but non-authoritative capacity produces a request, with no promised seat allocation. The business must reconcile its real capacity and mark the slot authoritative before confirmation. Stale instant inventory is downgraded to request-to-book. An expired record remains allocated until the expiry worker runs; this is intentionally conservative and may temporarily hide seats, rather than oversell them.

Request SLA defaults to 24 hours, payment holds to 15 minutes, both capped at the slot start. These are proposed MVP defaults requiring product approval. The backend should externalize them through a reviewed future function/configuration change if commercial terms differ.

The backend executes `transition_booking` only after authorizing the requested action. Payment workers may confirm instant bookings after settlement; request bookings also require business approval. The database function does not itself distinguish a webhook worker from a business employee.

### Payment and refund state

Booking lifecycle: pending → confirmed/rejected/cancelled/expired; confirmed → completed/cancelled. Draft bookings are UI drafts before a commitment is inserted. Refunds are independent financial records; the view presents paid, unpaid, partially refunded and refunded states without overwriting the fulfillment history.

Each provider attempt stores provider, merchant account, test/live mode, external ID and idempotency key. Only one open attempt per booking is allowed. A late settlement must still be recorded after a timeout or cancellation. The database deliberately permits multiple settled attempts so real duplicate charges are not hidden; reconciliation flags them for refund investigation. Payment success never silently revives a cancelled/expired booking.

Webhook signatures must be verified outside PostgreSQL, before inserting the deduplicated inbox event. A verified timestamp is evidence supplied by the server, not cryptographic verification by the database. Process inbox events transactionally with payment changes and outbox events. Never hold database locks while making a network request to a payment provider.

Refund insertion locks the parent payment and limits active requested/pending/succeeded refunds to the settled amount. Failed refunds free local reservation room. Ambiguous provider failures must remain pending until reconciled; otherwise a late external success could exceed the intended refund after another attempt. If such an external anomaly occurs, retain the inbox evidence and escalate reconciliation rather than discarding it. Cancellation eligibility and provider fees are computed by the server from the snapshot.

### Itinerary history and feasibility

Create a draft version, insert stops/legs/cost items, run the deterministic planner, and seal it in the same controlled workflow. Once sealed, versions and their children cannot change. Edits create a new version. Sealing checks published/verified entities, stop windows, sequential positions, overlapping stops, total budget and presence of a validator version.

**Database sealing is not the full feasibility solver.** The service must check opening exceptions, day/timezone conversion, party suitability, strict budget treatment of uncertain prices, all route legs including the return journey, route freshness and actual travel gaps. The `validation` JSON is produced by trusted code; it must not be supplied directly by an LLM or a client. A manual infeasible draft may be saved but must not be presented as a validated plan.

Planning costs are denominated in the version currency. The service rejects mixed-currency estimates without an explicit conversion record. Stop totals, leg transport costs and extra costs are disjoint; do not duplicate transport costs in both legs and cost items. A booking from a stop requires a sealed version and the trip owner. Group members contribute preferences/votes; the organizer books.

### Time, hours and external evidence

Store instants as `timestamptz`; venues store IANA timezone names, initially Asia/Beirut. Opening hours are local wall times with weekday 0 Sunday through 6 Saturday. Split overnight opening periods at midnight. Exceptions override the weekly schedule. The initial exception table allows one opening interval per date; multiple split exception intervals require an extension. The backend validates timezone names using its IANA timezone database and handles DST explicitly.

Coordinates are canonical `geography(Point,4326)`, in longitude/latitude order. Do not also maintain independent editable lat/lon values; derive them with PostGIS to avoid drift. Dates and coordinates must not be fabricated from an AI response. External route/weather/location evidence includes provenance and expiry. Retention must comply with the selected provider's actual terms.

### Group links and reviews

Share links store only a cryptographic hash of a high-entropy random token, with expiry, role and revocation. The backend hashes the presented token, validates it and returns a limited projection. Account-backed members are required for voting in this MVP. Guest voting would need an explicit guest identity model; it is not simulated by anonymous shared user IDs.

The trip owner can create a member record for themselves to vote. Votes require vote/edit permission and an unlocked trip. Read-only participants cannot vote. Closing the trip locks voting. Public trip links must not expose precise private start locations or participant preferences without consent; use an API response projection.

Reviews require a completed booking owned by the author, which is stricter than the BRD's confirmed-or-completed allowance. One review per booking. Businesses respond using separate moderated records. Review author content and moderation permissions must be separated in the API.

### AI data separation

RAG chunks retain a document reference, version, source hash and model identifier. Retrieval excludes unapproved, revoked, expired or unpublished source entities. The initial embedding dimension is **1536**, a deliberate configurable architecture choice, not a requirement to use a specific provider. Query only compatible model versions. Changing dimensions requires a parallel column/table and index, re-embedding, evaluation and a controlled cutover. Never mix vectors from different models just because dimensions match.

Recommendation records retain candidate membership, eligibility, ranking version and source evidence. Feedback captures original and final version IDs plus changes and outcomes. Training consent is explicit. Evaluation datasets are versioned and sealed before comparisons; multilingual fixtures must use synthetic prompts, not raw customer conversations.

### Hosting and migrations

The schema is portable PostgreSQL and does not depend on Supabase Auth. For Supabase hosting, confirm extension schemas and role provisioning in staging, keep `app` outside exposed API schemas, and use a backend connection. This package does not modify an existing Supabase project. Do not use a privileged service key in the browser.

The supplied runner is a small standalone migration mechanism. If the FastAPI repository already uses Alembic, port these five ordered migrations into that repository's revision chain; do not run two migration histories on the same schema. No Alembic repository was supplied, so its revision IDs and existing model metadata are not invented here. SQL is the canonical definition; an ORM mapping should follow it, not recreate a weaker parallel schema through `create_all()`.

## References checked for implementation

- [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html) explains the row locks used to serialize capacity operations.
- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html) documents geography distances in meters and index-aware radius search.
- [PGlite extensions](https://pglite.dev/extensions/) documents the test engine's PostGIS, vector and btree_gist integrations. Embedded test success does not prove native concurrency behavior.
