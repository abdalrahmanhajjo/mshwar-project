# Mshwar relationship diagrams

These diagrams show the principal enforced foreign-key relationships by domain. See DATA_DICTIONARY.md and the migrations for all columns, constraints and auxiliary tables. Optional relationships such as booking-to-itinerary-stop are intentionally nullable.

## Supply ownership and inventory

```mermaid
erDiagram
  users ||--o{ organization_members : joins
  organizations ||--o{ organization_members : authorizes
  organizations ||--o{ venues : operates
  venues ||--o{ experiences : hosts
  destinations ||--o{ venues : locates
  experiences ||--o{ slots : schedules
  experiences ||--o{ price_rules : prices
  experiences ||--o{ policies : versions
  experiences ||--o{ experience_taxonomy : classifies
  taxonomy ||--o{ experience_taxonomy : labels
```

Organization/venue identity is also enforced by a composite FK on experiences. Price validity uses an exclusion constraint; it cannot overlap for the same experience and currency.

## Planning and group decisions

```mermaid
erDiagram
  users ||--o{ trips : owns
  trips ||--o{ trip_members : includes
  trips ||--o{ trip_versions : versions
  trips ||--o{ trip_share_links : shares
  trip_members ||--o{ votes : casts
  trip_versions ||--o{ trip_stops : sequences
  trip_versions ||--o{ trip_legs : routes
  trip_versions ||--o{ trip_cost_items : budgets
  experiences ||--o{ trip_stops : grounds
```

Only draft versions can be edited. Sealed versions are immutable. Share tokens are hashed and validated by the backend; they do not become database logins.

## Booking and financial history

```mermaid
erDiagram
  users ||--o{ bookings : books
  slots ||--o{ bookings : allocates
  trip_stops o|--o{ bookings : originates
  bookings ||--o{ booking_events : records
  bookings ||--o{ payments : attempts
  payments ||--o{ refunds : refunds
  bookings ||--o| reviews : qualifies
  reviews ||--o| review_responses : answers
```

A booking has one experience and one slot. Payments and refunds retain independent states. Webhook events are keyed by external provider/account/mode/event identity and are resolved by the provider adapter; they do not use an invented FK to an unknown payment.

## AI evidence and outcomes

```mermaid
erDiagram
  knowledge_documents ||--o{ knowledge_chunks : embeds
  knowledge_chunks ||--o{ retrieval_sources : supports
  recommendation_runs ||--o{ retrieval_sources : retrieves
  recommendation_runs ||--o{ recommendation_candidates : ranks
  experiences ||--o{ recommendation_candidates : grounds
  trip_versions o|--o{ recommendation_runs : produces
  recommendation_runs o|--o{ feedback_events : informs
  evaluation_datasets ||--o{ evaluation_cases : contains
  evaluation_datasets ||--o{ evaluation_runs : evaluates
  evaluation_runs ||--o{ evaluation_results : measures
  evaluation_cases ||--o{ evaluation_results : scores
```

Knowledge, learning feedback and fixed evaluation cases are stored separately. Production user edits must never silently rewrite the evaluation dataset.
