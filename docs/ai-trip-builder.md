# AI Trip Builder

The language model reads intent and writes explanations. It never invents a place, a price or a total. Every stop is a published experience id returned by retrieval. Totals are summed in Postgres from `trip_stops.estimated_minor`, `trip_legs.estimated_minor` and `trip_cost_items.amount_minor`.

## Environment stubs

| Variable                       | CI / local default | Behaviour                                                            |
| ------------------------------ | ------------------ | -------------------------------------------------------------------- |
| `OPENAI_API_KEY`               | empty              | Forces the deterministic stub LLM                                    |
| `PLANNER_LLM_PROVIDER`         | `stub`             | `stub` (fixtures) or `openai` (only if a key is set)                 |
| `PLANNER_LLM_MAX_ATTEMPTS`     | `2`                | Schema-validate, retry once, then fail safe                          |
| `PLANNER_FAULT_INJECT`         | empty              | `provider_down` opens the fallback path; `malformed` exercises retry |
| `CATALOGUE_EMBEDDING_PROVIDER` | `stub`             | Hybrid retrieval uses `app.stub_embedding`                           |
| `CATALOGUE_ROUTING_PROVIDER`   | `auto`             | Travel legs use Epic 7 RoutingService (stub without Maps)            |
| `WEATHER_PROVIDER`             | `stub`             | Forecasts for warnings; unavailable → no warning                     |

Leave provider keys unset in CI. Fixture responses cover English, Lebanese Arabic, MSA Arabic and French.

## Manual drill (AI failure)

1. Set `PLANNER_FAULT_INJECT=provider_down`.
2. Submit a known prompt such as “a slow day in Byblos for two”.
3. Confirm the yellow degraded banner and that a plan still appears from structured filters.
4. Confirm `/api/v1/planner/admin/health` shows degraded sessions and that no sealed version is left half-written.
5. Unset the fault flag; the next request uses the stub LLM again.

## Migration numbering

This epic adds `mshwar-database/migrations/018_ai_trip_builder.sql` after Epic 7 `017_maps_routing_weather.sql`.
