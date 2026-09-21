# Mshwar — Phase 1 milestone

AI-Powered Lebanon Trip & Experience Platform — discover and plan Lebanon.

This repository is the **Phase 1 milestone** of Mshwar: the traveller-facing
product. It is a self-contained, runnable slice of the full platform, derived
from the complete implementation at
[abdalrahmanhajjo/mshwar](https://github.com/abdalrahmanhajjo/mshwar).

## What Phase 1 contains

| Area | Included |
| --- | --- |
| Foundation & platform setup | Monorepo, database, migrations, seed toolkit, CI gates |
| Design system & UI foundation | Brand tokens, component library, responsive traveller shell |
| Accounts, identity & preferences | Registration, sign-in, recovery, email verification, profile, account hub, data export and deletion |
| Catalogue, search & discovery | Businesses, experiences, categories, media, browse, search, map, listing detail, favorites, collections |
| Maps, routing & weather | Travel-time routing, start-location picker, multi-stop optimisation, forecasts and weather warnings |
| Trip builder | Intent extraction, candidate retrieval, eligibility, ranking, itinerary assembly and costing, manual builder, versioning |
| Localization, RTL & accessibility | en / ar / fr catalogues, Arabic RTL, WCAG 2.2 AA |
| Security, privacy & trust | Per-endpoint authorisation, audit log, rate limiting, log scrubbing, consent and policy flows |

## What Phase 2 will add

Business portal · admin, moderation and operations console · availability,
booking and payments · notifications and messaging · group planning and
reviews · weather-driven replanning · the remaining evaluation, performance
and production-pilot work.

Phase 2 features are not disabled behind flags — their routes, endpoints,
components and tests are simply not present in this repository.

### Database note

The schema is kept whole: all 29 migrations are applied as-is. The core
schema migration (`001_schema.sql`) creates the booking, payment, review and
group tables, and the Phase 1 integrity, security and row-level-security
migrations (`002`–`006`) already reference them. Removing those tables would
break migrations that Phase 1 depends on, so they are retained as shared
dependencies and simply carry no rows in this milestone.

[![CI](https://github.com/mshwar/mshwar/actions/workflows/ci.yml/badge.svg)](https://github.com/mshwar/mshwar/actions/workflows/ci.yml)

## Repository layout

```
apps/web                   Next.js 16 web app (traveller surface)
services/api               FastAPI service (auth, catalogue, planner, profile, privacy)
mshwar-database            Canonical PostgreSQL schema: forward-only SQL migrations + tests
mshwar-brand-foundation    Design tokens (JSON) and generated Tailwind / CSS / Figma files
docs/                      Feature docs, audits, BRD and prototype screenshots
docs/security/             Security, privacy and trust (start with docs/security/README.md)
backlog/                   Product backlog exports
```

## Tech stack

| Layer    | Technology                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| Web      | Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui, vitest |
| API      | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 (async, SQL functions), pytest             |
| Database | PostgreSQL 17 + PostGIS + pgvector + btree_gist + pg_trgm                                  |
| Planner  | Deterministic stub LLM client, exact route optimiser (≤ 12 stops), Open-Meteo weather      |
| Maps     | Google Distance Matrix (batched) or a Haversine stub without a key                         |

## Prerequisites

- Node.js 22 and pnpm 11 (`corepack enable`)
- Python 3.11
- Docker with Compose v2 (for the one-command setup), or PostgreSQL 17 with PostGIS and pgvector

## Quick start (Docker)

```bash
pnpm install
docker compose up --build
```

This starts PostgreSQL and Redis, applies the SQL migrations, then runs the API on http://localhost:8000
(docs at `/docs`) and the web app on http://localhost:3000. The API runs with
`ENVIRONMENT=development` and dev endpoints enabled; optional overrides go in
`services/api/.env` and `apps/web/.env.local` (both git-ignored).

## Running without Docker

```bash
# 1. Database: an empty PostgreSQL 17 database with PostGIS and pgvector available
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar

# 2. API
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r services/api/requirements-dev.txt
cp services/api/.env.example services/api/.env    # then adjust
pnpm --filter api migrate                          # apply mshwar-database/migrations
pnpm --filter api dev                              # http://localhost:8000

# 3. Web
pnpm install
pnpm --filter web dev                              # http://localhost:3000
```

Seed Lebanon sample inventory with `pnpm --filter api seed` (see `services/api/scripts/seed.py --help`).

## Configuration

Every API setting is listed with comments in `services/api/.env.example`; web settings are in
`.env.example`. Names are case-insensitive. The most important ones:

| Variable                                      | Purpose                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`                                 | `development`, `test`, `staging` or `production`. Deployed environments fail closed.                |
| `DATABASE_URL`                                | PostgreSQL URL (`postgresql+asyncpg://…`)                                                           |
| `SECRET_KEY`                                  | Signs private file links; ≥ 32 characters in staging/production                                     |
| `INTERNAL_JOB_TOKEN`                          | `X-Job-Token` for cron/worker endpoints; required in staging/production                             |
| `ENABLE_DEV_ENDPOINTS`                        | Payment simulation and fault injection; refused in staging/production                               |
| `TRUSTED_PROXY_COUNT`                         | Reverse proxies in front of the API, used to read the client IP for rate limits                     |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Required in production; webhooks are rejected without the secret                                    |
| `GOOGLE_MAPS_API_KEY`                         | Distance Matrix; without it routing uses the Haversine stub                                         |
| `PRIVATE_STORAGE_DIR`                         | Uploaded documents and images (persistent path in production)                                       |
| `NEXT_PUBLIC_API_URL`                         | API base URL used by the web server and the `/api` rewrite                                          |
| `CATALOGUE_SAMPLE_FALLBACK`                   | Web: show the bundled sample catalogue when the API is down (default: on in dev, off in production) |

Staging and production refuse to start with default secrets, dev endpoints, stub payments or fault
injection. Secrets come from the platform secret store; never commit `.env` files.

## Database

The schema lives only in `mshwar-database/migrations` (forward-only, checksum-verified; see
`mshwar-database/README.md`). Apply with `pnpm --filter api migrate`. To change the schema, add the next
numbered file and refresh `mshwar-database/SHA256SUMS.txt`; never edit an applied migration.
Rollbacks are fix-forward migrations or restores (see `docs/database-provisioning.md`).

## Quality checks

```bash
pnpm lint            # ESLint (web) + ruff (API)
pnpm typecheck       # tsc + mypy
pnpm test            # vitest + token tests + pytest (needs DATABASE_URL on a migrated database)
pnpm format:check    # Prettier (ruff format runs inside `pnpm lint`)
pnpm i18n:check      # en/ar/fr catalogue parity
pnpm tokens:check    # generated design tokens are up to date
pnpm db:test         # PGlite schema invariant suite
pnpm --filter web build
pnpm --filter web test:e2e   # Playwright (uses the sample catalogue)
```

Pre-commit hooks (`pre-commit install`) run the same formatters, linters and type checks.
CI runs everything above in `.github/workflows/{ci,web,api}.yml`, plus the last-seat concurrency test
(`mshwar-database/tests/concurrency.py`) against a real PostgreSQL service.

## Where things live

| Concern                   | Location                                                            |
| ------------------------- | ------------------------------------------------------------------- |
| Web routes                | `apps/web/src/app` (`(traveller)`, `business`, `admin`)             |
| Web API calls             | `apps/web/src/lib/api/client.ts` + one module per domain in `lib/`  |
| Translations              | `apps/web/src/lib/*-copy.ts`, `apps/web/src/lib/messages.ts`        |
| API routes                | `services/api/app/api/v1/endpoints/`, registered in `api_router.py` |
| Settings                  | `services/api/app/core/config.py`                                   |
| Sessions / auth helpers   | `services/api/app/core/auth_session.py`, `admin_auth.py`            |
| Database calls and errors | `services/api/app/core/sql.py`                                      |
| Booking & payment rules   | SQL functions in `mshwar-database/migrations` + `app/payments/`     |
| Trip planner              | `services/api/app/planner/`                                         |
| External providers        | `app/planner/routing.py` (maps), `weather.py`, `app/payments/*`     |

To add an API endpoint: add a router module in `app/api/v1/endpoints/`, register it in
`app/api/v1/api_router.py`, and add tests in `services/api/tests/`.

## Commit convention

[Conventional Commits](https://conventionalcommits.org/): `feat`, `fix`, `docs`, `refactor`, `perf`,
`test`, `build`, `ci`, `chore`. Example: `feat(planner): add weather-aware replanning`.

## License

Internal use only — Mshwar Project Team.
