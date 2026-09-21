# Mshwar brand foundation

Proposed visual identity for the Lebanon-wide travel discovery and itinerary platform. This is a reviewable brand direction for the interface work, not an assertion of trademark clearance or a user-approved identity. The previous PostgreSQL package remains independent.

## Included

- Primary bilingual logo concept, with the Latin wordmark `mshwar` and Arabic `مشوار`.
- App icon master concept, using the same journey symbol.
- Visual brand direction board.
- Exact editable design tokens in JSON — the single source of truth for colour, type, spacing, radius, elevation and motion.
- Generated Tailwind theme, CSS custom properties, and Figma import payloads (`pnpm tokens:generate`).
- Typography, icon, photography and responsive-interface guidance.
- Calculated contrast checks for the proposed palette.
- [Token naming convention](./TOKEN-NAMING.md), [Figma Variables import](./FIGMA-IMPORT.md), and the [54-screen Figma inventory](./FIGMA-54-SCREENS.md).

The images are raster artwork. They are not editable SVG masters, and typography shown in the generated board is a visual approximation. The definitive application type choices are listed below. Raster app-icon adaptation may vary slightly from the original logo; final production should export both from one approved vector master. Platform-specific app icon/favicons are not claimed as finished exports here.

## Design tokens (single source of truth)

`design-tokens.json` is the only file that may define product colour, type, spacing, radius, elevation or motion. Light and dark palettes share the same semantic keys (`surface`, `accent`, `danger`, …). Primitive names such as `cedar` and `orange` stay in `primitive.color` for brand reference and are not Tailwind utilities.

```bash
# From the repo root
pnpm tokens:generate   # write CSS, Tailwind theme, Figma exports, contrast report
pnpm tokens:check      # CI: fail if generated files are stale or contrast fails
pnpm tokens:contrast   # WCAG AA assertion over contrast-checks.json
pnpm tokens:test       # node:test coverage for the generator and contrast math
```

`apps/web` imports the generated CSS and extends Tailwind from the generated theme object. Do not hand-edit `generated/` or `apps/web/src/styles/generated/`. Figma publish is manual (no API access); see `FIGMA-IMPORT.md`.

## Logo concept

The continuous M-shaped path connects the name to a journey; the orange endpoint becomes a small memorable accent. Keep the mark flat, proportions unchanged and free of shadows or extra outlines. Use the full wordmark in the website header and symbol alone where space is limited. Keep clear space at least the diameter of the endpoint dot around the logo. At small sizes, omit the Arabic subline rather than shrinking it until unreadable. Test the finalized vector at 16, 24 and 32 pixels before exporting favicons.

Do not imply that the logo is an official emblem, government asset, verified supplier badge or partner mark. The RKIF website is the user's visual reference for the later UI; its logo is not being reused.

## Color roles

Product UI uses the **semantic** names. Primitive pigments are listed so the brand package stays reviewable.

| Semantic token   | Primitive (light) | Exact value | Use                                              |
| ---------------- | ----------------- | ----------- | ------------------------------------------------ |
| `text` / `brand` | Cedar             | #12352F     | Primary text, navigation, primary buttons        |
| `accent`         | Orange            | #F3653E     | Brand accent fill, selected details, endpoint    |
| `surface`        | Canvas            | #FCFCF8     | Main page background                             |
| `surface-raised` | White             | #FFFFFF     | Cards, dialogs and input surfaces                |
| `text-muted`     | Slate             | #5E6D66     | Secondary text on canvas, cards and sunken wells |
| `border`         | Border            | #7F8984     | Control boundaries and dividers (WCAG 1.4.11)    |
| `text-on-accent` | Accent text       | #0C241F     | Small text on orange-filled controls             |
| `danger`         | Error             | #B42318     | Destructive status                               |
| `success`        | Success           | #256D47     | Positive status                                  |
| `warning`        | Warning           | #855200     | Caution status                                   |

Dark-mode values for the same semantic keys live in `color.dark` — they are not defined only inside a CSS media query. Dark muted text is `#A8B5AF`. Dark default borders are `#6A8A84`.

## Contrast (WCAG 2.2 AA)

`pnpm tokens:contrast` recomputes relative luminance for every pairing in `contrast-checks.json` and fails CI on regression. Live ratios live in `generated/contrast-report.json`.

Corrected after the brand review (MSHWAR-24):

| Pairing                                | Before                                   | After                                    | Why                                                                   |
| -------------------------------------- | ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Muted text on sunken surface           | Slate `#66756E` / `#F3F5F2` = **4.42:1** | Slate `#5E6D66` / `#F3F5F2` = **4.97:1** | Small-text AA is 4.5:1. Muted copy sits on wells, not only on canvas. |
| Default border on canvas / card        | `#D8E0DC` = **1.31–1.34:1**              | `#7F8984` = **3.29–3.61:1**              | WCAG 1.4.11 needs 3:1 for control boundaries.                         |
| Dark default border on canvas / raised | `#2A4A44` = **1.31–1.76:1**              | `#6A8A84` = **3.39–4.54:1**              | Same 1.4.11 requirement in dark mode.                                 |

Accent fill `#F3653E` is unchanged. The review pairings that still fail — white/orange **3.11:1** and cedar/orange **4.28:1** — are **forbidden** for small text. Product UI uses `accent.foreground` `#0C241F` on orange (**5.24:1**). Do not use `text-accent` for body or labels; orange is a fill.

| Approved pairing                   | Ratio   | Threshold    |
| ---------------------------------- | ------- | ------------ |
| Cedar text on canvas               | 12.96:1 | 4.5:1 text   |
| Muted `#5E6D66` on canvas          | 5.30:1  | 4.5:1 text   |
| Muted `#5E6D66` on sunken          | 4.97:1  | 4.5:1 text   |
| Accent text on orange              | 5.24:1  | 4.5:1 text   |
| Focus ring (cedar) on canvas       | 12.96:1 | 3:1 non-text |
| Focus ring (cedar) on orange       | 4.28:1  | 3:1 non-text |
| Default border `#7F8984` on canvas | 3.51:1  | 3:1 non-text |

Orange as small text on canvas is only 3.03:1 and is listed as forbidden in `contrast-checks.json`. Full interface accessibility still requires component and interaction checks beyond these token pairs.

## Typography

- Latin: **DM Sans** (variable, optical size axis), weights 400–700. [Official specimen](https://fonts.google.com/specimen/DM+Sans).
- Display accent: **Newsreader** italic (`typography.family.display`), used sparingly for one emphasised phrase in large headings. [Official specimen](https://fonts.google.com/specimen/Newsreader).
- Arabic: **Noto Sans Arabic**, weights 400, 500, 600 and 700. [Official specimen](https://fonts.google.com/noto/specimen/Noto%20Sans%20Arabic).
- Main body: 16px or larger; standard labels 14px or larger; Latin line height 1.6, Arabic 1.8.
- Use semantic heading order and avoid all-caps paragraphs. Do not apply Latin letter spacing to Arabic.
- Self-host approved font files in the production repository with their license notices (the web app keeps them in `apps/web/src/app/fonts`); this package does not contain font binaries.

## Icon system

Use [Lucide](https://lucide.dev/) consistently, with 24px default size and 1.75px stroke. Do not mix unrelated icon libraries, emoji or solid icons in the navigation. Keep its [license notices](https://lucide.dev/license) when distributing icon assets. Icons are specified here, not bundled as individual SVG exports.

| Product purpose | Lucide icon       |
| --------------- | ----------------- |
| Discovery       | Compass           |
| Location        | MapPin            |
| Trip planning   | Route             |
| Date            | CalendarDays      |
| Party size      | Users             |
| Saved places    | Heart             |
| Booking         | Ticket            |
| Nature          | Mountain          |
| Dining          | Utensils          |
| Stay            | BedDouble         |
| Weather         | CloudSun          |
| Search          | Search            |
| Filters         | SlidersHorizontal |
| Business portal | Store             |
| Accessibility   | Accessibility     |

Give icon-only controls accessible names and 44px interaction targets. Mirror directional navigation appropriately in RTL; never mirror logos, photographs or non-directional icons automatically.

## Photography direction for the upcoming interface

Use real, source-checked Lebanese places: coast, mountains, historic architecture, food and human-scale local experiences. Favor natural light, documentary credibility and thoughtful crops. Never use generated scenery as documentary evidence for a named location, and never invent provider image URLs. Real listing photos must belong to or be authorized by the listing owner. Reserve image aspect ratios to avoid layout shifts, provide descriptive alt text and serve responsive optimized files. Actual destination photos will be sourced during interface construction; they are not included in this brand foundation.

## Interface rules

Use a 4px spacing base, 12px controls and 20px cards. Keep a 1280px content maximum with 48px desktop and 20px mobile gutters. Prioritize discovery/search and trip creation immediately; avoid a long marketing page before the working product. Navigation, filters, trip timeline, booking summaries and business screens must share the same tokens.

Use explicit available, pending, confirmed and cancelled text; never communicate a booking state by color alone. Provide keyboard focus, empty/error/loading states and reduced-motion behavior. The orange endpoint is a brand cue, not a universal notification badge. Display estimates as estimates, and keep demonstration inventory visibly distinguished from bookable supply.

## Remaining production artwork work

After the visual direction is settled, create a single editable vector logo master, exact vector-derived icon and favicon exports, final dark/light lockups and an audited font/icon asset bundle. Build and test the actual responsive screens against the product requirements and database contract. This foundation does not claim those later deliverables are already complete.
