# Threat model

Story: MSHWAR-114 · Method: STRIDE per surface · Reviewed: September 2026 · Next review: before launch, then every six months or after a major feature

## System at a glance

```
Browser ──HTTPS──► Next.js web (proxy.ts: request id, locale; CSP and security headers)
                     │  /api/* rewrite (same origin, cookies)
                     ▼
                  FastAPI API ──► PostgreSQL 17 (RLS, SECURITY DEFINER functions, audit log)
                     │        ──► Redis (rate-limit counters)
                     │        ──► Payment provider (Stripe test adapter) ◄── signed webhooks
                     │        ──► ImageKit (listing photos)      ──► Email (SMTP/SendGrid)
                     │        ──► Google Maps / routing, weather ──► LLM provider (planner)
                     └──────► Sentry (scrubbed errors)
Scheduler ──X-Job-Token──► API job endpoints
```

### Trust boundaries

1. Internet ↔ web and API (untrusted input, cookies).
2. API ↔ database: the API runs as `mshwar_api`, which can only do what `mshwar_backend` allows.
3. API ↔ third parties: outbound calls go to fixed hosts; only webhooks come in, and they are signature-checked.
4. Business ↔ business: data from different businesses shares tables, separated by row-level security.
5. Scheduler ↔ API: a shared job token.

### What we protect

| Asset                                                                     | Why it matters        |
| ------------------------------------------------------------------------- | --------------------- |
| Accounts and sessions                                                     | account takeover      |
| Personal data (names, emails, phones, preferences, trip plans, locations) | privacy law and trust |
| Bookings, payments and refunds                                            | money                 |
| Business verification documents                                           | identity documents    |
| Reviews and listings                                                      | marketplace integrity |
| Admin actions and the audit trail                                         | accountability        |
| AI and maps budgets                                                       | cost                  |

## Traveller surface

Sign-up and sign-in, search, the planner, checkout, bookings, reviews, group trips, settings.

| Threat (STRIDE)        | Example                                                | Controls                                                                                                   | Residual risk                                                   |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Spoofing               | password guessing, credential stuffing                 | Argon2id hashes; sign-in limits per IP and per email; the same message whether or not the account exists   | no second factor for travellers (low)                           |
| Spoofing               | stolen session cookie                                  | `HttpOnly`, `Secure` (deployed), `SameSite=Lax`; hashed server-side sessions; sign-out revokes the session | device compromise is out of scope                               |
| Tampering              | cross-site request from another website                | SameSite cookies plus the cross-site request guard                                                         | –                                                               |
| Tampering              | changing someone else's trip, booking or review (IDOR) | object checks in database functions; 404 for foreign records; RLS                                          | –                                                               |
| Repudiation            | "I didn't cancel that booking"                         | audit log with actor, reason and request id                                                                | –                                                               |
| Information disclosure | reading another user's data; account enumeration       | policies on every route; uniform errors; no echoed input                                                   | sign-up says an email is taken (accepted, see review SR-12)     |
| Information disclosure | a leaked share or unsubscribe link                     | long random tokens, stored hashed where they grant changes; rate-limited; revocable share links            | anyone holding a live share link can view that trip (by design) |
| Denial of service      | scripted searches, sign-ups or planner calls           | per-rule rate limits in Redis; AI spending ceiling per person and platform                                 | large network floods need edge protection (hosting)             |
| Elevation of privilege | acting as a business or admin                          | role checks in database functions; admin routes separated                                                  | –                                                               |

## Business surface

The business portal: listings, availability, bookings inbox, staff, uploads, reviews, metrics.

| Threat                 | Example                                                       | Controls                                                                                | Residual risk                                                        |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Spoofing               | fake business                                                 | verification before bookings; admin review; audit trail                                 | document forgery needs human judgement                               |
| Tampering              | editing or hiding bad reviews                                 | functions forbid it; businesses can only reply or report                                | –                                                                    |
| Tampering              | injecting revenue events or other businesses' metrics         | `capture_org_event` checks membership and event names                                   | –                                                                    |
| Tampering              | malicious files (scripts in images, active PDFs, huge images) | type, signature and structure checks; size, pixel and quota limits; sandboxed downloads | new file-format exploits (low; ImageKit re-encodes delivered images) |
| Information disclosure | one business reading another's bookings or guests             | RLS on tenant tables, tested with direct SQL as the backend role                        | –                                                                    |
| Information disclosure | a former staff member keeps access                            | roles per member; removing a member ends access; invitations expire                     | –                                                                    |
| Denial of service      | upload flooding                                               | per-business hourly limit and storage quota                                             | –                                                                    |
| Elevation of privilege | staff with a narrow role using owner actions                  | capability checks per action (`require_capability`)                                     | –                                                                    |

## Admin surface

The admin console: verification, moderation, feature flags, catalogue, refunds, audit search.

| Threat                 | Example                                | Controls                                                                                        | Residual risk                                                  |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Spoofing               | admin account takeover                 | same sign-in controls as travellers; elevated tier needed for the most sensitive actions        | **no MFA for admins yet (medium, see review SR-14)**           |
| Tampering              | covering tracks                        | audit log can't be changed or deleted by anyone through the app; API role can't touch the table | database owner access is outside the app (operational control) |
| Repudiation            | disputed moderation or refund          | reasons required; every action audited with request id                                          | –                                                              |
| Information disclosure | over-broad data access                 | audit search shows field names, not personal values                                             | –                                                              |
| Elevation of privilege | an admin granting themself more rights | self-grant and last-grant rules in the database                                                 | –                                                              |

## Platform and supply chain

| Threat                      | Controls                                                                                                                                          | Residual risk                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Vulnerable dependency       | pip-audit and pnpm audit in CI; Dependabot; weekly scheduled scan                                                                                 | dev-only advisories accepted (SR-15); Python versions not locked (SR-16) |
| Vulnerable container image  | Trivy scan of both images; slim/alpine bases; non-root users                                                                                      | –                                                                        |
| Secret in the repository    | gitleaks in CI; secrets only in the platform store; scrubbed logs                                                                                 | –                                                                        |
| Unsafe code pattern         | ruff security rules; Semgrep                                                                                                                      | –                                                                        |
| Misconfiguration            | the API refuses to start with default secrets, dev endpoints, memory rate limits, SQL echo, a non-https web origin, or a privileged database role | –                                                                        |
| Third-party outage or abuse | stub fallbacks; circuit breaker for the planner; spending ceilings                                                                                | –                                                                        |

## Out of scope for this model

Physical security, hosting-provider controls, DDoS protection at the network edge, and the security of users' own devices. These belong to the hosting and operations plan.

## Still to do outside the code

- A penetration test by an independent tester before launch.
- Legal review of the trust documents (see [privacy-and-consent.md](privacy-and-consent.md)).
- A decision on MFA for admin accounts (SR-14).
