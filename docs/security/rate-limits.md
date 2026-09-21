# Rate limits and cost ceilings

Owner: platform · Story: MSHWAR-110 · Code: `services/api/app/core/rate_limit.py`, `services/api/app/planner/budget.py`

## How limits work

- **Sliding window.** Each rule counts hits in a sliding window.
- **Two allowances per rule:**
  - an _anonymous_ allowance, keyed by client IP;
  - a _signed-in_ allowance, keyed by account.
  - Signed-in callers are identified before the limit is applied, so a forged cookie gets the anonymous allowance.
- **Client IP** is the entry added by the outermost trusted proxy (`TRUSTED_PROXY_COUNT`). The rest of `X-Forwarded-For` is ignored.
- **Store:**
  - `RATE_LIMIT_STORE=redis` (required in staging and production) keeps counters in Redis (`REDIS_URL`), shared by every API worker.
  - `memory` keeps them per process (development and tests).
  - If Redis is unreachable, the API falls back to per-process counters for 30 seconds at a time rather than failing requests or switching limits off.
- **Email keys** (sign-in, reset, verification) are hashed before they reach the store.
- **Rejections** return `429` with:
  - body: `{"detail": "Too many requests. Please wait and try again.", "code": "rate_limited", "request_id": "…"}`;
  - headers: `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`.
  - The response is identical whether or not an account exists.

## Rules

| Rule                | Anonymous (per IP)                                           | Signed in (per account)                             | Applied to                                                                                                     |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `auth-register`     | `REGISTER_IP_LIMIT` (30) / `RATE_LIMIT_WINDOW_SECONDS` (1 h) | –                                                   | `POST /auth/register`                                                                                          |
| `auth-signin-ip`    | `SIGNIN_IP_LIMIT` (100) / 15 min                             | –                                                   | `POST /auth/signin`                                                                                            |
| `auth-signin-email` | `SIGNIN_EMAIL_LIMIT` (10) / 15 min per email                 | –                                                   | `POST /auth/signin`                                                                                            |
| `auth-reset-ip`     | `FORGOT_IP_LIMIT` (20) / 1 h                                 | –                                                   | `POST /auth/forgot-password`, `POST /auth/reset-password`                                                      |
| `auth-reset-email`  | `FORGOT_EMAIL_LIMIT` (5) / 1 h per email                     | –                                                   | `POST /auth/forgot-password`                                                                                   |
| `auth-verify-ip`    | `VERIFY_IP_LIMIT` (20) / 1 h                                 | –                                                   | `POST /auth/resend-verification`                                                                               |
| `auth-verify-email` | `VERIFY_EMAIL_LIMIT` (3) / 1 h per email                     | –                                                   | `POST /auth/resend-verification`                                                                               |
| `search`            | 60 / min                                                     | 120 / min                                           | Catalogue browse and search, businesses, public reviews, slots, quotes                                         |
| `ai-generate`       | –                                                            | 20 / 10 min                                         | `POST /planner/sessions`, `…/clarify`, `…/refine`, `…/regenerate`                                              |
| `maps`              | –                                                            | 90 / 10 min                                         | Planner route, optimise, weather, warnings, replan; location autocomplete and reverse lookups (paid providers) |
| `booking`           | –                                                            | 30 / 10 min                                         | Checkout draft, commit, inquiry, pay, cancel; booking create and cancel                                        |
| `booking-ip`        | 120 / 10 min                                                 | –                                                   | Every booking write, regardless of account (stops account farms behind one IP)                                 |
| `token-link`        | 30 / 10 min                                                  | –                                                   | Share links, unsubscribe links, signed file links, password reset and email verification submissions           |
| `community-write`   | –                                                            | 30 / h                                              | Reviews, review reports, group suggestions and votes                                                           |
| `upload-org`        | –                                                            | `UPLOAD_ORG_HOURLY_LIMIT` (60) / h per organisation | `POST /portal/organizations/{id}/files` (counted only after the caller's permission is confirmed)              |

Every route's rule is declared next to its access policy in `services/api/app/api/v1/endpoints/*.py`. `tests/test_abuse_controls.py` fails if a rule in `RULES` is missing from this table.

## AI generation cost ceiling

- **What is charged.** Each generation request is charged `AI_REQUEST_COST_USD` (default $0.01) **before** the model runs.
- **Ceilings** (0 disables either one):
  - `AI_USER_DAILY_BUDGET_USD` (default $0.25, which is 25 generations) per traveller per Asia/Beirut calendar day;
  - `AI_GLOBAL_DAILY_BUDGET_USD` (default $50) for the whole platform per day.
- **How the charge is taken.**
  - It commits in its own short transaction (`app.consume_ai_budget`), so concurrent generations never queue behind each other.
  - It is kept even if the generation fails, so retries are not free.
- **What the traveller sees.**
  - At their own ceiling: `429` with `code: ai_quota_exceeded`, "You've reached today's AI planning limit. It resets at midnight Beirut time." and `Retry-After` until midnight.
  - At the platform ceiling: `429` with `code: ai_capacity_reached`, "AI planning is busy right now. Please try again later."
  - The planner shows both messages in the traveller's language.
  - `GET /api/v1/planner/quota` returns the requests used today, the requests remaining and the reset time.
- **Tuning.** Set `AI_REQUEST_COST_USD` to the real per-request cost of the configured model (tokens × price) once a live model replaces the stub.

## Metrics and alerting

- **Endpoint.** `GET /api/v1/health/metrics` (header `X-Job-Token`) exports Prometheus counters:
  - `mshwar_rate_limit_checks_total{rule}`
  - `mshwar_rate_limit_rejections_total{rule}`, which includes `ai-budget-user` and `ai-budget-platform`
  - `mshwar_rate_limit_store_failures_total`
- **Logs.** Every rejection is also logged at `WARNING` as `rate limit exceeded`, with the rule name and never the key.
- **Alert rules:** [`ops/alerts/rate-limits.yml`](../../ops/alerts/rate-limits.yml).

| Alert                | Condition                                 | Meaning                                                       |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `SigninBruteForce`   | `auth-signin-*` rejections > 50 in 10 min | Credential stuffing or a broken client                        |
| `TokenLinkGuessing`  | `token-link` rejections > 20 in 10 min    | Someone is enumerating share, unsubscribe or file links       |
| `AIBudgetExhausted`  | any `ai-budget-platform` rejection        | Platform AI spend ceiling reached; raise it or investigate    |
| `AIQuotaPressure`    | `ai-budget-user` rejections > 30 in 1 h   | Many travellers hit their daily ceiling; review the allowance |
| `RateLimitStoreDown` | `store_failures` increasing for 5 min     | Redis unreachable; limits are per process until it recovers   |
