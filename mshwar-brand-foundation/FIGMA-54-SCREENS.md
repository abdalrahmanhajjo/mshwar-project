# 54-screen Figma inventory (MSHWAR-27)

Live file: [Mshwar — Complete UI — Clickable Prototype](https://www.figma.com/design/CTLlkbyldx557zamdshjd5/Mshwar--Complete-UI--Clickable-Prototype) · page **`54 screens`**.

This is the **code-side companion** to that file. It is derived from the Next.js App Router pages and shells on this branch (`apps/web/src/app`, traveller / business / admin layouts, auth, settings, hub, browse, privacy). Use it to name, place, and capture frames **without guessing** route names or grid coordinates.

**Structural grid is in Figma** (54 desktop + 20 mobile + 4 handoffs on page `54 screens`). Live slots are **named empty frames awaiting capture paste**. Gap/state slots are **stamped**. This repository still has no Figma API access and does not write the live file from CI (see [FIGMA-IMPORT.md](./FIGMA-IMPORT.md)). Machine-readable copy: [generated/figma-54-screens.json](./generated/figma-54-screens.json) (hand-authored inventory, not `pnpm tokens:generate` output).

## MSHWAR-27 acceptance checklist

Structural ACs are **done in Figma**. Remaining work is screenshot paste into the named live frames.

- [x] **AC1.** All 54 core slots exist as **1440×1600** desktop frames (32 live product surfaces + 22 documented gap/state slots). Live frames are named and empty pending capture; gaps/states are stamped.
- [x] **AC2.** A **390×844** mobile pass exists for the **20** highest-traffic live routes marked below (named frames, capture pending).
- [x] **AC3.** Every frame sits on the journey-band grid: `x = slot * 1600`, `y` from the six bands in [Grid](#grid-six-journey-bands).
- [x] **AC4.** The [four cross-surface handoffs](#four-cross-surface-handoffs) are sticky-note annotated on the canvas.
- [x] **AC5.** Layer names follow the convention below; Tokens Studio / Variables imported from [FIGMA-IMPORT.md](./FIGMA-IMPORT.md); file published for review.

Subtasks: MSHWAR-185 (remaining traveller/account desktop frames), MSHWAR-186 (390px pass), MSHWAR-187 (grid), MSHWAR-188 (handoffs), MSHWAR-189 (layer names + publish).

## Counts versus the story text

DSN.5 / MSHWAR-27 says “34 of 54 core desktop frames are imported.” This branch does **not** have 34 distinct product routes.

| Bucket                                                            | Count | Notes                                                                                               |
| ----------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------- |
| Unique live product surfaces (31 `page.tsx` routes + `not-found`) |    32 | English path; `/ar` and `/fr` are the same screens                                                  |
| Documented gap / planned / state slots (pad to 54)                |    22 | Named placeholders so the Figma file can keep 54 numbered frames                                    |
| **Documented Figma slots**                                        |    54 | Import these as 1440px frames                                                                       |
| Alias extra (do **not** add a 55th frame)                         |     1 | `/saved` redirects to `/favorites`                                                                  |
| Non-product (do **not** frame)                                    |     2 | `loading.tsx` shells; `api/health`                                                                  |
| Likely origin of the story’s “34 imported”                        |    +2 | `/saved` + a global loading shell were probably counted as frames. Treat them as extras, not slots. |

Locale prefixes (`/ar/…`, `/fr/…`) and RTL are **not** extra frames. Toggle Figma Variables / layout direction on the same 54 slots.

## Real routes on this branch

Implemented `page.tsx` files under `apps/web/src/app`, plus the App Router 404.

**Traveller browse / marketing**

| Route                  | Shell     | Slot                     |
| ---------------------- | --------- | ------------------------ |
| `/`                    | Traveller | Discover/00              |
| `/discover`            | Traveller | Discover/01              |
| `/destinations`        | Traveller | Discover/02              |
| `/destinations/[slug]` | Traveller | Discover/03              |
| `/experiences`         | Traveller | Discover/04              |
| `/experiences/[slug]`  | Traveller | Discover/05              |
| `/ideas`               | Traveller | Discover/06              |
| `/contact`             | Traveller | Discover/07              |
| `/terms`               | Traveller | Discover/08              |
| `/privacy`             | Traveller | Discover/09 (legal page) |
| `not-found` (404)      | None      | Discover/10              |

**Plan**

| Route   | Shell     | Slot    |
| ------- | --------- | ------- |
| `/plan` | Traveller | Plan/00 |

**Account — auth**

| Route              | Shell     | Slot       |
| ------------------ | --------- | ---------- |
| `/signin`          | Traveller | Account/00 |
| `/signup`          | Traveller | Account/01 |
| `/forgot-password` | Traveller | Account/02 |
| `/reset-password`  | Traveller | Account/03 |
| `/verify-email`    | Traveller | Account/04 |

**Account — hub + settings**

| Route            | Shell     | Slot       | Note                                       |
| ---------------- | --------- | ---------- | ------------------------------------------ |
| `/settings`      | Traveller | Account/05 | Profile form **and** in-page privacy panel |
| `/trips`         | Traveller | Account/06 |                                            |
| `/favorites`     | Traveller | Account/07 |                                            |
| `/bookings`      | Traveller | Account/08 |                                            |
| `/notifications` | Traveller | Account/09 |                                            |
| `/saved`         | —         | _alias_    | Redirect only. Do not frame.               |

**Business** (`business/layout.tsx`)

| Route                | Slot        |
| -------------------- | ----------- |
| `/business`          | Business/00 |
| `/business/listings` | Business/01 |
| `/business/bookings` | Business/02 |
| `/business/finance`  | Business/03 |
| `/business/team`     | Business/04 |

**Admin** (`admin/layout.tsx`)

| Route               | Slot     |
| ------------------- | -------- |
| `/admin`            | Admin/00 |
| `/admin/users`      | Admin/01 |
| `/admin/businesses` | Admin/02 |
| `/admin/moderation` | Admin/03 |
| `/admin/settings`   | Admin/04 |

Nav sources: `apps/web/src/components/shell/nav-config.ts` (traveller / business / admin) and the traveller footer (`/destinations`, `/plan`, `/business`, `/ideas`, `/contact`, `/experiences`, `/privacy`).

## Grid: six journey bands

Desktop artboard: **1440 × 1600**. Mobile artboard: **390 × 844**.

```
x = slot * 1600
y_desktop = band.y
y_mobile  = band.y + 1760
```

The 160px remainder after a 1440-wide frame is the gutter. Mobile frames sit **under** their desktop twin so bands do not collide. Band pitch is **3600** (1600 desktop + 160 gutter + 844 mobile + leftover).

| Band id    | Label    |     Y | Slots | What lives here                                          |
| ---------- | -------- | ----: | ----: | -------------------------------------------------------- |
| `discover` | Discover |     0 |  0–11 | Browse, marketing, legal, 404, search gap                |
| `plan`     | Plan     |  3600 |   0–7 | Trip planner + itinerary gaps                            |
| `book`     | Book     |  7200 |   0–7 | Booking request → pay → review (no dedicated routes yet) |
| `account`  | Account  | 10800 |   0–9 | Auth, settings (profile + privacy), hub                  |
| `business` | Business | 14400 |   0–7 | Partner console + listing-editor gaps                    |
| `admin`    | Admin    | 18000 |   0–7 | Ops console + detail-page gaps                           |

Examples: Home desktop is `(0, 0)`. Settings desktop is `(5 * 1600, 10800)` = `(8000, 10800)`. Settings mobile is `(8000, 12560)`.

## 20 highest-traffic routes (390px pass)

Only **live** routes are in the mobile pass. Gap/state slots stay desktop-only until the product ships them.

| #   | Route                  | Slot        | Why it is priority           |
| --- | ---------------------- | ----------- | ---------------------------- |
| 1   | `/`                    | Discover/00 | Default landing              |
| 2   | `/discover`            | Discover/01 | Signed-in browse entry       |
| 3   | `/destinations`        | Discover/02 | Primary nav                  |
| 4   | `/destinations/[slug]` | Discover/03 | Destination template         |
| 5   | `/experiences`         | Discover/04 | Primary nav                  |
| 6   | `/experiences/[slug]`  | Discover/05 | Listing + book CTA           |
| 7   | `/ideas`               | Discover/06 | Footer / inspiration         |
| 8   | `/plan`                | Plan/00     | Primary nav “Plan a trip”    |
| 9   | `/signin`              | Account/00  | Auth entry                   |
| 10  | `/signup`              | Account/01  | Auth entry                   |
| 11  | `/forgot-password`     | Account/02  | Recovery start               |
| 12  | `/settings`            | Account/05  | Profile + privacy            |
| 13  | `/trips`               | Account/06  | Hub / primary nav “My trips” |
| 14  | `/favorites`           | Account/07  | Hub                          |
| 15  | `/bookings`            | Account/08  | Hub                          |
| 16  | `/notifications`       | Account/09  | Hub                          |
| 17  | `/business`            | Business/00 | Partner home                 |
| 18  | `/business/listings`   | Business/01 | Partner inventory            |
| 19  | `/business/bookings`   | Business/02 | Partner ops                  |
| 20  | `/admin`               | Admin/00    | Admin home                   |

Desktop-only live routes (no 390px pass in this story): `/contact`, `/terms`, `/privacy`, 404, `/reset-password`, `/verify-email`, `/business/finance`, `/business/team`, `/admin/users`, `/admin/businesses`, `/admin/moderation`, `/admin/settings`.

## 54 slots

`status`: **live** = capture from the running app; **gap** = planned route that does not exist yet (empty 1440 frame + label); **state** = same route as a live sibling, different UI state.

### Discover — y = 0

| Slot | Layer name                            | Route / source         | Status | 390 |     x |
| ---: | ------------------------------------- | ---------------------- | ------ | --- | ----: |
|    0 | `Discover/00-home/1440`               | `/`                    | live   | yes |     0 |
|    1 | `Discover/01-discover/1440`           | `/discover`            | live   | yes |  1600 |
|    2 | `Discover/02-destinations/1440`       | `/destinations`        | live   | yes |  3200 |
|    3 | `Discover/03-destination-detail/1440` | `/destinations/[slug]` | live   | yes |  4800 |
|    4 | `Discover/04-experiences/1440`        | `/experiences`         | live   | yes |  6400 |
|    5 | `Discover/05-experience-detail/1440`  | `/experiences/[slug]`  | live   | yes |  8000 |
|    6 | `Discover/06-ideas/1440`              | `/ideas`               | live   | yes |  9600 |
|    7 | `Discover/07-contact/1440`            | `/contact`             | live   |     | 11200 |
|    8 | `Discover/08-terms/1440`              | `/terms`               | live   |     | 12800 |
|    9 | `Discover/09-privacy-legal/1440`      | `/privacy`             | live   |     | 14400 |
|   10 | `Discover/10-not-found/1440`          | `not-found.tsx`        | live   |     | 16000 |
|   11 | `Discover/11-search-results/1440`     | _no `/search` route_   | gap    |     | 17600 |

### Plan — y = 3600

| Slot | Layer name                            | Route / source       | Status | 390 |     x |
| ---: | ------------------------------------- | -------------------- | ------ | --- | ----: |
|    0 | `Plan/00-plan/1440`                   | `/plan`              | live   | yes |     0 |
|    1 | `Plan/01-trip-builder/1440`           | `/plan` editor       | gap    |     |  1600 |
|    2 | `Plan/02-trip-detail/1440`            | `/trips/[id]`        | gap    |     |  3200 |
|    3 | `Plan/03-itinerary-day/1440`          | day view             | gap    |     |  4800 |
|    4 | `Plan/04-plan-empty/1440`             | `/plan` empty        | state  |     |  6400 |
|    5 | `Plan/05-plan-constraints-error/1440` | hard-constraint fail | state  |     |  8000 |
|    6 | `Plan/06-share-itinerary/1440`        | share link           | gap    |     |  9600 |
|    7 | `Plan/07-saved-ideas-on-canvas/1440`  | ideas → plan         | gap    |     | 11200 |

### Book — y = 7200

No dedicated booking routes ship on this branch. The live book CTA lives on `Discover/05` (`/experiences/[slug]`). These eight slots hold the rest of the Book journey so the 54-frame grid stays complete.

| Slot | Layer name                          | Route / source              | Status |     x |
| ---: | ----------------------------------- | --------------------------- | ------ | ----: |
|    0 | `Book/00-booking-request/1440`      | `/bookings/new`             | gap    |     0 |
|    1 | `Book/01-booking-confirmation/1440` | `/bookings/[id]/confirmed`  | gap    |  1600 |
|    2 | `Book/02-booking-policies/1440`     | policies overlay on listing | state  |  3200 |
|    3 | `Book/03-booking-gate-signin/1440`  | unsigned book → `/signin`   | state  |  4800 |
|    4 | `Book/04-payment/1440`              | abstracted provider         | gap    |  6400 |
|    5 | `Book/05-review-composer/1440`      | post-stay review            | gap    |  8000 |
|    6 | `Book/06-booking-cancelled/1440`    | cancel reason               | state  |  9600 |
|    7 | `Book/07-booking-detail/1440`       | `/bookings/[id]`            | gap    | 11200 |

### Account — y = 10800

All ten slots are **live**. Privacy controls are a panel on `/settings`, not a separate route.

| Slot | Layer name                        | Route              | Status | 390 |     x |
| ---: | --------------------------------- | ------------------ | ------ | --- | ----: |
|    0 | `Account/00-signin/1440`          | `/signin`          | live   | yes |     0 |
|    1 | `Account/01-signup/1440`          | `/signup`          | live   | yes |  1600 |
|    2 | `Account/02-forgot-password/1440` | `/forgot-password` | live   | yes |  3200 |
|    3 | `Account/03-reset-password/1440`  | `/reset-password`  | live   |     |  4800 |
|    4 | `Account/04-verify-email/1440`    | `/verify-email`    | live   |     |  6400 |
|    5 | `Account/05-settings/1440`        | `/settings`        | live   | yes |  8000 |
|    6 | `Account/06-trips/1440`           | `/trips`           | live   | yes |  9600 |
|    7 | `Account/07-favorites/1440`       | `/favorites`       | live   | yes | 11200 |
|    8 | `Account/08-bookings/1440`        | `/bookings`        | live   | yes | 12800 |
|    9 | `Account/09-notifications/1440`   | `/notifications`   | live   | yes | 14400 |

### Business — y = 14400

| Slot | Layer name                        | Route                     | Status | 390 |     x |
| ---: | --------------------------------- | ------------------------- | ------ | --- | ----: |
|    0 | `Business/00-dashboard/1440`      | `/business`               | live   | yes |     0 |
|    1 | `Business/01-listings/1440`       | `/business/listings`      | live   | yes |  1600 |
|    2 | `Business/02-bookings/1440`       | `/business/bookings`      | live   | yes |  3200 |
|    3 | `Business/03-finance/1440`        | `/business/finance`       | live   |     |  4800 |
|    4 | `Business/04-team/1440`           | `/business/team`          | live   |     |  6400 |
|    5 | `Business/05-listing-editor/1440` | `/business/listings/[id]` | gap    |     |  8000 |
|    6 | `Business/06-listing-create/1440` | `/business/listings/new`  | gap    |     |  9600 |
|    7 | `Business/07-team-invite/1440`    | `/business/team/invite`   | gap    |     | 11200 |

### Admin — y = 18000

| Slot | Layer name                      | Route                    | Status | 390 |     x |
| ---: | ------------------------------- | ------------------------ | ------ | --- | ----: |
|    0 | `Admin/00-overview/1440`        | `/admin`                 | live   | yes |     0 |
|    1 | `Admin/01-users/1440`           | `/admin/users`           | live   |     |  1600 |
|    2 | `Admin/02-businesses/1440`      | `/admin/businesses`      | live   |     |  3200 |
|    3 | `Admin/03-moderation/1440`      | `/admin/moderation`      | live   |     |  4800 |
|    4 | `Admin/04-settings/1440`        | `/admin/settings`        | live   |     |  6400 |
|    5 | `Admin/05-user-detail/1440`     | `/admin/users/[id]`      | gap    |     |  8000 |
|    6 | `Admin/06-business-detail/1440` | `/admin/businesses/[id]` | gap    |     |  9600 |
|    7 | `Admin/07-case-detail/1440`     | `/admin/moderation/[id]` | gap    |     | 11200 |

**Gap frames:** fill with a 1440 canvas, the layer name, the intended route, and a “not in app yet” stamp. Do not invent businesses, prices, or availability on gap frames.

## Four cross-surface handoffs

Place these as Figma sticky notes / connectors. They are **annotations**, not extra slots in the 54. Suggested note position: `x = 20000` (to the right of Discover’s last slot).

### 1. Traveller ↔ Business

- **From:** Discover/05 `/experiences/[slug]` (public listing) and footer “Partner with us”.
- **To:** Business/00 `/business`.
- **Reverse:** Business/01 listing preview → Discover/05.
- **Annotation text:** `HANDOFF traveller↔business — Footer “Partner with us” and unsigned /business open the Business shell. Reverse: listing preview opens the public experience frame (Discover/05). Do not duplicate the listing as a fifth Business slot.`
- **Connector:** Discover/05 ↔ Business/00.

### 2. Traveller ↔ Account (auth / booking gate)

- **From:** Plan/00, Discover/05 book CTA, Account/06–09 hub, Account/05 settings.
- **To:** Account/00 `/signin` (then return).
- **Annotation text:** `HANDOFF traveller↔account — Unsigned hub, settings, or “Request to book” gates through Sign in (Account/00). After session, return to the originating traveller or hub frame. Book/03 is the same gate shown on the Book band.`
- **Connector:** Discover/05 + Account/06 → Account/00.

### 3. Business ↔ Admin (moderation)

- **From:** Business/01 `/business/listings` (submit / verification).
- **To:** Admin/03 `/admin/moderation` (and Admin/07 case detail when built).
- **Reverse:** approve / reject returns the listing to Business/01.
- **Annotation text:** `HANDOFF business↔admin — Listing submit and verification enter the Admin moderation queue (Admin/03). Approve or reject writes back to Business listings. Admin never invents a listing that is not on the Business side.`
- **Connector:** Business/01 ↔ Admin/03.

### 4. Account ↔ Legal / Admin (trust and privacy)

- **From:** Account/05 `/settings` privacy panel (export, reset personalisation, delete/anonymise).
- **To:** Discover/09 `/privacy` (public policy) and Admin/01 + Admin/04 (ops review of the same account).
- **Annotation text:** `HANDOFF account↔legal/admin — Settings privacy actions cite the public Privacy policy frame (Discover/09). Export / reset / delete remain on Account/05; they are not a sixth settings route. Admin users/settings can inspect the anonymised account afterwards. Do not frame /saved; it redirects to Favorites.`
- **Connector:** Account/05 ↔ Discover/09; Account/05 → Admin/01.

## Layer naming convention

```
{Band}/{NN}-{kebab-name}/{viewport}
```

- `Band` is one of `Discover`, `Plan`, `Book`, `Account`, `Business`, `Admin` (title case, matches the band label).
- `NN` is the two-digit slot (`00`–`11`).
- `kebab-name` matches the JSON `slug`.
- `viewport` is `1440` or `390`.
- Handoff notes: `Handoffs/{pair}` — e.g. `Handoffs/traveller-business`.
- Gap frames keep the same name; add a child text layer `GAP — not in app`.
- State frames add a child `STATE — {empty|error|overlay|signed-in}`.
- Do **not** encode locale (`ar`, `fr`) or color mode in the frame name. Use Variables (`light` / `dark`) and a layout-direction toggle.

## Publish-for-review checklist (MSHWAR-189)

Structural items below are done on page `54 screens`. This repo still cannot publish the file. Re-check after capture paste.

1. **Tokens Studio import** — follow [FIGMA-IMPORT.md](./FIGMA-IMPORT.md): load `generated/tokens-studio.json`, confirm `core` + `semantic/light` + `semantic/dark`, export to Figma Variables.
2. **Variables** — collections `Mshwar / Color`, `Radius`, `Spacing`, `Motion`, `Type`, `Elevation`. Color and Elevation have `light` and `dark`. Bind frames to **semantic** names, not cedar/orange primitives.
3. **Frames tidy** — 54 desktop frames named as above; 20 mobile twins; no `/saved`, no `/ar` duplicates, no `loading` frame; gap stamps visible; unused default frames deleted.
4. **Grid** — every frame at `slot * 1600` on its band Y; mobile at `band.y + 1760`.
5. **Handoffs** — four sticky notes with the annotation text above.
6. **Pages** — suggested Figma pages: `Cover`, `54 screens`, `Handoffs`, `_scratch`. Keep the inventory page clean.
7. **Save / publish** — save the file and share the review link. That save is the publish step. Do not claim CI published Figma.

## How to capture live frames

Until a Figma plugin or API exists:

1. Run the web app (`pnpm --filter web dev`) at 1440 and 390.
2. Walk each **live** row in this doc (or `frames[].status === "live"` in the JSON).
3. Screenshot into the matching frame. Prefer `byblos` / seeded catalogue slugs for `[slug]` templates.
4. Leave **gap** frames empty except for the stamp. Leave **state** frames as overlays on a dimmed live sibling if the state is not URL-addressable.

The structural grid is already on page `54 screens`. Paste captures into the named **live** frames only. Do not back-port invented routes into the app from gap labels.
