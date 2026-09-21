# Audit log

Story: MSHWAR-109 · Code: `mshwar-database/migrations/023_audit_log.sql`, `services/api/app/api/v1/endpoints/admin.py`, `apps/web/src/components/admin/audit-log-view.tsx`

## What is recorded

Every consequential change writes one row to `app.audit_log`:

| Field                      | Meaning                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `actor_id`                 | who did it (from the `app.actor_id` setting the API sets for each request)            |
| `action`                   | what happened, for example `booking.cancel`, `verification_approve`, `users.UPDATE`   |
| `target_type`, `target_id` | what it happened to                                                                   |
| `organization_id`          | the business involved, when there is one                                              |
| `changes`                  | which fields changed; values only for non-personal state fields (status, role, flags) |
| `reason`                   | the reason given, when the action needs one                                           |
| `request_id`               | the request that caused it, so the row can be matched to logs and Sentry              |
| `created_at`               | when                                                                                  |

Two sources feed it:

- **Explicit calls** to `app.write_audit(...)` from functions that make important decisions (moderation, verification, refunds, admin grants, password resets, privacy actions).
- **A generic trigger** (`app.audit_change`) on the other consequential tables: users, catalogue collections, feature flags, weather thresholds, ranker weights, staff invitations, support cases, media, verification documents, review responses and reports, trip share links, reconciliation items, notification settings, blackouts and moderation events.

Personal data (names, emails, phone numbers, free text) is never copied into `changes`; only the field name is recorded.

## It can't be changed

- `UPDATE`, `DELETE` and `TRUNCATE` on `audit_log` are refused by triggers, for everyone.
- The API's database role has no direct access to the table. It can only add rows through the audit functions and read them through `app.admin_search_audit`.

## Searching

Admins open **Admin → Audit log** (`/admin/audit`). Filters: action, actor, target type and id, business, request id, and a date range. Results are newest first, 50 per page (up to 200 through the API), with "load more" paging.

API: `GET /api/v1/admin/audit` and `GET /api/v1/admin/audit/filters` (admin only).

## Retention

Audit rows are kept for as long as they are needed to account for important actions (see the privacy policy). Deleting them needs a deliberate migration run by the database owner; the application can't.

## Tests

- `services/api/tests/test_audit_coverage.py`: each audited action writes a row with actor, target and request id; rows can't be edited or deleted; personal values are not copied.
- `mshwar-database/tests/integration.mjs`: append-only guarantees on the embedded database.
