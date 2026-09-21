# Booking flow — manual screen-reader checklist (WCAG 2.2 AA)

Automated axe-core runs in CI on shells, primitives, plan, contact and sign-in. The booking UI on `main` is a hub list plus a cancel reason, not a full checkout. Run this pass when a booking request or payment screen lands (Epic 9).

## Setup

- VoiceOver (Safari) or NVDA (Firefox)
- Keyboard only — no pointer
- Locales: English, then Arabic RTL at 390px and 1440px
- Contrast: text ≥ 4.5:1, control boundaries / focus ≥ 3:1 (token check in CI)

## Checklist

| Step                             | What to verify                                                                                 | Pass |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| 1. Land on `/experiences/[slug]` | Listing title, price (announced as currency), and “Request / preview” are named                | ☐    |
| 2. Open date / guest fields      | Each input has a visible label; errors are announced with `aria-describedby`                   | ☐    |
| 3. Keyboard                      | Tab order is listing → dates → guests → submit; focus ring stays visible                       | ☐    |
| 4. Unverified account            | Booking gate states that email must be verified; focus moves to the banner                     | ☐    |
| 5. Submit request                | Status (pending / confirmed) is a text name, not colour alone                                  | ☐    |
| 6. `/bookings`                   | List is a set of articles/cards; cancel reason is labelled; confirm is a button                | ☐    |
| 7. Cancel error                  | Empty reason keeps the button disabled or announces `fieldRequired`                            | ☐    |
| 8. Skip link                     | “Skip to content” jumps to `#main` and does not trap focus                                     | ☐    |
| 9. Arabic RTL                    | Drawer opens from the start edge; progress and carousels mirror; Latin place names stay intact | ☐    |
| 10. Map / date picker            | Map iframe or fallback has an accessible name; date fields expose start/end                    | ☐    |

Record date, browser, SR version and locale in the release notes. Do not mark MSHWAR-107 done for a new booking screen until this table is filled.
