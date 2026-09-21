# Platform KPI metric definitions

Sourced by `GET /api/v1/admin/kpis` (`app.admin_metric_definitions`) and shown as tooltips on `/admin`.

| Key                                | Definition                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `users`                            | Count of `app.users` created in the selected window, excluding deleted.                                                |
| `businesses`                       | Count of `app.organizations` created in the window.                                                                    |
| `verified_businesses`              | Organisations whose `verification = verified` at query time. The verified badge is only set by admin approval.         |
| `bookings`                         | Count of `app.bookings` created in the window.                                                                         |
| `confirmed_bookings`               | Bookings currently confirmed that were created in the window.                                                          |
| `open_cases`                       | Support cases in `open` or `investigating`.                                                                            |
| `case_backlog_hours`               | Mean age in hours of open/investigating cases.                                                                         |
| `open_quality_issues`              | Open `data_quality_issues` rows.                                                                                       |
| `planner_success_rate`             | Share of `recommendation_runs` with status `succeeded`. `0` / source `stub` when the planner has not run.              |
| `planner_infeasible_rate`          | Share of runs with status `infeasible`.                                                                                |
| `planner_fallback_rate`            | Share of runs with status `fallback`.                                                                                  |
| `outbox_depth`                     | Pending `app.outbox` rows (`processed_at` and `dead_lettered_at` null). Exposed on `GET /api/v1/checkout/ops/metrics`. |
| `outbox_failed`                    | Pending outbox rows with `last_error_code` set.                                                                        |
| `outbox_dead_lettered`             | Outbox rows moved to the DLQ after 8 publish attempts.                                                                 |
| `notification_email_delivery_rate` | `sent / (sent + failed)` for the email channel in the window. Stubbed adapter outcomes count as sent.                  |
| `notification_email_failure_rate`  | `failed / (sent + failed)` for the email channel.                                                                      |
| `notification_dead_letters`        | Notifications that exhausted 8 attempts and sit in the DLQ (at query time).                                            |

Event semantics: counts use row `created_at` in the requested `[from, to)` window unless the definition says "at query time". Planner rates use `recommendation_runs.status` only — the API never invents generation outcomes. Notification rates never invent provider outcomes.
