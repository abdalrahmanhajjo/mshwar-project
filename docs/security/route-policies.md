# Route access policies

Generated from the running app by `python scripts/route_policies.py`; a test fails if this file is stale.
The policy model is described in [authorization.md](authorization.md).

| Policy | Routes |
|---|---|
| `admin` | 6 |
| `job` | 1 |
| `public` | 19 |
| `session` | 44 |
| **Total** | **70** |

| Method | Path | Policy |
|---|---|---|
| POST | `/api/v1/auth/forgot-password` | `public` |
| GET | `/api/v1/auth/me` | `session` |
| POST | `/api/v1/auth/refresh` | `session` |
| POST | `/api/v1/auth/register` | `public` |
| POST | `/api/v1/auth/resend-verification` | `public` |
| POST | `/api/v1/auth/reset-password` | `public` |
| POST | `/api/v1/auth/signin` | `public` |
| POST | `/api/v1/auth/signout` | `public` |
| POST | `/api/v1/auth/verify-email` | `public` |
| GET | `/api/v1/catalogue/collections` | `public` |
| POST | `/api/v1/catalogue/collections` | `admin` |
| GET | `/api/v1/catalogue/collections/{slug}` | `public` |
| POST | `/api/v1/catalogue/collections/{slug}/open-as-trip` | `session` |
| GET | `/api/v1/catalogue/destinations` | `public` |
| GET | `/api/v1/catalogue/experiences` | `public` |
| GET | `/api/v1/catalogue/experiences/{slug}` | `public` |
| POST | `/api/v1/catalogue/experiences/{slug}/publish` | `session` |
| GET | `/api/v1/catalogue/experiences/{slug}/related` | `public` |
| POST | `/api/v1/catalogue/experiences/{slug}/unpublish` | `session` |
| GET | `/api/v1/catalogue/search` | `public` |
| GET | `/api/v1/favorites` | `session` |
| POST | `/api/v1/favorites` | `session` |
| POST | `/api/v1/favorites/merge` | `session` |
| POST | `/api/v1/favorites/toggle` | `session` |
| DELETE | `/api/v1/favorites/{favorite_id}` | `session` |
| GET | `/api/v1/health` | `public` |
| GET | `/api/v1/health/metrics` | `job` |
| GET | `/api/v1/locations/areas` | `public` |
| GET | `/api/v1/locations/autocomplete` | `session` |
| GET | `/api/v1/locations/reverse` | `session` |
| POST | `/api/v1/locations/start` | `session` |
| GET | `/api/v1/planner/admin/health` | `admin` |
| GET | `/api/v1/planner/admin/injections` | `admin` |
| PUT | `/api/v1/planner/admin/ranker` | `admin` |
| GET | `/api/v1/planner/admin/trips/{trip_id}/versions` | `admin` |
| GET | `/api/v1/planner/admin/versions/{version_id}` | `admin` |
| POST | `/api/v1/planner/manual` | `session` |
| POST | `/api/v1/planner/optimize` | `session` |
| GET | `/api/v1/planner/quota` | `session` |
| POST | `/api/v1/planner/route` | `session` |
| POST | `/api/v1/planner/sessions` | `session` |
| GET | `/api/v1/planner/sessions/{session_id}` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/clarify` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/lock` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/refine` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/regenerate` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/replace/accept` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/replace/cancel` | `session` |
| POST | `/api/v1/planner/sessions/{session_id}/replace/preview` | `session` |
| GET | `/api/v1/planner/sessions/{session_id}/stops/{stop_id}/alternatives` | `session` |
| GET | `/api/v1/planner/thresholds` | `session` |
| GET | `/api/v1/planner/trips/{trip_id}/versions` | `session` |
| GET | `/api/v1/planner/versions/{version_id}` | `session` |
| POST | `/api/v1/planner/versions/{version_id}/link-booking` | `session` |
| POST | `/api/v1/planner/warnings` | `session` |
| POST | `/api/v1/planner/weather` | `session` |
| GET | `/api/v1/privacy/consents` | `session` |
| PUT | `/api/v1/privacy/consents` | `session` |
| POST | `/api/v1/privacy/delete-account` | `session` |
| GET | `/api/v1/privacy/export` | `session` |
| GET | `/api/v1/privacy/policies` | `public` |
| POST | `/api/v1/privacy/policies/accept` | `session` |
| POST | `/api/v1/privacy/reset-personalisation` | `session` |
| GET | `/api/v1/profile` | `session` |
| PUT | `/api/v1/profile` | `session` |
| GET | `/api/v1/profile/vocabularies` | `public` |
| GET | `/api/v1/trips` | `session` |
| POST | `/api/v1/trips` | `session` |
| POST | `/api/v1/trips/{trip_id}/archive` | `session` |
| GET | `/health` | `public` |
