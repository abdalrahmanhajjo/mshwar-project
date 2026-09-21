# Mshwar code quality & architecture audit

- **Date:** 16 September 2026
- **Scope:** the whole repository on `feat/ui-redesign`.
- **Related:** the finding IDs `C1`–`L15` point to the detailed table and proofs in [code-review-report.md](code-review-report.md). This document adds the architecture, structure, tooling and technical-debt view, and the refactor plan.

**Tools used**

- the repo's own lint, format, type and test commands
- PostgreSQL 16 with PostGIS and pgvector, for the API tests
- `ruff` with the root config, `vulture`, `knip`, `pip-audit`, `pnpm audit`
- an import-graph script
- `pip install .` for the API package

Docker images could not be built here, because the sandbox blocks container registries. Docker findings come from reading the files and running their steps by hand.

---

## Repository map

```text
mshwar/
├── apps/web/                    Next.js 16 app (App Router, React 19, Tailwind v4)
│   ├── src/app/                 routes: (traveller)/, business/, admin/, api/health
│   ├── src/components/          by domain: browse, hub, planner, plan, checkout, business, admin, ui, shell …
│   ├── src/lib/                 42 files: API clients + copy catalogues + sample data + helpers (mixed)
│   ├── src/i18n/                locale, formatting, parity helpers
│   ├── src/hooks/               1 file (use-toast)
│   ├── src/styles/generated/    design tokens (generated)
│   ├── .storybook/, scripts/, public/ (default Next template SVGs)
│   └── pnpm-lock.yaml, pnpm-workspace.yaml   ← nested copies inside the workspace
├── services/api/                FastAPI
│   ├── app/api/v1/endpoints/    18 routers (portal 872 lines, admin 815, planner 668, auth 520)
│   ├── app/planner/             trip builder: pipeline, optimizer, routing, weather, LLM, ranking
│   ├── app/payments/            provider abstraction, state machine, outbox, webhook
│   ├── app/catalogue/           search parsing, price labels, routing/embedding shims
│   ├── app/core/                config, auth helpers, storage, mailer, notifications, rate limit
│   ├── app/schemas/             Pydantic request/response models
│   ├── app/models/              SQLAlchemy models  ← not used, don't match the schema
│   ├── app/alembic/             Alembic migrations ← not used, don't match the schema
│   ├── app/seed/                Lebanon seed data
│   ├── db/Dockerfile            Postgres image (broken)
│   └── tests/                   32 test modules (flat)
├── mshwar-database/             canonical schema: 21 SQL migrations, runner, docs, PGlite tests (npm)
├── mshwar-brand-foundation/     design tokens (JSON source) → generated CSS/TS/Figma
├── docs/                        feature docs + review reports
├── backlog/                     Jira CSV + markdown backlog
├── prototype/                   8 PNG screenshots        ← root clutter
├── 155d3800-….png, Mshwar_Business_Requirements_Document_v1.0.{docx,pdf}   ← root clutter
├── .github/workflows/           api.yml, web.yml, ci.yml (overlapping)
└── package.json, pnpm-workspace.yaml, docker-compose.yml, .ruff.toml, mypy.ini, .eslintrc.js
```

### What's organised well

- Web components are grouped by domain.
- UI primitives live in `components/ui`.
- Routes use App Router groups.
- API routers are split by domain, and payments and planner are their own packages.
- The schema has one canonical home (`mshwar-database`).
- Tokens come from a single source.

### Structure problems

| Problem                                              | Where                                                                                | Recommendation                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead folders that contradict the real schema         | `services/api/app/models/`, `app/alembic/`, `alembic.ini`                            | **Delete** (your decision). The SQL migrations are the only schema                                                                                |
| `lib/` mixes four different jobs                     | `apps/web/src/lib/` (9 API clients, 10 `*-copy.ts` catalogues, sample data, helpers) | Move the copy catalogues next to i18n (`src/i18n/copy/`) and the API clients to `src/lib/api/`. This is a mechanical move, done later in the plan |
| Nested lockfile/workspace inside a workspace package | `apps/web/pnpm-lock.yaml`, `apps/web/pnpm-workspace.yaml`                            | Keep only if `pnpm install` must work inside `apps/web`, and keep the lockfile in sync (done)                                                     |
| Root clutter                                         | `155d3800-….png`, `Mshwar_Business_Requirements_Document_v1.0.*`, `prototype/`       | Move to `docs/brd/` and `docs/prototype/`. Nothing links to them                                                                                  |
| Default template files                               | `apps/web/public/{file,globe,next,vercel,window}.svg`                                | Delete (not referenced)                                                                                                                           |
| Dead config                                          | root `.eslintrc.js` (web uses `eslint.config.mjs`)                                   | Delete, or move the useful rules into the flat config                                                                                             |
| Shadowed config                                      | `services/api/pyproject.toml [tool.ruff]` hides root `.ruff.toml`                    | Add `extend = "../../.ruff.toml"`                                                                                                                 |
| Flat tests folder                                    | `services/api/tests/` (32 files)                                                     | OK for now; no change needed                                                                                                                      |

---

## A. Executive summary

The codebase is **readable and well-tested**:

- web typecheck and lint are clean, and there are 157 web tests including axe accessibility checks
- 213 API tests with 93% coverage
- strict mypy passes
- there are no `any` types, no `@ts-ignore` and no `console.log`

Most booking, payment, portal and admin rules live in **PostgreSQL `SECURITY DEFINER` functions**, with thin FastAPI routers calling them. That is a valid design for this project, and the SQL layer is careful: row locks, idempotency keys, exclusion constraints and state-machine triggers.

The weak points:

1. **Configuration and deployment safety.** Env vars are ignored, secrets have hard-coded fallbacks, and the Docker images don't build. This single area causes most of the critical security findings.
2. **A few endpoints** where payment or ops actions skip ownership or role checks.
3. **Structural drift.** There are two schema systems (SQL + unused Alembic/ORM), an import cycle between auth modules, payment orchestration inside a router, and 135 of 208 endpoints with no response schema.
4. **Duplication on the web.** There are nine hand-written fetch helpers with different error behaviour.
5. **Stale docs.** The README and AGENTS.md describe Alembic, Next 15, Python 3.9/3.11, a `packages/shared` folder, husky and OR-Tools, which don't match the code.

No rewrite is needed. The plan below fixes the risks in small steps, each with its own tests.

---

## B. Critical problems

| #   | File                                                                                                          | Problem                                                                                                                                                                                                                                                            | Why it matters                                                           | Recommended fix                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `services/api/app/core/config.py`                                                                             | `case_sensitive=True`: uppercase env vars and `.env` keys are ignored                                                                                                                                                                                              | Production runs as "development" with default secrets, which opens C2–C5 | Case-insensitive settings; refuse to start with default secrets outside development                                               |
| C2  | `app/core/storage.py`                                                                                         | Signed download path isn't contained; the key has a default value                                                                                                                                                                                                  | Anyone can read server files (proven)                                    | Contain the path; validate the key format; require a real secret                                                                  |
| C3  | `app/payments/stripe_test.py`                                                                                 | Webhook secret falls back to a public value                                                                                                                                                                                                                        | Forged "paid" events (proven)                                            | No fallback; reject webhooks when the secret is missing                                                                           |
| C4  | `app/payments/stripe_test.py`, `factory.py`                                                                   | Stub provider auto-succeeds when the key is missing                                                                                                                                                                                                                | Bookings confirmed without payment                                       | Stub only when chosen explicitly and never in production                                                                          |
| C5  | `app/api/v1/endpoints/checkout.py`                                                                            | `/simulate` has no owner check and is open whenever the environment isn't production                                                                                                                                                                               | Free bookings; cancelling other people's bookings (proven)               | Dev flag + owner check (your decision)                                                                                            |
| D1  | `services/api/db/Dockerfile`, `services/api/Dockerfile`, `apps/web/Dockerfile`, `services/api/pyproject.toml` | **All three images fail to build:** `psql` runs at build time with no server, and the `pgvector` extension name is wrong; `pip install .` fails (`setuptools.backends` doesn't exist, confirmed); the web image uses the wrong context and paths, and pnpm 9 vs 11 | `docker compose up` (the documented quick start) can't work              | Fix the build backend; use init scripts; multi-stage images built from the repo root; run as non-root; no `--reload` in the image |

---

## C. Architecture problems

1. **Import cycle and layer inversion:** `endpoints/auth.py → core/admin_auth.py → core/portal_auth.py → endpoints/auth.py`. `core/guests.py` and `core/portal_auth.py` import from a router module. The cycle is currently "solved" with imports inside functions (`auth.py:220,285`). **Fix:** move session loading (`load_session`, `require_session`, `require_verified_user`) into `app/core/auth_session.py`, and make routers import from core.
2. **Business logic in a router:** `checkout.py:pay_booking` (97 lines) runs the provider call, timeout handling, payment record and outcome. `cancel_preview` combines two SQL calls with Python policy logic. **Fix:** `app/payments/checkout_service.py`, with the router kept thin.
3. **No data-access layer:** 139 `fetch_json(...)` and 56 raw `text(...)` SQL calls sit directly in routers. SQL function names, argument order and JSON shapes are repeated per route. **Fix (incremental):** small typed per-domain modules (e.g. `app/repositories/checkout.py`) that wrap the SQL function calls. Start with checkout and payments; don't rewrite portal/admin all at once.
4. **Untyped API responses:** 135 of 208 endpoints return raw JSONB (`-> Any`), so the OpenAPI schema is empty and the web types are written by hand. Internal fields (`customer_id`, `organization_id`) go straight to clients. **Fix:** add response models step by step, starting with checkout and bookings.
5. **Identity from request headers:** middleware in `main.py` trusts `x-user-id` / `x-organization-id`. It's only used by the unused `get_db`, but it's a trap. **Fix:** delete it.
6. **External calls in hot paths:** `RoutingService()` is created per candidate (`eligibility.travel_leg`); Google is called with a new synchronous `httpx.Client` per element, inside async routes; SMTP is also synchronous. Adapters exist (good), but they are synchronous and not batched.
7. **Two booking systems:** `/bookings` (hub preview bookings) and `/checkout` (real bookings). This is a product decision; noted, not changed.
8. **Process-local state:** rate limiter, route cache, circuit breaker and payment metrics are module globals. That's fine for one worker, wrong for several. Documented; Redis later.
9. **Web data layer:** pages are Server Components (good: only 2 client pages). Catalogue data is fetched server-side, but falls back to fake seed data (H9). Account, business and admin views fetch in client effects through nine separate helpers (M15).

---

## D. Folder structure

The current structure is mostly understandable. The only changes that are really needed are listed in the "Structure problems" table above. Recommended layout after cleanup (only the changed parts are shown):

```text
services/api/app/
├── api/v1/endpoints/      (unchanged)
├── core/
│   └── auth_session.py    NEW: session loading used by routers + core
├── payments/
│   └── checkout_service.py NEW: pay / cancel-preview orchestration
├── models/                REMOVED
└── alembic/               REMOVED (+ alembic.ini)

apps/web/src/
└── lib/api/client.ts      NEW: one fetch helper + error normalisation

docs/
├── brd/                   moved BRD docx/pdf
└── prototype/             moved screenshots
```

---

## E. Code quality problems

**Duplication**

- Nine fetch/`readError` copies in `apps/web/src/lib/*.ts`.
- `require_session` exists twice (`api/v1/session.py`, `core/portal_auth.py`).
- `_client_ip` exists twice (`auth.py`, `admin_auth.py`).
- The same "reload lists" block appears twice in `admin/moderation-queue.tsx`.
- The intensity mapping exists twice (`ranking.py`, `eligibility.py`).
- The price-rule `LIMIT 1` subquery is copied into six SQL functions.

**Dead code (confirmed by knip / vulture and grep)**

- **Web files:** `components/browse/saved-view.tsx` (the `/saved` page redirects to `/favorites`), `lib/config.ts`, `test-mocks/next-link.tsx`.
- **Web dependencies:** `tailwindcss-animate`, `@storybook/react` (stories use `@storybook/react-vite`).
- **API:** `get_db`, `get_read_db`, `Base` and the header context helpers (tested, but not used by the app).
- **Settings nothing reads:** `algorithm`, `access_token_expire_minutes` (no JWT), `redis_url`, `log_level`, `log_format`, `sentry_*`, `posthog_api_key`, `app_host/port`.
- **Default template SVGs** in `public/`.

**Complexity**

`_held_karp` (22), `assemble_plan` (18), `evaluate_candidate` (15), `apply_defaults` (15), `set_lock` (11), `apply_refinement` (11) are all over the mccabe limit of 10.

Long functions:

- `pipeline.start_or_continue` (143 lines)
- `replan_affected` (132 lines, 12 parameters)
- `persist_plan` (101 lines, 13 parameters)

Split only where it helps readability (see M-list).

**Large files**

| File                   | Lines | Verdict                                              |
| ---------------------- | ----: | ---------------------------------------------------- |
| `endpoints/portal.py`  |   872 | many thin routes; OK once the repositories exist     |
| `endpoints/admin.py`   |   815 | many thin routes; OK once the repositories exist     |
| `planner/pipeline.py`  |   805 | orchestrates several flows; split by flow later      |
| `web planner-view.tsx` |   663 | 6 components in one file; split into `planner/*.tsx` |
| `web lib/catalog.ts`   |   726 | sample data (becomes dev-only after H9)              |

**Naming**

Mostly clear. Some exceptions:

- `fetch_json` returns any scalar, not only JSON.
- `_session` / `_user_id` wrappers in `portal.py` add nothing.
- `data` / `row[0..7]` tuple indexing in `bookings.py` and `auth.py`: use `.mappings()` and field names.

**Comments**

Mostly "why" comments, which is good. Some are stale or misleading:

- `catalog-image.tsx` says `next.config.ts` has a remote image config (it doesn't).
- `storage.py` places the module docstring _after_ `from __future__`, so it isn't a docstring.
- README comments mention `router.py` and a `dependencies/` folder that don't exist.

---

## F. Security findings

- **Critical:** C1, C2, C3, C4, C5.
- **High:**
  - H1: ops endpoints are open to any user.
  - H2: dispatch/escalate work without a token.
  - H3: no sign-in rate limit, and the `X-Forwarded-For` client IP can be faked.
  - H8: uploads are written before the permission check, with no size limit.
- **Medium:**
  - M1: identity is read from request headers.
  - M2: the API connects as the DB superuser, and SQL echo logs parameters.
  - M3: raw DB errors are sent to clients.
  - M7: CSV formula injection.
  - M11: sign-in timing reveals which emails exist.
  - M13: no web security headers.
  - Silent `except Exception` without logging (`explanations.py:81`, `outbox.py:55`).
- **Low:**
  - L1: `safeNextPath` bypass.
  - L7: guest cookie without `secure`.
  - Token compared with `==`.
  - Dev hard-coded fallback secrets (`change-me-in-production`, `whsec_local_stub`).
- **Secrets scan:** no real secrets are committed. `.env*` files are git-ignored. The `NEXT_PUBLIC_*` values are only the API URL and a browser Maps key (which must be referrer-restricted).
- **SQL injection:** all API queries use bound parameters. The seeder builds SQL with f-strings from static numbers (L10).

## G. Performance findings (all measured or read directly from the code)

- H4: the optimizer is unbounded and blocks the event loop (22 stops → 10 s, 556 MB).
- H7: n·(n−1) sequential synchronous Google calls; about 48 per plan build.
- H11: unbounded list functions; one booking response rebuilds the whole org list.
- M12: missing indexes (listed); substring search scans every row.
- M8: caches and the rate limiter never evict; failures cached for 6 h.
- M16: every card loads a 1600 px image.
- M17: public catalogue data is never cached.
- L3: repeated JSON parsing and linear lookups in saved-experiences.
- Two DB round trips to load the session on checkout routes (L6).

## H. Database findings

- **Models:** the SQL schema is strong (FKs, CHECKs, exclusion constraints, RLS policies, audit triggers). The SQLAlchemy models don't match it and aren't used (delete).
- **Queries:**
  - price rule chosen without a validity check (M5)
  - unbounded lists (H11)
  - per-row JSON builder calls inside `jsonb_agg` (`list_experiences_portal`, `list_my_organizations`): OK at current size
- **Constraints:** `opening_hours` allows `24:00` but not overnight ranges (M6).
- **Transactions:** one transaction per request (`get_auth_db`), committed on success. `pay_booking` commits explicitly on the failure paths. The provider call happens inside the open DB transaction (keep it short; covered by M4).
- **Indexes:** mostly good. Missing ones are listed in M12.
- **Migrations:**
  - The SQL runner is checksum-verified and forward-only, and applying twice works.
  - Alembic is a second, conflicting system, and its downgrade in the CI rollback would drop real tables (H10).
  - The two DB test suites fail on `seed.sql` and aren't in CI (H12).
  - The app connects as `postgres` (a superuser), so RLS is bypassed (M2).

## I. Frontend findings

- **Next.js:**
  - Only 2 client pages. Good server/client split.
  - `middleware.ts` is deprecated in Next 16 (should be `proxy.ts`).
  - No `error.tsx` boundaries at all.
  - `metadata` exists on only 10 of 53 pages, so most tabs have no page title.
  - Public data uses `cache: "no-store"`.
- **Components:**
  - `planner-view.tsx` is too large.
  - The fake-data fallback (H9).
  - Map pins use hard-coded coordinates (M14).
  - `arrow-link.tsx` is marked `"use client"` without needing it.
- **Effects:** missing cancellation/`catch` (L2); no infinite-loop risks found; dependency arrays pass the `react-hooks` lint rules.
- **State:** local state + a small context (auth, locale, portal) + `useSyncExternalStore` for saved items. Appropriate, no global store needed.
- **TypeScript:**
  - Strict mode, 0 `any`, 0 `@ts-ignore`.
  - 28 unchecked `response.json() as T` casts (API responses aren't validated).
  - `profile.locale as Locale` should use `parseLocale`.
  - Types are written by hand and can drift (L15).
- **Styling:**
  - Design tokens are used everywhere; one raw hex colour (`#bfd9dd`) in the map.
  - Repeated arbitrary sizes (`text-[0.6875rem]` ×11, `rounded-[1.5rem]` ×8) should become named utilities.
- **Accessibility:** axe tests pass; semantic buttons and labels are used; no clickable `div`s were found.

## J. Backend findings

- **FastAPI:**
  - Routers are consistent (`/api/v1`, kebab-case, action sub-resources for state changes).
  - Oddities: two health endpoints; `DELETE /bookings/{id}` exists only to return 405; planner admin routes live under `/planner/admin`.
- **Services:** the planner pipeline, payments and notifications are real service modules (good). Checkout orchestration lives in the router (C.2).
- **Schemas:** requests are validated with Pydantic (good). Gaps:
  - `OptimizeRequest.stops` has no maximum.
  - Lat/lng aren't range-checked.
  - `q` has no max length.
  - The upload body has no size limit.
  - `CheckoutSimulateIn.outcome` is free text.
- **Errors:** raw DB messages returned (M3); silent excepts; the 422 constant is deprecated.
- **Logging:** nothing configures logging, so `logger.info` never appears. No request IDs in logs.
- **Async:** synchronous CPU work (optimizer) and synchronous HTTP (Google, SMTP) inside `async def` routes.
- **Other:** the real LLM client is never used (M9); the mailer never sends (M10).

## K. Testing findings

- **Strengths:** the API tests hit a real database (not mocks); there are cross-tenant tests, idempotency and last-seat tests, fault injection, and web axe tests.
- **Weaknesses:**
  - Some tests **lock in insecure behaviour**: the ops endpoints and `/simulate` are called as a normal guest.
  - No tests for config loading, webhook secret handling, file-path containment, upload permissions, planner return-by, duplicate locks, or `24:00` hours.
  - The DB suites are broken and aren't in CI (H12).
  - No e2e tests in CI (L14).
  - Snapshot tests for locale screens are brittle (15 snapshots rewrite on any visual change).
  - Test helpers ship inside app code (`RecordingMailer`, `sign_stripe_payload`, fault injection that changes global settings).

## L. Configuration / DevOps findings

- **Environment:**
  - C1.
  - Unused settings (see E).
  - `ENVIRONMENT` defaults to development (fail-open).
  - `.env.example` documents `ALGORITHM` and `ACCESS_TOKEN_EXPIRE_MINUTES`, which nothing uses.
- **Python version drift:** AGENTS.md says 3.9, README and CI say 3.11, `mypy.ini` says 3.11, `ruff` targets 3.9, `pyproject` says `>=3.9`.
- **Docker:**
  - D1 (all images broken).
  - No `.dockerignore`.
  - Images run as root.
  - The API image ships `--reload` and test tools.
  - compose requires `.env.local` files that don't exist in a fresh clone.
- **CI:**
  - The root format check already fails (`tsconfig.json`).
  - Root `lint/typecheck/test/build` skip the API without saying so.
  - The ruff config is shadowed, so security and print rules never run on the API.
  - `pnpm install` isn't `--frozen-lockfile`, and the cache key ignores the lockfile.
  - `ci.yml` duplicates parts of `api.yml` and `web.yml`.
  - The rollback job runs Alembic.
- **Dependencies:**
  - No known vulnerabilities.
  - Unused: `tailwindcss-animate`, `@storybook/react`.
  - `pytest`, `pytest-asyncio` and `pytest-cov` are runtime dependencies in `pyproject`/`requirements.txt`, so they ship in the image.
  - Both `psycopg2-binary` and `psycopg[binary]` are listed.
  - `aiosqlite` is in `requirements.txt` but not in `pyproject`.
  - Major upgrade opportunities (report only, not done): Node 20 → 22 in the web Dockerfile (CI uses 22).
- **Git hygiene:**
  - `.gitignore` is good.
  - The nested lockfile in `apps/web`.
- **Docs:** stale in README, AGENTS.md, CONTRIBUTING and `database-provisioning.md` (Alembic, husky, `router.py`, `dependencies/`, `packages/shared`, Next 15, OR-Tools, "5 migrations").

## M. Files that should be refactored (prioritised)

1. `services/api/app/core/config.py`
   - **Reason:** C1, fail-open defaults, unused settings.
   - **Action:** case-insensitive settings, fail closed, drop unused fields.
2. `services/api/app/core/storage.py`, `endpoints/portal.py` (files)
   - **Reason:** C2, H8.
   - **Action:** contain the path, check permission before writing, limit size and type.
3. `services/api/app/payments/stripe_test.py`, `payments/factory.py`
   - **Reason:** C3, C4.
   - **Action:** no secret fallback, explicit stub mode.
4. `services/api/app/api/v1/endpoints/checkout.py`
   - **Reason:** C5, H1, business logic in the router.
   - **Action:** job token for ops, dev-only + owner-checked simulate, move the pay flow to `payments/checkout_service.py`.
5. `services/api/app/core/notifications/service.py`
   - **Reason:** H2.
   - **Action:** shared job-token check.
6. `services/api/app/api/v1/endpoints/auth.py`, `core/admin_auth.py`, `core/portal_auth.py`, `core/guests.py`, `api/v1/session.py`
   - **Reason:** H3, M11, import cycle, duplication.
   - **Action:** `core/auth_session.py`, trusted-proxy IP helper, sign-in rate limit, dummy hash.
7. `services/api/app/main.py`, `app/dependencies.py`, `app/core/context.py`
   - **Reason:** M1, M2, dead code, no logging setup.
   - **Action:** remove header identity, add an explicit SQL echo flag, add logging config.
8. `services/api/app/planner/{assembly,optimizer,eligibility}.py`, `schemas/planner.py`, `endpoints/planner.py`
   - **Reason:** H4, H5, H6, M6, L4.
   - **Action:** return leg, lock validation, 24:00, limits, thread pool.
9. `Dockerfiles`, `pyproject.toml`, `docker-compose.yml`
   - **Reason:** D1.
   - **Action:** working, non-root images.
10. `services/api/app/models/`, `app/alembic/`, `alembic.ini`, `.github/workflows/api.yml`
    - **Reason:** H10.
    - **Action:** delete; fix the rollback job and docs.
11. `apps/web/src/lib/catalogue-api.ts`
    - **Reason:** H9, M14, M17.
    - **Action:** no fake fallback, real coordinates, revalidate.
12. `apps/web/src/lib/*.ts` API clients
    - **Reason:** M15.
    - **Action:** one `lib/api/client.ts`.
13. `mshwar-database/tests/seed.sql` + CI
    - **Reason:** H12.
    - **Action:** fix the seed, run both suites in CI.
14. `mshwar-database/migrations/022_*.sql` (new)
    - **Reason:** M5, M12, H11 (admin bookings and single-booking lookup).
    - **Action:** a forward-only migration.
15. Docs (`README.md`, `AGENTS.md`, `.github/CONTRIBUTING.md`, `docs/database-provisioning.md`)
    - **Reason:** stale.
    - **Action:** match reality.

---

## Technical debt report

**Must fix now:**

- C1–C5 and D1
- H1–H3, H5, H6, H8, H9, H10, H12
- M1, M2 (echo), M3

**Should fix soon:**

- H4, H7, H11
- M4–M8, M10–M17, M19, M20
- the import cycle
- checkout service extraction
- response models for checkout and bookings
- the logging setup
- ruff config inheritance
- error boundaries and page titles

**Nice to improve:**

- L1–L15
- the `lib/` folder split
- root clutter and template SVGs
- repeated arbitrary Tailwind sizes
- splitting `planner-view.tsx` and `pipeline.py`
- a repository layer for portal/admin
- Redis for shared state
- M9 and M18 (product decisions)

---

## Refactor plan

Every step is small and keeps the API contracts the same, unless a security bug requires otherwise (called out below). Each step gets a test that fails first. After each phase: ruff, ruff format, mypy, pytest (API), lint, typecheck, vitest, i18n, tokens, web build.

**Phase 1: Critical (security, money, data)**

1. `config.py` reads env vars case-insensitively; fails closed with default secrets outside development; explicit `SQL_ECHO`.
2. Signed-file path containment + key format check.
3. Webhooks: no secret fallback; missing secret → 503.
4. Stub payments only with an explicit stub provider and never in production.
5. One `require_job_token` helper; used by `/checkout/ops/*`, `/notifications/dispatch`, `/escalate`; open only when `ALLOW_INSECURE_DEV_ENDPOINTS=true`.
6. `/simulate`: dev flag + owner check + allowed outcomes only.
7. Uploads: permission check first, size limit, allowed types, clean up on failure.
8. Sign-in and register rate limits; trusted-proxy client IP; dummy hash on unknown email.
9. Remove the header identity middleware and the unused DB dependencies.
10. DB error mapping: known SQLSTATEs + app `RAISE` messages keep 4xx; unknown → 500 with a generic message, logged.
11. CSV formula escaping.

_Breaking changes (needed for security):_ ops, dispatch and simulate now need a token or dev flag; tests are updated to send it.

**Phase 2: Structural and correctness**

1. `core/auth_session.py` breaks the import cycle.
2. `payments/checkout_service.py` (the pay flow moves out of the router).
3. Planner: return leg, duplicate-lock validation, `24:00` parsing, `0`-second legs, optimize limits + thread pool.
4. Web: remove the fake-data fallback (404 → `notFound`, errors → error state), real map coordinates.
5. Delete Alembic and the ORM models; fix the CI rollback job and docs.
6. Fix `seed.sql`; add the PGlite and concurrency suites to CI.
7. Docker: build backend, API/web/DB Dockerfiles, `.dockerignore`, compose.
8. Ruff config inheritance + fix what it reports; root scripts include the API.

**Phase 3: Quality**

1. `lib/api/client.ts` replaces the nine helpers; normalised errors.
2. Dead files, dependencies and settings removed; root clutter moved.
3. `error.tsx` boundaries; `proxy.ts` rename; `arrow-link` becomes a server component; Combobox copy.
4. Logging config; log inside the silent excepts; the 422 constant.
5. README / AGENTS / CONTRIBUTING / provisioning docs updated.

**Phase 4: Performance**

1. Migration `022`: indexes, `current_price_rule()`, paging for `list_admin_bookings`, direct row lookup for `portal_booking_row`.
2. Routing: batched matrix request, one shared client, failures not cached, bounded caches.
3. Web: lazy images with `srcset`; catalogue `revalidate`; saved-experiences `Set`.

**Phase 5: Testing**

1. Regression tests for every fix above (added alongside each fix).
2. Replace the tests that relied on insecure behaviour.
3. CI: frozen lockfile, DB suites, API included in root scripts.

---

## Refactor results (branch `chore/code-quality-fixes`)

### What was changed

**Phase 1: security and money**

| Finding | Change                                                                                                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1      | Settings read env vars case-insensitively. Staging/production refuse to start with a short or default `SECRET_KEY`, no `INTERNAL_JOB_TOKEN`, dev endpoints on, stub or unset payments, fault injection, or a `/tmp` storage directory. Unknown `ENVIRONMENT` values are rejected. |
| C2      | Private file keys must match the generated `YYYY/MM/<uuid>-name` shape and resolve inside the storage root. Signed tokens for any other key are refused.                                                                                                                          |
| C3      | No webhook secret fallback. A missing secret returns 503; a wrong signature returns 400.                                                                                                                                                                                          |
| C4      | The payment stub is only allowed outside production (enforced by settings validation).                                                                                                                                                                                            |
| C5      | `/checkout/{id}/simulate` needs `ENABLE_DEV_ENDPOINTS`, only touches the caller's own booking, and accepts only `succeeded`/`failed`/`cancelled`.                                                                                                                                 |
| H1, H2  | One `require_job_token` guard (`X-Job-Token`, constant-time compare) on `/checkout/ops/*`, `/notifications/dispatch` and `/escalate`.                                                                                                                                             |
| H3      | Sign-in is rate-limited per IP and per email; register per IP. Client IP comes only from trusted proxies (`TRUSTED_PROXY_COUNT`). Password hashing runs in a thread. Unknown emails still spend a hash check.                                                                     |
| H8      | Uploads check permission before touching the disk. They are limited to 10 MB and to JPEG/PNG/WebP/PDF verified by file signature, and are deleted if the database attach fails.                                                                                                   |
| M1      | Header-based identity middleware and the unused `get_db`/`get_read_db`/context helpers removed.                                                                                                                                                                                   |
| M2      | SQL echo only with `SQL_ECHO=true`.                                                                                                                                                                                                                                               |
| M3      | `app/core/sql.py` maps SQLSTATEs to safe 4xx/503 responses. Unknown errors become a logged 500 with no internal detail.                                                                                                                                                           |
| M7      | CSV cells starting with `= + - @` (or tab/CR) are escaped.                                                                                                                                                                                                                        |
| M11     | Sign-in timing no longer reveals whether an email exists.                                                                                                                                                                                                                         |
| DB      | Migration `022` revokes `EXECUTE` from `PUBLIC` on all app functions. Functions added in 019–021 had default `EXECUTE` for `PUBLIC`, so the restricted `mshwar_reader` role could call 22 `SECURITY DEFINER` functions, including payment ones.                                   |

**Phase 2: correctness and structure**

- **Planner:**
  - Return-by now includes the drive home (H5).
  - Duplicate or out-of-range locked positions are rejected (H6).
  - `24:00` closing time is understood (M6).
  - Real 0-second legs are allowed (L4).
- **Optimiser:** at most 12 stops, timeout capped at 5 s, runs in a worker thread, and coordinates are range-checked (H4).
- **Web catalogue:** sample data is used only when the API is unreachable _and_ `CATALOGUE_SAMPLE_FALLBACK` allows it; a 404 is a real 404 (H9). The map uses venue coordinates; unknown destinations get no pin (M14). API paging fields are mapped correctly.
- **Import cycle removed:** new `core/auth_session.py`, `core/client_ip.py`, `core/job_auth.py` and `core/sql.py`.
- **Pay flow and cancel preview** moved out of the router into `payments/checkout_service.py`.
- **Deleted** Alembic, the SQLAlchemy models and `alembic.ini`. The CI rollback no longer touches the database (H10, M20).
- **Database test suites:**
  - Seed data fixed; the flaky venue query fixed; the backend-path test now uses the real `commit_checkout` function.
  - Both suites run in CI (H12). The report counts migrations.
  - `SHA256SUMS.txt` refreshed.
- **Packaging and Docker:**
  - API packaging fixed: `pip install .` works; runtime and dev requirements are split.
  - Docker images rewritten: non-root users, no `--reload` in the image.
  - Web image built from the repo root with the standalone output.
  - `.dockerignore` files added.
  - Compose runs `db → migrate → api → web` (D1).
- **Tooling:**
  - Root `pnpm lint/typecheck/test` now include the API (via `services/api/package.json`).
  - The API ruff config extends the root rules, and the findings they surfaced were fixed (including the seeder's string-built SQL).
  - The seeder imports correctly and is idempotent. It already failed on a fresh database before this work.

**Phase 3: quality**

- **Shared web API client:** `lib/api/client.ts` replaced nine copies. It reads FastAPI validation errors correctly, where the old copies showed "[object Object]".
- **Removed:**
  - dead web files: `saved-view`, `lib/config`, template SVGs
  - unused packages: `tailwindcss-animate`, `@storybook/react`, `pre-commit` (npm)
  - the root `.eslintrc.js` and unused settings
- **Web package install:** `apps/web` keeps its own `pnpm-workspace.yaml` (`packages: ["."]`) and lockfile so `pnpm install` works inside it; the lockfile was refreshed to match the removed packages.
- **Next.js:**
  - `middleware.ts` renamed to `proxy.ts` (the build warning is gone).
  - Root `error.tsx` added, with en/ar/fr copy.
  - Titles added for the portal and console, with `noindex`.
  - `ArrowLink` is now a server component.
  - Duplicate call to action removed from the empty favourites page.
- **Logging:** JSON logging is configured, and the two silent fallbacks now log.
- **Deprecations and lint:** deprecated 422 constant replaced. Lint rules moved into the flat ESLint config, and the 7 lint warnings are resolved.
- **Docs:** README, AGENTS.md, CONTRIBUTING, `database-provisioning.md`, BRANCH_STRATEGY and both `.env.example` files now match the code.
- **Repository root:** BRD and prototype images moved to `docs/brd` and `docs/prototype`.

**Phase 4: performance**

- **Migration `022`:**
  - `current_price_rule()` used by catalogue, portal and planner reads (M5)
  - direct single-row `portal_booking_row`
  - paged `list_admin_bookings`
  - indexes: `payments(booking_id, created_at)`, `payments(external_id)`, `bookings(slot_id)`, `bookings(experience_id)`, `bookings(created_at, id)`, `experiences(venue_id)`, `catalogue_collection_items(experience_id)`
  - a `pg_trgm` index on the search text
  - a CHECK so range prices carry an upper bound
- **Routing:**
  - Only uncached pairs are fetched, in batched Distance Matrix calls. A 13-point matrix takes 2 requests instead of 156.
  - LRU cache bounded to 10,000 entries; failures cached for 60 s.
  - The rate limiter forgets idle keys.
- **Web:**
  - Lazy, responsive images (`srcset`, `sizes`), with no empty `src`.
  - Catalogue fetches revalidate every 60 s.
  - Saved listings use a `Set` and a raw-string snapshot.
  - Favourites sync uses one bulk request.
  - Stale async responses are ignored (search, slots, alternatives, listing editor).
- **Security headers:** CSP, HSTS, frame, referrer and permissions headers in production.

**Phase 5: tests.** The API suite grew from 213 to 263 tests and the web suite from 157 to 176, with a regression test for each fix above. The tests that relied on insecure behaviour were updated to send the job token or enable dev endpoints explicitly.

### Final quality gate

| Check                                                                     | Before                      | After                                                        |
| ------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                          | not used in CI              | pass                                                         |
| `pnpm format:check`                                                       | **fail** (`tsconfig.json`)  | pass                                                         |
| `pnpm lint` (ESLint + ruff)                                               | web 7 warnings, API skipped | pass, 0 warnings                                             |
| `pnpm typecheck` (tsc + mypy strict)                                      | web only                    | pass (103 API files)                                         |
| Web tests (vitest + axe)                                                  | 157                         | **176 pass**                                                 |
| API tests (pytest)                                                        | 213, 93.38%                 | **263 pass, 93.82%**                                         |
| Token checks / tests                                                      | pass / 20                   | pass / 20                                                    |
| i18n parity                                                               | pass                        | pass                                                         |
| `pnpm --filter web build`                                                 | pass, 1 deprecation warning | pass, no warnings                                            |
| Playwright e2e (35)                                                       | not run                     | **35 pass** (two full runs)                                  |
| PGlite schema suite                                                       | **fail**                    | **52 pass**                                                  |
| Last-seat concurrency test                                                | **fail**                    | pass                                                         |
| Migrations applied twice                                                  | pass (21)                   | pass (22)                                                    |
| `pip install .`                                                           | **fail**                    | pass                                                         |
| API starts with runtime deps only; `/health`, `/api/v1/health`, ops → 401 | not checked                 | pass                                                         |
| Web standalone server serves `/` and `/experiences`                       | not checked                 | pass                                                         |
| `pip-audit`, `pnpm audit --prod`                                          | clean                       | clean                                                        |
| Docker image builds                                                       | broken                      | not run here (registry blocked); every step replayed by hand |

### Not changed (need a decision or are out of scope)

- **M9:** the real LLM provider is still a stub.
- **M10:** the mailer still only logs.
- **M18:** the two booking systems.
- **M2:** the API still connects as `postgres`. Switching to `mshwar_backend` needs a grants review.
- **M4:** the provider-timeout handling.
- **M8:** Redis-backed shared caches.
- **Structure:** the `lib/` folder split; splitting `planner-view.tsx` and `pipeline.py`.
- **Types:** typed response models for the 135 untyped endpoints; generated TypeScript API types (new dependency).
- **Favourites** still render card details from the bundled sample catalogue. Listings that aren't in it show only their slug; a favourites endpoint that returns listing details would fix this.
- **CSP** still allows `'unsafe-inline'` scripts until nonces are wired.
