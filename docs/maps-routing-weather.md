# Maps, routing and weather (Epic 7)

Travel time, stop order and weather warnings are **measured or solved**. They are never guessed by an LLM.

## Routing (MSHWAR-62)

`app.planner.routing.RoutingService` sits in front of a provider interface.

| Mode                         | When                                                                                          | What travellers see                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Google Distance Matrix       | `GOOGLE_MAPS_API_KEY` is set (and `CATALOGUE_ROUTING_PROVIDER` is not `stub` / `unavailable`) | `source=google`, structured metres and seconds                     |
| Haversine + 1.35 road factor | Maps credential unset                                                                         | `source=haversine-stub`, labelled **stub**, never as Google        |
| Unavailable                  | Provider error, or `CATALOGUE_ROUTING_PROVIDER=unavailable`                                   | `available=false`, NULL distance/duration. No silent fake estimate |

Cache key: rounded origin, destination, mode, 15-minute time bucket. TTL: `ROUTING_CACHE_TTL_SECONDS` (default 6h).

Per-plan cost instrumentation records requested elements, cache hits and an **estimated** USD using the public Distance Matrix list price (USD 5 / 1000 elements). That figure is a budget stub, not a billed invoice. Default plan budget: `ROUTING_PLAN_BUDGET_USD=0.50`.

## Start location (MSHWAR-63)

`/plan/start` and the plan workspace accept search (catalog autocomplete stub, Google reverse if a server Maps credential exists), map pin-drop, device geolocation, and manual coordinates. Denied geolocation never dead-ends the flow. The human-readable label is stored on the profile as `preferences.start_location`.

## Optimiser (MSHWAR-64)

Constrained TSP with time windows (Held-Karp, n ≤ 10). Locked stops keep position. Appointment windows, closing times and return-by make the plan **infeasible** when they cannot be met. Output legs are re-fetched from the routing service before display. Solver timeout falls back to the original order (or infeasible).

OR-Tools is optional. The in-tree solver is deterministic and is what CI runs.

## Weather (MSHWAR-65)

| `WEATHER_PROVIDER`   | Behaviour                                                                |
| -------------------- | ------------------------------------------------------------------------ |
| `stub` (default, CI) | Recorded Open-Meteo fixture. No network.                                 |
| `open-meteo`         | Public Open-Meteo forecast API. Prototype. No SLA. Attribution required. |
| `unavailable`        | `available=false`. **No warning** is shown.                              |

Open-Meteo’s public API does not require a credential. `OPEN_METEO_API_KEY` is reserved for a future commercial/self-hosted endpoint.

### Production provider decision

Prototype: Open-Meteo public API (no contract, best-effort, keep attribution).

Production: pick one of:

1. **Open-Meteo commercial / self-hosted** — same schema, ops SLA, predictable cost (hosting + on-call).
2. **Meteomatics or equivalent licensed feed** — paid per call/volume, contractual uptime, Lebanon coverage to be confirmed in procurement.

Do not ship a paid weather vendor until legal/retention terms are signed. Forecast rows store `provider`, `source` and `fetched_at`.

## Warnings and replan (MSHWAR-66 / 67)

Experiences already have `weather_sensitivity` (`indoor` / `outdoor` / `weather-sensitive`), editable by a listing-capable business user or a platform admin. Thresholds live in `app.weather_warning_thresholds` and `/admin/settings`.

A warning names the stop and the forecast timestamp. Indoor stops are not warned for rain/wind. **Warnings never cancel or alter bookings** (asserted in tests). Partial replan rebuilds only weather-hit unlocked stops; locked/unaffected keep place. If no alternative fits, the API returns a plain message and leaves the current plan unchanged.
