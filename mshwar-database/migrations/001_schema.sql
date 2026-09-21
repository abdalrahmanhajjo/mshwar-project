-- PostgreSQL 17 baseline. Run only through scripts/migrate.py in a fresh database.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
SET search_path = app, public;
CREATE TABLE app.users (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
auth_issuer text NOT NULL, auth_subject text NOT NULL, display_name text NOT NULL,
locale text NOT NULL DEFAULT 'en' CHECK(locale IN ('ar','en','fr')),
status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(auth_issuer,auth_subject)
);

CREATE TABLE app.user_private (
user_id uuid PRIMARY KEY REFERENCES app.users(id), email text, phone text,
preferences jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(preferences)='object'),
personalization_consent boolean NOT NULL DEFAULT false, marketing_consent boolean NOT NULL DEFAULT false,
updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.consent_events (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app.users(id), purpose text NOT NULL,
granted boolean NOT NULL, policy_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.organizations (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL, slug text NOT NULL UNIQUE,
status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','archived')),
verification text NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','verified','rejected','revoked')),
public_contact jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.organization_members (
organization_id uuid NOT NULL REFERENCES app.organizations(id),
user_id uuid NOT NULL REFERENCES app.users(id),
role text NOT NULL CHECK(role IN ('owner','manager','inventory','bookings','finance')),
active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id)
);

CREATE TABLE app.staff_invitations (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id),
email text NOT NULL, role text NOT NULL CHECK(role IN ('manager','inventory','bookings','finance')),
token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz,
invited_by uuid NOT NULL REFERENCES app.users(id), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.verification_events (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id),
reviewer_id uuid NOT NULL REFERENCES app.users(id), decision text NOT NULL CHECK(decision IN ('verified','rejected','revoked')),
reason text NOT NULL CHECK(length(trim(reason))>0), evidence_object_key text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.destinations (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
parent_id uuid REFERENCES app.destinations(id), slug text NOT NULL UNIQUE,
country_code text NOT NULL DEFAULT 'LB' CHECK(length(country_code)=2), name text NOT NULL,
CHECK(parent_id IS DISTINCT FROM id)
);

CREATE TABLE app.venues (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id), destination_id uuid REFERENCES app.destinations(id),
name text NOT NULL, address text NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Beirut',
location geography(Point,4326) NOT NULL, location_source text NOT NULL,
source_reference text, source_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,organization_id)
);

CREATE TABLE app.taxonomy (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
kind text NOT NULL CHECK(kind IN ('category','amenity','dietary','accessibility','interest','suitability','weather')),
slug text NOT NULL, label text NOT NULL, active boolean NOT NULL DEFAULT true, UNIQUE(kind,slug)
);

CREATE TABLE app.experiences (
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
);

CREATE TABLE app.experience_taxonomy (
experience_id uuid NOT NULL REFERENCES app.experiences(id), term_id uuid NOT NULL REFERENCES app.taxonomy(id), PRIMARY KEY(experience_id,term_id)
);

CREATE TABLE app.experience_translations (
experience_id uuid NOT NULL REFERENCES app.experiences(id), locale text NOT NULL CHECK(locale IN ('ar','en','fr')),
title text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY(experience_id,locale)
);

CREATE TABLE app.destination_translations (
destination_id uuid NOT NULL REFERENCES app.destinations(id), locale text NOT NULL CHECK(locale IN ('ar','en','fr')),
title text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY(destination_id,locale)
);

CREATE TABLE app.taxonomy_translations (
taxonomy_id uuid NOT NULL REFERENCES app.taxonomy(id), locale text NOT NULL CHECK(locale IN ('ar','en','fr')),
title text NOT NULL, description text NOT NULL DEFAULT '', PRIMARY KEY(taxonomy_id,locale)
);

CREATE TABLE app.media (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), provider text NOT NULL DEFAULT 'imagekit',
object_key text NOT NULL, alt_text text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
moderation text NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')),
UNIQUE(provider,object_key)
);

CREATE TABLE app.opening_hours (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
venue_id uuid NOT NULL REFERENCES app.venues(id), weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6),
opens time NOT NULL, closes time NOT NULL, CHECK(closes>opens), UNIQUE(venue_id,weekday,opens)
);

CREATE TABLE app.opening_exceptions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
venue_id uuid NOT NULL REFERENCES app.venues(id), local_date date NOT NULL,
closed boolean NOT NULL DEFAULT false, opens time, closes time,
CHECK((closed AND opens IS NULL AND closes IS NULL) OR (NOT closed AND opens IS NOT NULL AND closes IS NOT NULL AND closes>opens)),
UNIQUE(venue_id,local_date)
);

CREATE TABLE app.blackouts (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), period tstzrange NOT NULL,
reason text NOT NULL, CHECK(NOT isempty(period) AND NOT lower_inf(period) AND NOT upper_inf(period))
);

CREATE TABLE app.currencies (
code text PRIMARY KEY CHECK(code ~ '^[A-Z]{3}$'), minor_digits smallint NOT NULL CHECK(minor_digits BETWEEN 0 AND 4)
);

CREATE TABLE app.price_rules (
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
);

CREATE TABLE app.policies (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), version integer NOT NULL CHECK(version>0),
cancellation_rules jsonb NOT NULL CHECK(jsonb_typeof(cancellation_rules)='object'),
terms_text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(experience_id,version)
);

CREATE TABLE app.slots (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
capacity integer NOT NULL CHECK(capacity>0), reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=capacity),
authoritative boolean NOT NULL DEFAULT false, source text NOT NULL, observed_at timestamptz NOT NULL,
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
CHECK(ends_at>starts_at), UNIQUE(experience_id,starts_at), UNIQUE(id,experience_id)
);

CREATE TABLE app.trips (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
owner_id uuid NOT NULL REFERENCES app.users(id), title text NOT NULL,
status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','locked','archived')),
lock_version integer NOT NULL DEFAULT 1 CHECK(lock_version>0), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.trip_members (
trip_id uuid NOT NULL REFERENCES app.trips(id), user_id uuid NOT NULL REFERENCES app.users(id),
role text NOT NULL CHECK(role IN ('view','vote','edit')), shared_preferences jsonb NOT NULL DEFAULT '{}',
PRIMARY KEY(trip_id,user_id)
);

CREATE TABLE app.trip_share_links (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_id uuid NOT NULL REFERENCES app.trips(id), token_hash text NOT NULL UNIQUE,
role text NOT NULL CHECK(role IN ('view','vote','edit')), expires_at timestamptz NOT NULL,
revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.trip_versions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_id uuid NOT NULL REFERENCES app.trips(id), version integer NOT NULL CHECK(version>0),
created_by uuid NOT NULL REFERENCES app.users(id), origin text NOT NULL CHECK(origin IN ('manual','ai','weather','template')),
window_start timestamptz NOT NULL, return_by timestamptz NOT NULL, start_location geography(Point,4326) NOT NULL,
party_size integer NOT NULL CHECK(party_size>0), budget_minor bigint NOT NULL CHECK(budget_minor>=0),
currency text NOT NULL REFERENCES app.currencies(code), strict_budget boolean NOT NULL DEFAULT true,
constraints jsonb NOT NULL DEFAULT '{}', validation jsonb NOT NULL DEFAULT '{}', sealed_at timestamptz,
created_at timestamptz NOT NULL DEFAULT now(), CHECK(return_by>window_start), UNIQUE(trip_id,version), UNIQUE(id,trip_id)
);

CREATE TABLE app.trip_stops (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
version_id uuid NOT NULL REFERENCES app.trip_versions(id), experience_id uuid NOT NULL REFERENCES app.experiences(id),
position integer NOT NULL CHECK(position>0), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
estimated_minor bigint NOT NULL CHECK(estimated_minor>=0), price_kind text NOT NULL CHECK(price_kind IN ('fixed','estimate','quote')),
locked boolean NOT NULL DEFAULT false, snapshot jsonb NOT NULL, CHECK(ends_at>starts_at),
UNIQUE(version_id,position), UNIQUE(id,version_id),
EXCLUDE USING gist(version_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
);

CREATE TABLE app.trip_legs (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
version_id uuid NOT NULL REFERENCES app.trip_versions(id), position integer NOT NULL CHECK(position>=0),
provider text NOT NULL, fetched_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
distance_m integer CHECK(distance_m>=0), duration_seconds integer CHECK(duration_seconds>=0),
estimated_minor bigint NOT NULL DEFAULT 0 CHECK(estimated_minor>=0),
status text NOT NULL CHECK(status IN ('available','unavailable')), CHECK(expires_at>fetched_at),
CHECK(status='unavailable' OR (distance_m IS NOT NULL AND duration_seconds IS NOT NULL)), UNIQUE(version_id,position)
);

CREATE TABLE app.trip_cost_items (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
version_id uuid NOT NULL REFERENCES app.trip_versions(id), kind text NOT NULL CHECK(kind IN ('tax','fee','transport','contingency','other')),
label text NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor>=0)
);

CREATE TABLE app.votes (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_id uuid NOT NULL REFERENCES app.trips(id), user_id uuid NOT NULL REFERENCES app.users(id),
experience_id uuid REFERENCES app.experiences(id), term_id uuid REFERENCES app.taxonomy(id),
value smallint NOT NULL CHECK(value IN (-1,0,1)), CHECK(num_nonnulls(experience_id,term_id)=1),
FOREIGN KEY(trip_id,user_id) REFERENCES app.trip_members(trip_id,user_id),
UNIQUE NULLS NOT DISTINCT(trip_id,user_id,experience_id,term_id)
);

CREATE TABLE app.favorites (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app.users(id), experience_id uuid REFERENCES app.experiences(id), trip_id uuid REFERENCES app.trips(id),
CHECK(num_nonnulls(experience_id,trip_id)=1), UNIQUE NULLS NOT DISTINCT(user_id,experience_id,trip_id)
);

CREATE TABLE app.trip_templates (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
slug text NOT NULL UNIQUE, title text NOT NULL, status text NOT NULL CHECK(status IN ('draft','published','archived')),
destination_id uuid REFERENCES app.destinations(id), description text NOT NULL
);

CREATE TABLE app.trip_template_stops (
template_id uuid NOT NULL REFERENCES app.trip_templates(id), position integer NOT NULL CHECK(position>0),
experience_id uuid NOT NULL REFERENCES app.experiences(id), PRIMARY KEY(template_id,position)
);

CREATE TABLE app.bookings (
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
);

CREATE TABLE app.inquiries (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL REFERENCES app.users(id), experience_id uuid NOT NULL REFERENCES app.experiences(id),
requested_at timestamptz, party_size integer NOT NULL CHECK(party_size>0), message text NOT NULL,
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed')), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.booking_events (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid NOT NULL REFERENCES app.bookings(id), actor_id uuid REFERENCES app.users(id),
from_status text, to_status text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.payments (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid NOT NULL, currency text NOT NULL, provider text NOT NULL, provider_account text NOT NULL,
live_mode boolean NOT NULL DEFAULT false, external_id text, idempotency_key text NOT NULL,
amount_minor bigint NOT NULL CHECK(amount_minor>0),
status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','succeeded','failed','cancelled')),
created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(booking_id,currency) REFERENCES app.bookings(id,currency),
UNIQUE(provider,provider_account,live_mode,external_id), UNIQUE(provider,provider_account,live_mode,idempotency_key)
);

CREATE TABLE app.refunds (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
payment_id uuid NOT NULL REFERENCES app.payments(id), amount_minor bigint NOT NULL CHECK(amount_minor>0),
idempotency_key text NOT NULL UNIQUE, external_id text,
status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','pending','succeeded','failed')),
reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.webhook_inbox (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
provider text NOT NULL, provider_account text NOT NULL, live_mode boolean NOT NULL,
event_id text NOT NULL, payload_hash text NOT NULL, sanitized_payload jsonb NOT NULL,
verified_at timestamptz NOT NULL, processed_at timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
last_error_code text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_account,live_mode,event_id)
);

CREATE TABLE app.reviews (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
booking_id uuid NOT NULL UNIQUE REFERENCES app.bookings(id), author_id uuid NOT NULL REFERENCES app.users(id),
rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL,
moderation text NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.review_responses (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
review_id uuid NOT NULL UNIQUE REFERENCES app.reviews(id), author_id uuid NOT NULL REFERENCES app.users(id),
body text NOT NULL, moderation text NOT NULL DEFAULT 'pending' CHECK(moderation IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.support_cases (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
reporter_id uuid NOT NULL REFERENCES app.users(id), assigned_to uuid REFERENCES app.users(id),
booking_id uuid REFERENCES app.bookings(id), experience_id uuid REFERENCES app.experiences(id), review_id uuid REFERENCES app.reviews(id),
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','resolved','closed')),
reason text NOT NULL, resolution text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.outbox (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
event_type text NOT NULL, aggregate_id uuid NOT NULL, dedupe_key text NOT NULL UNIQUE,
payload jsonb NOT NULL, available_at timestamptz NOT NULL DEFAULT now(), claimed_until timestamptz,
processed_at timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), last_error_code text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.notifications (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid NOT NULL REFERENCES app.users(id), outbox_id uuid NOT NULL REFERENCES app.outbox(id),
channel text NOT NULL CHECK(channel IN ('email','in_app')), category text NOT NULL CHECK(category IN ('transactional','marketing')),
status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','suppressed')),
read_at timestamptz, attempts integer NOT NULL DEFAULT 0, UNIQUE(user_id,outbox_id,channel)
);

CREATE TABLE app.knowledge_documents (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid REFERENCES app.experiences(id), destination_id uuid REFERENCES app.destinations(id),
locale text NOT NULL CHECK(locale IN ('ar','en','fr')), source_uri text NOT NULL, content_hash text NOT NULL,
body text NOT NULL, version integer NOT NULL CHECK(version>0), approved_by uuid REFERENCES app.users(id),
approved_at timestamptz, revoked_at timestamptz, expires_at timestamptz,
CHECK(num_nonnulls(experience_id,destination_id)=1), UNIQUE(source_uri,locale,version)
);

CREATE TABLE app.knowledge_chunks (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
document_id uuid NOT NULL REFERENCES app.knowledge_documents(id), position integer NOT NULL CHECK(position>=0),
body text NOT NULL, token_count integer NOT NULL CHECK(token_count>0),
embedding_model text NOT NULL, embedding vector(1536) NOT NULL,
UNIQUE(document_id,position,embedding_model)
);

CREATE TABLE app.recommendation_runs (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_version_id uuid REFERENCES app.trip_versions(id), user_id uuid REFERENCES app.users(id),
model_version text NOT NULL, prompt_version text NOT NULL, ranker_version text NOT NULL, optimizer_version text NOT NULL,
status text NOT NULL CHECK(status IN ('succeeded','infeasible','failed','fallback')),
constraints jsonb NOT NULL, validation jsonb NOT NULL, latency_ms integer CHECK(latency_ms>=0), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.recommendation_candidates (
run_id uuid NOT NULL REFERENCES app.recommendation_runs(id), experience_id uuid NOT NULL REFERENCES app.experiences(id),
rank integer CHECK(rank>0), score double precision NOT NULL CHECK(score BETWEEN -1e9 AND 1e9),
eligible boolean NOT NULL, sponsored boolean NOT NULL DEFAULT false,
reasons jsonb NOT NULL, PRIMARY KEY(run_id,experience_id)
);

CREATE TABLE app.retrieval_sources (
run_id uuid NOT NULL REFERENCES app.recommendation_runs(id), chunk_id uuid NOT NULL REFERENCES app.knowledge_chunks(id),
PRIMARY KEY(run_id,chunk_id)
);

CREATE TABLE app.feedback_events (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES app.users(id), run_id uuid REFERENCES app.recommendation_runs(id),
original_version_id uuid REFERENCES app.trip_versions(id), final_version_id uuid REFERENCES app.trip_versions(id),
booking_id uuid REFERENCES app.bookings(id), event_type text NOT NULL,
changes jsonb NOT NULL, training_consent boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.evaluation_datasets (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL, version integer NOT NULL CHECK(version>0), checksum text NOT NULL,
sealed_at timestamptz, UNIQUE(name,version)
);

CREATE TABLE app.evaluation_cases (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
dataset_id uuid NOT NULL REFERENCES app.evaluation_datasets(id),
locale text NOT NULL CHECK(locale IN ('ar','ar-LB','en','fr','mixed')), prompt text NOT NULL,
expected_constraints jsonb NOT NULL, fixture_version text NOT NULL
);

CREATE TABLE app.evaluation_runs (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
dataset_id uuid NOT NULL REFERENCES app.evaluation_datasets(id), model_version text NOT NULL,
prompt_version text NOT NULL, ranker_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.evaluation_results (
run_id uuid NOT NULL REFERENCES app.evaluation_runs(id), case_id uuid NOT NULL REFERENCES app.evaluation_cases(id),
passed boolean NOT NULL, metrics jsonb NOT NULL, PRIMARY KEY(run_id,case_id)
);

CREATE TABLE app.weather_snapshots (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
venue_id uuid NOT NULL REFERENCES app.venues(id), provider text NOT NULL,
fetched_at timestamptz NOT NULL, forecast_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
measurements jsonb NOT NULL, attribution text NOT NULL, CHECK(expires_at>fetched_at)
);

CREATE TABLE app.weather_warnings (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
trip_stop_id uuid NOT NULL REFERENCES app.trip_stops(id), snapshot_id uuid NOT NULL REFERENCES app.weather_snapshots(id),
rule_version text NOT NULL, severity text NOT NULL CHECK(severity IN ('advisory','warning')),
acknowledged_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.configuration_versions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
key text NOT NULL, version integer NOT NULL CHECK(version>0), value jsonb NOT NULL,
changed_by uuid NOT NULL REFERENCES app.users(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(key,version)
);

CREATE TABLE app.commission_terms (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id uuid NOT NULL REFERENCES app.organizations(id), version integer NOT NULL CHECK(version>0),
basis_points integer NOT NULL CHECK(basis_points BETWEEN 0 AND 10000), fixed_minor bigint NOT NULL CHECK(fixed_minor>=0),
currency text NOT NULL REFERENCES app.currencies(code), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,version)
);

CREATE TABLE app.booking_commissions (
booking_id uuid PRIMARY KEY REFERENCES app.bookings(id), terms_id uuid NOT NULL REFERENCES app.commission_terms(id),
amount_minor bigint NOT NULL CHECK(amount_minor>=0), snapshot jsonb NOT NULL
);

CREATE TABLE app.analytics_events (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
event_name text NOT NULL, user_id uuid REFERENCES app.users(id), organization_id uuid REFERENCES app.organizations(id),
experience_id uuid REFERENCES app.experiences(id), properties jsonb NOT NULL DEFAULT '{}',
dedupe_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.data_quality_issues (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
experience_id uuid NOT NULL REFERENCES app.experiences(id), rule_code text NOT NULL,
status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','ignored')), details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.audit_log (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
actor_id uuid, request_id text, action text NOT NULL, table_name text NOT NULL,
row_key jsonb NOT NULL, changes jsonb NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.consent_events (user_id);
CREATE INDEX ON app.organization_members (organization_id);
CREATE INDEX ON app.organization_members (user_id);
CREATE INDEX ON app.staff_invitations (organization_id);
CREATE INDEX ON app.staff_invitations (invited_by);
CREATE INDEX ON app.verification_events (organization_id);
CREATE INDEX ON app.verification_events (reviewer_id);
CREATE INDEX ON app.destinations (parent_id);
CREATE INDEX ON app.venues (organization_id);
CREATE INDEX ON app.venues (destination_id);
CREATE INDEX ON app.experiences (organization_id);
CREATE INDEX ON app.experience_taxonomy (experience_id);
CREATE INDEX ON app.experience_taxonomy (term_id);
CREATE INDEX ON app.experience_translations (experience_id);
CREATE INDEX ON app.destination_translations (destination_id);
CREATE INDEX ON app.taxonomy_translations (taxonomy_id);
CREATE INDEX ON app.media (experience_id);
CREATE INDEX ON app.opening_hours (venue_id);
CREATE INDEX ON app.opening_exceptions (venue_id);
CREATE INDEX ON app.blackouts (experience_id);
CREATE INDEX ON app.price_rules (experience_id);
CREATE INDEX ON app.policies (experience_id);
CREATE INDEX ON app.slots (experience_id);
CREATE INDEX ON app.trips (owner_id);
CREATE INDEX ON app.trip_members (trip_id);
CREATE INDEX ON app.trip_members (user_id);
CREATE INDEX ON app.trip_share_links (trip_id);
CREATE INDEX ON app.trip_versions (trip_id);
CREATE INDEX ON app.trip_versions (created_by);
CREATE INDEX ON app.trip_stops (version_id);
CREATE INDEX ON app.trip_stops (experience_id);
CREATE INDEX ON app.trip_legs (version_id);
CREATE INDEX ON app.trip_cost_items (version_id);
CREATE INDEX ON app.votes (trip_id);
CREATE INDEX ON app.votes (user_id);
CREATE INDEX ON app.votes (experience_id);
CREATE INDEX ON app.votes (term_id);
CREATE INDEX ON app.favorites (user_id);
CREATE INDEX ON app.favorites (experience_id);
CREATE INDEX ON app.favorites (trip_id);
CREATE INDEX ON app.trip_templates (destination_id);
CREATE INDEX ON app.trip_template_stops (template_id);
CREATE INDEX ON app.trip_template_stops (experience_id);
CREATE INDEX ON app.bookings (customer_id);
CREATE INDEX ON app.bookings (organization_id);
CREATE INDEX ON app.bookings (trip_stop_id);
CREATE INDEX ON app.inquiries (customer_id);
CREATE INDEX ON app.inquiries (experience_id);
CREATE INDEX ON app.booking_events (booking_id);
CREATE INDEX ON app.booking_events (actor_id);
CREATE INDEX ON app.refunds (payment_id);
CREATE INDEX ON app.reviews (author_id);
CREATE INDEX ON app.review_responses (author_id);
CREATE INDEX ON app.support_cases (reporter_id);
CREATE INDEX ON app.support_cases (assigned_to);
CREATE INDEX ON app.support_cases (booking_id);
CREATE INDEX ON app.support_cases (experience_id);
CREATE INDEX ON app.support_cases (review_id);
CREATE INDEX ON app.notifications (user_id);
CREATE INDEX ON app.notifications (outbox_id);
CREATE INDEX ON app.knowledge_documents (experience_id);
CREATE INDEX ON app.knowledge_documents (destination_id);
CREATE INDEX ON app.knowledge_documents (approved_by);
CREATE INDEX ON app.knowledge_chunks (document_id);
CREATE INDEX ON app.recommendation_runs (trip_version_id);
CREATE INDEX ON app.recommendation_runs (user_id);
CREATE INDEX ON app.recommendation_candidates (run_id);
CREATE INDEX ON app.recommendation_candidates (experience_id);
CREATE INDEX ON app.retrieval_sources (run_id);
CREATE INDEX ON app.retrieval_sources (chunk_id);
CREATE INDEX ON app.feedback_events (user_id);
CREATE INDEX ON app.feedback_events (run_id);
CREATE INDEX ON app.feedback_events (original_version_id);
CREATE INDEX ON app.feedback_events (final_version_id);
CREATE INDEX ON app.feedback_events (booking_id);
CREATE INDEX ON app.evaluation_cases (dataset_id);
CREATE INDEX ON app.evaluation_runs (dataset_id);
CREATE INDEX ON app.evaluation_results (run_id);
CREATE INDEX ON app.evaluation_results (case_id);
CREATE INDEX ON app.weather_snapshots (venue_id);
CREATE INDEX ON app.weather_warnings (trip_stop_id);
CREATE INDEX ON app.weather_warnings (snapshot_id);
CREATE INDEX ON app.configuration_versions (changed_by);
CREATE INDEX ON app.commission_terms (organization_id);
CREATE INDEX ON app.booking_commissions (terms_id);
CREATE INDEX ON app.analytics_events (user_id);
CREATE INDEX ON app.analytics_events (organization_id);
CREATE INDEX ON app.analytics_events (experience_id);
CREATE INDEX ON app.data_quality_issues (experience_id);

CREATE INDEX venues_location_gix ON app.venues USING gist(location);
CREATE INDEX blackouts_period_gix ON app.blackouts USING gist(experience_id,period);
CREATE INDEX experience_search_gin ON app.experiences USING gin(to_tsvector('simple',title || ' ' || description));
CREATE INDEX slot_discovery_idx ON app.slots(experience_id,starts_at) WHERE status='open';
CREATE INDEX booking_expiry_idx ON app.bookings(hold_until) WHERE status='pending';
CREATE INDEX booking_org_calendar_idx ON app.bookings(organization_id,created_at DESC,id);
CREATE INDEX booking_customer_idx ON app.bookings(customer_id,created_at DESC,id);
CREATE INDEX outbox_pending_idx ON app.outbox(available_at,created_at) WHERE processed_at IS NULL;
CREATE INDEX webhook_pending_idx ON app.webhook_inbox(created_at) WHERE processed_at IS NULL;
CREATE INDEX knowledge_embedding_hnsw ON app.knowledge_chunks USING hnsw(embedding vector_cosine_ops);
CREATE INDEX analytics_time_brin ON app.analytics_events USING brin(created_at);
CREATE INDEX audit_time_brin ON app.audit_log USING brin(created_at);
CREATE INDEX organization_members_user_idx ON app.organization_members(user_id,organization_id) WHERE active;
INSERT INTO app.currencies(code,minor_digits) VALUES ('USD',2),('LBP',2),('EUR',2);
