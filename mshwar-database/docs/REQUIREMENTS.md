# BRD traceability and implementation boundaries

Source: supplied Mshwar Business Requirements Document v1.0. Its cover date is 10 September 2026; this package was prepared on 9 September 2026 UTC. The BRD's external commercial claims are not treated as independently verified launch approval.

The table maps every functional requirement group to concrete schema support. “Application responsibility” means code or operational integration required alongside the database; SQL alone cannot implement those product interactions.

| BRD references     | Database implementation                                                                                           | Application responsibility                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| FR-001–005         | users, user_private, consent_events; unique auth issuer/subject                                                   | Auth provider, session revocation, recovery, locale/RTL rendering, consent UI                                           |
| FR-010–016         | destinations, venues, experiences, translations, taxonomy, media, favorites; GiST and text indexes                | Public published-only query projection, Arabic normalization, map UI, ranking                                           |
| FR-020–029         | trip_versions/stops/legs/costs; immutable sealing and derived totals; recommendation evidence                     | Intent validation, LLM fallback, deterministic hours/routing/party/budget solver, stop-lock-preserving edits            |
| FR-030–035         | geography points, route legs with expiry, weather snapshots and warnings                                          | Map provider, location consent, weather adapter, explain/confirm replanning                                             |
| FR-040–042         | slots, blackouts, price_rules, policies, bookings, inquiries; atomic capacity reservation                         | Hours-to-slot generation, commercial quote approval, checkout UX                                                        |
| FR-043–048         | transition guards, snapshots, payments, refunds, webhook inbox, financial status view                             | Authorization, provider signatures and network calls, business approval, cancellation/refund policy engine              |
| FR-050–053         | trip_members, hashed share links, votes, favorites                                                                | Secure token issuance/redemption, limited shared projections, group-fit calculation                                     |
| FR-054–055         | completed-booking review eligibility, one review per booking, separate business responses                         | Content moderation, response permissions and public review display                                                      |
| FR-060–069         | organizations, memberships, invitations, experiences, operating schedules, booking history                        | Onboarding, private evidence upload, permission-checked business portal, metrics definitions                            |
| FR-070–077         | verification events, moderation fields, support cases, configuration versions, commissions, quality issues, audit | Platform admin role enforcement/MFA, moderation queues, approved overrides and data-quality jobs                        |
| FR-080–083         | transactional outbox, deduplicated notifications, consent flags                                                   | Email/in-app dispatch, retries and marketing opt-out enforcement                                                        |
| AI-01–08           | grounded FKs, versioned constraints, retrieval source links, sealed evaluation datasets                           | Schema-validating LLM adapter, bounded context, injection defense, deterministic validation and multilingual test cases |
| AI-09–10           | original/final trip version links, recommendation candidates, feedback events, model/prompt/ranker versions       | Consent-aware export, event instrumentation, outcome attribution and model comparison                                   |
| BR-01–10           | status/verification fields, price currencies/types, capacity locking, freshness, sponsored flag                   | Published-only queries, hours validation, sponsorship disclosure, freshness policy                                      |
| BR-11–20           | review eligibility, immutable booking contracts, idempotency, reconciliation, state audit                         | Financial policy, business approval, admin permissions and external settlement proof                                    |
| BR-21–25           | composite ownership FKs, scoped reader RLS, consent, archival statuses, separate trip/booking/payment records     | All backend write authorization, privacy deletion workflow, truthful UI wording                                         |
| NFR-05, 17, 18     | relational constraints, validity timestamps, audit/event records                                                  | Data-quality monitoring and actor authorization                                                                         |
| NFR-01, 03, 04, 13 | indexes and short transactions; documented pooling/backup plan                                                    | Native load tests, infrastructure capacity, backups/PITR, restore drills and SLA measurement                            |

## Explicit scope decisions

- Standalone SQL migration runner is provided because no existing Alembic repository/revision chain was attached. Port into Alembic before integrating with a repository already using it; do not maintain two schema owners.
- Per-slot capacity is implemented. Hotel night inventory and resources shared across multiple experiences are not assumed.
- Fixed all-inclusive prices can be booked. From/range/quote listings remain discoverable but require a fixed commitment before checkout. Dynamic pricing, child tariffs, coupons and FX are not silently approximated.
- Account-backed participants vote; guest-session voting requires a separate model. Organizer books from a shared trip.
- Reviews require completion; pending/confirmed-only reviews are not accepted.
- Request-to-book confirms only after the business reconciles capacity. Provider payouts, split payments, subscriptions and premium products remain future BRD scope.
- Taxonomies and translations are present, but the package does not fabricate real Lebanese business inventory. Test fixtures are visibly synthetic.
- Booking snapshots and financial history are protected against normal changes. Retention/anonymization is a controlled operational workflow, not a cascade deleting payment evidence.

## Before commercial launch

Resolve the production payment/acquirer model, policy versions, tax treatment, exact resource model, authorization implementation, permitted map/weather retention, retention rules, SLA values and hosting configuration. Those decisions need business or infrastructure facts that the attached BRD does not fully define. The database package makes those boundaries visible instead of asserting they are already resolved.
