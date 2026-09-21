# Epic 12 — Localization, RTL & Accessibility

Delivery gate for MSHWAR-104–107. No schema migration: `users.locale` and preference locale already exist. Epic 7 owns SQL `017_maps_routing_weather.sql`. Epic 8 owns `018_ai_trip_builder.sql`. Epic 9 owns `019` bookings/payments. Epic 10 owns notifications/messaging SQL. This epic is docs + code only.

## Story map

| Story                                   | What shipped                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSHWAR-104** Translation workflow     | Catalogue registry, fail-fast `t()`, plural / date / number / currency helpers, `pnpm --filter web i18n:check`, [translator guide](./i18n-translator-guide.md)                                    |
| **MSHWAR-105** Arabic RTL               | Logical CSS scan (components + app), directional icons, bidi isolation, RTL snapshots at 390/1440, map / chart / date-picker / carousel / progress checks                                         |
| **MSHWAR-106** Lebanese Arabic AI input | Dialect extractor at `services/api/app/planner/intent/extractor.py` with Arabizi fixtures and an 85% CI threshold. Low confidence returns a clarification prompt and does not guess a destination |
| **MSHWAR-107** WCAG 2.2 AA              | Visible focus, labelled fields with error association, skip link + landmarks (existing shell), axe-core on MVP pages, [booking SR checklist](./a11y-booking-screen-reader.md)                     |

## CI gates

- `pnpm --filter web i18n:check` — catalogue parity and leftover hardcoded MVP copy
- `pnpm --filter web test` — includes axe-core, RTL snapshots, formatters
- `pytest` — dialect eval must meet the fixture threshold
- `pnpm tokens:contrast` — 4.5:1 text / 3:1 non-text

## Planner compose (Epic 7 + Epic 8 + Epic 12)

`/plan` renders localized `PlanView` (collection / trip / defaults / itinerary checkout CTA), Epic 8 `PlannerView` (AI trip builder), then Epic 7 `PlanWorkspace` (maps, routing, weather, replan). Planner chrome lives in `plannerCopy`; checkout chrome lives in `checkoutCopy`. Both are part of catalogue parity CI.

`services/api/app/planner/intent/` holds both façades:

- `extract_constraints()` — Epic 8 LLM / stub-LLM path used by the trip-builder pipeline
- `extract_intent()` — lexicon dialect/Arabizi extractor for the 85% eval set

Put new dialect fixtures under `services/api/app/planner/intent/fixtures/`.
