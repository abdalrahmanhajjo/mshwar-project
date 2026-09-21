# Mshwar data dictionary

63 tables. SQL is authoritative. Amounts are integer minor units; timestamps are UTC instants.

## users

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
auth_issuer text NOT NULL, auth_subject text NOT NULL, display_name text NOT NULL,
locale text NOT NULL DEFAULT 'en' CHECK(locale IN ('ar','en','fr')),
status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(auth_issuer,auth_subject)
```

## user_private

```sql
user_id uuid PRIMARY KEY REFERENCES app.users(id), email text, phone text,
preferences jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(preferences)='object'),
personalization_consent boolean NOT NULL DEFAULT false, marketing_consent boolean NOT NULL DEFAULT false,
updated_at timestamptz NOT NULL DEFAULT now()
```

## consent_events

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app.users(id), purpose text NOT NULL,
granted boolean NOT NULL, policy_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
```

## organizations

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL, slug text NOT NULL UNIQUE,
status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','archived')),
verification text NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','rejected','revoked')),
public_contact jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
```

## organization_members

```sql
organization_id uuid NOT NULL REFERENCES app.organizations(id),
user_id uuid NOT NULL REFERENCES app.users(id),
role text NOT NULL CHECK(role IN ('owner','manager','inventory','bookings','finance')),
active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id)
```

## staff_invitations

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id),
email text NOT NULL, role text NOT NULL CHECK(role IN ('manager','inventory','bookings','finance')),
token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz,
invited_by uuid NOT NULL REFERENCES app.users(id), created_at timestamptz NOT NULL DEFAULT now()
```

## verification_events

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id),
reviewer_id uuid NOT NULL REFERENCES app.users(id), decision text NOT NULL CHECK(decision IN ('verified','rejected','revoked')),
reason text NOT NULL CHECK(length(trim(reason))>0), evidence_object_key text, created_at timestamptz NOT NULL DEFAULT now()
```

## destinations

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
parent_id uuid REFERENCES app.destinations(id), slug text NOT NULL UNIQUE,
country_code text NOT NULL DEFAULT 'LB' CHECK(length(country_code)=2), name text NOT NULL,
CHECK(parent_id IS DISTINCT FROM id)
```

## venues

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id), destination_id uuid REFERENCES app.destinations(id),
name text NOT NULL, address text NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Beirut',
location geography(Point,4326) NOT NULL, location_source text NOT NULL,
source_reference text, source_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id)
```

## taxonomy

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
kind text NOT NULL CHECK(kind IN ('category','amenity','dietary','accessibility','interest','suitability','weather')),
slug text NOT NULL, label text NOT NULL, active boolean NOT NULL DEFAULT true, UNIQUE(kind,slug)
```

## experiences

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id), venue_id uuid NOT NULL,
slug text NOT NULL UNIQUE, title text NOT NULL, description text NOT NULL DEFAULT '',
status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','paused','archived')),
booking_mode text NOT NULL CHECK(booking_mode IN ('instant','request','inquiry')),
duration_minutes integer NOT NULL CHECK(duration_minutes>0), min_party integer NOT NULL DEFAULT 1 CHECK(min_party>0),
max_party integer NOT NULL CHECK(max_party>=min_party), min_age integer CHECK(min_age>=0),
setting text NOT NULL CHECK(setting IN ('indoor','outdoor','mixed')), intensity smallint CHECK(intensity BETWEEN 1 AND 5),
weather_rules jsonb NOT NULL DEFAULT '{}', freshness_seconds integer NOT NULL DEFAULT 86400 CHECK(freshness_seconds>0),
updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id),
FOREIGN KEY(venue_id,organization_id) REFERENCES app.venues(id,organization_id)
```

## experience_taxonomy

```sql
experience_id uuid NOT NULL REFERENCES app.experiences(id), term_id uuid NOT NULL REFERENCES app.taxonomy(id), PRIMARY KEY(experience_id,term_id)
```

## experience_translations

```sql
experience_id uuid NOT NULL REFERENCES app.experiences(id), locale text NOT NULL CHECK(locale IN ('ar','en','fr')),
title text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY(experience_id,locale)
```

## destination_translations

```sql
destination_id uuid NOT NULL REFERENCES app.destinations(id), locale text NOT NULL CHECK(locale IN ('ar','en','fr')),
title text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY(destination_id,locale)
```

## taxonomy_translations

```sql
taxonomy_id uuid NOT NULL REFERENCES app.taxonomy(id), locale text NOT NULL CHECK(locale IN ('ar','en','fr')),
title text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY(taxonomy_id,locale)
```

## media

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), provider text NOT NULL DEFAULT 'imagekit',
object_key text NOT NULL, alt_text text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
moderation text NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')),
UNIQUE(provider,object_key)
```

## opening_hours

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
venue_id uuid NOT NULL REFERENCES app.venues(id), weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6),
opens time NOT NULL, closes time NOT NULL, CHECK(closes>opens), UNIQUE(venue_id,weekday,opens)
```

## opening_exceptions

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
venue_id uuid NOT NULL REFERENCES app.venues(id), local_date date NOT NULL,
closed boolean NOT NULL DEFAULT false, opens time, closes time,
CHECK((closed AND opens IS NULL AND closes IS NULL) OR (NOT closed AND opens IS NOT NULL AND closes IS NOT NULL AND closes>opens)),
UNIQUE(venue_id,local_date)
```

## blackouts

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), period tstzrange NOT NULL,
reason text NOT NULL, CHECK(NOT isempty(period) AND NOT lower_inf(period) AND NOT upper_inf(period))
```

## currencies

```sql
code text PRIMARY KEY CHECK(code ~ '^[A-Z]{3}$'), minor_digits smallint NOT NULL CHECK(minor_digits BETWEEN 0 AND 4)
```

## price_rules

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), currency text NOT NULL REFERENCES app.currencies(code),
price_type text NOT NULL CHECK(price_type IN ('fixed','from','range','quote')),
unit text NOT NULL CHECK(unit IN ('person','group')), amount_minor bigint, max_amount_minor bigint,
valid_during tstzrange NOT NULL, source text NOT NULL, verified_at timestamptz,
CHECK(NOT isempty(valid_during)), CHECK(amount_minor IS NULL OR amount_minor>=0),
CHECK((price_type='quote' AND amount_minor IS NULL AND max_amount_minor IS NULL) OR
(price_type IN ('fixed','from') AND amount_minor IS NOT NULL AND max_amount_minor IS NULL) OR
(price_type='range' AND amount_minor IS NOT NULL AND max_amount_minor>=amount_minor)),
EXCLUDE USING gist (experience_id WITH =, currency WITH =, valid_during WITH &&)
```

## policies

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), version integer NOT NULL CHECK(version>0),
cancellation_rules jsonb NOT NULL CHECK(jsonb_typeof(cancellation_rules)='object'),
terms_text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(experience_id,version)
```

## slots

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
capacity integer NOT NULL CHECK(capacity>0), reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=capacity),
authoritative boolean NOT NULL DEFAULT false, source text NOT NULL, observed_at timestamptz NOT NULL,
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
CHECK(ends_at>starts_at), UNIQUE(experience_id,starts_at), UNIQUE(id,experience_id)
```

## trips

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
owner_id uuid NOT NULL REFERENCES app.users(id), title text NOT NULL,
status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','locked','archived')),
lock_version integer NOT NULL DEFAULT 1 CHECK(lock_version>0), created_at timestamptz NOT NULL DEFAULT now()
```

## trip_members

```sql
trip_id uuid NOT NULL REFERENCES app.trips(id), user_id uuid NOT NULL REFERENCES app.users(id),
role text NOT NULL CHECK(role IN ('view','vote','edit')), shared_preferences jsonb NOT NULL DEFAULT '{}',
PRIMARY KEY(trip_id,user_id)
```

## trip_share_links

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_id uuid NOT NULL REFERENCES app.trips(id), token_hash text NOT NULL UNIQUE,
role text NOT NULL CHECK(role IN ('view','vote','edit')), expires_at timestamptz NOT NULL,
revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
```

## trip_versions

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_id uuid NOT NULL REFERENCES app.trips(id), version integer NOT NULL CHECK(version>0),
created_by uuid NOT NULL REFERENCES app.users(id), origin text NOT NULL CHECK(origin IN ('manual','ai','weather','template')),
window_start timestamptz NOT NULL, return_by timestamptz NOT NULL, start_location geography(Point,4326) NOT NULL,
party_size integer NOT NULL CHECK(party_size>0), budget_minor bigint NOT NULL CHECK(budget_minor>=0),
currency text NOT NULL REFERENCES app.currencies(code), strict_budget boolean NOT NULL DEFAULT true,
constraints jsonb NOT NULL DEFAULT '{}', validation jsonb NOT NULL DEFAULT '{}', sealed_at timestamptz,
created_at timestamptz NOT NULL DEFAULT now(), CHECK(return_by>window_start), UNIQUE(trip_id,version), UNIQUE(id,trip_id)
```

## trip_stops

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
version_id uuid NOT NULL REFERENCES app.trip_versions(id), experience_id uuid NOT NULL REFERENCES app.experiences(id),
position integer NOT NULL CHECK(position>0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
estimated_minor bigint NOT NULL CHECK(estimated_minor>=0), price_kind text NOT NULL CHECK(price_kind IN ('fixed','estimate','quote')),
locked boolean NOT NULL DEFAULT false, snapshot jsonb NOT NULL, CHECK(ends_at>starts_at),
UNIQUE(version_id,position), UNIQUE(id,version_id),
EXCLUDE USING gist(version_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
```

## trip_legs

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
version_id uuid NOT NULL REFERENCES app.trip_versions(id), position integer NOT NULL CHECK(position>=0),
provider text NOT NULL, fetched_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
distance_m integer CHECK(distance_m>=0), duration_seconds integer CHECK(duration_seconds>=0),
estimated_minor bigint NOT NULL DEFAULT 0 CHECK(estimated_minor>=0),
status text NOT NULL CHECK(status IN ('available','unavailable')), CHECK(expires_at>fetched_at),
CHECK(status='unavailable' OR (distance_m IS NOT NULL AND duration_seconds IS NOT NULL)), UNIQUE(version_id,position)
```

## trip_cost_items

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
version_id uuid NOT NULL REFERENCES app.trip_versions(id), kind text NOT NULL CHECK(kind IN ('tax','fee','transport','contingency','other')),
label text NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor>=0)
```

## votes

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_id uuid NOT NULL REFERENCES app.trips(id), user_id uuid NOT NULL REFERENCES app.users(id),
experience_id uuid REFERENCES app.experiences(id), term_id uuid REFERENCES app.taxonomy(id),
value smallint NOT NULL CHECK(value IN (-1,0,1)), CHECK(num_nonnulls(experience_id,term_id)=1),
FOREIGN KEY(trip_id,user_id) REFERENCES app.trip_members(trip_id,user_id),
UNIQUE NULLS NOT DISTINCT(trip_id,user_id,experience_id,term_id)
```

## favorites

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app.users(id), experience_id uuid REFERENCES app.experiences(id), trip_id uuid REFERENCES app.trips(id),
CHECK(num_nonnulls(experience_id,trip_id)=1), UNIQUE NULLS NOT DISTINCT(user_id,experience_id,trip_id)
```

## trip_templates

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
slug text NOT NULL UNIQUE, title text NOT NULL, status text NOT NULL CHECK(status IN ('draft','published','archived')),
destination_id uuid REFERENCES app.destinations(id), description text NOT NULL
```

## trip_template_stops

```sql
template_id uuid NOT NULL REFERENCES app.trip_templates(id), position integer NOT NULL CHECK(position>0),
experience_id uuid NOT NULL REFERENCES app.experiences(id), PRIMARY KEY(template_id,position)
```

## bookings

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL REFERENCES app.users(id), organization_id uuid NOT NULL REFERENCES app.organizations(id),
experience_id uuid NOT NULL, slot_id uuid NOT NULL, trip_stop_id uuid REFERENCES app.trip_stops(id),
party_size integer NOT NULL CHECK(party_size>0),
status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','expired','completed')),
mode text NOT NULL CHECK(mode IN ('instant','request')), hold_until timestamptz,
response_due_at timestamptz, inventory_reserved boolean NOT NULL DEFAULT false,
currency text NOT NULL REFERENCES app.currencies(code), total_minor bigint NOT NULL CHECK(total_minor>=0),
payment_required boolean NOT NULL, price_snapshot jsonb NOT NULL, policy_snapshot jsonb NOT NULL,
request_key text NOT NULL, request_hash text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now(),
FOREIGN KEY(experience_id,organization_id) REFERENCES app.experiences(id,organization_id),
FOREIGN KEY(slot_id,experience_id) REFERENCES app.slots(id,experience_id),
UNIQUE(customer_id,request_key), UNIQUE(id,currency),
CHECK(status<>'cancelled' OR length(trim(reason))>0),
CHECK(status<>'pending' OR hold_until IS NOT NULL)
```

## inquiries

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL REFERENCES app.users(id), experience_id uuid NOT NULL REFERENCES app.experiences(id),
requested_at timestamptz, party_size integer NOT NULL CHECK(party_size>0), message text NOT NULL,
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')), created_at timestamptz NOT NULL DEFAULT now()
```

## booking_events

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid NOT NULL REFERENCES app.bookings(id), actor_id uuid REFERENCES app.users(id),
from_status text, to_status text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
```

## payments

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid NOT NULL, currency text NOT NULL, provider text NOT NULL, provider_account text NOT NULL,
live_mode boolean NOT NULL DEFAULT false, external_id text, idempotency_key text NOT NULL,
amount_minor bigint NOT NULL CHECK(amount_minor>0),
status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','succeeded','failed','cancelled')),
created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(booking_id,currency) REFERENCES app.bookings(id,currency),
UNIQUE(provider,provider_account,live_mode,external_id), UNIQUE(provider,provider_account,live_mode,idempotency_key)
```

## refunds

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
payment_id uuid NOT NULL REFERENCES app.payments(id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
idempotency_key text NOT NULL UNIQUE, external_id text,
status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','pending','succeeded','failed')),
reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
```

## webhook_inbox

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
provider text NOT NULL, provider_account text NOT NULL, live_mode boolean NOT NULL,
event_id text NOT NULL, payload_hash text NOT NULL, sanitized_payload jsonb NOT NULL,
verified_at timestamptz NOT NULL, processed_at timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
last_error_code text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_account,live_mode,event_id)
```

## reviews

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid NOT NULL UNIQUE REFERENCES app.bookings(id), author_id uuid NOT NULL REFERENCES app.users(id),
rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL,
moderation text NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now()
```

## review_responses

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
review_id uuid NOT NULL UNIQUE REFERENCES app.reviews(id), author_id uuid NOT NULL REFERENCES app.users(id),
body text NOT NULL, moderation text NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now()
```

## support_cases

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
reporter_id uuid NOT NULL REFERENCES app.users(id), assigned_to uuid REFERENCES app.users(id),
booking_id uuid REFERENCES app.bookings(id), experience_id uuid REFERENCES app.experiences(id), review_id uuid REFERENCES app.reviews(id),
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','closed')),
reason text NOT NULL, resolution text, created_at timestamptz NOT NULL DEFAULT now()
```

## outbox

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
event_type text NOT NULL, aggregate_id uuid NOT NULL, dedupe_key text NOT NULL UNIQUE,
payload jsonb NOT NULL, available_at timestamptz NOT NULL DEFAULT now(), claimed_until timestamptz,
processed_at timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), last_error_code text, created_at timestamptz NOT NULL DEFAULT now()
```

## notifications

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app.users(id), outbox_id uuid NOT NULL REFERENCES app.outbox(id),
channel text NOT NULL CHECK(channel IN ('email','in_app')), category text NOT NULL CHECK(category IN ('transactional','marketing')),
status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','suppressed')),
read_at timestamptz, attempts integer NOT NULL DEFAULT 0, UNIQUE(user_id,outbox_id,channel)
```

## knowledge_documents

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid REFERENCES app.experiences(id), destination_id uuid REFERENCES app.destinations(id),
locale text NOT NULL CHECK(locale IN ('ar','en','fr')), source_uri text NOT NULL, content_hash text NOT NULL,
body text NOT NULL, version integer NOT NULL CHECK(version>0), approved_by uuid REFERENCES app.users(id),
approved_at timestamptz, revoked_at timestamptz, expires_at timestamptz,
CHECK(num_nonnulls(experience_id,destination_id)=1), UNIQUE(source_uri,locale,version)
```

## knowledge_chunks

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
document_id uuid NOT NULL REFERENCES app.knowledge_documents(id), position integer NOT NULL CHECK(position>=0),
body text NOT NULL, token_count integer NOT NULL CHECK(token_count>0),
embedding_model text NOT NULL, embedding vector(1536) NOT NULL,
UNIQUE(document_id,position,embedding_model)
```

## recommendation_runs

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_version_id uuid REFERENCES app.trip_versions(id), user_id uuid REFERENCES app.users(id),
model_version text NOT NULL, prompt_version text NOT NULL, ranker_version text NOT NULL, optimizer_version text NOT NULL,
status text NOT NULL CHECK(status IN ('succeeded','infeasible','failed','fallback')),
constraints jsonb NOT NULL, validation jsonb NOT NULL, latency_ms integer CHECK(latency_ms>=0), created_at timestamptz NOT NULL DEFAULT now()
```

## recommendation_candidates

```sql
run_id uuid NOT NULL REFERENCES app.recommendation_runs(id), experience_id uuid NOT NULL REFERENCES app.experiences(id),
rank integer CHECK(rank>0), score double precision NOT NULL CHECK(score BETWEEN -1e9 AND 1e9),
eligible boolean NOT NULL, sponsored boolean NOT NULL DEFAULT false,
reasons jsonb NOT NULL, PRIMARY KEY(run_id,experience_id)
```

## retrieval_sources

```sql
run_id uuid NOT NULL REFERENCES app.recommendation_runs(id), chunk_id uuid NOT NULL REFERENCES app.knowledge_chunks(id),
PRIMARY KEY(run_id,chunk_id)
```

## feedback_events

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES app.users(id), run_id uuid REFERENCES app.recommendation_runs(id),
original_version_id uuid REFERENCES app.trip_versions(id), final_version_id uuid REFERENCES app.trip_versions(id),
booking_id uuid REFERENCES app.bookings(id), event_type text NOT NULL,
changes jsonb NOT NULL, training_consent boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
```

## evaluation_datasets

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL, version integer NOT NULL CHECK(version>0), checksum text NOT NULL,
sealed_at timestamptz, UNIQUE(name,version)
```

## evaluation_cases

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
dataset_id uuid NOT NULL REFERENCES app.evaluation_datasets(id),
locale text NOT NULL CHECK(locale IN ('ar','ar-LB','en','fr','mixed')), prompt text NOT NULL,
expected_constraints jsonb NOT NULL, fixture_version text NOT NULL
```

## evaluation_runs

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
dataset_id uuid NOT NULL REFERENCES app.evaluation_datasets(id), model_version text NOT NULL,
prompt_version text NOT NULL, ranker_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
```

## evaluation_results

```sql
run_id uuid NOT NULL REFERENCES app.evaluation_runs(id), case_id uuid NOT NULL REFERENCES app.evaluation_cases(id),
passed boolean NOT NULL, metrics jsonb NOT NULL, PRIMARY KEY(run_id,case_id)
```

## weather_snapshots

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
venue_id uuid NOT NULL REFERENCES app.venues(id), provider text NOT NULL,
fetched_at timestamptz NOT NULL, forecast_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
measurements jsonb NOT NULL, attribution text NOT NULL, CHECK(expires_at>fetched_at)
```

## weather_warnings

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_stop_id uuid NOT NULL REFERENCES app.trip_stops(id), snapshot_id uuid NOT NULL REFERENCES app.weather_snapshots(id),
rule_version text NOT NULL, severity text NOT NULL CHECK(severity IN ('advisory','warning')),
acknowledged_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
```

## configuration_versions

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
key text NOT NULL, version integer NOT NULL CHECK(version>0), value jsonb NOT NULL,
changed_by uuid NOT NULL REFERENCES app.users(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(key,version)
```

## commission_terms

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id), version integer NOT NULL CHECK(version>0),
basis_points integer NOT NULL CHECK(basis_points BETWEEN 0 AND 10000), fixed_minor bigint NOT NULL CHECK(fixed_minor>=0),
currency text NOT NULL REFERENCES app.currencies(code), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,version)
```

## booking_commissions

```sql
booking_id uuid PRIMARY KEY REFERENCES app.bookings(id), terms_id uuid NOT NULL REFERENCES app.commission_terms(id),
amount_minor bigint NOT NULL CHECK(amount_minor>=0), snapshot jsonb NOT NULL
```

## analytics_events

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
event_name text NOT NULL, user_id uuid REFERENCES app.users(id), organization_id uuid REFERENCES app.organizations(id),
experience_id uuid REFERENCES app.experiences(id), properties jsonb NOT NULL DEFAULT '{}',
dedupe_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
```

## data_quality_issues

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), rule_code text NOT NULL,
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','ignored')), details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
```

## audit_log

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
actor_id uuid, request_id text, action text NOT NULL, table_name text NOT NULL,
row_key jsonb NOT NULL, changes jsonb NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
```

## Additional integrity layers

The field definitions above come from migration 001. Migrations 002–005 add trigger-based immutability, state transitions, price-range completeness, required cancellation reasons, slot contract protection, evaluation freezing, RLS and grants. Apply all five migrations; migration 001 alone is not the complete database.
