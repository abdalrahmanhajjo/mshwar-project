# Legal documents, consent and cookies

Story: MSHWAR-113 · Code: `apps/web/src/lib/legal/`, `apps/web/src/components/legal/`, `mshwar-database/migrations/026_consent_and_policies.sql`, `services/api/app/api/v1/endpoints/privacy.py`

> The legal texts are drafts written for Lebanon (Law No. 81/2018 on electronic transactions and personal data, and Consumer Protection Law No. 659/2005). **They must be reviewed by a Lebanese lawyer before launch.** Until then every page shows a "Draft pending legal review" notice.

## The four documents

| Document             | Page                    | Must be accepted | Source                          |
| -------------------- | ----------------------- | ---------------- | ------------------------------- |
| Terms of service     | `/terms`                | yes              | `src/lib/legal/terms.ts`        |
| Privacy policy       | `/privacy`              | yes              | `src/lib/legal/privacy.ts`      |
| Cancellation policy  | `/cancellation-policy`  | no               | `src/lib/legal/cancellation.ts` |
| Community guidelines | `/community-guidelines` | no               | `src/lib/legal/community.ts`    |

Each is written in English, Arabic and French with the same sections. Operator details come from environment variables:

| Variable                           | Default                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_LEGAL_ENTITY_NAME`    | `Mshwar`                                                              |
| `NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS` | `Tripoli, Lebanon`                                                    |
| `NEXT_PUBLIC_PRIVACY_EMAIL`        | none (the text points to the Contact page)                            |
| `NEXT_PUBLIC_LEGAL_REVIEWED`       | `false` (set to `true` after legal sign-off to hide the draft notice) |

### Publishing a new version

1. Edit the texts (all three languages).
2. Change the date in `apps/web/src/lib/legal/versions.json`.
3. Add a migration that inserts the same version into `app.legal_documents`, with `effective_at` and `requires_acceptance`.
4. Deploy the migration and the web app together.

A web test fails if `versions.json` and the database seed disagree. When a version that must be accepted changes, signed-in people see a banner and accept the new version before continuing; the acceptance is recorded against the exact version they were shown.

## Consent

| Purpose           | Default             | Where it's changed                                             | What it controls                                                                           |
| ----------------- | ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Terms and privacy | required at sign-up | sign-up form, update banner                                    | account creation                                                                           |
| Personalisation   | **off**             | sign-up (optional), Settings → Your data, profile notice       | whether saved preferences and activity shape plans, and whether feedback can train ranking |
| Marketing email   | **off**             | sign-up (optional), Settings → Communication, unsubscribe link | offers by email                                                                            |
| Marketing in-app  | **off**             | Settings → Communication                                       | offers inside the app                                                                      |

- Each purpose is separate and can be withdrawn at any time. Booking and account emails are always sent, because they're part of the service.
- Every change is written to `app.consent_events` by a database trigger, with the version in force and where it came from (`signup`, `settings`, `preferences`, `unsubscribe_link`, `privacy_reset`, `account_deletion`, `policy_update`). People see this history in Settings.
- With personalisation off, saved preferences are **kept but not used**. Turning it back on applies them again.

API: `GET /api/v1/privacy/policies` (public), `GET`/`PUT /api/v1/privacy/consents`, `POST /api/v1/privacy/policies/accept`. Sign-up (`POST /auth/register`) needs `accept_terms: true` and records `policy_versions`, `personalisation_consent` and `marketing_consent`.

## Cookies

| Cookie           | Category  | Lifetime | Purpose                               |
| ---------------- | --------- | -------- | ------------------------------------- |
| `mshwar_session` | essential | 7 days   | keeps you signed in                   |
| `mshwar_guest`   | essential | 30 days  | lets a guest join a shared group trip |
| `mshwar-locale`  | essential | 1 year   | remembers your language               |
| `mshwar-consent` | essential | 1 year   | remembers your cookie choices         |

Optional categories, **off until the visitor allows them**:

- **Error reporting**: the browser Sentry SDK isn't loaded until allowed, and stops when withdrawn.
- **Maps and embedded content**: the Google Maps frame is replaced by a notice with an "Allow maps" button.

The banner offers "Essential only" and "Allow all" with the same size and style, plus "Choose" for each category. "Cookie settings" in the footer reopens it. The choice is stored as `mshwar-consent=v1.e<0|1>.m<0|1>`; a new category would use a new version and ask again.

## Refunds when a business cancels

Drafting the cancellation policy showed that a business cancellation was refunded by the customer's cancellation terms, which could mean a partial refund. Migration 026 changes this: **when a business cancels, the customer always gets a full refund.**
