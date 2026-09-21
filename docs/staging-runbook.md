# Staging runbook

How to stand up the staging environment Mshwar deploys to. Follow it once; after that the
`Deploy API to Staging` job in `.github/workflows/api.yml` does the work on every push to `main`.

Staging deliberately runs the same compose stack as local development, so the role model, the
`SECURITY DEFINER` functions and the connection layer behave identically in both. See
`docs/database-provisioning.md` for why the database is self-hosted rather than managed.

## 1. The box

One VPS is enough to begin with.

| Item           | Minimum          | Note                                                      |
| -------------- | ---------------- | --------------------------------------------------------- |
| RAM            | 4 GB             | Postgres with PostGIS and pgvector, Redis, two containers |
| Disk           | 40 GB SSD        | Postgres data, Docker images, backups                     |
| OS             | Ubuntu 24.04 LTS | Anything that runs Docker Engine is fine                  |
| Docker Compose | 2.24 or newer    | `docker-compose.staging.yml` uses the `!override` tag     |

Point a hostname at it (`staging-api.<your-domain>`) before starting, so TLS can be issued.

## 2. Lock the box down first

```bash
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Postgres, Redis and the API are **not** published to the host by the staging override — they are
reachable only inside the compose network, and the reverse proxy is the single way in. Do not open
5432 or 6379.

Create an unprivileged deploy user with its own SSH key. That key's private half becomes the
`STAGING_SSH_KEY` secret; nothing else should use it.

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
```

## 3. Clone into the path the workflow expects

The deploy job does `cd /opt/mshwar`. That path is not configurable without editing the workflow.

```bash
install -d -o deploy -g deploy /opt/mshwar
sudo -u deploy git clone https://github.com/abdalrahmanhajjo/mshwar.git /opt/mshwar
```

## 4. Write the environment file

`/opt/mshwar/.env`, owned by `deploy`, mode `600`, never committed. Start from `.env.example` — it
declares 53 variables — and set every one that staging needs. The four the compose override refuses
to start without:

```
POSTGRES_USER=mshwar_owner
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=mshwar
MSHWAR_API_USER=mshwar_api
MSHWAR_API_PASSWORD=<generated>
```

Also required in a deployed environment, per the security review:

| Variable                              | Why                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `REDIS_URL`, `RATE_LIMIT_STORE=redis` | Rate limits and the AI spend ceiling must be shared, not per-process (SR-07)  |
| `PUBLIC_WEB_ORIGIN`                   | Must be `https://…`; the cross-site request guard checks it (SR-03)           |
| `NEXT_PUBLIC_LEGAL_REVIEWED=true`     | Legal review completed 18 Sep 2026; without this the draft notice still shows |
| `SENTRY_DSN`                          | AC-15 cannot be demonstrated until Sentry reports from a deployed environment |

Generate secrets with `openssl rand -base64 32`. Record where each lives; `docs/KEY_ROTATION.md`
covers rotating them.

Compose reads this file for `${VAR}` interpolation **and** passes it into the API container, because `docker-compose.staging.yml` declares it under `env_file`. A variable that is only listed under a service's `environment:` block is not enough on its own — the staging config validator will reject the boot and name the missing setting.

## 5. Bring up the database and create the restricted role

The API must **not** connect as the database owner. `mshwar_api` is a login role that only inherits
`mshwar_backend`, and the API refuses to start in staging or production otherwise (SR-02).

```bash
cd /opt/mshwar
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d db
docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Run the migrations first — they create `mshwar_backend` — then the login role:

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml run --rm migrate

docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "
  CREATE ROLE mshwar_api LOGIN PASSWORD '<MSHWAR_API_PASSWORD>'
    NOSUPERUSER NOBYPASSRLS INHERIT;
  GRANT mshwar_backend TO mshwar_api;"
```

This is the same shape CI uses in `backend-test`, which is why the test suite exercises row-level
security on every pull request.

Confirm the role cannot bypass RLS — if this returns `t`, stop and fix it:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
  "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'mshwar_api';"
```

## 6. Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
docker compose ps
```

## 7. Terminate TLS

Put Caddy or nginx in front, terminating TLS for `staging-api.<your-domain>` and proxying to the
`api` container on port 8000. The API reads client addresses through `TRUSTED_PROXY_COUNT`; set it
to the number of proxies actually in front of it, or rate limits will key on the wrong address.

## 8. Turn deploys on

In the repository settings:

1. Add a variable `DEPLOY_ENABLED` = `true`. Until this is set, the API deploy jobs are skipped
   rather than reporting a success they did not perform.

   Each deploy target has its own switch, so turning one on does not enable the others:

   | Variable                    | Enables                                | Also needs                                                                            |
   | --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
   | `DEPLOY_ENABLED`            | API deploy to staging                  | The four `STAGING_*` secrets below                                                    |
   | `DEPLOY_WEB_ENABLED`        | Vercel preview, staging and production | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PRODUCTION_WEB_URL`            |
   | `DEPLOY_PRODUCTION_ENABLED` | API deploy to production, and rollback | The `PRODUCTION_*` secrets, and a production compose override that does not yet exist |

2. Add secrets to the `staging` environment: `STAGING_API_URL` (e.g.
   `https://staging-api.<your-domain>`), `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`.
3. Leave `production` unconfigured for now. With `DEPLOY_ENABLED` on, an unset production secret
   fails the job loudly, which is the intended behaviour once you are ready to use it.

Push to `main` and watch `Deploy API to Staging`. It pulls, rebuilds, runs migrations, restarts the
API and polls `/health` ten times before giving up.

## 9. Verify

| Check                            | How                                                                             | Satisfies    |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------ |
| API is up                        | `curl -fsS https://staging-api.<domain>/health`                                 | Deploy gate  |
| Connected as the restricted role | `SELECT current_user;` from inside the API                                      | SR-02        |
| Rate limits are shared           | Exceed a limit, confirm `Retry-After` and `RateLimit` headers                   | SR-07        |
| Sentry receives errors           | Trigger a controlled error, confirm it arrives with a request id and no secrets | AC-15, SR-09 |
| Legal notice is gone             | Load `/terms`; the draft banner should not appear                               | SR-19        |

## 10. Backups before anything real exists

Migrations are forward-only and are never rolled back automatically. A bad migration is fixed
forward or restored from a backup, and that decision is made by a person.

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > /opt/mshwar/ops/db-backups/$(date +%F).sql.gz
```

Put that on a daily timer, copy the output off the box, and restore one before you trust it. An
untested backup is not a backup.

## Known gap

This is a single machine: no replication, no failover, and a reboot is downtime. That is an
acceptable trade for staging and an early pilot, and it is the reason
`docs/database-provisioning.md` leaves managed Postgres open for after launch.
