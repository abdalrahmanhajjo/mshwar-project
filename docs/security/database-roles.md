# Database roles

Story: MSHWAR-108 · Code: `mshwar-database/migrations/004_security.sql`, `024_authorisation.sql`, `services/api/app/core/db_role.py`

## Roles

| Role                           | Login | Used by                           | Rights                                                           |
| ------------------------------ | ----- | --------------------------------- | ---------------------------------------------------------------- |
| owner (for example `postgres`) | yes   | migrations only                   | everything                                                       |
| `mshwar_backend`               | no    | granted to the API login role     | row-level-security policies and `EXECUTE` on the API's functions |
| `mshwar_reader`                | no    | read-only tooling                 | read-only access to the caller's own rows                        |
| `mshwar_api`                   | yes   | the API in staging and production | member of `mshwar_backend`, nothing else                         |

`mshwar_api` must **not** be a superuser, must **not** have `BYPASSRLS`, and must inherit `mshwar_backend`.
In staging and production the API checks this at start-up (`check_database_role`) and refuses to start if it's wrong.

## Creating the login role

Run once per database, as the owner, after the migrations:

```sql
CREATE ROLE mshwar_api LOGIN PASSWORD '<from the secret store>' NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT mshwar_backend TO mshwar_api;
```

Then point the API at it:

```bash
DATABASE_URL=postgresql+asyncpg://mshwar_api:<password>@<host>:5432/mshwar
```

Keep using the owner account for `scripts/migrate.py`.

## Why it matters

The API reads and writes through `SECURITY DEFINER` functions that check the caller.
Direct table access by the API role is limited by row-level security, and the audit log can't be read or changed by it at all.
If the API connected as a superuser, all of that would be silently skipped.

## Tests

CI runs the whole API test suite as `mshwar_api` (see `.github/workflows/api.yml`):

```bash
DATABASE_URL=postgresql+asyncpg://mshwar_api:mshwar_api@localhost:5432/mshwar_test \
TEST_ADMIN_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mshwar_test \
PYTHONPATH=. python -m pytest tests/
```

`TEST_ADMIN_DATABASE_URL` is only for test fixtures that need to set up data directly. Leave it empty outside tests.
