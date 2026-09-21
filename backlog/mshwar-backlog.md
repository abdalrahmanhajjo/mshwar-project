# Mshwar - Delivery Backlog

Derived from the Mshwar Business Requirements Document v1.0 (10 September 2026), the five PostgreSQL migrations, the brand foundation package and the 54-screen inventory.

**15 epics · 116 stories · 542 subtasks · 662 story points**

---

## FND — Foundation & Platform Setup

`Phase 0 - Foundation` · `Platform` · 7 stories · 34 subtasks · 39 pts

Stand up the repo, environments, database and CI so every later epic has a place to land. Nothing in this epic is user-visible; everything after it depends on it.

### FND.1 Set up the monorepo, package management and code standards

_Highest priority · 5 points · traces to Tech baseline S23_

Create the repository layout for the Next.js frontend and FastAPI backend, with shared tooling, formatting and commit conventions so the two stacks stay consistent.

**Acceptance criteria**

- Repo contains a working `apps/web` (Next.js + TypeScript + Tailwind + shadcn/ui) and `services/api` (FastAPI + SQLAlchemy + Pydantic).
- A single command installs and runs both locally.
- Lint, format and type-check run clean on a fresh clone.
- README documents local setup end to end.

**Subtasks**

- [ ] Initialise Next.js 15 + TypeScript + Tailwind + shadcn/ui in apps/web
- [ ] Initialise FastAPI + SQLAlchemy 2.x + Pydantic v2 + Alembic in services/api
- [ ] Configure ESLint, Prettier, Ruff and mypy with agreed rule sets
- [ ] Add pre-commit hooks and Conventional Commits enforcement
- [ ] Write the root README with local setup, ports and env-var table

### FND.2 Provision PostgreSQL 17 with PostGIS, pgvector and btree_gist

_Highest priority · 5 points · traces to BRD 1.2, migrations 001-005_

Provision the database that the whole product assumes: relational core, geospatial queries for distance and routing inputs, vector search for RAG, and exclusion constraints for slot booking.

**Acceptance criteria**

- Local and staging databases run PostgreSQL 17 with postgis, pgvector and btree_gist enabled.
- Extension creation is part of a versioned migration, not a manual step.
- A smoke query proves each extension works (ST_DWithin, vector <-> operator, an EXCLUDE constraint).
- Connection pooling is configured and documented.

**Subtasks**

- [ ] Write migration 000 that creates the three extensions
- [ ] Add docker-compose service for Postgres 17 + PostGIS for local dev
- [ ] Configure SQLAlchemy engine, pooling and statement timeouts
- [ ] Add an extension smoke-test to the test suite
- [ ] Document the Supabase vs self-hosted decision and its trade-offs

### FND.3 Land the core schema migrations 001-005

_Highest priority · 8 points · traces to BRD S13, migrations 001-005_

Apply the five authored migrations (identity, catalogue, availability, booking/payment, AI/ops) and make them re-runnable from an empty database.

**Acceptance criteria**

- `alembic upgrade head` succeeds from an empty database with zero manual steps.
- `alembic downgrade base` runs clean, proving every migration is reversible.
- Every table has an owner, a primary key strategy and created_at/updated_at.
- Migration order has no forward references.

**Subtasks**

- [ ] Convert the five SQL files into ordered Alembic revisions
- [ ] Add downgrade paths for each revision
- [ ] Add a CI job that runs upgrade head then downgrade base on a scratch database
- [ ] Generate and commit an ERD from the live schema
- [ ] Document the entity model in the repo wiki

### FND.4 Enforce row-level security and tenant isolation at the database layer

_Highest priority · 8 points · traces to BR-21, FR-060, FR-066_

Business staff must never see another organisation's bookings or customers. Enforce that in Postgres with FORCE ROW LEVEL SECURITY rather than relying on application filters alone.

**Acceptance criteria**

- RLS is enabled and FORCED on every table holding org-scoped or user-scoped data.
- The application connects as a non-superuser role that cannot bypass RLS.
- A test proves org A cannot read org B's bookings even with a crafted query.
- Session context (current org, current user) is set on every request and cleared on release.

**Subtasks**

- [ ] Define the app database role and revoke BYPASSRLS
- [ ] Write RLS policies for org-scoped tables (listings, experiences, slots, bookings)
- [ ] Write RLS policies for user-scoped tables (trips, favorites, notifications)
- [ ] Add SET LOCAL session-context middleware in FastAPI
- [ ] Write cross-tenant isolation tests that must fail closed

### FND.5 Build the environment and secrets strategy

_High priority · 3 points · traces to BRD S25, AC-15_

Define local, staging and production environments with separate credentials, and make sure no secret can reach the client bundle or a log line.

**Acceptance criteria**

- Three environments exist with separate databases and separate third-party keys.
- Secrets come from the platform secret store, never from committed files.
- A CI check fails the build if a secret pattern appears in the repo or in a client bundle.
- Rotating a key requires no code change.

**Subtasks**

- [ ] Define the env-var contract and validate it at boot with Pydantic Settings
- [ ] Configure Vercel and backend-host environment variables per stage
- [ ] Add gitleaks or equivalent secret scanning to CI
- [ ] Write the key-rotation runbook

### FND.6 Set up CI/CD with quality gates

_High priority · 5 points · traces to BRD S24, S25_

Every pull request runs the same checks, and merging to main deploys to staging automatically.

**Acceptance criteria**

- PRs run lint, type-check, unit tests and migration up/down.
- Coverage is reported and a floor is enforced on changed files.
- Merge to main deploys the frontend to Vercel preview and the API to staging.
- A failed deploy rolls back without manual database surgery.

**Subtasks**

- [ ] Create the GitHub Actions workflow for the web app
- [ ] Create the workflow for the API including a Postgres service container
- [ ] Add coverage reporting and the changed-files threshold
- [ ] Wire staging auto-deploy and a manual production promotion gate
- [ ] Document the branch and release strategy

### FND.7 Build the seed and demo-data toolkit

_High priority · 5 points · traces to AC-02, AC-03, BR-01_

The AI planner can only be demonstrated against real, verified Lebanese inventory. Build a repeatable seeder so any environment can be filled with credible data.

**Acceptance criteria**

- A single command seeds a coherent Lebanon dataset: regions, businesses, experiences, prices, hours, slots and images.
- Seeded coordinates are valid and fall inside Lebanon.
- Seed data is idempotent - running it twice does not duplicate rows.
- At least 60 experiences across 8+ categories and 6+ regions, enough for the planner to produce varied itineraries.

**Subtasks**

- [ ] Define the seed data format and validation rules
- [ ] Curate the Lebanon region and locality reference list
- [ ] Curate 60+ real experiences with categories, durations, price models and hours
- [ ] Write the idempotent seeder command with upsert-by-natural-key
- [ ] Add a coordinate and opening-hours sanity checker

---

## DSN — Design System & UI Foundation

`Phase 0 - Foundation` · `Design` · 5 stories · 24 subtasks · 26 pts

Turn the brand foundation and the imported Figma frames into coded, accessible, tri-lingual components. This is the epic that connects the design work already done to the code.

### DSN.1 Codify brand tokens as the single source of truth

_Highest priority · 5 points · traces to Brand foundation package_

Convert the brand package into design tokens consumed by both Figma and Tailwind, so a colour change happens in one place.

**Acceptance criteria**

- Colour, type, spacing, radius, elevation and motion tokens exist in one JSON source.
- Tailwind theme is generated from that source, not hand-maintained.
- Light and dark palettes are both defined; no colour is defined only inside a media query.
- Token names are semantic (surface, accent, danger), not literal (orange-500).

**Subtasks**

- [ ] Author the token JSON from the brand package
- [ ] Generate the Tailwind theme and CSS custom properties from tokens
- [ ] Define the dark-mode token overrides
- [ ] Publish the tokens as a Figma variables collection
- [ ] Document the token naming convention

### DSN.2 Fix the contrast failures found in the brand review

_Highest priority · 3 points · traces to Package review findings_

Several brand pairings fall below WCAG AA. Correct them at token level before components are built on top of them.

**Acceptance criteria**

- Every text/background pair used in the product meets 4.5:1, or 3:1 for large text.
- Control boundaries and focus rings meet the 3:1 non-text contrast requirement of WCAG 1.4.11.
- A contrast test runs in CI against the token file and fails on regression.
- The corrected values are pushed back into the brand package and Figma variables.

**Subtasks**

- [ ] Recompute relative luminance for every token pairing in use
- [ ] Adjust the failing accent and muted-text values
- [ ] Write the automated contrast assertion over the token JSON
- [ ] Update the brand package document with corrected swatches

### DSN.3 Build the core component library

_High priority · 8 points · traces to Screen inventory, FR-005_

Build the shadcn/ui-based components that the 54 screens actually use, each one keyboard-accessible and direction-agnostic.

**Acceptance criteria**

- Buttons, inputs, selects, date pickers, sliders, tabs, dialogs, sheets, toasts, cards, badges and empty states are implemented.
- Every interactive component is reachable and operable by keyboard alone, with a visible focus ring.
- No component uses left/right physical properties where logical properties (inline-start/end) are required for RTL.
- Components are documented in Storybook with light, dark, LTR and RTL snapshots.

**Subtasks**

- [ ] Set up Storybook with theme and direction toolbars
- [ ] Implement form primitives: input, select, combobox, date-range, slider
- [ ] Implement overlay primitives: dialog, sheet, popover, toast
- [ ] Implement content primitives: card, badge, rating, price, empty state
- [ ] Add axe-core accessibility checks to every story

### DSN.4 Implement the responsive app shell

_High priority · 5 points · traces to Screen inventory, FR-005_

One shell that carries header, navigation, language switcher, auth state and footer across all three surfaces at 390px and 1440px.

**Acceptance criteria**

- The shell renders correctly at 390px and 1440px with no horizontal scroll.
- Navigation collapses to a mobile pattern below the breakpoint.
- The language switcher flips direction without a reload.
- Traveller, business and admin shells share primitives but differ in navigation.

**Subtasks**

- [ ] Build the traveller header, nav and footer
- [ ] Build the business portal sidebar shell
- [ ] Build the admin console shell
- [ ] Implement the language switcher with direction flip
- [ ] Verify both breakpoints against the Figma frames

### DSN.5 Finish the Figma source of truth for all 54 screens

_Medium priority · 5 points · traces to Figma import checklist_

34 of 54 core desktop frames are imported. Complete the remaining desktop frames, add the mobile pass, and arrange everything on the documented grid.

**Acceptance criteria**

- All 54 core routes exist as 1440px frames.
- A 390px mobile pass exists for the 20 highest-traffic routes.
- Frames are placed on the agreed grid: X = slot * 1600, six journey bands on the documented Y values.
- Cross-surface handoffs are annotated on the canvas.

**Subtasks**

- [ ] Import the 20 remaining traveller and account desktop frames
- [ ] Run the 390px mobile pass on the priority routes
- [ ] Arrange all frames onto the journey-band grid
- [ ] Annotate the four cross-surface handoffs
- [ ] Tidy layer naming and publish the file for review

---

## ACC — Accounts, Identity & Preferences

`Phase 0 - Foundation` · `Traveller` · 7 stories · 34 subtasks · 34 pts

Registration, sign-in, recovery, profile, preferences and the language choice that everything else reads from.

### ACC.1 Implement registration, sign-in and sign-out

_Highest priority · 8 points · traces to FR-001, AC-01_

Secure email/password authentication with sessions, plus the groundwork for social sign-in later.

**Acceptance criteria**

- A user can register, sign in and sign out from web on mobile and desktop.
- Passwords are hashed with a modern KDF; plaintext never reaches logs or Sentry.
- Sessions are httpOnly, secure, SameSite and expire on a documented schedule.
- Protected routes redirect unauthenticated users and return them to the intended page after sign-in.

**Subtasks**

- [ ] Design the users, sessions and credentials tables
- [ ] Implement password hashing and the sign-up endpoint
- [ ] Implement session issue, refresh and revoke
- [ ] Build the /signin and /signup screens against the Figma frames
- [ ] Add route protection middleware on both client and server

### ACC.2 Implement account recovery without account enumeration

_Highest priority · 5 points · traces to FR-001_

A user can regain access, and an attacker cannot use the flow to learn which emails have accounts.

**Acceptance criteria**

- The forgot-password response is identical whether or not the address exists.
- Reset tokens are single-use, time-limited and invalidated on password change.
- All other sessions are revoked when a password is reset.
- Rate limiting blocks enumeration by volume.

**Subtasks**

- [ ] Implement reset-token issue and verification
- [ ] Build the /forgot-password and reset screens
- [ ] Send the reset email through the notification service
- [ ] Add rate limiting and a constant-time response path
- [ ] Write tests asserting identical responses for known and unknown emails

### ACC.3 Verify email addresses

_High priority · 3 points · traces to FR-001_

Confirm the address is reachable before it can receive booking confirmations.

**Acceptance criteria**

- New accounts are unverified until the emailed link is used.
- Unverified accounts can browse but cannot book.
- The verification email can be resent with rate limiting.
- Verification state is visible in admin.

**Subtasks**

- [ ] Add verification token issue and confirm endpoints
- [ ] Build the verify-email and resend screens
- [ ] Gate booking on verified state
- [ ] Surface verification state on the admin user record

### ACC.4 Build the profile and preferences screen

_High priority · 5 points · traces to FR-002, FR-003, AC-01_

Let users set the basics the planner needs: name, language, home area, and the travel preferences that shape recommendations.

**Acceptance criteria**

- A user can set display name, language, home or start area and default group size.
- Dietary, accessibility, activity-intensity and interest preferences are editable and optional.
- Nothing sensitive is inferred - every preference is explicitly chosen by the user.
- Changes take effect on the next plan without needing a new account or session.

**Subtasks**

- [ ] Model the preference schema with controlled vocabularies
- [ ] Build the /settings profile and preferences UI
- [ ] Implement the preference read/write API
- [ ] Wire home-area selection to the map location picker
- [ ] Add a per-trip override so preferences are defaults, not constraints

### ACC.5 Implement language selection with Arabic RTL

_Highest priority · 5 points · traces to FR-005, AC-16_

Arabic, English and French, switchable at any time, with correct direction and no reload.

**Acceptance criteria**

- The three languages are selectable from the header and from settings.
- Arabic renders RTL with correct mirroring of icons, drawers and progress indicators.
- The choice persists for signed-in users and for guests via cookie.
- Language is reflected in the URL so a page can be shared in a specific language.

**Subtasks**

- [ ] Set up next-intl with the three locales and message catalogues
- [ ] Implement dir switching and logical CSS properties audit
- [ ] Add locale-prefixed routing
- [ ] Persist locale to the user profile and to a guest cookie
- [ ] Snapshot-test key screens in all three locales

### ACC.6 Build the account hub: trips, favorites, bookings and notifications

_High priority · 5 points · traces to FR-004, FR-053_

One place where a user finds everything they have saved or booked, scoped strictly to them.

**Acceptance criteria**

- /trips, /favorites, /bookings and /notifications each list the user's own records only.
- Empty states explain what the section is for and link to the relevant entry point.
- Items can be removed where policy permits; bookings are never silently deleted.
- Lists paginate and remain usable at 390px.

**Subtasks**

- [ ] Build the /trips list with status chips
- [ ] Build the /favorites grid with unfavorite
- [ ] Build the /bookings list with status and policy summary
- [ ] Build the /notifications list with read/unread
- [ ] Add ownership assertions to every query and a cross-user access test

### ACC.7 Let users export and delete their data

_Medium priority · 3 points · traces to BR-22, BRD S16_

Give users a working route to see what is held about them and to remove it, including personalisation signals.

**Acceptance criteria**

- A user can request an export and receive their profile, trips, favorites, reviews and bookings.
- A user can reset personalisation signals without deleting the account.
- Account deletion anonymises rather than destroys records that bookings and accounting depend on.
- Both actions are audit logged.

**Subtasks**

- [ ] Implement the data export job and download
- [ ] Implement personalisation-signal reset
- [ ] Implement account deletion with referential anonymisation
- [ ] Add the privacy section to /settings
- [ ] Document the retention policy per entity

---

## CAT — Catalogue, Search & Discovery

`Phase 1 - Marketplace MVP` · `Traveller` · 8 stories · 37 subtasks · 51 pts

Everything a traveller can do before they ask for a plan: browse, search, filter, map, compare and save. This is the inventory layer the AI planner later reads from.

### CAT.1 Model the catalogue: businesses, experiences, categories and media

_Highest priority · 8 points · traces to FR-010, FR-014, BR-01, BR-03_

The structured entities behind every listing, with the labelling rules that stop estimated prices being shown as firm ones.

**Acceptance criteria**

- Businesses, experiences, categories, tags, amenities, suitability labels and media are modelled and migrated.
- Every price carries currency, price type (fixed, from, estimated, quote-required) and an effective source.
- Only active and published entities are returned by public endpoints.
- Weather sensitivity (indoor, outdoor, weather-sensitive) is a first-class field.

**Subtasks**

- [ ] Write the catalogue migration with all constraints
- [ ] Define the category, tag, amenity and suitability taxonomies
- [ ] Implement the price-model value object with type and source
- [ ] Add the publish/unpublish state machine
- [ ] Write repository tests asserting unpublished content never leaks

### CAT.2 Build the browse and explore pages

_Highest priority · 8 points · traces to FR-010, FR-012, AC-02_

The /explore surface with its filter rail, result grid and shareable state.

**Acceptance criteria**

- Users can browse destinations, experiences, attractions, restaurants and ready-made trips.
- Filters cover date, price, distance, category, group suitability, rating and availability where known.
- Filter state is encoded in the URL and restores exactly on reload or share.
- Results show count, active filter chips and a clear-all.

**Subtasks**

- [ ] Build the filter rail with all filter types
- [ ] Implement URL state sync for filters
- [ ] Build the result grid with skeleton and empty states
- [ ] Implement server-side filtering and pagination
- [ ] Add sort options and make the default explicit

### CAT.3 Implement keyword and natural-language search

_High priority · 8 points · traces to FR-011, BR-01_

Search that handles a typed keyword and a typed sentence, and never returns something that is not a real listing.

**Acceptance criteria**

- Keyword search covers name, description, category and locality across the three languages.
- Natural-language queries are parsed into filters and run against the same index.
- Every result maps to a real internal entity ID; no result is generated text.
- Zero-result queries offer relaxations rather than a dead end.

**Subtasks**

- [ ] Set up full-text search with Arabic, English and French configurations
- [ ] Generate and store pgvector embeddings for experiences
- [ ] Implement hybrid keyword plus vector retrieval
- [ ] Implement the query-to-filter parser
- [ ] Build the zero-result relaxation suggestions

### CAT.4 Build the interactive map view

_Highest priority · 8 points · traces to FR-013, AC-02_

A map that stays in sync with the list, so a marker and a card are always the same thing.

**Acceptance criteria**

- Users can switch between list and map without losing filters or scroll position.
- Markers correspond exactly to the visible result set and open the matching detail card.
- Clustering handles dense areas such as Beirut without hiding results.
- The map is usable at 390px and degrades to the list if the map fails to load.

**Subtasks**

- [ ] Integrate Google Maps Platform with an API key restricted by referrer
- [ ] Implement marker rendering, clustering and hover sync
- [ ] Build the map detail card and its link to the listing
- [ ] Implement viewport-driven search with a search-this-area control
- [ ] Add the map failure fallback

### CAT.5 Build the listing detail page

_Highest priority · 8 points · traces to FR-014, BR-03, BR-25_

The page a traveller decides on: verified data, labelled prices, policies, availability status and the booking mode stated up front.

**Acceptance criteria**

- The page shows verified business data, price model, location, duration, policies, images and availability status.
- Estimated, from-price and quote-required values are explicitly labelled as such.
- The booking mode - instant confirm, request to book, or inquiry - is visible before any commitment.
- Add to trip and favorite are available without forcing AI plan generation.

**Subtasks**

- [ ] Build the gallery, header and key-facts block
- [ ] Build the price and policy block with explicit labelling
- [ ] Build the availability panel reflecting booking mode
- [ ] Implement add-to-trip and favorite from the detail page
- [ ] Add structured data markup for search engines

### CAT.6 Implement favorites

_High priority · 3 points · traces to FR-015, FR-053_

Save a listing once, see it everywhere, and never end up with duplicates.

**Acceptance criteria**

- A user can favorite and unfavorite from grid, map card and detail page.
- A unique constraint prevents duplicate favorites at the database level.
- Favorites survive sign-out and sign-in.
- Optimistic UI rolls back cleanly if the write fails.

**Subtasks**

- [ ] Add the favorites table with a unique constraint
- [ ] Implement the toggle endpoint as idempotent
- [ ] Wire the favorite control into all three surfaces
- [ ] Handle the guest-to-signed-in favorite merge

### CAT.7 Build curated collections and ready-made trips

_Medium priority · 5 points · traces to FR-010, FR-016_

Editorial entry points for users who do not want to describe anything - a weekend in the north, a rainy-day list, a budget day out.

**Acceptance criteria**

- Admins can assemble collections from existing experiences.
- Collection pages render at /collections and each collection has its own page.
- A ready-made trip can be opened directly in the trip editor as a starting point.
- Collections respect publish state and never surface paused inventory.

**Subtasks**

- [ ] Model collections and collection items
- [ ] Build the admin collection editor
- [ ] Build the public collection index and detail pages
- [ ] Implement open-as-trip from a ready-made trip

### CAT.8 Surface related and nearby experiences

_Medium priority · 3 points · traces to FR-016_

Suggestions that work without invoking the planner, with honest distance and travel-time context.

**Acceptance criteria**

- Each listing shows nearby and related experiences.
- Suggestions are based on location, category and compatibility, not on popularity invented by AI.
- Distance and estimated travel time are shown with each suggestion.
- Paused or unpublished inventory never appears.

**Subtasks**

- [ ] Implement the PostGIS nearby query with a tunable radius
- [ ] Implement category and attribute similarity scoring
- [ ] Build the related-experiences component
- [ ] Add travel-time context from the routing service

---

## BIZ — Business Portal

`Phase 1 - Marketplace MVP` · `Business` · 10 stories · 45 subtasks · 55 pts

The supply side: onboarding, verification, listings, availability, the booking inbox and performance metrics. Nothing a business publishes reaches a traveller without passing admin verification.

### BIZ.1 Build business registration and onboarding

_Highest priority · 5 points · traces to FR-060, AC-09_

A business can create an organisation account and start preparing listings while verification is pending.

**Acceptance criteria**

- A business can register an organisation and land in a pending-verification state.
- Pending businesses can draft listings but cannot publish them.
- The onboarding checklist shows exactly what is still required.
- The organisation is isolated by RLS from the first row written.

**Subtasks**

- [ ] Model organisations, memberships and verification state
- [ ] Build the business sign-up flow
- [ ] Build the onboarding checklist screen
- [ ] Block publish while verification is pending
- [ ] Add the org-scoped session context

### BIZ.2 Build verification document submission

_High priority · 5 points · traces to FR-060, BR-02_

Collect what admin needs to verify a business, and make clear the badge is granted by Mshwar, never self-assigned.

**Acceptance criteria**

- A business can submit registration details and supporting documents.
- Uploaded documents are stored privately and are not publicly reachable.
- Verification state transitions are audit logged with actor and reason.
- The verified badge can only be set by an admin action.

**Subtasks**

- [ ] Build the document upload with private storage and signed URLs
- [ ] Model the verification submission and its review states
- [ ] Build the submission screen and status tracker
- [ ] Add the audit log entries for every state change

### BIZ.3 Implement staff invitations and role-based permissions

_Medium priority · 5 points · traces to FR-061, BR-21_

An owner can bring in staff without handing over finance and settings access.

**Acceptance criteria**

- An owner can invite staff by email and assign a role.
- Roles limit access to listings, bookings, finance and settings independently.
- A staff member of one organisation cannot read any data from another.
- Invitations expire and can be revoked.

**Subtasks**

- [ ] Define the role and permission matrix
- [ ] Implement invitation issue, accept and revoke
- [ ] Enforce permissions in the API and hide unauthorised UI
- [ ] Build the team management screen
- [ ] Write cross-org and cross-role access tests

### BIZ.4 Build the listing and experience editor

_Highest priority · 8 points · traces to FR-062, AC-09, BR-03_

The form a business fills in to create sellable inventory, with validation strict enough that the planner can trust the output.

**Acceptance criteria**

- A business can create and edit listings with category, images, location, duration, pricing and policies.
- Required fields and data types are validated before publication, not after.
- Location is set on a map and validated to fall inside Lebanon.
- Weather sensitivity and group suitability are set at creation.

**Subtasks**

- [ ] Build the multi-step experience editor
- [ ] Implement image upload through ImageKit with transformations
- [ ] Implement the map location picker with coordinate validation
- [ ] Implement the pricing editor with price type and currency
- [ ] Implement the publish gate with a pre-publish validation report

### BIZ.5 Build opening hours, slots, capacity and blackout management

_Highest priority · 8 points · traces to FR-063, FR-041, BR-08_

The availability model the booking engine and the planner both read from.

**Acceptance criteria**

- A business can set weekly opening hours and dated exceptions.
- Slots carry start, end, capacity and remaining capacity.
- Blackout dates remove availability without deleting the slot definition.
- Every availability record stores last-updated timestamp and source.

**Subtasks**

- [ ] Model opening hours, exceptions, slots and blackouts
- [ ] Build the weekly hours editor
- [ ] Build the slot generator with recurrence rules
- [ ] Build the calendar view with blackout toggling
- [ ] Record actor and timestamp on every change

### BIZ.6 Build the booking inbox

_Highest priority · 8 points · traces to FR-064, FR-066, AC-09_

Where a business sees requests and answers them, with the answer flowing straight back to the traveller's itinerary.

**Acceptance criteria**

- Requests appear in the inbox with party size, date, experience and traveller note.
- A business can confirm or reject with a reason and an optional message.
- The response updates the traveller's itinerary and triggers a notification.
- Only bookings belonging to the organisation are visible.

**Subtasks**

- [ ] Build the inbox list with status and date filters
- [ ] Build the request detail and respond panel
- [ ] Implement confirm and reject with reason capture
- [ ] Wire the response to the notification outbox
- [ ] Add the org-scope assertion test

### BIZ.7 Build the booking calendar and list views

_High priority · 5 points · traces to FR-066_

A business needs both a day-by-day operational view and a filterable list.

**Acceptance criteria**

- Bookings render on a calendar by day and week.
- The list filters by status, date range and experience.
- Both views show capacity consumed against capacity available.
- Export to CSV is available for the filtered set.

**Subtasks**

- [ ] Build the calendar component with day and week modes
- [ ] Build the filterable booking list
- [ ] Add the capacity-utilisation indicator
- [ ] Implement filtered CSV export

### BIZ.8 Implement pause and unpublish without data loss

_High priority · 3 points · traces to FR-068, BR-24_

A business must be able to stop taking bookings tomorrow without erasing last month.

**Acceptance criteria**

- An experience can be paused; it stops appearing in search and in new itineraries immediately.
- Existing bookings, reviews and analytics for the paused experience are preserved.
- Unpausing restores visibility without re-entering data.
- Paused state is visible in the business portal and in admin.

**Subtasks**

- [ ] Add the paused state and exclude it from all public queries
- [ ] Verify the planner excludes paused inventory
- [ ] Add pause and unpause controls with confirmation
- [ ] Write a test asserting historical records survive a pause

### BIZ.9 Build the business performance dashboard

_Medium priority · 5 points · traces to FR-067_

Views, saves, itinerary inclusions, booking requests, confirmations and revenue - all derived from auditable events, not estimates.

**Acceptance criteria**

- The dashboard shows views, saves, itinerary inclusions, requests, confirmations and revenue where applicable.
- Every metric traces back to a recorded platform event.
- Date-range filtering works and the comparison period is stated.
- Metrics are org-scoped and cannot leak across organisations.

**Subtasks**

- [ ] Define the event taxonomy for business-facing metrics
- [ ] Implement event capture at each surface
- [ ] Build the aggregation queries with date ranges
- [ ] Build the dashboard screen with charts and an export

### BIZ.10 Separate public and internal business contact details

_Medium priority · 3 points · traces to FR-069_

The phone number on the listing and the number operations calls at 8am are not the same number.

**Acceptance criteria**

- A business can set public contact details and separate internal fulfilment contacts.
- Internal contacts are never returned by public endpoints.
- Fulfilment instructions reach the confirmation email but not the public page.
- A test asserts internal fields are absent from the public serializer.

**Subtasks**

- [ ] Split the contact model into public and internal
- [ ] Build the contact and fulfilment settings screen
- [ ] Audit the public serializers for leakage
- [ ] Include fulfilment instructions in confirmation notifications only

---

## ADM — Admin, Moderation & Operations Console

`Phase 1 - Marketplace MVP` · `Admin` · 9 stories · 44 subtasks · 54 pts

The operations surface that stands between supply and demand: verification, moderation, taxonomy, support, configuration and platform health. Every action here is audited.

### ADM.1 Build the admin authentication and permission model

_Highest priority · 5 points · traces to FR-070, FR-073, BR-20_

Admin is a separate privilege level, not a flag on a normal account, and sensitive actions need elevated permission.

**Acceptance criteria**

- Admin access requires a distinct role that cannot be self-granted.
- Sensitive actions - financial overrides, booking state changes - require an elevated permission beyond basic admin.
- Every admin session is logged with actor, IP and duration.
- Admin routes are unreachable and invisible to non-admin accounts.

**Subtasks**

- [ ] Model admin roles and the elevated-permission tier
- [ ] Implement admin route guards on client and server
- [ ] Add admin session logging
- [ ] Build the admin role management screen
- [ ] Write privilege-escalation tests

### ADM.2 Build the business verification queue

_Highest priority · 8 points · traces to FR-070, BR-02, AC-10_

The queue where a submitted business becomes a verified one, or does not, with a reason either way.

**Acceptance criteria**

- An admin can review, approve, reject, suspend and re-verify businesses.
- Every action requires a reason and is written to the audit log.
- Approval sets the verified badge; nothing else can set it.
- The business is notified of the outcome with the reason where appropriate.

**Subtasks**

- [ ] Build the verification queue list with filters and SLA age
- [ ] Build the review detail with document viewer
- [ ] Implement approve, reject, suspend and re-verify with reason capture
- [ ] Wire outcome notifications to the business
- [ ] Add audit log entries for every transition

### ADM.3 Build content moderation for listings, images and reviews

_High priority · 8 points · traces to FR-071, BR-11, AC-10_

Moderate abuse without rewriting what people actually said, and keep the evidence.

**Acceptance criteria**

- An admin can moderate listings, images, reviews and other user-generated content.
- Moderation preserves the original content and history for audit and support.
- A review can be hidden for policy violation but never edited into different words.
- Bulk actions are available for obvious spam waves.

**Subtasks**

- [ ] Build the moderation queue with content-type filters
- [ ] Implement hide, restore and escalate actions with evidence retention
- [ ] Build the image moderation view
- [ ] Implement bulk moderation with a confirmation step
- [ ] Add the moderation audit trail

### ADM.4 Build taxonomy management

_High priority · 5 points · traces to FR-072_

Categories, tags, amenities, suitability labels and weather-sensitivity classes, editable without a deploy and without breaking existing records.

**Acceptance criteria**

- An admin can create, rename, merge and retire taxonomy terms.
- Changes propagate to search and planning without orphaning existing assignments.
- Retiring a term keeps historical assignments intact and stops new ones.
- Term changes are versioned and audited.

**Subtasks**

- [ ] Build the taxonomy CRUD screens
- [ ] Implement merge and retire with reassignment
- [ ] Trigger search reindex on taxonomy change
- [ ] Add taxonomy change auditing

### ADM.5 Build booking and payment inspection with support actions

_High priority · 8 points · traces to FR-073, BR-20_

When a traveller calls, operations needs the whole picture and a safe set of levers.

**Acceptance criteria**

- An admin can inspect any booking with its full state history, price snapshot and policy snapshot.
- Payment records and their provider references are visible without exposing secrets.
- Authorised support actions - force-cancel, mark refunded, resend confirmation - require elevated permission and a reason.
- Every support action is audit logged and visible on the booking timeline.

**Subtasks**

- [ ] Build the booking inspector with the full state timeline
- [ ] Surface payment records and reconciliation status
- [ ] Implement the elevated support actions with reason capture
- [ ] Add the booking audit timeline component
- [ ] Write tests asserting non-elevated admins cannot perform financial actions

### ADM.6 Build marketplace configuration and feature flags

_Medium priority · 5 points · traces to FR-074_

Commission, fees, planner limits and feature rollout changeable from the console, with a record of who changed what.

**Acceptance criteria**

- An admin can configure commission and fee rules without a code change.
- Feature flags can be toggled per environment and per cohort.
- Configuration changes are versioned with actor, timestamp and previous value.
- A misconfiguration can be rolled back to a previous version in one action.

**Subtasks**

- [ ] Model versioned configuration with an audit trail
- [ ] Build the fee and commission configuration screen
- [ ] Implement the feature-flag service and its client hook
- [ ] Implement configuration rollback
- [ ] Document which settings are safe to change live

### ADM.7 Build the platform health and KPI dashboard

_Medium priority · 5 points · traces to FR-075, BRD S19_

The numbers operations checks every morning, computed from defined event semantics rather than ad-hoc queries.

**Acceptance criteria**

- The dashboard shows user, business and booking KPIs with date filtering.
- Each metric has a written definition visible from the dashboard.
- Planner health - generation success rate, infeasible rate, fallback rate - is included.
- The dashboard loads in under three seconds on a month of data.

**Subtasks**

- [ ] Define the event semantics document and metric definitions
- [ ] Build the aggregation layer with materialised views where needed
- [ ] Build the KPI dashboard screen
- [ ] Add planner health metrics
- [ ] Add metric definition tooltips sourced from the definitions document

### ADM.8 Build the support case and report handling workflow

_Medium priority · 5 points · traces to FR-076_

Reported reviews, reported listings and user support cases tracked to resolution rather than handled in an inbox.

**Acceptance criteria**

- A report or support case has status, owner, evidence and resolution.
- Cases can be assigned, reassigned and escalated.
- Resolution requires an outcome note.
- Case age and backlog are visible on the health dashboard.

**Subtasks**

- [ ] Model support cases and reports
- [ ] Build the case queue and detail screens
- [ ] Implement assignment, escalation and resolution
- [ ] Link cases to the entities they concern
- [ ] Add case metrics to the health dashboard

### ADM.9 Build automated data-quality checks

_Medium priority · 5 points · traces to FR-077, BR-08, BR-09_

Catch stale availability, missing prices and invalid coordinates before a traveller finds them.

**Acceptance criteria**

- Scheduled checks flag stale availability, missing or unlabelled prices and coordinates outside Lebanon.
- Issues appear in an admin queue and can notify the owning business.
- A check can be triggered on demand as well as on schedule.
- Resolved issues close automatically on the next run.

**Subtasks**

- [ ] Implement the check framework and scheduler
- [ ] Write the stale-availability, missing-price and invalid-coordinate checks
- [ ] Build the data-quality queue screen
- [ ] Implement business notification for flagged issues
- [ ] Add check results to the health dashboard

---

## MAP — Maps, Routing & Weather

`Phase 2 - AI Planner` · `Planner` · 6 stories · 31 subtasks · 44 pts

The factual services the planner depends on: where things are, how long it takes to get between them, and whether the weather will ruin it. These must be real measurements, never guesses from a language model.

### MAP.1 Integrate the routing and travel-time service

_Highest priority · 8 points · traces to FR-031, AC-05, BR-04_

Real distance and duration between stops, cached hard because this is the most expensive external call in the product.

**Acceptance criteria**

- Travel time and distance between any two stops come from the configured routing provider.
- Results are cached by origin, destination, mode and time bucket.
- When the provider is unavailable, metrics are marked unavailable rather than estimated silently.
- Provider cost per plan is measurable and within the documented budget.

**Subtasks**

- [ ] Integrate the Google Maps routing API behind a provider interface
- [ ] Implement the distance-matrix cache with a TTL policy
- [ ] Implement graceful degradation when routing is unavailable
- [ ] Add per-plan routing cost instrumentation
- [ ] Write tests against a recorded provider fixture

### MAP.2 Build the start-location picker

_Highest priority · 5 points · traces to FR-030, BR-17_

Three ways to say where you are starting from, and device location is never the only one.

**Acceptance criteria**

- A user can set the start location by search, by dropping a pin on the map, or by granting device location.
- Manual entry is always available; the flow never dead-ends on a denied permission.
- Precise location is requested only with explicit user permission.
- The chosen start location is shown in plain language, not as raw coordinates.

**Subtasks**

- [ ] Build the location search with place autocomplete
- [ ] Build the map pin-drop picker
- [ ] Implement the geolocation permission flow with denial handling
- [ ] Implement reverse geocoding for a human-readable label
- [ ] Persist the default start location to the profile

### MAP.3 Implement multi-stop route optimisation

_Highest priority · 13 points · traces to FR-024, FR-032, AC-05_

Sequence the stops to cut pointless driving while honouring locked stops, appointment times and the return-by constraint. This is an OR-Tools job, not a prompt.

**Acceptance criteria**

- The optimiser sequences stops to reduce total travel time subject to hard constraints.
- Locked stops keep their position; appointment-time stops keep their window.
- The return-by time and closing times are respected or the plan is reported infeasible.
- Optimiser output is validated against the routing service before display.

**Subtasks**

- [ ] Model the itinerary as a constrained routing problem
- [ ] Implement the OR-Tools solver with time windows
- [ ] Encode locked stops and fixed appointments as constraints
- [ ] Implement post-solve validation against real routing data
- [ ] Add solver timeout handling and a deterministic fallback ordering
- [ ] Benchmark solve time across 3, 6 and 10 stop plans

### MAP.4 Integrate the weather forecast service

_High priority · 5 points · traces to FR-034, BR-18, AC-06_

Open-Meteo for the prototype behind an interface, because production will need something with a commercial guarantee.

**Acceptance criteria**

- Forecasts are retrieved per location and date for the planning horizon.
- The provider sits behind an interface so it can be swapped without touching the planner.
- Forecast data carries its source and retrieval timestamp.
- Forecast unavailability degrades to no warning, never to a wrong warning.

**Subtasks**

- [ ] Define the weather provider interface
- [ ] Implement the Open-Meteo adapter with caching
- [ ] Store forecast source and timestamp with every retrieval
- [ ] Implement the unavailable-forecast degradation path
- [ ] Document the production provider decision and its cost

### MAP.5 Implement weather-sensitivity classification and warnings

_High priority · 5 points · traces to FR-033, FR-034, AC-06_

Classify what the weather can ruin, then warn about it clearly - without cancelling anything on the user's behalf.

**Acceptance criteria**

- Every experience carries an indoor, outdoor or weather-sensitive classification, editable by verified business or admin.
- A warning appears when configured thresholds are met for an affected stop.
- The warning names the affected stops and shows the forecast source timestamp.
- A warning never cancels or alters a booking automatically.

**Subtasks**

- [ ] Add the classification field and its editors in business and admin
- [ ] Define the configurable warning thresholds
- [ ] Implement the warning evaluation in the planning pipeline
- [ ] Build the itinerary weather warning component
- [ ] Write tests asserting no booking state changes on a warning

### MAP.6 Implement partial replanning for weather-affected stops

_Medium priority · 8 points · traces to FR-035, AC-06_

Rebuild only the parts the weather hit, and leave the rest of the plan alone.

**Acceptance criteria**

- A user can rebuild only the weather-affected portion of a trip.
- Locked stops and unaffected stops keep their place where feasible.
- The replan recalculates downstream time, route and cost.
- If no feasible replacement exists, the user is told plainly rather than shown a worse plan silently.

**Subtasks**

- [ ] Implement affected-segment detection
- [ ] Implement the constrained partial re-solve
- [ ] Build the replan-affected-stops UI action
- [ ] Show a before-and-after diff of the changed segment
- [ ] Handle the no-feasible-alternative case explicitly

---

## AIP — AI Trip Builder

`Phase 2 - AI Planner` · `Planner` · 13 stories · 64 subtasks · 86 pts

The product's centrepiece and its biggest risk. The language model reads intent and writes explanations; it never invents a place, a price or a total. Every stop resolves to a real entity ID.

### AIP.1 Build the intent extraction service

_Highest priority · 8 points · traces to FR-020, FR-021, AC-03_

Turn a sentence in Arabic, Lebanese Arabic, English, French or a mix of them into validated structured constraints.

**Acceptance criteria**

- Free text in any of the supported languages returns a validated structured constraint object.
- Lebanese Arabic phrasing is handled, not just Modern Standard Arabic.
- Missing required fields produce a clarification request rather than a guess.
- The extractor output is schema-validated; malformed output is retried then failed safely.

**Subtasks**

- [ ] Define the trip-constraint schema with Pydantic
- [ ] Write and version the extraction prompt with few-shot examples
- [ ] Build the Lebanese Arabic example set for the prompt and the tests
- [ ] Implement schema validation with bounded retry
- [ ] Implement the clarification-question generator for missing fields
- [ ] Build the evaluation set of 100 real phrasings across the three languages

### AIP.2 Build the clarification loop

_High priority · 5 points · traces to FR-021, BRD S11_

Ask for what is genuinely missing, once, rather than interrogating the user or inventing defaults invisibly.

**Acceptance criteria**

- The planner asks only for constraints it cannot default safely.
- Any assumed default is shown to the user on the plan itself.
- The user can answer clarifications inline without losing what they already typed.
- No more than two clarification rounds before the planner proceeds with visible assumptions.

**Subtasks**

- [ ] Define which constraints are required versus defaultable
- [ ] Build the inline clarification UI
- [ ] Implement the assumptions banner on generated plans
- [ ] Cap clarification rounds and proceed with stated defaults

### AIP.3 Build structured candidate retrieval

_Highest priority · 8 points · traces to FR-022, BR-01, AC-03_

Pull candidates from Mshwar inventory before a single word of itinerary text is generated. This is the rule that keeps the product honest.

**Acceptance criteria**

- Candidate retrieval runs against the database before any generation step.
- Every candidate carries a valid internal entity ID and an active published status.
- Retrieval combines structured filters with vector similarity over verified descriptions.
- A plan cannot be assembled from anything not returned by retrieval.

**Subtasks**

- [ ] Implement the structured filter query from the constraint object
- [ ] Implement pgvector similarity retrieval over experience embeddings
- [ ] Implement hybrid scoring and candidate-set assembly
- [ ] Enforce the entity-ID contract between retrieval and assembly
- [ ] Write a test asserting no stop can exist without a retrieved candidate

### AIP.4 Implement hard eligibility filtering

_Highest priority · 8 points · traces to FR-023, AC-04, BR-05, BR-06_

Filter candidates against the constraints that cannot be negotiated: hours, duration, capacity, travel feasibility and budget.

**Acceptance criteria**

- Candidates are filtered against opening hours, duration, capacity, travel feasibility and budget.
- A hard-constraint violation is blocked, or flagged explicitly before display - never hidden.
- A strict budget is not exceeded without an explicit warning and user approval.
- A stop is not scheduled outside known opening hours unless the business supports appointment exceptions.

**Subtasks**

- [ ] Implement the opening-hours feasibility check with exception support
- [ ] Implement the capacity and availability eligibility check
- [ ] Implement the travel-feasibility check using real routing data
- [ ] Implement the budget check with the strict-budget warning path
- [ ] Build the constraint-violation explanation format
- [ ] Write the eligibility test matrix covering each constraint independently

### AIP.5 Implement candidate ranking

_High priority · 8 points · traces to BRD S11, BR-10_

Rank the eligible candidates against the user's stated preferences, with sponsored placement labelled and unable to bypass eligibility.

**Acceptance criteria**

- Ranking uses stated preferences, factual attributes and compatibility, not fabricated popularity.
- Sponsored placement is clearly labelled and cannot override a hard eligibility rule.
- Ranking weights are configurable and versioned.
- The same input produces the same ranking - the ranker is deterministic.

**Subtasks**

- [ ] Define the ranking feature set and weights
- [ ] Implement the deterministic scoring function
- [ ] Implement sponsored-placement injection with labelling and eligibility guard
- [ ] Make weights configurable through admin configuration
- [ ] Write ranking regression tests with a golden fixture set

### AIP.6 Build the itinerary assembly and cost computation

_Highest priority · 8 points · traces to FR-025, BR-04, AC-03_

Assemble the timeline and compute the total from stored price components. The model may explain the number; it may never produce it.

**Acceptance criteria**

- The itinerary shows timeline, total estimated cost, travel segments, stop durations and booking status.
- The total is computed from stored structured price components in backend code.
- Estimated and from-price components are labelled in the breakdown.
- A test asserts the displayed total equals the sum computed from the database.

**Subtasks**

- [ ] Implement the itinerary assembly service
- [ ] Implement the cost breakdown calculator over price components
- [ ] Build the itinerary timeline UI with travel segments
- [ ] Build the cost breakdown panel with per-component labelling
- [ ] Write the total-integrity test asserting no model involvement

### AIP.7 Implement stop locking and targeted regeneration

_Highest priority · 8 points · traces to FR-026, AC-07_

Let a user pin what they already love and ask for everything else to change.

**Acceptance criteria**

- A user can lock a stop and request changes to the rest of the plan.
- Locked stops are unchanged unless a feasibility conflict makes them impossible.
- Any forced change to a locked stop is explained explicitly.
- Regeneration recalculates time, route and cost for the whole plan.

**Subtasks**

- [ ] Add lock state to the itinerary model
- [ ] Pass locks as hard constraints into the solver
- [ ] Build the lock and unlock controls on the itinerary
- [ ] Implement the locked-stop conflict explanation
- [ ] Write tests covering lock plus infeasibility

### AIP.8 Implement single-stop replacement

_Highest priority · 5 points · traces to FR-027, AC-07_

Swap one stop for an alternative and recompute everything downstream before the user commits.

**Acceptance criteria**

- A user can replace a stop with alternatives that match the remaining constraints.
- Replacement recalculates downstream time, cost and route before confirmation.
- The alternatives list shows why each one fits.
- The user sees the delta in time and cost before accepting.

**Subtasks**

- [ ] Implement the alternatives query for a given slot
- [ ] Build the replace-stop panel with alternatives
- [ ] Implement downstream recalculation and the preview diff
- [ ] Implement accept and cancel for the proposed replacement

### AIP.9 Implement conversational trip refinement

_Medium priority · 8 points · traces to FR-028_

Convert phrases like less driving or make it more romantic into structured preference changes, then revalidate the whole plan.

**Acceptance criteria**

- Free-text edits are converted into structured preference changes.
- The revised plan is revalidated against all hard constraints.
- The user sees what the system understood before the plan changes.
- An unparseable request asks for clarification rather than silently doing nothing.

**Subtasks**

- [ ] Define the refinement intent schema
- [ ] Write and version the refinement prompt
- [ ] Build the refinement chat panel on the trip editor
- [ ] Show the interpreted change for confirmation
- [ ] Handle unparseable refinements with a clarification

### AIP.10 Build recommendation explanations with RAG

_Medium priority · 5 points · traces to FR-029, BR-04_

Explain why each stop is there, grounded in the user's stated preferences and factual attributes only.

**Acceptance criteria**

- Explanations reference user preferences and factual entity attributes.
- No explanation exposes model internals, scores or private data.
- Explanations are generated from retrieved verified content, not from model memory.
- An explanation never contains a price, time or total that contradicts the structured plan.

**Subtasks**

- [ ] Build the RAG retrieval over verified business content
- [ ] Write and version the explanation prompt with grounding constraints
- [ ] Implement the contradiction check between explanation and structured plan
- [ ] Build the explanation UI on each stop

### AIP.11 Persist itinerary versions for auditability

_High priority · 5 points · traces to BR-19, BR-25_

Every AI-generated version is stored before booking, so the plan that was booked can always be reconstructed.

**Acceptance criteria**

- Each generated or edited itinerary version is persisted with its constraints and inputs.
- A booking references the exact itinerary version it was made from.
- Version history is viewable by the user and by admin support.
- Versions are immutable once written.

**Subtasks**

- [ ] Model itinerary versions with immutable snapshots
- [ ] Persist the constraint object and retrieval inputs per version
- [ ] Link bookings to itinerary versions
- [ ] Build the version history view
- [ ] Write immutability tests

### AIP.12 Build the AI failure fallback path

_Highest priority · 5 points · traces to AC-13, BRD S18_

When the model provider is down, the product still works - it just works without natural language.

**Acceptance criteria**

- AI provider failure falls back to structured filter-based planning.
- The fallback never corrupts persisted state or leaves a half-written plan.
- The user is told plainly that the natural-language path is unavailable.
- The fallback is exercised by an automated test and by a documented manual drill.

**Subtasks**

- [ ] Implement provider timeout, retry and circuit-breaker policy
- [ ] Implement the structured-only planning fallback
- [ ] Ensure transactional integrity across the fallback boundary
- [ ] Build the degraded-mode user messaging
- [ ] Add a fault-injection test for provider failure

### AIP.13 Build prompt-injection and output-safety guards

_Highest priority · 5 points · traces to BRD S16, BR-04_

User text and business-written descriptions both reach the model. Neither may be allowed to change what the system does.

**Acceptance criteria**

- Business descriptions and user input are treated as data, never as instructions.
- The model cannot trigger a booking, a payment or a price change through its output.
- Model output is schema-validated before it influences any state.
- Injection attempts are logged and surfaced in the admin health dashboard.

**Subtasks**

- [ ] Implement input and retrieved-content isolation in the prompt structure
- [ ] Restrict the model to read-only tool surfaces
- [ ] Add strict output schema validation at every model boundary
- [ ] Build the injection-attempt test suite
- [ ] Log and alert on suspected injection patterns

---

## BKG — Availability, Booking & Payments

`Phase 3 - Booking` · `Booking` · 12 stories · 54 subtasks · 76 pts

Where a plan becomes a commitment and money becomes involved. Snapshots, idempotency and reconciliation are non-negotiable here.

### BKG.1 Implement the three booking modes

_Highest priority · 5 points · traces to FR-040, BR-07, BR-25_

Instant confirm, request to book and inquiry only - with the mode visible before the traveller commits to anything.

**Acceptance criteria**

- A business can configure each experience as instant confirm, request to book or inquiry only.
- The mode is shown to the traveller before any commitment step.
- Instant confirm is only selectable when the business maintains authoritative capacity.
- The product keeps a clear distinction between a suggestion, a request and a confirmed booking.

**Subtasks**

- [ ] Add the booking-mode field and its business-side editor
- [ ] Gate instant confirm on authoritative-capacity configuration
- [ ] Surface the mode on listing, itinerary and checkout
- [ ] Implement the three distinct commitment flows

### BKG.2 Implement overbooking prevention with database-level guarantees

_Highest priority · 8 points · traces to FR-041, BR-07_

Two travellers clicking at the same second must not both get the last place. Enforce it in Postgres, not in application logic.

**Acceptance criteria**

- Concurrent booking attempts on the last slot produce exactly one success.
- Capacity is enforced by a transactional check or an EXCLUDE constraint, not by a read-then-write.
- A concurrency test with parallel requests proves no oversell.
- Failure to secure capacity returns a clear, actionable message.

**Subtasks**

- [ ] Implement the capacity constraint with btree_gist EXCLUDE where applicable
- [ ] Implement the transactional hold-then-commit path
- [ ] Write the parallel-request concurrency test
- [ ] Implement hold expiry for abandoned checkouts
- [ ] Build the capacity-unavailable user messaging

### BKG.3 Implement the booking state machine

_Highest priority · 8 points · traces to FR-043, AC-11, BR-25_

Draft, pending, confirmed, rejected, cancelled, completed, refunded - with invalid transitions blocked and every move audited.

**Acceptance criteria**

- All seven states exist and every transition is explicitly allowed or blocked.
- An invalid transition raises an error and changes nothing.
- Every transition records actor, timestamp, reason and correlation ID.
- The state timeline is visible to the traveller, the business and admin.

**Subtasks**

- [ ] Define the state machine and its transition table
- [ ] Implement transition guards at the service layer
- [ ] Implement the booking audit timeline
- [ ] Write exhaustive transition tests including every blocked path
- [ ] Build the timeline UI component shared across surfaces

### BKG.4 Implement price and policy snapshots

_Highest priority · 5 points · traces to FR-042, BR-12, AC-11_

A booking freezes the price and the cancellation policy as they were at the moment of commitment.

**Acceptance criteria**

- A booking stores an immutable snapshot of price components and cancellation policy.
- A later price or policy change by the business does not affect an existing booking.
- The snapshot is what the confirmation, the refund calculation and any dispute reference.
- A test proves a policy edit after booking leaves the booking's terms unchanged.

**Subtasks**

- [ ] Model the snapshot structures as immutable JSON columns
- [ ] Capture snapshots at the commitment transaction
- [ ] Use the snapshot in confirmation rendering and refund computation
- [ ] Write the post-booking-edit immutability test

### BKG.5 Build the checkout flow

_Highest priority · 8 points · traces to FR-042, FR-044, AC-11_

From listing or itinerary to a committed booking, with party size, date, price and policy all confirmed before money is discussed.

**Acceptance criteria**

- A user can book from a listing page and from within an itinerary.
- Checkout captures party size, date and time, and shows the price and policy before commitment.
- A payment request is created only after the backend validates price, availability and booking state.
- The flow works at 390px and in all three languages.

**Subtasks**

- [ ] Build the checkout screens for all three booking modes
- [ ] Implement server-side pre-payment validation
- [ ] Implement the booking draft and hold lifecycle
- [ ] Build the review-and-confirm step with the full breakdown
- [ ] Localise and RTL-test the checkout flow

### BKG.6 Build the payment provider abstraction

_Highest priority · 8 points · traces to FR-045, BRD S26_

Lebanon is not a supported Stripe country. Stripe test mode can carry the academic demo, but the interface has to assume it will be replaced.

**Acceptance criteria**

- Payments go through a provider interface; no Stripe type appears in domain code.
- Provider-specific identifiers are stored separately from business booking identifiers.
- A second provider can be added without changing the booking service.
- The production-provider decision and its constraints are documented for the pilot phase.

**Subtasks**

- [ ] Define the payment provider interface and domain types
- [ ] Implement the Stripe test-mode adapter
- [ ] Separate provider references from booking references in the schema
- [ ] Write a stub second adapter proving the abstraction holds
- [ ] Document the Lebanon payment-provider constraint and candidate options

### BKG.7 Implement webhook verification and reconciliation

_Highest priority · 8 points · traces to FR-045, FR-048, BR-14, AC-12_

Payment succeeded does not mean booking confirmed. The two have to be reconciled, and the webhook has to be proven genuine.

**Acceptance criteria**

- Webhook signatures are verified; unverified payloads are rejected and logged.
- Webhook handling is idempotent - a replayed event changes nothing twice.
- A payment success with a failed booking is detected and resolved by reconciliation.
- Mismatches appear in an operations queue rather than failing silently.

**Subtasks**

- [ ] Implement signature verification for the Stripe adapter
- [ ] Implement idempotent webhook processing with an event log
- [ ] Build the reconciliation job for payment and booking mismatches
- [ ] Build the operations reconciliation queue
- [ ] Write replay and mismatch tests

### BKG.8 Implement idempotency across booking and payment writes

_Highest priority · 5 points · traces to BR-13, FR-048_

A double-click, a retry or a flaky network must not produce two reservations or two charges.

**Acceptance criteria**

- Booking and payment operations accept and enforce an idempotency key.
- A repeated request with the same key returns the original result without a second side effect.
- Keys expire on a documented schedule.
- A test simulates duplicate submission and asserts a single booking and a single charge.

**Subtasks**

- [ ] Add the idempotency key store with TTL
- [ ] Enforce idempotency in the booking commitment endpoint
- [ ] Enforce idempotency in the payment intent endpoint
- [ ] Write duplicate-submission tests for both paths

### BKG.9 Implement the outbox pattern for reliable side effects

_High priority · 5 points · traces to FR-080, FR-083, migration 004_

A booking confirmation must not be lost because an email provider was down at the wrong moment.

**Acceptance criteria**

- Side effects are written to an outbox in the same transaction as the state change.
- A worker publishes outbox entries with retry and backoff.
- A failed side effect never rolls back or duplicates the business transaction.
- Outbox depth and failure rate are observable.

**Subtasks**

- [ ] Implement the outbox table and transactional write
- [ ] Build the outbox publisher worker with retry and dead-lettering
- [ ] Wire booking events into the outbox
- [ ] Add outbox depth and failure metrics to monitoring

### BKG.10 Implement cancellation and refund eligibility

_High priority · 8 points · traces to FR-047, BR-16, BR-15_

Eligibility is computed from the policy snapshot on the booking, not from whatever the policy says today.

**Acceptance criteria**

- Cancellation eligibility and any refund amount are computed from the booking's policy snapshot.
- A traveller sees the exact consequence before confirming a cancellation.
- A business cancellation requires a reason and triggers the refund or alternative workflow.
- Refund state is reflected in the booking state machine and in notifications.

**Subtasks**

- [ ] Implement the policy evaluation engine over snapshots
- [ ] Build the traveller cancellation flow with consequence preview
- [ ] Build the business cancellation flow with reason capture
- [ ] Implement refund initiation through the provider interface
- [ ] Write policy-evaluation tests across the full window matrix

### BKG.11 Build booking confirmations

_Highest priority · 3 points · traces to FR-046, AC-11_

An itemised confirmation generated from persisted data, in the user's language.

**Acceptance criteria**

- The confirmation itemises the booking, the price breakdown and the policies.
- It is generated from persisted booking and payment records, never from generated text.
- It is delivered by email and in-app and is retrievable later from the bookings list.
- It renders correctly in Arabic RTL.

**Subtasks**

- [ ] Build the confirmation document template in three languages
- [ ] Generate confirmations from persisted records only
- [ ] Deliver by email and in-app through the outbox
- [ ] Make confirmations retrievable from the bookings list

### BKG.12 Prove that failed payments never produce confirmed bookings

_Highest priority · 5 points · traces to FR-048, AC-12, BR-14_

The specific failure the BRD calls out: a timed-out or failed payment must not leave a confirmed paid booking behind.

**Acceptance criteria**

- A failed payment leaves the booking unconfirmed and the capacity released.
- A timed-out payment resolves deterministically through reconciliation.
- No code path can confirm a booking without a verified successful payment for paid inventory.
- Fault-injection tests cover failure, timeout and late-success cases.

**Subtasks**

- [ ] Write the fault-injection harness for payment outcomes
- [ ] Test the failed-payment path end to end
- [ ] Test the timeout-then-late-success path
- [ ] Verify capacity release on every failure path

---

## NTF — Notifications & Messaging

`Phase 3 - Booking` · `Platform` · 5 stories · 21 subtasks · 19 pts

Transactional messages that are triggered by persisted events, retryable, observable, and kept strictly separate from marketing.

### NTF.1 Build the notification service and channel abstraction

_High priority · 5 points · traces to FR-080, FR-083_

One service, multiple channels, every message driven by a persisted event.

**Acceptance criteria**

- Notifications are triggered by persisted events through the outbox, never fired inline.
- Email and in-app channels are implemented behind a shared interface.
- Delivery attempts, failures and retries are recorded per notification.
- A failed delivery never duplicates the underlying booking or payment action.

**Subtasks**

- [ ] Define the notification event taxonomy
- [ ] Implement the notification service and channel interface
- [ ] Implement the email adapter with templating
- [ ] Implement the in-app notification store and feed
- [ ] Record delivery attempts and outcomes

### NTF.2 Build traveller transactional notifications

_High priority · 5 points · traces to FR-080_

Booking requested, confirmed, rejected, cancelled, payment status and material itinerary changes.

**Acceptance criteria**

- Each listed event produces a notification in the user's language.
- Every notification links directly to the relevant booking or trip.
- Material itinerary changes made by the platform are notified, not silently applied.
- Users can see the full notification history at /notifications.

**Subtasks**

- [ ] Build templates for each traveller event in three languages
- [ ] Wire booking lifecycle events to notifications
- [ ] Implement the material-change detection for itineraries
- [ ] Build the in-app notification feed with read state

### NTF.3 Build business notifications

_High priority · 3 points · traces to FR-081_

A new request that sits unanswered is lost revenue, so the business hears about it immediately and can act in one click.

**Acceptance criteria**

- A business is notified of new booking requests and other time-sensitive actions.
- Every notification contains a direct link to the relevant booking.
- Notification preferences are configurable per staff role.
- An unanswered request escalates on a configurable schedule.

**Subtasks**

- [ ] Build business notification templates
- [ ] Wire request events to business notifications with deep links
- [ ] Implement per-role notification preferences
- [ ] Implement the unanswered-request escalation

### NTF.4 Separate marketing from transactional communication

_High priority · 3 points · traces to FR-082_

A user can opt out of marketing and still receive the email that tells them their booking was rejected.

**Acceptance criteria**

- Marketing and transactional messages use separate consent flags.
- Opting out of marketing never suppresses a transactional message.
- Consent state and its change history are stored per user.
- Every marketing message carries a working unsubscribe.

**Subtasks**

- [ ] Model marketing and transactional consent separately
- [ ] Build the communication preferences screen
- [ ] Enforce the consent check at send time
- [ ] Implement unsubscribe handling and its audit trail

### NTF.5 Make notification delivery observable and retryable

_Medium priority · 3 points · traces to FR-083_

Failures should be visible in a dashboard, not discovered by a complaining customer.

**Acceptance criteria**

- Delivery failures are visible in the admin health dashboard.
- Failed notifications retry with backoff and dead-letter after a documented limit.
- Retrying a notification never repeats the booking or payment action behind it.
- Delivery rate and failure rate are tracked per channel.

**Subtasks**

- [ ] Implement retry with exponential backoff and dead-lettering
- [ ] Build the notification health panel in admin
- [ ] Add per-channel delivery metrics
- [ ] Implement manual resend from admin with an audit entry

---

## GRP — Group Planning, Favorites & Reviews

`Phase 4 - Group + Weather` · `Traveller` · 6 stories · 27 subtasks · 32 pts

The social layer: share a trip, collect votes, and let people who actually went write about it. Reviews are moderated for abuse but never rewritten.

### GRP.1 Build shareable group-planning links with roles

_High priority · 8 points · traces to FR-050, AC-08_

A trip owner shares one link, and the link itself decides whether the recipient can look, vote or edit.

**Acceptance criteria**

- A trip owner can create a shareable link with a view, vote or edit permission.
- A participant can join without creating an account when the link permits it.
- The owner can revoke a link and see who has joined.
- Permissions are enforced server-side, not just hidden in the UI.

**Subtasks**

- [ ] Model share links, permissions and participants
- [ ] Implement link creation, revocation and expiry
- [ ] Implement the guest participation path with a session identity
- [ ] Build the share dialog and the participants panel
- [ ] Write permission enforcement tests per role

### GRP.2 Implement participant voting

_High priority · 5 points · traces to FR-051, AC-08_

Participants vote on suggested experiences and categories, and can change their mind until the trip is locked.

**Acceptance criteria**

- Participants can vote on suggested experiences and categories.
- Votes are attributed to a participant or session and can be updated until the trip is locked.
- Vote counts update for everyone without a manual refresh.
- Locking the trip closes voting and states who locked it and when.

**Subtasks**

- [ ] Model votes with participant attribution
- [ ] Build the voting UI on the group trip page
- [ ] Implement vote updates and the tally
- [ ] Implement trip locking and its effect on voting
- [ ] Add polling or live updates for the tally

### GRP.3 Build the group recommendation summary

_Medium priority · 5 points · traces to FR-052_

Summarise where the group agrees and where it does not, without exposing anything a participant did not agree to share.

**Acceptance criteria**

- The summary reports agreement, disagreement and the main trade-offs.
- No participant's private preference is shown beyond what they agreed to share.
- The summary is derived from recorded votes and shared preferences only.
- The summary updates as votes change.

**Subtasks**

- [ ] Define the group-fit scoring across participant preferences
- [ ] Implement the privacy filter over participant data
- [ ] Build the agreement summary component
- [ ] Write tests asserting unshared preferences never appear

### GRP.4 Implement review eligibility and submission

_High priority · 8 points · traces to FR-054, BR-11, AC-10_

Only people who actually had the interaction can review it, and each of them only once.

**Acceptance criteria**

- A review can only be submitted after a completed or confirmed qualifying interaction.
- Eligibility is enforced server-side and duplicate reviews are prevented.
- Every review is attributable to a real account and a specific eligibility event.
- Reviews can be reported and moderated for abuse but never edited by the platform.

**Subtasks**

- [ ] Model reviews with their eligibility event reference
- [ ] Implement the eligibility check and duplicate prevention
- [ ] Build the review submission form with rating dimensions
- [ ] Build the review display with verified-stay indication
- [ ] Implement review reporting into the moderation queue

### GRP.5 Implement business responses to reviews

_Medium priority · 3 points · traces to FR-055, BR-11_

A business gets a right of reply, and no ability to make a review disappear.

**Acceptance criteria**

- A business can publicly respond to a review once.
- A business cannot edit, hide or delete a legitimate review.
- Responses are subject to the same moderation policy as reviews.
- The response is shown beneath the review with a clear business label.

**Subtasks**

- [ ] Model review responses
- [ ] Build the respond control in the business portal
- [ ] Enforce the one-response and no-edit rules
- [ ] Route responses through moderation

### GRP.6 Build review aggregation and display

_Medium priority · 3 points · traces to FR-054, BR-01_

Ratings that roll up honestly, including the distribution rather than just the average.

**Acceptance criteria**

- Listing pages show the average rating, the count and the distribution.
- Aggregates recompute when a review is added, hidden or restored.
- A listing with too few reviews says so rather than showing a misleading average.
- Hidden reviews are excluded from aggregates but retained for audit.

**Subtasks**

- [ ] Implement the aggregation with incremental recompute
- [ ] Build the rating summary component with distribution
- [ ] Implement the low-sample display rule
- [ ] Write tests covering hide, restore and recompute

---

## I18N — Localization, RTL & Accessibility

`Cross-cutting` · `Design` · 4 stories · 19 subtasks · 26 pts

Arabic, English and French as first-class languages, Arabic RTL that actually works, and a product usable by keyboard and screen reader. This is treated as a delivery gate, not a polish pass.

### I18N.1 Build the translation workflow and message catalogues

_Highest priority · 5 points · traces to FR-005, AC-16_

One place where strings live, with a process that catches a missing translation before a user does.

**Acceptance criteria**

- All user-facing strings come from message catalogues; no hardcoded copy ships.
- Missing keys fail the build rather than falling back silently in production.
- Pluralisation, date, number and currency formatting are locale-aware.
- Translator handoff and review are documented.

**Subtasks**

- [ ] Set up the catalogue structure and key naming convention
- [ ] Add a CI check for hardcoded strings and missing keys
- [ ] Implement locale-aware date, number and currency formatting
- [ ] Write the translation contribution guide
- [ ] Complete the English, Arabic and French catalogues for MVP screens

### I18N.2 Make Arabic RTL correct across every surface

_Highest priority · 8 points · traces to FR-005, AC-16_

Direction is not a stylesheet flip. Icons, drawers, progress, charts, maps and form affordances all need checking.

**Acceptance criteria**

- Every MVP screen renders correctly in RTL at 390px and 1440px.
- Directional icons, drawers, carousels and progress indicators mirror correctly.
- No component uses physical left/right where logical properties are needed.
- Mixed-direction content - Arabic text with Latin place names or numbers - renders without bidi corruption.

**Subtasks**

- [ ] Audit and convert physical CSS properties to logical properties
- [ ] Fix directional icon and navigation mirroring
- [ ] Handle bidi isolation for mixed-direction strings
- [ ] Capture RTL visual snapshots for every MVP screen
- [ ] Test the map, charts and date pickers specifically in RTL

### I18N.3 Handle Lebanese Arabic in AI input

_High priority · 5 points · traces to FR-020, AC-16_

People will not type Modern Standard Arabic into the planner. The intent extractor has to cope with how Lebanese Arabic is actually written, including Arabizi.

**Acceptance criteria**

- The intent extractor handles Lebanese dialect phrasing and Latin-script Arabizi.
- A dialect evaluation set is part of the automated test suite.
- Extraction accuracy on the dialect set meets the agreed threshold before release.
- Unrecognised phrasing asks for clarification rather than guessing.

**Subtasks**

- [ ] Build the Lebanese Arabic and Arabizi evaluation set
- [ ] Tune the extraction prompt with dialect examples
- [ ] Add the dialect evaluation to CI with a pass threshold
- [ ] Implement the low-confidence clarification path

### I18N.4 Meet WCAG 2.2 AA across the MVP screens

_High priority · 8 points · traces to Package review findings_

Keyboard operability, visible focus, correct semantics and adequate contrast - verified, not assumed.

**Acceptance criteria**

- Every interactive element is reachable and operable by keyboard with a visible focus indicator.
- Colour contrast meets 4.5:1 for text and 3:1 for control boundaries.
- Forms have programmatic labels, error association and clear error text.
- Automated axe checks run in CI and a manual screen-reader pass covers the booking flow.

**Subtasks**

- [ ] Add automated axe-core checks to component and page tests
- [ ] Fix keyboard traps and focus-order problems
- [ ] Add labels, descriptions and error associations to all forms
- [ ] Implement skip links and landmark structure
- [ ] Run and document a manual screen-reader pass on the booking flow

---

## SEC — Security, Privacy & Trust

`Cross-cutting` · `Platform` · 7 stories · 28 subtasks · 34 pts

The controls that make the marketplace safe to transact in: authorisation everywhere, auditing of anything consequential, and no secret or personal record leaking into a log.

### SEC.1 Implement authorisation checks on every endpoint

_Highest priority · 8 points · traces to BR-21, FR-073_

Every endpoint answers who is asking and what they are allowed to touch, with no reliance on an unguessable ID.

**Acceptance criteria**

- Every endpoint enforces authentication and object-level authorisation.
- No endpoint relies on an opaque identifier as its only protection.
- Automated tests attempt cross-user and cross-org access on every resource type.
- Authorisation failures return a consistent response that does not leak existence.

**Subtasks**

- [ ] Define the permission model and its enforcement helper
- [ ] Audit and guard every existing endpoint
- [ ] Write the automated IDOR test suite across resource types
- [ ] Standardise the authorisation failure response

### SEC.2 Build the audit log

_Highest priority · 5 points · traces to FR-070, BR-20, FR-073_

Anything consequential - verification, moderation, financial overrides, configuration - leaves a record of who, what, when and why.

**Acceptance criteria**

- Consequential actions write an audit entry with actor, action, target, reason and timestamp.
- Audit entries are append-only and cannot be edited or deleted from the application.
- Admin can search and filter the audit log.
- Audit coverage is asserted by tests for each consequential action type.

**Subtasks**

- [ ] Design the append-only audit schema
- [ ] Implement the audit-write helper and apply it at each call site
- [ ] Build the admin audit log search screen
- [ ] Write coverage tests asserting each action type audits

### SEC.3 Implement rate limiting and abuse controls

_High priority · 5 points · traces to FR-001, BRD S16_

Protect sign-in, password reset, search, AI generation and booking from volume abuse and from cost blowout.

**Acceptance criteria**

- Authentication, reset, search, AI generation and booking endpoints are rate limited.
- Limits differ per endpoint and per authentication state.
- Exceeded limits return a clear, non-leaking response with a retry hint.
- AI generation has a per-user and per-day cost ceiling.

**Subtasks**

- [ ] Implement the rate-limiting middleware with a shared store
- [ ] Configure per-endpoint limits and document them
- [ ] Implement the AI generation cost ceiling and its user messaging
- [ ] Add rate-limit metrics and alerting

### SEC.4 Prevent secrets and personal data reaching logs

_Highest priority · 3 points · traces to AC-15_

Logs and error reports carry correlation IDs, never tokens, card references or personal records.

**Acceptance criteria**

- No secret, token or payment identifier appears in any log or error report.
- Personal data in logs is minimised and redacted by a shared scrubber.
- Every request carries a correlation ID through logs, traces and Sentry.
- An automated test asserts the scrubber removes each sensitive field class.

**Subtasks**

- [ ] Implement the log scrubber with a sensitive-field registry
- [ ] Configure Sentry beforeSend scrubbing
- [ ] Implement correlation ID propagation across web and API
- [ ] Write scrubber tests for every sensitive field class

### SEC.5 Harden file upload and media handling

_High priority · 3 points · traces to FR-062, FR-060_

Images and verification documents are untrusted input until proven otherwise.

**Acceptance criteria**

- Uploads are validated by content type and by actual content, not by file extension.
- Verification documents are stored privately and served only through short-lived signed URLs.
- Image processing runs through ImageKit rather than in the application process.
- Upload size and rate are limited per organisation.

**Subtasks**

- [ ] Implement server-side content validation for uploads
- [ ] Configure private storage and signed URL issuance for documents
- [ ] Configure ImageKit transformations and delivery
- [ ] Add upload size and rate limits

### SEC.6 Write the privacy policy, terms and consent flows

_High priority · 5 points · traces to BR-22, BRD S16_

The public trust pages and the consent points that make personalisation lawful and reversible.

**Acceptance criteria**

- Privacy policy, terms of service, cancellation policy and community guidelines are published.
- Consent for personalisation and for marketing is captured separately and is revocable.
- Cookie consent defaults to the privacy-preserving option.
- The trust pages are available in all three languages.

**Subtasks**

- [ ] Draft the policy documents with the required Lebanon-specific content
- [ ] Build the trust and policy pages
- [ ] Implement the consent capture and revocation flows
- [ ] Implement cookie consent defaulting to essential only

### SEC.7 Run a pre-pilot security review

_Medium priority · 5 points · traces to Phase 5, BRD S16_

Before real businesses and real travellers, run a structured review against the controls this epic built.

**Acceptance criteria**

- A threat model covering the three surfaces is documented.
- A dependency and container vulnerability scan runs in CI and is clean of criticals.
- A penetration test or structured internal review is completed with findings tracked.
- All critical and high findings are resolved or formally accepted before pilot.

**Subtasks**

- [ ] Write the threat model for traveller, business and admin surfaces
- [ ] Add dependency and container scanning to CI
- [ ] Run the structured security review and log findings as issues
- [ ] Track findings to resolution or documented acceptance

---

## QA — Quality, Testing & Evaluation

`Cross-cutting` · `Platform` · 8 stories · 37 subtasks · 47 pts

The BRD names automated coverage of auth, trip-generation validation, booking and payment transitions as an MVP acceptance criterion. This epic makes that real, and adds the AI-specific evaluation that ordinary tests cannot provide.

### QA.1 Establish the test strategy and pyramid

_High priority · 3 points · traces to BRD S24, AC-14_

Agree what is tested where, so the suite stays fast and the gaps are deliberate.

**Acceptance criteria**

- The test strategy document defines unit, integration, end-to-end and evaluation layers.
- Coverage targets are set per layer and per critical path.
- Test data management and fixtures are standardised.
- The full suite runs in under ten minutes in CI.

**Subtasks**

- [ ] Write the test strategy document
- [ ] Set up the test database and fixture factories
- [ ] Configure the CI test matrix and parallelism
- [ ] Define and enforce coverage targets on critical paths

### QA.2 Cover the authentication paths with automated tests

_Highest priority · 5 points · traces to AC-14, FR-001_

One of the four paths the MVP acceptance criteria name explicitly.

**Acceptance criteria**

- Registration, sign-in, sign-out, recovery and session expiry are covered end to end.
- Negative cases - wrong password, expired token, reused reset token - are covered.
- Account enumeration resistance is asserted by test.
- The suite runs on every pull request.

**Subtasks**

- [ ] Write unit tests for the credential and session services
- [ ] Write integration tests for every auth endpoint
- [ ] Write end-to-end tests for the sign-in and recovery journeys
- [ ] Assert enumeration resistance and rate limiting

### QA.3 Cover trip-generation validation with automated tests

_Highest priority · 8 points · traces to AC-14, AC-04_

Prove the planner never produces an infeasible plan, and never invents an entity.

**Acceptance criteria**

- Every generated stop is asserted to resolve to a real, active entity ID.
- Hard-constraint satisfaction is asserted for budget, hours, duration, group size and return time.
- The infeasible case is asserted to report infeasibility rather than degrade silently.
- The itinerary total is asserted to equal the database-computed sum.

**Subtasks**

- [ ] Build the planner test harness with deterministic fixtures
- [ ] Write entity-integrity assertions over generated plans
- [ ] Write the constraint-satisfaction test matrix
- [ ] Write the infeasibility reporting tests
- [ ] Write the total-integrity test

### QA.4 Cover booking and payment state transitions with automated tests

_Highest priority · 8 points · traces to AC-14, AC-11, FR-048_

The fourth named path, and the one with money attached.

**Acceptance criteria**

- Every allowed transition is tested and every blocked transition is asserted to fail.
- Concurrency, idempotency and overbooking are covered by dedicated tests.
- Payment failure, timeout and late-success paths are covered by fault injection.
- Reconciliation is covered including the mismatch case.

**Subtasks**

- [ ] Write the exhaustive state-transition test suite
- [ ] Write the concurrency and idempotency tests
- [ ] Write the payment fault-injection tests
- [ ] Write the reconciliation tests including mismatch resolution

### QA.5 Build the AI evaluation suite

_High priority · 8 points · traces to AC-16, FR-020, BRD S24_

Model behaviour needs evaluation sets and thresholds, because a unit test cannot tell you the extractor got worse.

**Acceptance criteria**

- An evaluation set covers intent extraction across Arabic, Lebanese Arabic, English and French.
- Grounding is evaluated - no explanation may reference an entity or fact not retrieved.
- Evaluation runs in CI with a pass threshold and blocks regression.
- Results are tracked over time so prompt changes can be compared.

**Subtasks**

- [ ] Build the intent extraction evaluation set with expected outputs
- [ ] Build the grounding and hallucination evaluation
- [ ] Implement the evaluation runner with thresholds
- [ ] Wire evaluation into CI as a gate
- [ ] Build the evaluation result history report

### QA.6 Build end-to-end journey tests

_High priority · 5 points · traces to BRD S9, S24_

The three journeys that matter, driven through a real browser in all three languages.

**Acceptance criteria**

- The traveller journey from search to confirmed booking passes end to end.
- The business journey from registration to responding to a request passes end to end.
- The admin journey from verification queue to approved business passes end to end.
- Each journey runs at 390px and 1440px and at least once in Arabic RTL.

**Subtasks**

- [ ] Set up Playwright with the three-locale and two-viewport matrix
- [ ] Write the traveller booking journey test
- [ ] Write the business onboarding and response journey test
- [ ] Write the admin verification journey test
- [ ] Add visual regression snapshots for key screens

### QA.7 Run performance and load testing

_Medium priority · 5 points · traces to BRD S15_

Find out where it breaks before the pilot does.

**Acceptance criteria**

- Response-time targets are defined per endpoint class and asserted under load.
- Planner generation time is measured and meets the agreed budget at the 95th percentile.
- Database query performance is profiled and the slow queries are indexed.
- Load test results and the identified ceiling are documented.

**Subtasks**

- [ ] Define performance budgets per endpoint class
- [ ] Build the load test scenarios for search, planning and booking
- [ ] Profile and index the slow queries
- [ ] Run the load test and document the capacity ceiling
- [ ] Add Core Web Vitals monitoring to the frontend

### QA.8 Run user acceptance testing against the MVP criteria

_Medium priority · 5 points · traces to AC-01 to AC-16_

Walk the sixteen acceptance criteria with real users and record the result of each one.

**Acceptance criteria**

- Each of the sixteen MVP acceptance criteria has a written test script and a recorded result.
- UAT is run with participants covering all three languages.
- Defects found are logged, triaged and linked to the criterion they failed.
- Sign-off records which criteria passed, which were waived and why.

**Subtasks**

- [ ] Write the UAT script for each acceptance criterion
- [ ] Recruit participants across the three languages
- [ ] Run the UAT sessions and record results
- [ ] Triage and track the defects found
- [ ] Produce the sign-off record

---

## OPS — Observability, DevOps & Production Pilot

`Phase 5 - Production Pilot` · `Platform` · 9 stories · 43 subtasks · 39 pts

Everything needed to run this in front of real businesses: monitoring that tells you what broke, runbooks for when it does, and the commercial and legal decisions the pilot cannot start without.

### OPS.1 Integrate Sentry and structured logging

_Highest priority · 3 points · traces to AC-15, BRD S25_

Errors reach a dashboard with enough context to diagnose them and nothing that should not be there.

**Acceptance criteria**

- Sentry captures frontend and backend errors in every deployed environment.
- A deliberately triggered test error is captured and visible.
- Logs are structured, carry a correlation ID and contain no secrets.
- Error volume and new-issue rate are alerted on.

**Subtasks**

- [ ] Integrate Sentry in the web app and the API
- [ ] Configure release tagging and source maps
- [ ] Implement structured logging with correlation IDs
- [ ] Verify the controlled test-error capture
- [ ] Configure error rate alerting

### OPS.2 Build application and business metrics dashboards

_High priority · 5 points · traces to BRD S19, S25_

Separate views for is it up and is it working, because those are different questions.

**Acceptance criteria**

- Infrastructure and application health metrics are dashboarded with alert thresholds.
- Business metrics - bookings, plan generations, conversion - are dashboarded separately.
- External provider latency and error rates are tracked per provider.
- AI provider cost per day and per plan is tracked against budget.

**Subtasks**

- [ ] Instrument the API with request, latency and error metrics
- [ ] Build the infrastructure health dashboard with alerts
- [ ] Build the business metrics dashboard
- [ ] Track external provider latency, errors and cost
- [ ] Set up the on-call alert routing

### OPS.3 Implement backup, restore and disaster recovery

_Highest priority · 5 points · traces to BRD S25_

A backup that has never been restored is not a backup.

**Acceptance criteria**

- Automated database backups run on a documented schedule with a stated retention.
- Point-in-time recovery is available and its window is documented.
- A restore drill is performed and the time to recover is recorded.
- RPO and RTO targets are agreed and documented.

**Subtasks**

- [ ] Configure automated backups and retention
- [ ] Enable and verify point-in-time recovery
- [ ] Run a full restore drill into a scratch environment
- [ ] Document RPO, RTO and the restore runbook

### OPS.4 Write the operational runbooks

_Medium priority · 3 points · traces to BRD S25, S18_

The documents someone reads at 2am: what to do when the planner fails, when payments mismatch, when a provider is down.

**Acceptance criteria**

- Runbooks exist for AI provider outage, payment provider outage, routing outage and database incident.
- Each runbook names the detection signal, the immediate mitigation and the escalation path.
- The reconciliation runbook covers the payment and booking mismatch queue.
- Runbooks are reviewed after each incident.

**Subtasks**

- [ ] Write the AI provider outage runbook
- [ ] Write the payment and reconciliation runbook
- [ ] Write the routing and maps outage runbook
- [ ] Write the database incident and restore runbook
- [ ] Define the incident review process

### OPS.5 Decide and document the production payment provider

_Highest priority · 5 points · traces to BRD S26, FR-045_

Stripe covers the demo. It does not cover Lebanon in production. This decision gates the pilot and needs to be made with the abstraction already in place.

**Acceptance criteria**

- Candidate providers and local acquiring options for Lebanon are evaluated and compared.
- The commercial, legal and technical constraints of each are documented.
- A decision is recorded with its rationale and its implementation cost.
- The chosen provider is validated against the existing payment abstraction.

**Subtasks**

- [ ] Research payment providers and acquiring options available for Lebanon
- [ ] Document fees, settlement, currency and compliance constraints per option
- [ ] Evaluate the fit against the existing provider interface
- [ ] Record the decision and the implementation plan

### OPS.6 Prepare the legal and policy foundation for the pilot

_High priority · 5 points · traces to Phase 5, BRD S17_

Business terms, traveller terms, cancellation and refund policy, and the data-protection position - in place before the first real transaction.

**Acceptance criteria**

- Business partner terms and traveller terms of service are drafted and reviewed.
- The platform cancellation and refund policy is published and matches what the code enforces.
- The data-protection position and retention schedule are documented.
- Policy documents exist in all three languages.

**Subtasks**

- [ ] Draft the business partner agreement
- [ ] Draft the traveller terms of service
- [ ] Publish the cancellation and refund policy and reconcile it with the code
- [ ] Document the data protection position and retention schedule
- [ ] Translate the policy set into Arabic and French

### OPS.7 Build the partner onboarding programme

_Medium priority · 5 points · traces to Phase 5, AC-09_

Getting the first real businesses on is a process, not a signup form: outreach, data collection, training and a support path.

**Acceptance criteria**

- An onboarding playbook covers outreach, verification, listing setup and training.
- Business-facing help content and a getting-started guide are published.
- A named support path exists with a response-time commitment.
- Pilot partner targets and success measures are agreed.

**Subtasks**

- [ ] Write the partner onboarding playbook
- [ ] Build the business help centre content
- [ ] Define the support channel and its response commitment
- [ ] Agree pilot partner targets and success measures
- [ ] Run onboarding with the first pilot cohort

### OPS.8 Build the public help and trust surfaces

_Medium priority · 3 points · traces to Screen inventory, FR-076_

The help centre, contact, safety, about and policy pages that make an unfamiliar marketplace credible.

**Acceptance criteria**

- Help centre, contact, safety, about and policy pages are published.
- A traveller can find how cancellation works and how to reach support in two clicks from any page.
- All content exists in Arabic, English and French.
- Contact submissions land in the support case queue.

**Subtasks**

- [ ] Write the help centre articles for the common journeys
- [ ] Build the help centre with search
- [ ] Build the contact form wired to the support queue
- [ ] Build the safety, about and policy pages
- [ ] Translate all help and trust content

### OPS.9 Run the pilot readiness review and go-live

_Medium priority · 5 points · traces to Phase 5, AC-01 to AC-16_

One structured gate covering acceptance criteria, security findings, runbooks, legal, payments and monitoring before real money moves.

**Acceptance criteria**

- All sixteen MVP acceptance criteria are demonstrated and signed off or explicitly waived.
- Security findings are closed or formally accepted.
- Runbooks, backups and monitoring are verified operational.
- A go or no-go decision is recorded with its conditions.

**Subtasks**

- [ ] Assemble the readiness checklist across all gates
- [ ] Run the acceptance criteria demonstration
- [ ] Verify monitoring, backups and runbooks operationally
- [ ] Hold the go or no-go review and record the decision
- [ ] Execute the go-live plan with a rollback path

---
