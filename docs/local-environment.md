# Local environment files

The local configuration uses these files. They contain development settings and
must remain Git-ignored.

| File                      | Used by                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `.env`                    | Docker Compose variable substitution; also contains the complete local settings reference. |
| `services/api/.env`       | FastAPI settings when started from `services/api`, and Docker Compose's API environment.   |
| `apps/web/.env.local`     | Next.js local configuration and Docker Compose's web environment.                          |
| `mshwar-database/.env`    | Optional shell-loaded connection for standalone database tools.                            |
| `services/api/.env.local` | Compatibility copy for older setup instructions; the API does not load it automatically.   |

Keep shared database settings and API secrets consistent when editing the root and
API files. Keep the API compatibility copy in sync if you still use it. Docker
Compose overrides the API database and Redis hosts with container service names;
local shell commands use `localhost`.

The current local files include generated signing and internal-job secrets.
External service credentials are empty until supplied. Development uses the
configured routing, planner, payment, email, and storage fallbacks. Bundled sample
catalogue fallback is disabled in the web configuration.

## Start the local stack

From the repository root:

```sh
docker compose up --build
```

Compose starts PostgreSQL and Redis and applies the migrations before the API starts.

## Run migrations without Docker Compose

The migration runner reads `DATABASE_URL` from the process environment. It does not
automatically load an environment file. With the local database running, from the
repository root:

```sh
set -a
. ./mshwar-database/.env
set +a
pnpm --filter api migrate
```

Use Python 3.11 with the API development dependencies installed. Native concurrency
tests require a separate empty test database; do not point them at this development
database.

## Staging and production

Staging and production use the deployment platform's secret store. They need actual
database connections, site origins, service credentials, and deployment-specific
settings. Local files do not configure those deployments. A file named
`services/api/.env.staging` or `services/api/.env.production` is not automatically
loaded by the API; the deployment must explicitly supply its environment variables.
