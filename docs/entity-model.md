# Entity Model — Mshwar Platform

## Overview

Mshwar's database model consists of **63 tables** organized into thirteen domains, all in the `app` schema. Every table uses `uuid` primary keys with `gen_random_uuid()`. Amounts are integer minor units; timestamps are UTC instants.

---

## Domain: Identity & Privacy

Tables: `users`, `user_private`, `consent_events`, `organizations`, `organization_members`, `staff_invitations`, `verification_events`

### `users`

| Column         | Type          | Constraints                                       | Notes |
| -------------- | ------------- | ------------------------------------------------- | ----- |
| `id`           | `uuid`        | PK, DEFAULT gen_random_uuid()                     |       |
| `auth_issuer`  | `text`        | NOT NULL                                          |       |
| `auth_subject` | `text`        | NOT NULL                                          |       |
| `display_name` | `text`        | NOT NULL                                          |       |
| `locale`       | `text`        | DEFAULT 'en', CHECK(ar/en/fr)                     |       |
| `status`       | `text`        | DEFAULT 'active', CHECK(active/suspended/deleted) |       |
| `created_at`   | `timestamptz` | DEFAULT now()                                     |       |

**Constraints:** `UNIQUE(auth_issuer, auth_subject)`

### `user_private`

| Column                    | Type          | Constraints        | Notes |
| ------------------------- | ------------- | ------------------ | ----- |
| `user_id`                 | `uuid`        | PK, FK → users(id) |       |
| `email`                   | `text`        |                    |       |
| `phone`                   | `text`        |                    |       |
| `preferences`             | `jsonb`       | DEFAULT '{}'       |       |
| `personalization_consent` | `boolean`     | DEFAULT false      |       |
| `marketing_consent`       | `boolean`     | DEFAULT false      |       |
| `updated_at`              | `timestamptz` | DEFAULT now()      |       |

### `consent_events`

| Column           | Type          | Constraints                   | Notes |
| ---------------- | ------------- | ----------------------------- | ----- |
| `id`             | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `user_id`        | `uuid`        | FK → users(id)                |       |
| `purpose`        | `text`        | NOT NULL                      |       |
| `granted`        | `boolean`     | NOT NULL                      |       |
| `policy_version` | `text`        | NOT NULL                      |       |
| `created_at`     | `timestamptz` | DEFAULT now()                 |       |

### `organizations`

| Column           | Type          | Constraints                                                 | Notes |
| ---------------- | ------------- | ----------------------------------------------------------- | ----- |
| `id`             | `uuid`        | PK, DEFAULT gen_random_uuid()                               |       |
| `name`           | `text`        | NOT NULL                                                    |       |
| `slug`           | `text`        | UNIQUE, NOT NULL                                            |       |
| `status`         | `text`        | DEFAULT 'active', CHECK(active/suspended/archived)          |       |
| `verification`   | `text`        | DEFAULT 'pending', CHECK(pending/verified/rejected/revoked) |       |
| `public_contact` | `jsonb`       | DEFAULT '{}'                                                |       |
| `created_at`     | `timestamptz` | DEFAULT now()                                               |       |

### `organization_members`

| Column            | Type          | Constraints                                     | Notes |
| ----------------- | ------------- | ----------------------------------------------- | ----- |
| `organization_id` | `uuid`        | PK, FK → organizations(id)                      |       |
| `user_id`         | `uuid`        | PK, FK → users(id)                              |       |
| `role`            | `text`        | CHECK(owner/manager/inventory/bookings/finance) |       |
| `active`          | `boolean`     | DEFAULT true                                    |       |
| `created_at`      | `timestamptz` | DEFAULT now()                                   |       |

**Constraints:** `PRIMARY KEY(organization_id, user_id)`

### `staff_invitations`

| Column            | Type          | Constraints                               | Notes |
| ----------------- | ------------- | ----------------------------------------- | ----- |
| `id`              | `uuid`        | PK, DEFAULT gen_random_uuid()             |       |
| `organization_id` | `uuid`        | FK → organizations(id)                    |       |
| `email`           | `text`        | NOT NULL                                  |       |
| `role`            | `text`        | CHECK(manager/inventory/bookings/finance) |       |
| `token_hash`      | `text`        | UNIQUE, NOT NULL                          |       |
| `expires_at`      | `timestamptz` | NOT NULL                                  |       |
| `accepted_at`     | `timestamptz` |                                           |       |
| `invited_by`      | `uuid`        | FK → users(id)                            |       |
| `created_at`      | `timestamptz` | DEFAULT now()                             |       |

### `verification_events`

| Column                | Type          | Constraints                                | Notes |
| --------------------- | ------------- | ------------------------------------------ | ----- |
| `id`                  | `uuid`        | PK, DEFAULT gen_random_uuid()              |       |
| `organization_id`     | `uuid`        | FK → organizations(id)                     |       |
| `reviewer_id`         | `uuid`        | FK → users(id)                             |       |
| `decision`            | `text`        | CHECK(verified/rejected/revoked), NOT NULL |       |
| `reason`              | `text`        | NOT NULL, CHECK(length > 0)                |       |
| `evidence_object_key` | `text`        |                                            |       |
| `created_at`          | `timestamptz` | DEFAULT now()                              |       |

---

## Domain: Discovery

Tables: `destinations`, `venues`, `taxonomy`, `experiences`, `experience_taxonomy`, `experience_translations`, `destination_translations`, `taxonomy_translations`, `media`

### `destinations`

| Column         | Type          | Constraints                   | Notes            |
| -------------- | ------------- | ----------------------------- | ---------------- |
| `id`           | `uuid`        | PK, DEFAULT gen_random_uuid() |                  |
| `parent_id`    | `uuid`        | FK → destinations(id)         | Self-referencing |
| `slug`         | `text`        | UNIQUE, NOT NULL              |                  |
| `country_code` | `text`        | DEFAULT 'LB', CHECK(length=2) |                  |
| `name`         | `text`        | NOT NULL                      |                  |
| `created_at`   | `timestamptz` | DEFAULT now()                 |                  |

**Constraints:** `CHECK(parent_id IS DISTINCT FROM id)`

### `venues`

| Column              | Type                    | Constraints                   | Notes   |
| ------------------- | ----------------------- | ----------------------------- | ------- |
| `id`                | `uuid`                  | PK, DEFAULT gen_random_uuid() |         |
| `organization_id`   | `uuid`                  | FK → organizations(id)        |         |
| `destination_id`    | `uuid`                  | FK → destinations(id)         |         |
| `name`              | `text`                  | NOT NULL                      |         |
| `address`           | `text`                  | NOT NULL                      |         |
| `timezone`          | `text`                  | DEFAULT 'Asia/Beirut'         |         |
| `location`          | `geography(Point,4326)` | NOT NULL                      | PostGIS |
| `location_source`   | `text`                  | NOT NULL                      |         |
| `source_reference`  | `text`                  |                               |         |
| `source_expires_at` | `timestamptz`           |                               |         |
| `created_at`        | `timestamptz`           | DEFAULT now()                 |         |

**Constraints:** `UNIQUE(id, organization_id)`

### `taxonomy`

| Column   | Type      | Constraints                                                                | Notes |
| -------- | --------- | -------------------------------------------------------------------------- | ----- |
| `id`     | `uuid`    | PK, DEFAULT gen_random_uuid()                                              |       |
| `kind`   | `text`    | CHECK(category/amenity/dietary/accessibility/interest/suitability/weather) |       |
| `slug`   | `text`    | NOT NULL                                                                   |       |
| `label`  | `text`    | NOT NULL                                                                   |       |
| `active` | `boolean` | DEFAULT true                                                               |       |

**Constraints:** `UNIQUE(kind, slug)`

### `experiences`

| Column              | Type          | Constraints                                             | Notes |
| ------------------- | ------------- | ------------------------------------------------------- | ----- |
| `id`                | `uuid`        | PK, DEFAULT gen_random_uuid()                           |       |
| `organization_id`   | `uuid`        | FK → organizations(id)                                  |       |
| `venue_id`          | `uuid`        | FK → venues(id)                                         |       |
| `slug`              | `text`        | UNIQUE, NOT NULL                                        |       |
| `title`             | `text`        | NOT NULL                                                |       |
| `description`       | `text`        | DEFAULT ''                                              |       |
| `status`            | `text`        | DEFAULT 'draft', CHECK(draft/published/paused/archived) |       |
| `booking_mode`      | `text`        | CHECK(instant/request/inquiry)                          |       |
| `duration_minutes`  | `integer`     | CHECK(>0)                                               |       |
| `min_party`         | `integer`     | DEFAULT 1, CHECK(>0)                                    |       |
| `max_party`         | `integer`     | CHECK(>=min_party)                                      |       |
| `min_age`           | `integer`     | CHECK(>=0)                                              |       |
| `setting`           | `text`        | CHECK(indoor/outdoor/mixed)                             |       |
| `intensity`         | `smallint`    | CHECK(1-5)                                              |       |
| `weather_rules`     | `jsonb`       | DEFAULT '{}'                                            |       |
| `freshness_seconds` | `integer`     | DEFAULT 86400, CHECK(>0)                                |       |
| `updated_at`        | `timestamptz` | DEFAULT now()                                           |       |
| `created_at`        | `timestamptz` | DEFAULT now()                                           |       |

**Constraints:** `UNIQUE(id, organization_id)`, `FOREIGN KEY(venue_id, organization_id) REFERENCES app.venues(id, organization_id)`

### `experience_taxonomy`

**Constraints:** `PRIMARY KEY(experience_id, term_id)`, FKs to `experiences` and `taxonomy`

### `experience_translations`, `destination_translations`, `taxonomy_translations`

All have `PRIMARY KEY(entity_id, locale)` with CHECK on locale in ('ar','en','fr')

### `media`

| Column          | Type          | Constraints                                         | Notes |
| --------------- | ------------- | --------------------------------------------------- | ----- |
| `id`            | `uuid`        | PK, DEFAULT gen_random_uuid()                       |       |
| `experience_id` | `uuid`        | FK → experiences(id)                                |       |
| `provider`      | `text`        | DEFAULT 'imagekit'                                  |       |
| `object_key`    | `text`        | NOT NULL                                            |       |
| `alt_text`      | `text`        | NOT NULL                                            |       |
| `sort_order`    | `integer`     | DEFAULT 0                                           |       |
| `moderation`    | `text`        | DEFAULT 'pending', CHECK(pending/approved/rejected) |       |
| `created_at`    | `timestamptz` | DEFAULT now()                                       |       |

**Constraints:** `UNIQUE(provider, object_key)`

---

## Domain: Commercial Inventory

Tables: `opening_hours`, `opening_exceptions`, `blackouts`, `currencies`, `price_rules`, `policies`, `slots`

### `opening_hours`

| Column       | Type          | Constraints                     | Notes    |
| ------------ | ------------- | ------------------------------- | -------- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid()   |          |
| `venue_id`   | `uuid`        | FK → venues(id)                 |          |
| `weekday`    | `smallint`    | CHECK(0-6)                      | 0=Sunday |
| `opens`      | `time`        | NOT NULL                        |          |
| `closes`     | `time`        | NOT NULL, CHECK(closes > opens) |          |
| `created_at` | `timestamptz` | DEFAULT now()                   |          |

**Constraints:** `UNIQUE(venue_id, weekday, opens)`

### `opening_exceptions`

| Column       | Type          | Constraints                   | Notes |
| ------------ | ------------- | ----------------------------- | ----- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `venue_id`   | `uuid`        | FK → venues(id)               |       |
| `local_date` | `date`        | NOT NULL                      |       |
| `closed`     | `boolean`     | DEFAULT false                 |       |
| `opens`      | `time`        |                               |       |
| `closes`     | `time`        |                               |       |
| `created_at` | `timestamptz` | DEFAULT now()                 |       |

**Constraints:** `UNIQUE(venue_id, local_date)`

### `blackouts`

| Column          | Type          | Constraints                   | Notes |
| --------------- | ------------- | ----------------------------- | ----- |
| `id`            | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `experience_id` | `uuid`        | FK → experiences(id)          |       |
| `period`        | `tstzrange`   | NOT NULL                      |       |
| `reason`        | `text`        | NOT NULL                      |       |
| `created_at`    | `timestamptz` | DEFAULT now()                 |       |

---

## Domain: Planning

Tables: `trips`, `trip_members`, `trip_share_links`, `trip_versions`, `trip_stops`, `trip_legs`, `trip_cost_items`, `votes`, `favorites`, `trip_templates`, `trip_template_stops`

### `trips`

| Column         | Type          | Constraints                                   | Notes |
| -------------- | ------------- | --------------------------------------------- | ----- |
| `id`           | `uuid`        | PK, DEFAULT gen_random_uuid()                 |       |
| `owner_id`     | `uuid`        | FK → users(id)                                |       |
| `title`        | `text`        | NOT NULL                                      |       |
| `status`       | `text`        | DEFAULT 'draft', CHECK(draft/locked/archived) |       |
| `lock_version` | `integer`     | DEFAULT 1, CHECK(>0)                          |       |
| `created_at`   | `timestamptz` | DEFAULT now()                                 |       |

### `trip_versions`

| Column           | Type                    | Constraints                       | Notes |
| ---------------- | ----------------------- | --------------------------------- | ----- |
| `id`             | `uuid`                  | PK, DEFAULT gen_random_uuid()     |       |
| `trip_id`        | `uuid`                  | FK → trips(id)                    |       |
| `version`        | `integer`               | CHECK(>0)                         |       |
| `created_by`     | `uuid`                  | FK → users(id)                    |       |
| `origin`         | `text`                  | CHECK(manual/ai/weather/template) |       |
| `window_start`   | `timestamptz`           | NOT NULL                          |       |
| `return_by`      | `timestamptz`           | NOT NULL                          |       |
| `start_location` | `geography(Point,4326)` | NOT NULL                          |       |
| `party_size`     | `integer`               | CHECK(>0)                         |       |
| `budget_minor`   | `bigint`                | CHECK(>=0)                        |       |
| `currency`       | `text`                  | FK → currencies(code)             |       |
| `strict_budget`  | `boolean`               | DEFAULT true                      |       |
| `constraints`    | `jsonb`                 | DEFAULT '{}'                      |       |
| `validation`     | `jsonb`                 | DEFAULT '{}'                      |       |
| `sealed_at`      | `timestamptz`           |                                   |       |
| `created_at`     | `timestamptz`           | DEFAULT now()                     |       |

**Constraints:** `UNIQUE(trip_id, version)`, `CHECK(return_by > window_start)`

### `trip_stops`

| Column            | Type          | Constraints                   | Notes |
| ----------------- | ------------- | ----------------------------- | ----- |
| `id`              | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `version_id`      | `uuid`        | FK → trip_versions(id)        |       |
| `experience_id`   | `uuid`        | FK → experiences(id)          |       |
| `position`        | `integer`     | CHECK(>0)                     |       |
| `starts_at`       | `timestamptz` | NOT NULL                      |       |
| `ends_at`         | `timestamptz` | NOT NULL                      |       |
| `estimated_minor` | `bigint`      | CHECK(>=0)                    |       |
| `price_kind`      | `text`        | CHECK(fixed/estimate/quote)   |       |
| `locked`          | `boolean`     | DEFAULT false                 |       |
| `snapshot`        | `jsonb`       | NOT NULL                      |       |
| `created_at`      | `timestamptz` | DEFAULT now()                 |       |

**Constraints:** `EXCLUDE USING gist(version_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)`, `UNIQUE(version_id, position)`

### `trip_legs`, `trip_cost_items`

Similar structure with FKs to `trip_versions`

### `votes`

| Column          | Type          | Constraints                   | Notes |
| --------------- | ------------- | ----------------------------- | ----- |
| `id`            | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `trip_id`       | `uuid`        | FK → trips(id)                |       |
| `user_id`       | `uuid`        | FK → users(id)                |       |
| `experience_id` | `uuid`        | FK → experiences(id)          |       |
| `term_id`       | `uuid`        | FK → taxonomy(id)             |       |
| `value`         | `smallint`    | CHECK(-1/0/1)                 |       |
| `created_at`    | `timestamptz` | DEFAULT now()                 |       |

**Constraints:** `CHECK(num_nonnulls(experience_id, term_id)=1)`, `UNIQUE NULLS NOT DISTINCT(trip_id, user_id, experience_id, term_id)`

### `favorites`

| Column          | Type          | Constraints                   | Notes |
| --------------- | ------------- | ----------------------------- | ----- |
| `id`            | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `user_id`       | `uuid`        | FK → users(id)                |       |
| `experience_id` | `uuid`        | FK → experiences(id)          |       |
| `trip_id`       | `uuid`        | FK → trips(id)                |       |
| `created_at`    | `timestamptz` | DEFAULT now()                 |       |

**Constraints:** `CHECK(num_nonnulls(experience_id, trip_id)=1)`, `UNIQUE NULLS NOT DISTINCT(user_id, experience_id, trip_id)`

---

## Domain: Transactions

Tables: `bookings`, `inquiries`, `booking_events`, `payments`, `refunds`, `webhook_inbox`, `reviews`, `review_responses`, `support_cases`, `outbox`, `notifications`, `slots`

### `bookings`

| Column               | Type          | Constraints                                                                      | Notes |
| -------------------- | ------------- | -------------------------------------------------------------------------------- | ----- |
| `id`                 | `uuid`        | PK, DEFAULT gen_random_uuid()                                                    |       |
| `customer_id`        | `uuid`        | FK → users(id)                                                                   |       |
| `organization_id`    | `uuid`        | FK → organizations(id)                                                           |       |
| `experience_id`      | `uuid`        | FK → experiences(id)                                                             |       |
| `slot_id`            | `uuid`        | FK → slots(id)                                                                   |       |
| `trip_stop_id`       | `uuid`        | FK → trip_stops(id)                                                              |       |
| `party_size`         | `integer`     | CHECK(>0)                                                                        |       |
| `status`             | `text`        | DEFAULT 'pending', CHECK(pending/confirmed/rejected/cancelled/expired/completed) |       |
| `mode`               | `text`        | CHECK(instant/request)                                                           |       |
| `hold_until`         | `timestamptz` |                                                                                  |       |
| `response_due_at`    | `timestamptz` |                                                                                  |       |
| `inventory_reserved` | `boolean`     | DEFAULT false                                                                    |       |
| `currency`           | `text`        | FK → currencies(code)                                                            |       |
| `total_minor`        | `bigint`      | CHECK(>=0)                                                                       |       |
| `payment_required`   | `boolean`     | NOT NULL                                                                         |       |
| `price_snapshot`     | `jsonb`       | NOT NULL                                                                         |       |
| `policy_snapshot`    | `jsonb`       | NOT NULL                                                                         |       |
| `request_key`        | `text`        | NOT NULL                                                                         |       |
| `request_hash`       | `text`        | NOT NULL                                                                         |       |
| `reason`             | `text`        |                                                                                  |       |
| `created_at`         | `timestamptz` | DEFAULT now()                                                                    |       |

**Constraints:** `CHECK(status<>'cancelled' OR length(trim(reason))>0)`, `CHECK(status<>'pending' OR hold_until IS NOT NULL)`

### `payments`

| Column             | Type          | Constraints                                                          | Notes |
| ------------------ | ------------- | -------------------------------------------------------------------- | ----- |
| `id`               | `uuid`        | PK, DEFAULT gen_random_uuid()                                        |       |
| `booking_id`       | `uuid`        | FK → bookings(id)                                                    |       |
| `currency`         | `text`        | FK → currencies(code)                                                |       |
| `provider`         | `text`        | NOT NULL                                                             |       |
| `provider_account` | `text`        | NOT NULL                                                             |       |
| `live_mode`        | `boolean`     | DEFAULT false                                                        |       |
| `external_id`      | `text`        |                                                                      |       |
| `idempotency_key`  | `text`        | NOT NULL, UNIQUE                                                     |       |
| `amount_minor`     | `bigint`      | CHECK(>0)                                                            |       |
| `status`           | `text`        | DEFAULT 'created', CHECK(created/pending/succeeded/failed/cancelled) |       |
| `created_at`       | `timestamptz` | DEFAULT now()                                                        |       |

### `refunds`

| Column            | Type          | Constraints                                                    | Notes |
| ----------------- | ------------- | -------------------------------------------------------------- | ----- |
| `id`              | `uuid`        | PK, DEFAULT gen_random_uuid()                                  |       |
| `payment_id`      | `uuid`        | FK → payments(id)                                              |       |
| `amount_minor`    | `bigint`      | CHECK(>0)                                                      |       |
| `idempotency_key` | `text`        | NOT NULL, UNIQUE                                               |       |
| `external_id`     | `text`        |                                                                |       |
| `status`          | `text`        | DEFAULT 'requested', CHECK(requested/pending/succeeded/failed) |       |
| `reason`          | `text`        | NOT NULL                                                       |       |
| `created_at`      | `timestamptz` | DEFAULT now()                                                  |       |

### `reviews`

| Column       | Type          | Constraints                                         | Notes |
| ------------ | ------------- | --------------------------------------------------- | ----- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid()                       |       |
| `booking_id` | `uuid`        | FK → bookings(id), UNIQUE                           |       |
| `author_id`  | `uuid`        | FK → users(id)                                      |       |
| `rating`     | `smallint`    | CHECK(1-5)                                          |       |
| `body`       | `text`        | NOT NULL                                            |       |
| `moderation` | `text`        | DEFAULT 'pending', CHECK(pending/approved/rejected) |       |
| `created_at` | `timestamptz` | DEFAULT now()                                       |       |

### `notifications`

| Column       | Type          | Constraints                                              | Notes |
| ------------ | ------------- | -------------------------------------------------------- | ----- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid()                            |       |
| `user_id`    | `uuid`        | FK → users(id)                                           |       |
| `outbox_id`  | `uuid`        | FK → outbox(id)                                          |       |
| `channel`    | `text`        | CHECK(email/in_app)                                      |       |
| `category`   | `text`        | CHECK(transactional/marketing)                           |       |
| `status`     | `text`        | DEFAULT 'pending', CHECK(pending/sent/failed/suppressed) |       |
| `read_at`    | `timestamptz` |                                                          |       |
| `attempts`   | `integer`     | DEFAULT 0                                                |       |
| `created_at` | `timestamptz` | DEFAULT now()                                            |       |

---

## Domain: Knowledge & AI

Tables: `knowledge_documents`, `knowledge_chunks`, `recommendation_runs`, `recommendation_candidates`, `retrieval_sources`, `feedback_events`

### `knowledge_documents`

| Column           | Type          | Constraints                   | Notes |
| ---------------- | ------------- | ----------------------------- | ----- |
| `id`             | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `experience_id`  | `uuid`        | FK → experiences(id)          |       |
| `destination_id` | `uuid`        | FK → destinations(id)         |       |
| `locale`         | `text`        | CHECK(ar/en/fr), NOT NULL     |       |
| `source_uri`     | `text`        | NOT NULL                      |       |
| `content_hash`   | `text`        | NOT NULL                      |       |
| `body`           | `text`        | NOT NULL                      |       |
| `version`        | `integer`     | CHECK(>0)                     |       |
| `approved_by`    | `uuid`        | FK → users(id)                |       |
| `approved_at`    | `timestamptz` |                               |       |
| `revoked_at`     | `timestamptz` |                               |       |
| `expires_at`     | `timestamptz` |                               |       |
| `created_at`     | `timestamptz` | DEFAULT now()                 |       |

**Constraints:** `CHECK(num_nonnulls(experience_id, destination_id)=1)`, `UNIQUE(source_uri, locale, version)`

### `knowledge_chunks`

| Column            | Type           | Constraints                   | Notes    |
| ----------------- | -------------- | ----------------------------- | -------- |
| `id`              | `uuid`         | PK, DEFAULT gen_random_uuid() |          |
| `document_id`     | `uuid`         | FK → knowledge_documents(id)  |          |
| `position`        | `integer`      | CHECK(>=0)                    |          |
| `body`            | `text`         | NOT NULL                      |          |
| `token_count`     | `integer`      | CHECK(>0)                     |          |
| `embedding_model` | `text`         | NOT NULL                      |          |
| `embedding`       | `vector(1536)` | NOT NULL                      | pgvector |
| `created_at`      | `timestamptz`  | DEFAULT now()                 |          |

**Constraints:** `UNIQUE(document_id, position, embedding_model)`

### `recommendation_runs`

| Column              | Type          | Constraints                                 | Notes |
| ------------------- | ------------- | ------------------------------------------- | ----- |
| `id`                | `uuid`        | PK, DEFAULT gen_random_uuid()               |       |
| `trip_version_id`   | `uuid`        | FK → trip_versions(id)                      |       |
| `user_id`           | `uuid`        | FK → users(id)                              |       |
| `model_version`     | `text`        | NOT NULL                                    |       |
| `prompt_version`    | `text`        | NOT NULL                                    |       |
| `ranker_version`    | `text`        | NOT NULL                                    |       |
| `optimizer_version` | `text`        | NOT NULL                                    |       |
| `status`            | `text`        | CHECK(succeeded/infeasible/failed/fallback) |       |
| `constraints`       | `jsonb`       | DEFAULT '{}'                                |       |
| `validation`        | `jsonb`       | DEFAULT '{}'                                |       |
| `latency_ms`        | `integer`     | CHECK(>=0)                                  |       |
| `created_at`        | `timestamptz` | DEFAULT now()                               |       |

### `feedback_events`

| Column                | Type          | Constraints                   | Notes |
| --------------------- | ------------- | ----------------------------- | ----- |
| `id`                  | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `user_id`             | `uuid`        | FK → users(id)                |       |
| `run_id`              | `uuid`        | FK → recommendation_runs(id)  |       |
| `original_version_id` | `uuid`        | FK → trip_versions(id)        |       |
| `final_version_id`    | `uuid`        | FK → trip_versions(id)        |       |
| `booking_id`          | `uuid`        | FK → bookings(id)             |       |
| `event_type`          | `text`        | NOT NULL                      |       |
| `changes`             | `jsonb`       | DEFAULT '{}'                  |       |
| `training_consent`    | `boolean`     | DEFAULT false                 |       |
| `created_at`          | `timestamptz` | DEFAULT now()                 |       |

---

## Domain: Evaluation & Weather

Tables: `evaluation_datasets`, `evaluation_cases`, `evaluation_runs`, `evaluation_results`, `weather_snapshots`, `weather_warnings`

### `evaluation_datasets`

| Column       | Type          | Constraints                   | Notes |
| ------------ | ------------- | ----------------------------- | ----- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `name`       | `text`        | NOT NULL                      |       |
| `version`    | `integer`     | CHECK(>0)                     |       |
| `checksum`   | `text`        | NOT NULL                      |       |
| `sealed_at`  | `timestamptz` |                               |       |
| `created_at` | `timestamptz` | DEFAULT now()                 |       |

**Constraints:** `UNIQUE(name, version)`

### `evaluation_cases`

| Column                 | Type          | Constraints                   | Notes |
| ---------------------- | ------------- | ----------------------------- | ----- |
| `id`                   | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `dataset_id`           | `uuid`        | FK → evaluation_datasets(id)  |       |
| `locale`               | `text`        | CHECK(ar/ar-LB/en/fr/mixed)   |       |
| `prompt`               | `text`        | NOT NULL                      |       |
| `expected_constraints` | `jsonb`       | DEFAULT '{}'                  |       |
| `fixture_version`      | `text`        | NOT NULL                      |       |
| `created_at`           | `timestamptz` | DEFAULT now()                 |       |

### `evaluation_runs`

| Column           | Type          | Constraints                   | Notes |
| ---------------- | ------------- | ----------------------------- | ----- |
| `id`             | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `dataset_id`     | `uuid`        | FK → evaluation_datasets(id)  |       |
| `model_version`  | `text`        | NOT NULL                      |       |
| `prompt_version` | `text`        | NOT NULL                      |       |
| `ranker_version` | `text`        | NOT NULL                      |       |
| `created_at`     | `timestamptz` | DEFAULT now()                 |       |

### `evaluation_results`

| Column    | Type      | Constraints                   | Notes |
| --------- | --------- | ----------------------------- | ----- |
| `run_id`  | `uuid`    | PK, FK → evaluation_runs(id)  |       |
| `case_id` | `uuid`    | PK, FK → evaluation_cases(id) |       |
| `passed`  | `boolean` | NOT NULL                      |       |
| `metrics` | `jsonb`   | DEFAULT '{}'                  |       |

---

## Domain: Operations

Tables: `configuration_versions`, `commission_terms`, `booking_commissions`, `analytics_events`, `data_quality_issues`, `audit_log`, `outbox`, `trip_templates`, `trip_template_stops`

### `audit_log`

| Column       | Type          | Constraints                   | Notes |
| ------------ | ------------- | ----------------------------- | ----- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `actor_id`   | `uuid`        | FK → users(id)                |       |
| `request_id` | `text`        |                               |       |
| `action`     | `text`        | NOT NULL                      |       |
| `table_name` | `text`        | NOT NULL                      |       |
| `row_key`    | `jsonb`       | NOT NULL                      |       |
| `changes`    | `jsonb`       | NOT NULL                      |       |
| `reason`     | `text`        |                               |       |
| `created_at` | `timestamptz` | DEFAULT now()                 |       |

### `analytics_events`

| Column            | Type          | Constraints                   | Notes |
| ----------------- | ------------- | ----------------------------- | ----- |
| `id`              | `uuid`        | PK, DEFAULT gen_random_uuid() |       |
| `event_name`      | `text`        | NOT NULL                      |       |
| `user_id`         | `uuid`        | FK → users(id)                |       |
| `organization_id` | `uuid`        | FK → organizations(id)        |       |
| `experience_id`   | `uuid`        | FK → experiences(id)          |       |
| `properties`      | `jsonb`       | DEFAULT '{}'                  |       |
| `dedupe_key`      | `text`        | UNIQUE, NOT NULL              |       |
| `created_at`      | `timestamptz` | DEFAULT now()                 |       |

### `data_quality_issues`

| Column          | Type          | Constraints                                  | Notes |
| --------------- | ------------- | -------------------------------------------- | ----- |
| `id`            | `uuid`        | PK, DEFAULT gen_random_uuid()                |       |
| `experience_id` | `uuid`        | FK → experiences(id)                         |       |
| `rule_code`     | `text`        | NOT NULL                                     |       |
| `status`        | `text`        | DEFAULT 'open', CHECK(open/resolved/ignored) |       |
| `details`       | `jsonb`       | DEFAULT '{}'                                 |       |
| `created_at`    | `timestamptz` | DEFAULT now()                                |       |

---

## Extension Dependencies

| Extension    | Purpose                                                | Migration |
| ------------ | ------------------------------------------------------ | --------- |
| `postgis`    | `ST_DWithin`, `ST_MakePoint`, geospatial queries       | 001       |
| `pgvector`   | Vector similarity (`<->` operator) for RAG             | 001       |
| `btree_gist` | EXCLUDE constraint for slot booking overlap prevention | 001       |

## Security Architecture

- `app` schema is private — no PUBLIC table or function access
- `mshwar_backend` role: trusted server role with broad write authority
- `mshwar_reader` role: restricted read with RLS policies
- All tables have RLS enabled and forced
- `app.actor_id()` function returns the current actor from `app.user_id` setting
- `SET LOCAL` used for transaction-level settings
