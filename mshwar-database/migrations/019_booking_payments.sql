SET search_path = app, public;

-- ============================================================
-- Migration 019: Availability, Booking & Payments (Epic 9)
-- MSHWAR-81–92.
--
-- Numbering after Epic 7 and Epic 8 landed on main:
--   016 admin is on main
--   017 maps/routing/weather is on main (PR #7)
--   018 AI trip builder is on main (PR #8)
--   019 this file — booking & payments
-- Checksum apply is filename-ordered and forward-only. Rebase
-- may renumber if another migration lands first.
-- ============================================================

-- ---- status machine: draft + refunded --------------------------------

DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'app.bookings'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%expired%'
          AND pg_get_constraintdef(oid) ILIKE '%completed%'
          AND pg_get_constraintdef(oid) NOT ILIKE '%hold_until%'
    LOOP
        EXECUTE format('ALTER TABLE app.bookings DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE app.bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('draft', 'pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'completed', 'refunded'));

ALTER TABLE app.booking_events
    ADD COLUMN IF NOT EXISTS correlation_id text,
    ADD COLUMN IF NOT EXISTS request_id text;

ALTER TABLE app.outbox
    ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

-- ---- idempotency store (24h TTL) -------------------------------------

CREATE TABLE IF NOT EXISTS app.idempotency_keys (
    scope text NOT NULL,
    actor_id uuid NOT NULL,
    key text NOT NULL,
    request_hash text NOT NULL,
    resource_id uuid,
    response jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (scope, actor_id, key),
    CHECK (expires_at > created_at),
    CHECK (length(key) >= 8)
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx
    ON app.idempotency_keys (expires_at)
    WHERE expires_at IS NOT NULL;

-- ---- unit-level EXCLUDE holds (btree_gist) ---------------------------
-- Counted capacity is still enforced by UPDATE ... reserved+party<=capacity.
-- These rows make a second claim on the same unit number impossible.

CREATE TABLE IF NOT EXISTS app.slot_unit_holds (
    slot_id uuid NOT NULL REFERENCES app.slots(id),
    unit_no integer NOT NULL CHECK (unit_no > 0),
    booking_id uuid NOT NULL REFERENCES app.bookings(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    EXCLUDE USING gist (slot_id WITH =, unit_no WITH =)
);

CREATE INDEX IF NOT EXISTS slot_unit_holds_booking_idx ON app.slot_unit_holds (booking_id);

-- ---- reconciliation queue --------------------------------------------

CREATE TABLE IF NOT EXISTS app.reconciliation_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES app.bookings(id),
    payment_id uuid REFERENCES app.payments(id),
    kind text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    UNIQUE (booking_id, kind)
);

DO $$ DECLARE n text; BEGIN
  FOREACH n IN ARRAY ARRAY['idempotency_keys', 'slot_unit_holds', 'reconciliation_items'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', n);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', n);
    EXECUTE format('DROP POLICY IF EXISTS %I_deny ON app.%I', n, n);
    EXECUTE format(
        'CREATE POLICY %I_deny ON app.%I FOR ALL TO mshwar_backend USING (false) WITH CHECK (false)',
        n, n
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON app.idempotency_keys, app.slot_unit_holds, app.reconciliation_items
    TO mshwar_backend;

-- ---- transition table + guards ---------------------------------------

CREATE OR REPLACE FUNCTION app.booking_allowed_transitions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'draft', jsonb_build_array('pending', 'cancelled'),
        'pending', jsonb_build_array('confirmed', 'rejected', 'cancelled', 'expired'),
        'confirmed', jsonb_build_array('cancelled', 'completed', 'refunded'),
        'rejected', jsonb_build_array(),
        'cancelled', jsonb_build_array('refunded'),
        'expired', jsonb_build_array(),
        'completed', jsonb_build_array('refunded'),
        'refunded', jsonb_build_array()
    );
$$;

CREATE OR REPLACE FUNCTION app.booking_transition_allowed(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_from = p_to
        OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(app.booking_allowed_transitions() -> p_from) AS t(status)
            WHERE t.status = p_to
        );
$$;

CREATE OR REPLACE FUNCTION app.check_booking_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE paid bigint;
BEGIN
    IF OLD.status <> 'draft'
       AND ROW(
            NEW.customer_id, NEW.organization_id, NEW.experience_id, NEW.slot_id, NEW.trip_stop_id, NEW.party_size,
            NEW.currency, NEW.total_minor, NEW.payment_required, NEW.price_snapshot, NEW.policy_snapshot,
            NEW.request_key, NEW.request_hash, NEW.mode
       ) IS DISTINCT FROM ROW(
            OLD.customer_id, OLD.organization_id, OLD.experience_id, OLD.slot_id, OLD.trip_stop_id, OLD.party_size,
            OLD.currency, OLD.total_minor, OLD.payment_required, OLD.price_snapshot, OLD.policy_snapshot,
            OLD.request_key, OLD.request_hash, OLD.mode
       )
    THEN RAISE EXCEPTION 'booking contract is immutable'; END IF;
    IF NEW.status <> OLD.status THEN
        IF NOT app.booking_transition_allowed(OLD.status, NEW.status) THEN
            RAISE EXCEPTION 'invalid booking transition % -> %', OLD.status, NEW.status;
        END IF;
        IF NEW.status = 'confirmed' THEN
            IF OLD.hold_until IS NOT NULL AND OLD.hold_until <= clock_timestamp() THEN
                RAISE EXCEPTION 'booking hold expired';
            END IF;
            IF NOT NEW.inventory_reserved THEN
                RAISE EXCEPTION 'confirmation requires capacity';
            END IF;
            SELECT coalesce(sum(amount_minor), 0) INTO paid
            FROM app.payments WHERE booking_id = NEW.id AND status = 'succeeded';
            IF NEW.payment_required AND paid < NEW.total_minor THEN
                RAISE EXCEPTION 'payment not settled';
            END IF;
        END IF;
        IF NEW.status = 'completed' AND (SELECT ends_at FROM app.slots WHERE id = NEW.slot_id) > clock_timestamp() THEN
            RAISE EXCEPTION 'cannot complete before service ends';
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app.booking_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior text; event_uuid uuid; corr text;
BEGIN
    prior := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END;
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
        corr := nullif(current_setting('app.request_id', true), '');
        INSERT INTO app.booking_events(booking_id, actor_id, from_status, to_status, reason, correlation_id, request_id)
        VALUES (NEW.id, app.actor_id(), prior, NEW.status, NEW.reason, corr, corr)
        RETURNING id INTO event_uuid;
        INSERT INTO app.outbox(event_type, aggregate_id, dedupe_key, payload)
        VALUES (
            'booking.' || NEW.status,
            NEW.id,
            event_uuid::text,
            jsonb_build_object(
                'booking_id', NEW.id,
                'status', NEW.status,
                'from_status', prior,
                'correlation_id', corr
            )
        );
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app.allocate_slot_units(p_slot uuid, p_booking uuid, p_party integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE start_no integer;
BEGIN
    SELECT reserved - p_party + 1 INTO start_no FROM app.slots WHERE id = p_slot;
    IF start_no IS NULL OR start_no < 1 THEN
        RAISE EXCEPTION 'insufficient capacity';
    END IF;
    INSERT INTO app.slot_unit_holds(slot_id, unit_no, booking_id)
    SELECT p_slot, g, p_booking
    FROM generate_series(start_no, start_no + p_party - 1) AS g;
END $$;

CREATE OR REPLACE FUNCTION app.release_slot_units(p_booking uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM app.slot_unit_holds WHERE booking_id = p_booking;
END $$;

CREATE OR REPLACE FUNCTION app.transition_booking(p_booking uuid, p_status text, p_reason text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE b app.bookings; s app.slots;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
    IF b.status = p_status THEN RETURN; END IF;
    IF NULLIF(trim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'reason required'; END IF;
    IF NOT app.booking_transition_allowed(b.status, p_status) THEN
        RAISE EXCEPTION 'invalid booking transition % -> %', b.status, p_status;
    END IF;
    SELECT * INTO s FROM app.slots WHERE id = b.slot_id FOR UPDATE;
    IF p_status = 'confirmed' THEN
        IF s.status <> 'open' OR s.starts_at <= clock_timestamp()
           OR EXISTS (
                SELECT 1 FROM app.blackouts
                WHERE experience_id = b.experience_id
                  AND period && tstzrange(s.starts_at, s.ends_at, '[)')
           )
        THEN RAISE EXCEPTION 'slot no longer available'; END IF;
        IF NOT b.inventory_reserved THEN
            IF NOT s.authoritative THEN
                RAISE EXCEPTION 'business must reconcile and mark capacity authoritative before confirming';
            END IF;
            UPDATE app.slots SET reserved = reserved + b.party_size
            WHERE id = s.id AND reserved + b.party_size <= capacity;
            IF NOT FOUND THEN RAISE EXCEPTION 'insufficient capacity'; END IF;
            PERFORM app.allocate_slot_units(s.id, b.id, b.party_size);
            b.inventory_reserved := true;
        END IF;
    ELSIF p_status IN ('cancelled', 'rejected', 'expired', 'refunded') AND b.inventory_reserved THEN
        UPDATE app.slots SET reserved = reserved - b.party_size WHERE id = s.id;
        PERFORM app.release_slot_units(b.id);
        b.inventory_reserved := false;
    END IF;
    UPDATE app.bookings
    SET status = p_status, reason = p_reason, inventory_reserved = b.inventory_reserved
    WHERE id = p_booking;
END $$;

CREATE OR REPLACE FUNCTION app.expire_bookings(p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE b record; n integer := 0;
BEGIN
    IF p_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid batch size'; END IF;
    FOR b IN
        SELECT id FROM app.bookings
        WHERE status IN ('pending', 'draft')
          AND hold_until IS NOT NULL
          AND hold_until <= clock_timestamp()
        ORDER BY hold_until, id
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    LOOP
        PERFORM app.transition_booking(b.id, 'expired', 'Reservation deadline elapsed');
        n := n + 1;
    END LOOP;
    RETURN n;
END $$;

CREATE OR REPLACE FUNCTION app.guard_inventory_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; expected bigint; actual integer;
BEGIN
    IF TG_TABLE_NAME = 'slots' THEN sid := NEW.id; ELSE sid := NEW.slot_id; END IF;
    SELECT reserved INTO actual FROM app.slots WHERE id = sid FOR UPDATE;
    SELECT coalesce(sum(party_size), 0) INTO expected FROM app.bookings WHERE slot_id = sid AND inventory_reserved;
    IF actual <> expected THEN
        RAISE EXCEPTION 'inventory mismatch for slot %: counter %, bookings %', sid, actual, expected;
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.bookings WHERE slot_id = sid AND (
            (status IN ('confirmed', 'completed') AND NOT inventory_reserved)
            OR (status IN ('rejected', 'cancelled', 'expired', 'refunded') AND inventory_reserved)
        )
    ) THEN RAISE EXCEPTION 'booking state/inventory mismatch'; END IF;
    RETURN NULL;
END $$;

-- ---- public quote / slots --------------------------------------------

CREATE OR REPLACE FUNCTION app.instant_capacity_ready(p_experience uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM app.slots s
        JOIN app.experiences e ON e.id = s.experience_id
        WHERE s.experience_id = p_experience
          AND s.authoritative
          AND s.status = 'open'
          AND s.starts_at > clock_timestamp()
          AND s.observed_at >= clock_timestamp() - make_interval(secs => e.freshness_seconds)
          AND s.reserved < s.capacity
    );
$$;

CREATE OR REPLACE FUNCTION app.effective_booking_mode(p_experience uuid, p_slot uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE e app.experiences; s app.slots; mode text;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE id = p_experience;
    IF NOT FOUND THEN RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002'; END IF;
    mode := e.booking_mode;
    IF mode = 'inquiry' THEN
        RETURN 'inquiry';
    END IF;
    IF p_slot IS NULL THEN
        IF mode = 'instant' AND NOT app.instant_capacity_ready(p_experience) THEN
            RETURN 'request';
        END IF;
        RETURN mode;
    END IF;
    SELECT * INTO s FROM app.slots WHERE id = p_slot AND experience_id = p_experience;
    IF NOT FOUND THEN RAISE EXCEPTION 'slot not found' USING ERRCODE = 'P0002'; END IF;
    IF mode = 'instant' AND (NOT s.authoritative OR s.observed_at < clock_timestamp() - make_interval(secs => e.freshness_seconds)) THEN
        RETURN 'request';
    END IF;
    RETURN mode;
END $$;

CREATE OR REPLACE FUNCTION app.list_public_slots(p_slug text, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE e app.experiences;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE slug = p_slug AND status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002'; END IF;
    RETURN jsonb_build_object(
        'experience_id', e.id,
        'slug', e.slug,
        'booking_mode', e.booking_mode,
        'instant_eligible', app.instant_capacity_ready(e.id),
        'effective_mode', app.effective_booking_mode(e.id, NULL),
        'min_party', e.min_party,
        'max_party', e.max_party,
        'slots', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'starts_at', s.starts_at,
                'ends_at', s.ends_at,
                'capacity', s.capacity,
                'reserved', s.reserved,
                'remaining', s.capacity - s.reserved,
                'authoritative', s.authoritative,
                'fresh', s.observed_at >= clock_timestamp() - make_interval(secs => e.freshness_seconds)
            ) ORDER BY s.starts_at)
            FROM app.slots s
            WHERE s.experience_id = e.id
              AND s.status = 'open'
              AND s.starts_at > clock_timestamp()
              AND (p_from IS NULL OR s.starts_at >= p_from)
              AND (p_to IS NULL OR s.starts_at < p_to)
              AND NOT EXISTS (
                  SELECT 1 FROM app.blackouts k
                  WHERE k.experience_id = e.id
                    AND k.period && tstzrange(s.starts_at, s.ends_at, '[)')
              )
        ), '[]'::jsonb)
    );
END $$;

CREATE OR REPLACE FUNCTION app.quote_checkout(p_slug text, p_slot uuid, p_party integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE e app.experiences; s app.slots; pr app.price_rules; pol app.policies;
    mode text; total bigint;
BEGIN
    IF p_party IS NULL OR p_party <= 0 THEN
        RAISE EXCEPTION 'party size is required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO e FROM app.experiences WHERE slug = p_slug AND status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO s FROM app.slots WHERE id = p_slot AND experience_id = e.id;
    IF NOT FOUND OR s.status <> 'open' OR s.starts_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'slot unavailable' USING ERRCODE = 'P0002';
    END IF;
    IF p_party < e.min_party OR p_party > e.max_party THEN
        RAISE EXCEPTION 'party outside limits' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.blackouts
        WHERE experience_id = e.id AND period && tstzrange(s.starts_at, s.ends_at, '[)')
    ) THEN RAISE EXCEPTION 'slot blacked out'; END IF;
    IF s.reserved + p_party > s.capacity THEN
        RAISE EXCEPTION 'insufficient capacity';
    END IF;
    SELECT * INTO pr
    FROM app.price_rules
    WHERE experience_id = e.id AND price_type = 'fixed' AND valid_during @> s.starts_at
    ORDER BY verified_at DESC NULLS LAST, id DESC
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'fixed valid quote required before reservation'; END IF;
    SELECT * INTO pol FROM app.policies WHERE experience_id = e.id ORDER BY version DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid policy'; END IF;
    mode := app.effective_booking_mode(e.id, s.id);
    total := pr.amount_minor * CASE WHEN pr.unit = 'person' THEN p_party ELSE 1 END;
    RETURN jsonb_build_object(
        'experience_id', e.id,
        'experience_title', e.title,
        'slug', e.slug,
        'slot_id', s.id,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'party_size', p_party,
        'configured_mode', e.booking_mode,
        'effective_mode', mode,
        'instant_eligible', mode = 'instant',
        'authoritative', s.authoritative,
        'remaining', s.capacity - s.reserved,
        'price_rule_id', pr.id,
        'policy_id', pol.id,
        'currency', pr.currency,
        'unit_minor', pr.amount_minor,
        'unit', pr.unit,
        'total_minor', total,
        'payment_required', total > 0 AND mode <> 'inquiry',
        'price_snapshot', jsonb_build_object(
            'schema_version', 1,
            'rule_id', pr.id,
            'unit', pr.unit,
            'unit_minor', pr.amount_minor,
            'quantity', p_party,
            'total_minor', total,
            'currency', pr.currency,
            'source', pr.source,
            'experience_title', e.title,
            'starts_at', s.starts_at,
            'ends_at', s.ends_at
        ),
        'policy_snapshot', jsonb_build_object(
            'schema_version', 1,
            'policy_id', pol.id,
            'version', pol.version,
            'rules', pol.cancellation_rules,
            'terms', pol.terms_text
        )
    );
END $$;

-- ---- booking JSON helper ---------------------------------------------

CREATE OR REPLACE FUNCTION app.checkout_booking_json(p_booking uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'id', b.id,
        'customer_id', b.customer_id,
        'organization_id', b.organization_id,
        'experience_id', b.experience_id,
        'experience_title', e.title,
        'listing_slug', e.slug,
        'slot_id', b.slot_id,
        'trip_stop_id', b.trip_stop_id,
        'party_size', b.party_size,
        'status', b.status,
        'mode', b.mode,
        'hold_until', b.hold_until,
        'response_due_at', b.response_due_at,
        'inventory_reserved', b.inventory_reserved,
        'currency', b.currency,
        'total_minor', b.total_minor,
        'payment_required', b.payment_required,
        'price_snapshot', b.price_snapshot,
        'policy_snapshot', b.policy_snapshot,
        'reason', b.reason,
        'created_at', b.created_at,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at
    )
    FROM app.bookings b
    JOIN app.experiences e ON e.id = b.experience_id
    JOIN app.slots s ON s.id = b.slot_id
    WHERE b.id = p_booking;
$$;

CREATE OR REPLACE FUNCTION app.put_idempotency(
    p_scope text,
    p_actor uuid,
    p_key text,
    p_hash text,
    p_resource uuid,
    p_response jsonb,
    p_ttl interval DEFAULT interval '24 hours'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE existing app.idempotency_keys;
BEGIN
    IF p_key IS NULL OR length(p_key) < 8 THEN
        RAISE EXCEPTION 'idempotency key required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO existing
    FROM app.idempotency_keys
    WHERE scope = p_scope AND actor_id = p_actor AND key = p_key
    FOR UPDATE;
    IF FOUND THEN
        IF existing.expires_at <= clock_timestamp() THEN
            DELETE FROM app.idempotency_keys WHERE scope = p_scope AND actor_id = p_actor AND key = p_key;
        ELSIF existing.request_hash <> p_hash THEN
            RAISE EXCEPTION 'idempotency key reused for different request';
        ELSE
            RETURN existing.response;
        END IF;
    END IF;
    INSERT INTO app.idempotency_keys(scope, actor_id, key, request_hash, resource_id, response, expires_at)
    VALUES (p_scope, p_actor, p_key, p_hash, p_resource, p_response, clock_timestamp() + p_ttl)
    ON CONFLICT (scope, actor_id, key) DO UPDATE
        SET request_hash = EXCLUDED.request_hash,
            resource_id = EXCLUDED.resource_id,
            response = EXCLUDED.response,
            expires_at = EXCLUDED.expires_at
    RETURNING response INTO p_response;
    RETURN p_response;
END $$;

CREATE OR REPLACE FUNCTION app.expire_idempotency_keys()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
    DELETE FROM app.idempotency_keys WHERE expires_at <= clock_timestamp();
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

CREATE OR REPLACE FUNCTION app.create_checkout_draft(
    p_user uuid,
    p_slug text,
    p_slot uuid,
    p_party integer,
    p_key text,
    p_hash text,
    p_stop uuid DEFAULT NULL,
    p_correlation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE q jsonb; existing app.bookings; result uuid; v_mode text;
BEGIN
    PERFORM set_config('app.user_id', p_user::text, true);
    PERFORM set_config('app.request_id', coalesce(p_correlation, ''), true);
    IF p_user IS DISTINCT FROM app.actor_id() THEN RAISE EXCEPTION 'actor mismatch'; END IF;
    q := app.quote_checkout(p_slug, p_slot, p_party);
    v_mode := q ->> 'effective_mode';
    IF v_mode = 'inquiry' THEN RAISE EXCEPTION 'use inquiry flow'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_key, 0));
    SELECT * INTO existing FROM app.bookings WHERE customer_id = p_user AND request_key = p_key;
    IF FOUND THEN
        IF existing.request_hash <> p_hash THEN
            RAISE EXCEPTION 'idempotency key reused for different request';
        END IF;
        RETURN app.checkout_booking_json(existing.id);
    END IF;
    IF p_stop IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM app.trip_stops st
        JOIN app.trip_versions v ON v.id = st.version_id
        JOIN app.trips t ON t.id = v.trip_id
        WHERE st.id = p_stop AND st.experience_id = (q ->> 'experience_id')::uuid
          AND v.sealed_at IS NOT NULL AND t.owner_id = p_user
    ) THEN RAISE EXCEPTION 'invalid itinerary booking link'; END IF;
    INSERT INTO app.bookings(
        customer_id, organization_id, experience_id, slot_id, trip_stop_id, party_size, status, mode,
        hold_until, inventory_reserved, currency, total_minor, payment_required,
        price_snapshot, policy_snapshot, request_key, request_hash
    )
    SELECT
        p_user, e.organization_id, e.id, p_slot, p_stop, p_party, 'draft', v_mode,
        clock_timestamp() + interval '30 minutes', false,
        q ->> 'currency', (q ->> 'total_minor')::bigint, (q ->> 'payment_required')::boolean,
        q -> 'price_snapshot', q -> 'policy_snapshot', p_key, p_hash
    FROM app.experiences e
    WHERE e.id = (q ->> 'experience_id')::uuid
    RETURNING id INTO result;
    RETURN app.put_idempotency('booking.draft', p_user, p_key, p_hash, result, app.checkout_booking_json(result));
END $$;

CREATE OR REPLACE FUNCTION app.commit_checkout(
    p_user uuid,
    p_slug text,
    p_slot uuid,
    p_party integer,
    p_key text,
    p_hash text,
    p_price_rule uuid,
    p_policy uuid,
    p_stop uuid DEFAULT NULL,
    p_correlation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE existing app.bookings; v_booking_id uuid; q jsonb; v_mode text; s app.slots; held boolean := false;
BEGIN
    PERFORM set_config('app.user_id', p_user::text, true);
    PERFORM set_config('app.request_id', coalesce(p_correlation, ''), true);
    IF p_user IS DISTINCT FROM app.actor_id() THEN RAISE EXCEPTION 'actor mismatch'; END IF;
    q := app.quote_checkout(p_slug, p_slot, p_party);
    v_mode := q ->> 'effective_mode';
    IF v_mode = 'inquiry' THEN RAISE EXCEPTION 'use inquiry flow'; END IF;
    IF p_price_rule IS DISTINCT FROM (q ->> 'price_rule_id')::uuid
       OR p_policy IS DISTINCT FROM (q ->> 'policy_id')::uuid THEN
        RAISE EXCEPTION 'quote no longer valid';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_key, 0));
    SELECT * INTO existing FROM app.bookings WHERE customer_id = p_user AND request_key = p_key FOR UPDATE;
    IF FOUND THEN
        IF existing.request_hash <> p_hash THEN
            RAISE EXCEPTION 'idempotency key reused for different request';
        END IF;
        IF existing.status <> 'draft' THEN
            RETURN app.checkout_booking_json(existing.id);
        END IF;
        SELECT * INTO s FROM app.slots WHERE id = p_slot FOR UPDATE;
        IF s.authoritative THEN
            UPDATE app.slots SET reserved = reserved + existing.party_size
            WHERE id = p_slot AND reserved + existing.party_size <= capacity;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'insufficient capacity';
            END IF;
            PERFORM app.allocate_slot_units(p_slot, existing.id, existing.party_size);
            held := true;
        END IF;
        UPDATE app.bookings
        SET status = 'pending',
            mode = v_mode,
            price_snapshot = q -> 'price_snapshot',
            policy_snapshot = q -> 'policy_snapshot',
            total_minor = (q ->> 'total_minor')::bigint,
            payment_required = (q ->> 'payment_required')::boolean,
            currency = q ->> 'currency',
            inventory_reserved = held,
            hold_until = least(
                s.starts_at,
                clock_timestamp() + CASE WHEN v_mode = 'instant' THEN interval '15 minutes' ELSE interval '24 hours' END
            ),
            response_due_at = CASE
                WHEN v_mode = 'request' THEN least(s.starts_at, clock_timestamp() + interval '24 hours')
            END
        WHERE id = existing.id;
        IF v_mode = 'instant' AND NOT (q ->> 'payment_required')::boolean THEN
            PERFORM app.transition_booking(existing.id, 'confirmed', 'Instant confirm without payment');
        END IF;
        RETURN app.put_idempotency('booking.commit', p_user, p_key, p_hash, existing.id, app.checkout_booking_json(existing.id));
    END IF;
    v_booking_id := app.reserve_booking(
        p_user, p_slot, p_party, p_key, p_hash, p_price_rule, p_policy,
        (q ->> 'payment_required')::boolean, p_stop
    );
    IF EXISTS (SELECT 1 FROM app.bookings WHERE id = v_booking_id AND inventory_reserved)
       AND NOT EXISTS (SELECT 1 FROM app.slot_unit_holds WHERE booking_id = v_booking_id)
    THEN
        PERFORM app.allocate_slot_units(p_slot, v_booking_id, p_party);
    END IF;
    IF v_mode = 'instant' AND NOT (q ->> 'payment_required')::boolean THEN
        PERFORM app.transition_booking(v_booking_id, 'confirmed', 'Instant confirm without payment');
    END IF;
    RETURN app.put_idempotency('booking.commit', p_user, p_key, p_hash, v_booking_id, app.checkout_booking_json(v_booking_id));
END $$;

CREATE OR REPLACE FUNCTION app.create_inquiry_request(
    p_user uuid,
    p_slug text,
    p_party integer,
    p_message text,
    p_requested_at timestamptz DEFAULT NULL,
    p_key text DEFAULT NULL,
    p_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE e app.experiences; result uuid; payload jsonb;
BEGIN
    PERFORM set_config('app.user_id', p_user::text, true);
    SELECT * INTO e FROM app.experiences WHERE slug = p_slug AND status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002'; END IF;
    IF e.booking_mode <> 'inquiry' THEN
        RAISE EXCEPTION 'listing is not inquiry-only';
    END IF;
    IF p_party < e.min_party OR p_party > e.max_party THEN
        RAISE EXCEPTION 'party outside limits' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(btrim(p_message), '') IS NULL THEN
        RAISE EXCEPTION 'message required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.inquiries(customer_id, experience_id, requested_at, party_size, message)
    VALUES (p_user, e.id, p_requested_at, p_party, btrim(p_message))
    RETURNING id INTO result;
    payload := jsonb_build_object(
        'id', result,
        'experience_id', e.id,
        'listing_slug', e.slug,
        'party_size', p_party,
        'status', 'open',
        'mode', 'inquiry'
    );
    IF p_key IS NOT NULL THEN
        RETURN app.put_idempotency('booking.inquiry', p_user, p_key, coalesce(p_hash, p_key), result, payload);
    END IF;
    RETURN payload;
END $$;

-- ---- payments --------------------------------------------------------

CREATE OR REPLACE FUNCTION app.create_payment_for_booking(
    p_user uuid,
    p_booking uuid,
    p_provider text,
    p_account text,
    p_idempotency text,
    p_external text,
    p_live boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE b app.bookings; pay app.payments;
BEGIN
    PERFORM set_config('app.user_id', p_user::text, true);
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND customer_id = p_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    IF b.status <> 'pending' THEN RAISE EXCEPTION 'booking not payable'; END IF;
    IF NOT b.payment_required THEN RAISE EXCEPTION 'payment not required'; END IF;
    SELECT * INTO pay
    FROM app.payments
    WHERE provider = p_provider AND provider_account = p_account AND live_mode = p_live AND idempotency_key = p_idempotency;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'id', pay.id,
            'booking_id', pay.booking_id,
            'provider', pay.provider,
            'provider_ref', pay.external_id,
            'status', pay.status,
            'amount_minor', pay.amount_minor,
            'currency', pay.currency
        );
    END IF;
    INSERT INTO app.payments(booking_id, currency, provider, provider_account, live_mode, external_id, idempotency_key, amount_minor, status)
    VALUES (b.id, b.currency, p_provider, p_account, p_live, p_external, p_idempotency, b.total_minor, 'created')
    RETURNING * INTO pay;
    RETURN jsonb_build_object(
        'id', pay.id,
        'booking_id', pay.booking_id,
        'provider', pay.provider,
        'provider_ref', pay.external_id,
        'status', pay.status,
        'amount_minor', pay.amount_minor,
        'currency', pay.currency
    );
END $$;

CREATE OR REPLACE FUNCTION app.enqueue_reconciliation(p_booking uuid, p_payment uuid, p_kind text, p_detail jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE result uuid;
BEGIN
    INSERT INTO app.reconciliation_items(booking_id, payment_id, kind, detail)
    VALUES (p_booking, p_payment, p_kind, coalesce(p_detail, '{}'::jsonb))
    ON CONFLICT (booking_id, kind) DO UPDATE
        SET detail = EXCLUDED.detail, status = 'open', resolved_at = NULL
    RETURNING id INTO result;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION app.apply_payment_outcome(
    p_payment uuid,
    p_status text,
    p_reason text DEFAULT 'payment update'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE pay app.payments; b app.bookings;
BEGIN
    SELECT * INTO pay FROM app.payments WHERE id = p_payment FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO b FROM app.bookings WHERE id = pay.booking_id FOR UPDATE;
    IF pay.status IS DISTINCT FROM p_status THEN
        UPDATE app.payments SET status = p_status WHERE id = pay.id;
    END IF;
    IF p_status = 'succeeded' THEN
        IF b.status = 'pending' AND b.mode = 'instant' THEN
            PERFORM app.transition_booking(b.id, 'confirmed', p_reason);
        ELSIF b.status IN ('cancelled', 'expired', 'rejected', 'draft') THEN
            PERFORM app.enqueue_reconciliation(
                b.id, pay.id, 'paid_unconfirmed',
                jsonb_build_object('booking_status', b.status, 'payment_status', p_status)
            );
        END IF;
    ELSIF p_status IN ('failed', 'cancelled') THEN
        IF b.status IN ('draft', 'pending') THEN
            PERFORM app.transition_booking(b.id, 'cancelled', coalesce(nullif(p_reason, ''), 'Payment failed'));
        END IF;
        IF b.status = 'confirmed' THEN
            PERFORM app.enqueue_reconciliation(
                b.id, pay.id, 'confirmed_unpaid',
                jsonb_build_object('booking_status', b.status, 'payment_status', p_status)
            );
            PERFORM app.transition_booking(b.id, 'cancelled', 'Payment failed after confirmation attempt');
        END IF;
    END IF;
    RETURN jsonb_build_object(
        'payment_id', pay.id,
        'booking_id', b.id,
        'payment_status', p_status,
        'booking', app.checkout_booking_json(b.id)
    );
END $$;

CREATE OR REPLACE FUNCTION app.ingest_webhook(
    p_provider text,
    p_account text,
    p_live boolean,
    p_event_id text,
    p_hash text,
    p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE inbox app.webhook_inbox;
BEGIN
    INSERT INTO app.webhook_inbox(provider, provider_account, live_mode, event_id, payload_hash, sanitized_payload, verified_at)
    VALUES (p_provider, p_account, p_live, p_event_id, p_hash, p_payload, clock_timestamp())
    ON CONFLICT (provider, provider_account, live_mode, event_id) DO NOTHING
    RETURNING * INTO inbox;
    IF inbox.id IS NULL THEN
        SELECT * INTO inbox
        FROM app.webhook_inbox
        WHERE provider = p_provider AND provider_account = p_account AND live_mode = p_live AND event_id = p_event_id;
        RETURN jsonb_build_object('id', inbox.id, 'replayed', true, 'processed_at', inbox.processed_at);
    END IF;
    RETURN jsonb_build_object('id', inbox.id, 'replayed', false, 'processed_at', inbox.processed_at);
END $$;

CREATE OR REPLACE FUNCTION app.process_webhook_inbox(p_inbox uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE inbox app.webhook_inbox; pay uuid; outcome text; result jsonb;
BEGIN
    SELECT * INTO inbox FROM app.webhook_inbox WHERE id = p_inbox FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'webhook not found' USING ERRCODE = 'P0002'; END IF;
    IF inbox.processed_at IS NOT NULL THEN
        RETURN jsonb_build_object('id', inbox.id, 'replayed', true);
    END IF;
    pay := coalesce(
        (inbox.sanitized_payload ->> 'payment_id')::uuid,
        (SELECT id FROM app.payments WHERE external_id = inbox.sanitized_payload ->> 'provider_ref' LIMIT 1)
    );
    outcome := inbox.sanitized_payload ->> 'outcome';
    IF pay IS NULL OR outcome IS NULL THEN
        UPDATE app.webhook_inbox
        SET attempts = attempts + 1, last_error_code = 'missing_payment'
        WHERE id = inbox.id;
        RAISE EXCEPTION 'webhook missing payment reference';
    END IF;
    result := app.apply_payment_outcome(pay, outcome, 'webhook:' || inbox.event_id);
    UPDATE app.webhook_inbox SET processed_at = clock_timestamp(), attempts = attempts + 1 WHERE id = inbox.id;
    RETURN result || jsonb_build_object('inbox_id', inbox.id, 'replayed', false);
END $$;

CREATE OR REPLACE FUNCTION app.reconcile_payments(p_admin uuid, p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE rec record; n integer := 0; opened uuid;
BEGIN
    PERFORM app.require_admin(p_admin);
    FOR rec IN
        SELECT f.id AS booking_id, f.status, f.financial_status, f.needs_reconciliation
        FROM app.booking_financial_status f
        WHERE f.needs_reconciliation
        LIMIT p_limit
    LOOP
        opened := app.enqueue_reconciliation(
            rec.booking_id,
            (SELECT id FROM app.payments WHERE booking_id = rec.booking_id ORDER BY created_at DESC LIMIT 1),
            'financial_mismatch',
            jsonb_build_object('booking_status', rec.status, 'financial_status', rec.financial_status)
        );
        n := n + 1;
    END LOOP;
    RETURN jsonb_build_object('enqueued', n);
END $$;

CREATE OR REPLACE FUNCTION app.list_reconciliation_queue(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin);
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', r.id,
            'booking_id', r.booking_id,
            'payment_id', r.payment_id,
            'kind', r.kind,
            'status', r.status,
            'detail', r.detail,
            'created_at', r.created_at
        ) ORDER BY r.created_at)
        FROM app.reconciliation_items r
        WHERE r.status = 'open'
    ), '[]'::jsonb);
END $$;

-- ---- cancel / refund from snapshot -----------------------------------

CREATE OR REPLACE FUNCTION app.refund_bps_from_snapshot(p_snapshot jsonb, p_starts timestamptz)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE hours numeric; v_window jsonb; best integer := 0;
BEGIN
    IF p_snapshot ? 'windows' AND jsonb_typeof(p_snapshot -> 'windows') = 'array' THEN
        FOR v_window IN SELECT value FROM jsonb_array_elements(p_snapshot -> 'windows') LOOP
            IF p_starts - make_interval(hours => coalesce((v_window ->> 'hours_before')::integer, 0)) >= clock_timestamp() THEN
                best := greatest(best, coalesce((v_window ->> 'refund_bps')::integer, 0));
            END IF;
        END LOOP;
        RETURN best;
    END IF;
    hours := coalesce(
        (p_snapshot -> 'rules' ->> 'hours')::numeric,
        (p_snapshot ->> 'hours')::numeric,
        0
    );
    IF hours > 0 AND p_starts - make_interval(hours => hours::integer) >= clock_timestamp() THEN
        RETURN 10000;
    END IF;
    RETURN 0;
END $$;

CREATE OR REPLACE FUNCTION app.preview_cancellation(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE b app.bookings; s app.slots; bps integer; refund_minor bigint;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND customer_id = p_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO s FROM app.slots WHERE id = b.slot_id;
    bps := app.refund_bps_from_snapshot(coalesce(b.policy_snapshot -> 'rules', b.policy_snapshot), s.starts_at);
    refund_minor := (b.total_minor * bps) / 10000;
    RETURN jsonb_build_object(
        'booking_id', b.id,
        'status', b.status,
        'cancellable', b.status IN ('draft', 'pending', 'confirmed'),
        'refund_bps', bps,
        'refund_minor', refund_minor,
        'currency', b.currency,
        'policy_snapshot', b.policy_snapshot,
        'price_snapshot', b.price_snapshot
    );
END $$;

CREATE OR REPLACE FUNCTION app.cancel_checkout_booking(
    p_user uuid,
    p_booking uuid,
    p_reason text,
    p_as_business boolean DEFAULT false,
    p_org uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE b app.bookings; preview jsonb; pay app.payments; refund_id uuid;
BEGIN
    PERFORM set_config('app.user_id', p_user::text, true);
    IF p_as_business THEN
        PERFORM app.require_capability(p_user, p_org, 'bookings');
        SELECT * INTO b FROM app.bookings WHERE id = p_booking AND organization_id = p_org FOR UPDATE;
    ELSE
        SELECT * INTO b FROM app.bookings WHERE id = p_booking AND customer_id = p_user FOR UPDATE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'reason required' USING ERRCODE = '22023'; END IF;
    preview := app.preview_cancellation(b.customer_id, b.id);
    PERFORM app.transition_booking(b.id, 'cancelled', btrim(p_reason));
    SELECT * INTO pay FROM app.payments WHERE booking_id = b.id AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND (preview ->> 'refund_minor')::bigint > 0 THEN
        INSERT INTO app.refunds(payment_id, amount_minor, idempotency_key, status, reason)
        VALUES (
            pay.id,
            (preview ->> 'refund_minor')::bigint,
            'refund-' || b.id::text,
            'requested',
            btrim(p_reason)
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO refund_id;
        IF (preview ->> 'refund_bps')::integer >= 10000 THEN
            UPDATE app.refunds SET status = 'succeeded' WHERE id = refund_id OR idempotency_key = 'refund-' || b.id::text;
            PERFORM app.transition_booking(b.id, 'refunded', 'Refunded from policy snapshot');
        END IF;
    END IF;
    RETURN app.checkout_booking_json(b.id) || jsonb_build_object('cancellation_preview', preview, 'refund_id', refund_id);
END $$;

CREATE OR REPLACE FUNCTION app.get_booking_timeline(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE b app.bookings;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    IF b.customer_id <> p_user
       AND NOT EXISTS (
            SELECT 1 FROM app.organization_members m
            WHERE m.organization_id = b.organization_id AND m.user_id = p_user AND m.active
       )
       AND NOT EXISTS (SELECT 1 FROM app.platform_admins a WHERE a.user_id = p_user AND a.revoked_at IS NULL)
    THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    RETURN jsonb_build_object(
        'booking', app.checkout_booking_json(b.id),
        'timeline', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', ev.id,
                'actor_id', ev.actor_id,
                'from_status', ev.from_status,
                'to_status', ev.to_status,
                'reason', ev.reason,
                'correlation_id', ev.correlation_id,
                'created_at', ev.created_at
            ) ORDER BY ev.created_at)
            FROM app.booking_events ev WHERE ev.booking_id = b.id
        ), '[]'::jsonb)
    );
END $$;

CREATE OR REPLACE FUNCTION app.get_booking_confirmation(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE b app.bookings;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND customer_id = p_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    RETURN jsonb_build_object(
        'booking', app.checkout_booking_json(b.id),
        'payments', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'provider', p.provider,
                'provider_ref', p.external_id,
                'amount_minor', p.amount_minor,
                'currency', p.currency,
                'status', p.status,
                'created_at', p.created_at
            ) ORDER BY p.created_at)
            FROM app.payments p WHERE p.booking_id = b.id
        ), '[]'::jsonb),
        'price_snapshot', b.price_snapshot,
        'policy_snapshot', b.policy_snapshot,
        'generated_from', 'persisted'
    );
END $$;

CREATE OR REPLACE FUNCTION app.list_my_checkout_bookings(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.checkout_booking_json(b.id) ORDER BY b.created_at DESC), '[]'::jsonb)
    FROM app.bookings b
    WHERE b.customer_id = p_user;
$$;

CREATE OR REPLACE FUNCTION app.get_checkout_booking(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE b app.bookings;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND customer_id = p_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002'; END IF;
    RETURN app.checkout_booking_json(b.id);
END $$;

-- ---- outbox worker ---------------------------------------------------

CREATE OR REPLACE FUNCTION app.publish_outbox_batch(p_limit integer DEFAULT 50, p_max_attempts integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE rec record; n_ok integer := 0; n_fail integer := 0; n_dlq integer := 0; b app.bookings;
BEGIN
    FOR rec IN
        SELECT * FROM app.outbox
        WHERE processed_at IS NULL
          AND dead_lettered_at IS NULL
          AND available_at <= clock_timestamp()
          AND (claimed_until IS NULL OR claimed_until <= clock_timestamp())
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT p_limit
    LOOP
        UPDATE app.outbox
        SET claimed_until = clock_timestamp() + interval '2 minutes', attempts = attempts + 1
        WHERE id = rec.id;
        BEGIN
            IF rec.dedupe_key LIKE 'notify:%' THEN
                UPDATE app.outbox SET processed_at = clock_timestamp(), last_error_code = NULL WHERE id = rec.id;
                n_ok := n_ok + 1;
                CONTINUE;
            END IF;
            IF rec.event_type LIKE 'booking.%' THEN
                SELECT * INTO b FROM app.bookings WHERE id = rec.aggregate_id;
                IF FOUND THEN
                    PERFORM app.enqueue_notification(
                        b.customer_id,
                        rec.event_type,
                        b.id,
                        'notify:' || rec.dedupe_key,
                        jsonb_build_object(
                            'booking_id', b.id,
                            'status', b.status,
                            'price_snapshot', b.price_snapshot,
                            'policy_snapshot', b.policy_snapshot,
                            'total_minor', b.total_minor,
                            'currency', b.currency
                        )
                    );
                END IF;
            END IF;
            UPDATE app.outbox SET processed_at = clock_timestamp(), last_error_code = NULL WHERE id = rec.id;
            n_ok := n_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            IF rec.attempts + 1 >= p_max_attempts THEN
                UPDATE app.outbox
                SET dead_lettered_at = clock_timestamp(), last_error_code = SQLSTATE
                WHERE id = rec.id;
                n_dlq := n_dlq + 1;
            ELSE
                UPDATE app.outbox
                SET available_at = clock_timestamp() + make_interval(secs => least(300, power(2, rec.attempts)::integer * 5)),
                    last_error_code = SQLSTATE,
                    claimed_until = NULL
                WHERE id = rec.id;
                n_fail := n_fail + 1;
            END IF;
        END;
    END LOOP;
    RETURN jsonb_build_object('published', n_ok, 'retrying', n_fail, 'dead_lettered', n_dlq);
END $$;

CREATE OR REPLACE FUNCTION app.outbox_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'depth', count(*) FILTER (WHERE processed_at IS NULL AND dead_lettered_at IS NULL),
        'failed', count(*) FILTER (WHERE last_error_code IS NOT NULL AND processed_at IS NULL AND dead_lettered_at IS NULL),
        'dead_lettered', count(*) FILTER (WHERE dead_lettered_at IS NOT NULL),
        'processed', count(*) FILTER (WHERE processed_at IS NOT NULL)
    )
    FROM app.outbox;
$$;

-- Instant mode cannot be selected without authoritative future capacity.
CREATE OR REPLACE FUNCTION app.assert_instant_mode_allowed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.booking_mode = 'instant' AND NOT app.instant_capacity_ready(NEW.id) THEN
        -- Allow first save (no slots yet) only while draft; publish path still gates at quote time.
        IF NEW.status = 'published' THEN
            RAISE EXCEPTION 'instant confirm requires authoritative capacity';
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS experience_instant_guard ON app.experiences;
CREATE TRIGGER experience_instant_guard
    BEFORE INSERT OR UPDATE OF booking_mode, status ON app.experiences
    FOR EACH ROW EXECUTE FUNCTION app.assert_instant_mode_allowed();

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
