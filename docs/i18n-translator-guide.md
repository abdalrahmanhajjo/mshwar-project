# Translator guide (EN / AR / FR)

Mshwar ships English, Arabic and French as first-class locales. User-facing copy lives in TypeScript catalogues, not in JSX.

## Where strings live

| Catalogue          | File                                     | Surface                                        |
| ------------------ | ---------------------------------------- | ---------------------------------------------- |
| `messages`         | `apps/web/src/lib/messages.ts`           | Shell, auth, plan, legal, shared form chrome   |
| `browseCopy`       | `apps/web/src/lib/browse-copy.ts`        | Discover, destinations, experiences, ideas     |
| `hubCopy`          | `apps/web/src/lib/hub-copy.ts`           | Trips, favorites, bookings, notifications      |
| `businessCopy`     | `apps/web/src/lib/business-copy.ts`      | Business portal                                |
| `adminCopy`        | `apps/web/src/lib/admin-copy.ts`         | Admin console                                  |
| `privacyCopy`      | `apps/web/src/lib/privacy-copy.ts`       | Privacy controls                               |
| `plannerCopy`      | `apps/web/src/lib/planner-copy.ts`       | Plan workspace: start location, route, weather |
| `checkoutCopy`     | `apps/web/src/lib/checkout-copy.ts`      | Checkout, booking mode, itinerary add-to-plan  |
| `notificationCopy` | `apps/web/src/lib/notifications-copy.ts` | Notification prefs, unsubscribe, outbox health |

Key names are camelCase. Keep the same key in `en`, `ar` and `fr`. Do not leave a value empty.

## Handoff

1. Add or change the English string first.
2. Add Arabic (Lebanese-friendly MSA is fine for UI chrome) and French in the same commit.
3. Use `{name}` placeholders. Do not concatenate sentences in code.
4. For counts, add `one` / `other` (and `few` / `two` when Arabic needs them) and format with `formatPlural`.
5. Run `pnpm --filter web i18n:check`. Missing keys, empty values, or hardcoded MVP page copy fail CI.

## Review

- Arabic should read naturally RTL. Avoid translating Latin place names (Byblos, Beirut) unless a widely used Arabic form exists (جبيل, بيروت).
- Do not invent businesses, prices, or availability in copy. Those come from the catalogue.
- Brand name **Mshwar** / **مشوار** stays as-is.

## Runtime

`t(key)` throws if a key is missing. There is no silent English fallback in production.
