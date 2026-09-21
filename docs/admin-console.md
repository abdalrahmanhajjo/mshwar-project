# Admin console (Epic 6)

Operations surface for verification, moderation, taxonomy, bookings, configuration, health, support and data quality. Every mutating action requires a reason and is written to `app.audit_log`.

## Environment

| Variable                                         | Default | Notes                                                                                             |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| `SEARCH_REINDEX_PROVIDER`                        | `stub`  | Taxonomy changes enqueue `taxonomy_reindex` outbox events. No networked search cluster is called. |
| `DATA_QUALITY_SCHEDULER_ENABLED`                 | `false` | Leave unset/false in CI. Operators cron `POST /api/v1/admin/quality/run`.                         |
| `DATA_QUALITY_STALE_DAYS`                        | `14`    | Documented threshold; SQL currently uses a 14-day stale-availability window.                      |
| `IMAGEKIT_PRIVATE_KEY` / `IMAGEKIT_URL_ENDPOINT` | empty   | Empty keeps private local storage for verification documents.                                     |
| `STRIPE_SECRET_KEY`                              | empty   | Never returned on booking inspection. Payments expose provider + `external_id` only.              |

Deploy skip-when-unset for staging/production is unchanged.

## Live-safe configuration

These keys can be changed from `/admin/settings` without a deploy:

- `marketplace.fees` — `{ commission_bps, service_fee_minor, currency }`
- Feature flags — per `environment` (`development` / `staging` / `production` / `all`) and `cohort`

Rollback writes a new version that copies the previous value (one action). Do not put secrets in configuration values.

## Privilege model

- `ops` — verification, moderation, taxonomy, inspection, cases, quality, non-financial config
- `elevated` — grant/revoke admin roles; force-cancel; mark refunded; resend confirmation
- Admin cannot be self-granted. Bootstrap remains SQL `app.grant_platform_admin` for tests and break-glass.

Admin sessions record actor, IP and duration. `/admin` is hidden and blocked for non-admins.

## Notification health (Epic 10)

`/admin/notifications` reads `GET /api/v1/admin/notifications/health`. Failures, dead letters and per-channel rates are listed there. Resend writes `audit_log.action = notification_resend` and does not touch booking or payment rows.

Cron `POST /api/v1/notifications/dispatch` and `POST /api/v1/notifications/escalate`. See `docs/notifications.md`.
