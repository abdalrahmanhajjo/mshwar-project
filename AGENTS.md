# Mshwar - Project Agent Notes

## Architecture

Monorepo (pnpm workspace):

- **apps/web** — Next.js 16 (App Router, React 19), TypeScript strict, Tailwind CSS v4, shadcn/ui.
  Routes in `src/app`, UI by domain in `src/components`, API calls through `src/lib/api/client.ts`,
  copy catalogues (en/ar/fr) in `src/lib/*-copy.ts`, locale routing in `src/proxy.ts`.
- **services/api** — FastAPI, Pydantic v2, SQLAlchemy 2 (async engine, raw SQL only; no ORM models).
  Routers in `app/api/v1/endpoints`, shared helpers in `app/core`, domains in `app/planner`,
  `app/payments`, `app/catalogue`.
- **mshwar-database** — the only schema source: forward-only SQL migrations (`migrations/NNN_*.sql`),
  checksum-verified runner, PGlite and native concurrency test suites.
- **mshwar-brand-foundation** — design tokens (JSON) → generated CSS/Tailwind/Figma files.

Business rules for bookings, payments, portal and admin live in PostgreSQL `SECURITY DEFINER`
functions that take the signed-in user id explicitly. Routers authenticate the session, validate input,
call those functions through `app.core.sql.fetch_json`, and map errors with `raise_from_db`.

## Technology choices (BRD S23)

- **Database**: PostgreSQL 17 + PostGIS + pgvector + btree_gist + pg_trgm
- **AI**: LLM for language only; facts come from the database. The trip builder currently runs a
  deterministic stub client (`app/planner/llm.py`); the route optimiser is an exact Held-Karp solver
  (≤ 12 stops), not OR-Tools.
- **Maps**: Google Maps Platform (Distance Matrix, batched); Haversine stub without a key
- **Weather**: Open-Meteo (prototype)
- **Payments**: provider abstraction; Stripe test adapter; stub only in development/test
- **Images**: ImageKit planned; local private storage today

## Key constraints

1. **Lebanon Stripe constraint**: Lebanon is not on Stripe's global availability page. Keep payments behind
   the provider abstraction; a licensed acquirer must be selected for production.
2. **Python 3.11** everywhere (Docker, CI, ruff, mypy). Use `X | None` and keep `from __future__ import annotations`.
3. **Structured facts over LLM**: the AI never invents businesses, prices, availability or payment outcomes,
   and the web never shows sample listings as real (see `CATALOGUE_SAMPLE_FALLBACK`).
4. **Settings fail closed**: staging/production refuse to start with default secrets, dev endpoints,
   stub payments or fault injection (`app/core/config.py`).
5. **Internal jobs** (`/checkout/ops/*`, `/notifications/dispatch|escalate`) need the `X-Job-Token` header.
   Test-only endpoints need `ENABLE_DEV_ENDPOINTS=true`, which is refused outside development/test.
6. **Migrations are never edited after they are applied.** Add the next number and refresh
   `mshwar-database/SHA256SUMS.txt`.

## Development commands

```bash
pnpm install                                    # web + tooling
pip install -r services/api/requirements-dev.txt  # API (Python 3.11)

docker compose up --build   # db → migrate → api (:8000) → web (:3000)

pnpm --filter web dev       # web only
pnpm --filter api dev       # API only (needs DATABASE_URL)
pnpm --filter api migrate   # apply SQL migrations

pnpm lint                   # ESLint + ruff
pnpm typecheck              # tsc + mypy
pnpm test                   # vitest + token tests + pytest (needs a migrated database)
pnpm format:check           # Prettier
pnpm i18n:check && pnpm tokens:check
pnpm db:test                # PGlite schema suite
```

## Testing

- Web: `pnpm --filter web test` (vitest + axe); e2e: `pnpm --filter web test:e2e`
- API: `DATABASE_URL=... pnpm --filter api test` against a database migrated with `pnpm --filter api migrate`
- Database: `pnpm db:test`; last-seat race: `DATABASE_URL=<empty db> python mshwar-database/tests/concurrency.py`

## Ports

| Service       | Port      |
| ------------- | --------- |
| Web (Next.js) | 3000      |
| API (FastAPI) | 8000      |
| API Docs      | 8000/docs |
| PostgreSQL    | 5432      |

## Important files

- `services/api/.env.example` — every API setting, with comments
- `.env.example` — web and shared settings
- `docker-compose.yml` — local stack
- `services/api/app/core/config.py` — settings and environment validation
- `services/api/app/core/sql.py` — SQL function calls and DB error mapping
- `services/api/app/core/auth_session.py` — session loading for routers
- `mshwar-database/scripts/migrate.py` — checksum-verified SQL migration runner
- `docs/code-review-report.md`, `docs/code-quality-audit.md` — audit findings and refactor plan
