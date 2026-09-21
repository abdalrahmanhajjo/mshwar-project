SET search_path = app, public;

-- ============================================================
-- Migration 018: AI Trip Builder (Epic 8 / MSHWAR-68–80)
-- ============================================================
-- Planner sessions, versioned ranker weights, injection logs,
-- itinerary-version booking links, hybrid candidate retrieval,
-- and persist/seal helpers. LLM never writes places or totals;
-- every stop must be a retrieved published experience id.
--
-- Numbering note: 016/017 may be claimed by open Epic 6/7 PRs.
-- Rebase may renumber this file.

-- ---- schema -------------------------------------------------

ALTER TABLE app.bookings
    ADD COLUMN IF NOT EXISTS itinerary_version_id uuid REFERENCES app.trip_versions(id);

ALTER TABLE app.account_bookings
    ADD COLUMN IF NOT EXISTS itinerary_version_id uuid REFERENCES app.trip_versions(id);

CREATE TABLE IF NOT EXISTS app.planner_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    trip_id uuid REFERENCES app.trips(id),
    current_version_id uuid REFERENCES app.trip_versions(id),
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'clarifying', 'planned', 'infeasible', 'degraded', 'failed')),
    clarification_round integer NOT NULL DEFAULT 0
        CHECK (clarification_round BETWEEN 0 AND 2),
    locale text NOT NULL DEFAULT 'en',
    raw_text text NOT NULL DEFAULT '',
    constraints jsonb NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(constraints) = 'object'),
    assumed_defaults jsonb NOT NULL DEFAULT '[]'
        CHECK (jsonb_typeof(assumed_defaults) = 'array'),
    pending_action jsonb NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(pending_action) = 'object'),
    degraded boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.planner_ranker_weights (
    version text PRIMARY KEY,
    weights jsonb NOT NULL CHECK (jsonb_typeof(weights) = 'object'),
    active boolean NOT NULL DEFAULT false,
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES app.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS planner_ranker_one_active
    ON app.planner_ranker_weights (active) WHERE active;

CREATE TABLE IF NOT EXISTS app.planner_sponsorships (
    experience_id uuid PRIMARY KEY REFERENCES app.experiences(id),
    label text NOT NULL DEFAULT 'Sponsored',
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS app.ai_safety_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES app.users(id),
    session_id uuid REFERENCES app.planner_sessions(id),
    kind text NOT NULL CHECK (kind IN ('injection_attempt', 'schema_reject', 'tool_block')),
    pattern text NOT NULL,
    excerpt text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planner_sessions_user_idx
    ON app.planner_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS planner_sessions_trip_idx
    ON app.planner_sessions (trip_id);
CREATE INDEX IF NOT EXISTS ai_safety_events_created_idx
    ON app.ai_safety_events (created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_itinerary_version_idx
    ON app.bookings (itinerary_version_id);
CREATE INDEX IF NOT EXISTS account_bookings_itinerary_version_idx
    ON app.account_bookings (itinerary_version_id);

COMMENT ON TABLE app.planner_sessions IS
    'Clarification and draft state for the AI trip builder. Totals are never stored from the model.';
COMMENT ON TABLE app.ai_safety_events IS
    'Suspected prompt-injection or disallowed-tool attempts. Excerpts are truncated; raw prompts are not stored.';

-- ---- RLS ----------------------------------------------------

ALTER TABLE app.planner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.planner_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.planner_ranker_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.planner_ranker_weights FORCE ROW LEVEL SECURITY;
ALTER TABLE app.planner_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.planner_sponsorships FORCE ROW LEVEL SECURITY;
ALTER TABLE app.ai_safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_safety_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planner_session_owner ON app.planner_sessions;
CREATE POLICY planner_session_owner ON app.planner_sessions FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS planner_ranker_read ON app.planner_ranker_weights;
CREATE POLICY planner_ranker_read ON app.planner_ranker_weights FOR SELECT TO mshwar_backend
    USING (true);

DROP POLICY IF EXISTS planner_sponsorship_read ON app.planner_sponsorships;
CREATE POLICY planner_sponsorship_read ON app.planner_sponsorships FOR SELECT TO mshwar_backend
    USING (true);

DROP POLICY IF EXISTS ai_safety_admin_read ON app.ai_safety_events;
CREATE POLICY ai_safety_admin_read ON app.ai_safety_events FOR SELECT TO mshwar_backend
    USING (app.is_platform_admin(app.current_user_id()));

GRANT SELECT, INSERT, UPDATE ON app.planner_sessions, app.planner_ranker_weights,
    app.planner_sponsorships, app.ai_safety_events TO mshwar_backend;
GRANT SELECT ON app.planner_sessions, app.planner_ranker_weights TO mshwar_reader;

-- ---- seed: catalogue hours, ranker, one sponsored listing ----

INSERT INTO app.opening_hours (venue_id, weekday, opens, closes, source)
SELECT v.id, d.weekday, TIME '09:00', TIME '21:00', 'planner-seed'
FROM app.venues v
JOIN app.organizations o ON o.id = v.organization_id AND o.slug = 'mshwar-catalogue'
CROSS JOIN generate_series(0, 6) AS d(weekday)
WHERE NOT EXISTS (
    SELECT 1 FROM app.opening_hours h
    WHERE h.venue_id = v.id AND h.weekday = d.weekday
);

INSERT INTO app.planner_ranker_weights (version, weights, active, notes)
VALUES (
    'ranker-v1',
    jsonb_build_object(
        'preference', 0.34,
        'vector', 0.22,
        'destination', 0.18,
        'price_fit', 0.12,
        'compactness', 0.10,
        'sponsored', 0.04
    ),
    true,
    'Default deterministic weights. Sponsored cannot bypass eligibility.'
)
ON CONFLICT (version) DO UPDATE
SET weights = EXCLUDED.weights, notes = EXCLUDED.notes;

INSERT INTO app.planner_sponsorships (experience_id, label, active)
SELECT e.id, 'Sponsored', true
FROM app.experiences e
WHERE e.slug = 'beirut-street-to-sea'
ON CONFLICT (experience_id) DO NOTHING;

-- ---- helpers ------------------------------------------------

CREATE OR REPLACE FUNCTION app.planner_touch_session(p_id uuid)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE app.planner_sessions SET updated_at = now() WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION app.planner_active_weights()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT weights FROM app.planner_ranker_weights WHERE active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app.planner_set_ranker_weights(
    p_admin uuid,
    p_version text,
    p_weights jsonb,
    p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF jsonb_typeof(p_weights) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid weights' USING ERRCODE = '22023';
    END IF;
    UPDATE app.planner_ranker_weights SET active = false WHERE active;
    INSERT INTO app.planner_ranker_weights (version, weights, active, notes, created_by)
    VALUES (p_version, p_weights, true, coalesce(p_notes, ''), p_admin)
    ON CONFLICT (version) DO UPDATE
        SET weights = EXCLUDED.weights,
            active = true,
            notes = EXCLUDED.notes,
            created_by = EXCLUDED.created_by;
    RETURN (SELECT jsonb_build_object(
        'version', w.version, 'weights', w.weights, 'active', w.active, 'notes', w.notes
    ) FROM app.planner_ranker_weights w WHERE w.version = p_version);
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_upsert_session(
    p_user uuid,
    p_id uuid,
    p_locale text,
    p_raw_text text,
    p_status text,
    p_round integer,
    p_constraints jsonb,
    p_assumed jsonb,
    p_degraded boolean,
    p_trip uuid,
    p_version uuid,
    p_pending jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid := coalesce(p_id, gen_random_uuid());
BEGIN
    INSERT INTO app.planner_sessions (
        id, user_id, locale, raw_text, status, clarification_round,
        constraints, assumed_defaults, degraded, trip_id, current_version_id, pending_action, updated_at
    ) VALUES (
        v_id, p_user, coalesce(NULLIF(p_locale, ''), 'en'), coalesce(p_raw_text, ''),
        coalesce(NULLIF(p_status, ''), 'open'), GREATEST(LEAST(coalesce(p_round, 0), 2), 0),
        coalesce(p_constraints, '{}'::jsonb), coalesce(p_assumed, '[]'::jsonb),
        coalesce(p_degraded, false), p_trip, p_version, coalesce(p_pending, '{}'::jsonb), now()
    )
    ON CONFLICT (id) DO UPDATE SET
        locale = EXCLUDED.locale,
        raw_text = EXCLUDED.raw_text,
        status = EXCLUDED.status,
        clarification_round = EXCLUDED.clarification_round,
        constraints = EXCLUDED.constraints,
        assumed_defaults = EXCLUDED.assumed_defaults,
        degraded = EXCLUDED.degraded,
        trip_id = COALESCE(EXCLUDED.trip_id, app.planner_sessions.trip_id),
        current_version_id = COALESCE(EXCLUDED.current_version_id, app.planner_sessions.current_version_id),
        pending_action = EXCLUDED.pending_action,
        updated_at = now()
    WHERE app.planner_sessions.user_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_get_session(p_user uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_row app.planner_sessions;
BEGIN
    SELECT * INTO v_row FROM app.planner_sessions WHERE id = p_id AND user_id = p_user;
    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_retrieve_candidates(p_constraints jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_q text := btrim(coalesce(p_constraints->>'query', p_constraints->>'raw_text', ''));
    v_party integer := NULLIF(p_constraints->>'party_size', '')::integer;
    v_limit integer := GREATEST(coalesce(NULLIF(p_constraints->>'candidate_limit', '')::integer, 24), 1);
    v_items jsonb;
    v_tsq tsquery;
BEGIN
    IF v_q <> '' THEN
        BEGIN
            v_tsq := websearch_to_tsquery('simple', v_q);
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                v_tsq := plainto_tsquery('simple', v_q);
            EXCEPTION WHEN OTHERS THEN
                v_tsq := NULL;
            END;
        END;
    END IF;
    WITH scored AS (
        SELECT e.id,
            CASE
                WHEN v_tsq IS NULL THEN 0::float4
                ELSE ts_rank_cd(to_tsvector('simple', coalesce(e.search_text, e.title || ' ' || e.description)), v_tsq)
            END AS fts,
            CASE
                WHEN v_q = '' THEN 0::float4
                ELSE (1 - (e.embedding <=> app.stub_embedding(v_q)))
            END AS vec
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id
            AND o.status = 'active' AND o.verification = 'verified'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND e.embedding IS NOT NULL
          AND (v_party IS NULL OR (e.min_party <= v_party AND e.max_party >= v_party))
          AND (
                p_constraints->'destination_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'destination_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'destination_slugs') = 0
                OR d.slug IN (SELECT jsonb_array_elements_text(p_constraints->'destination_slugs'))
          )
          AND (
                p_constraints->'kind_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'kind_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'kind_slugs') = 0
                OR e.listing_kind IN (SELECT jsonb_array_elements_text(p_constraints->'kind_slugs'))
          )
          AND (
                p_constraints->'category_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'category_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'category_slugs') = 0
                OR EXISTS (
                    SELECT 1 FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category'
                      AND t.slug IN (SELECT jsonb_array_elements_text(p_constraints->'category_slugs'))
                )
          )
    )
    SELECT coalesce(jsonb_agg(item ORDER BY rank DESC, id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT s.id,
            (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) AS rank,
            jsonb_build_object(
                'id', e.id,
                'slug', e.slug,
                'title', e.title,
                'description', e.description,
                'status', e.status,
                'duration_minutes', e.duration_minutes,
                'min_party', e.min_party,
                'max_party', e.max_party,
                'setting', e.setting,
                'intensity', e.intensity,
                'listing_kind', e.listing_kind,
                'inventory_available', e.inventory_available,
                'destination_slug', d.slug,
                'destination_name', d.name,
                'venue_id', v.id,
                'venue_name', v.name,
                'lat', ST_Y(v.location::geometry),
                'lng', ST_X(v.location::geometry),
                'fts', s.fts,
                'vec', s.vec,
                'hybrid', round((0.7 * s.fts + 0.3 * greatest(s.vec, 0))::numeric, 4),
                'sponsored', EXISTS (
                    SELECT 1 FROM app.planner_sponsorships sp
                    WHERE sp.experience_id = e.id AND sp.active
                ),
                'sponsored_label', (
                    SELECT sp.label FROM app.planner_sponsorships sp
                    WHERE sp.experience_id = e.id AND sp.active
                ),
                'category_slugs', coalesce((
                    SELECT jsonb_agg(t.slug ORDER BY t.slug)
                    FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category'
                ), '[]'::jsonb),
                'interest_slugs', coalesce((
                    SELECT jsonb_agg(t.slug ORDER BY t.slug)
                    FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind IN ('interest', 'tag')
                ), '[]'::jsonb),
                'price', jsonb_build_object(
                    'currency', coalesce(pr.currency, 'USD'),
                    'type', coalesce(pr.price_type, 'from'),
                    'source', coalesce(pr.source, 'unknown'),
                    'amount_minor', pr.amount_minor,
                    'unit', coalesce(pr.unit, 'person')
                ),
                'hours', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                        'weekday', h.weekday, 'opens', h.opens, 'closes', h.closes
                    ) ORDER BY h.weekday)
                    FROM app.opening_hours h WHERE h.venue_id = v.id
                ), '[]'::jsonb),
                'exceptions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                        'local_date', x.local_date, 'closed', x.closed,
                        'opens', x.opens, 'closes', x.closes
                    ))
                    FROM app.opening_exceptions x WHERE x.venue_id = v.id
                ), '[]'::jsonb),
                'facts', coalesce(e.catalogue_facts, '[]'::jsonb)
            ) AS item
        FROM scored s
        JOIN app.experiences e ON e.id = s.id
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        LEFT JOIN LATERAL (
            SELECT currency, price_type, source, amount_minor, unit
            FROM app.price_rules
            WHERE experience_id = e.id
            ORDER BY verified_at DESC NULLS LAST
            LIMIT 1
        ) pr ON true
        ORDER BY (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) DESC, e.id
        LIMIT v_limit
    ) q;

    RETURN coalesce(v_items, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_persist_version(
    p_user uuid,
    p_trip uuid,
    p_title text,
    p_origin text,
    p_window_start timestamptz,
    p_return_by timestamptz,
    p_start_lng double precision,
    p_start_lat double precision,
    p_party_size integer,
    p_budget_minor bigint,
    p_currency text,
    p_strict_budget boolean,
    p_constraints jsonb,
    p_validation jsonb,
    p_stops jsonb,
    p_legs jsonb,
    p_costs jsonb,
    p_run jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip uuid := p_trip;
    v_version uuid;
    v_next integer;
    v_stop jsonb;
    v_leg jsonb;
    v_cost jsonb;
    v_exp uuid;
    v_retrieved jsonb;
    v_total bigint := 0;
    v_run uuid;
BEGIN
    IF p_stops IS NULL OR jsonb_typeof(p_stops) <> 'array' OR jsonb_array_length(p_stops) = 0 THEN
        RAISE EXCEPTION 'empty itinerary' USING ERRCODE = '22023';
    END IF;
    v_retrieved := coalesce(p_constraints->'retrieved_ids', '[]'::jsonb);
    IF jsonb_typeof(v_retrieved) <> 'array' THEN
        RAISE EXCEPTION 'retrieved_ids required' USING ERRCODE = '22023';
    END IF;

    IF v_trip IS NULL THEN
        INSERT INTO app.trips (owner_id, title, status)
        VALUES (p_user, coalesce(NULLIF(btrim(p_title), ''), 'Untitled plan'), 'draft')
        RETURNING id INTO v_trip;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = v_trip AND t.owner_id = p_user) THEN
            RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
        END IF;
        UPDATE app.trips SET title = coalesce(NULLIF(btrim(p_title), ''), title) WHERE id = v_trip;
    END IF;

    SELECT coalesce(max(version), 0) + 1 INTO v_next FROM app.trip_versions WHERE trip_id = v_trip;
    INSERT INTO app.trip_versions (
        trip_id, version, created_by, origin, window_start, return_by, start_location,
        party_size, budget_minor, currency, strict_budget, constraints, validation
    ) VALUES (
        v_trip, v_next, p_user, coalesce(NULLIF(p_origin, ''), 'ai'),
        p_window_start, p_return_by,
        ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326)::geography,
        GREATEST(p_party_size, 1), GREATEST(p_budget_minor, 0), coalesce(p_currency, 'USD'),
        coalesce(p_strict_budget, false), coalesce(p_constraints, '{}'::jsonb),
        coalesce(p_validation, '{}'::jsonb)
    ) RETURNING id INTO v_version;

    FOR v_stop IN SELECT value FROM jsonb_array_elements(p_stops)
    LOOP
        v_exp := (v_stop->>'experience_id')::uuid;
        IF NOT (v_retrieved @> jsonb_build_array(v_exp::text) OR v_retrieved @> jsonb_build_array(to_jsonb(v_exp))) THEN
            RAISE EXCEPTION 'stop not in retrieved candidates' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM app.experiences e
            JOIN app.organizations o ON o.id = e.organization_id
            WHERE e.id = v_exp AND e.status = 'published' AND o.status = 'active'
        ) THEN
            RAISE EXCEPTION 'unpublished stop' USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.trip_stops (
            version_id, experience_id, position, starts_at, ends_at,
            estimated_minor, price_kind, locked, snapshot
        ) VALUES (
            v_version, v_exp, (v_stop->>'position')::integer,
            (v_stop->>'starts_at')::timestamptz, (v_stop->>'ends_at')::timestamptz,
            GREATEST(coalesce((v_stop->>'estimated_minor')::bigint, 0), 0),
            coalesce(v_stop->>'price_kind', 'estimate'),
            coalesce((v_stop->>'locked')::boolean, false),
            coalesce(v_stop->'snapshot', '{}'::jsonb)
        );
    END LOOP;

    FOR v_leg IN SELECT value FROM jsonb_array_elements(coalesce(p_legs, '[]'::jsonb))
    LOOP
        INSERT INTO app.trip_legs (
            version_id, position, provider, fetched_at, expires_at,
            distance_m, duration_seconds, estimated_minor, status
        ) VALUES (
            v_version, (v_leg->>'position')::integer,
            coalesce(v_leg->>'provider', 'stub'),
            coalesce((v_leg->>'fetched_at')::timestamptz, now()),
            coalesce((v_leg->>'expires_at')::timestamptz, now() + interval '1 hour'),
            NULLIF(v_leg->>'distance_m', '')::integer,
            NULLIF(v_leg->>'duration_seconds', '')::integer,
            GREATEST(coalesce((v_leg->>'estimated_minor')::bigint, 0), 0),
            coalesce(v_leg->>'status', 'available')
        );
    END LOOP;

    FOR v_cost IN SELECT value FROM jsonb_array_elements(coalesce(p_costs, '[]'::jsonb))
    LOOP
        INSERT INTO app.trip_cost_items (version_id, kind, label, amount_minor)
        VALUES (
            v_version,
            coalesce(v_cost->>'kind', 'other'),
            coalesce(v_cost->>'label', 'Item'),
            GREATEST(coalesce((v_cost->>'amount_minor')::bigint, 0), 0)
        );
    END LOOP;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total FROM app.trip_stops WHERE version_id = v_version;
    v_total := v_total
        + coalesce((SELECT sum(estimated_minor) FROM app.trip_legs WHERE version_id = v_version), 0)
        + coalesce((SELECT sum(amount_minor) FROM app.trip_cost_items WHERE version_id = v_version), 0);

    UPDATE app.trip_versions
    SET validation = coalesce(p_validation, '{}'::jsonb)
            || jsonb_build_object('feasible', 'true', 'validator_version', 'planner-v1', 'total_minor', v_total),
        sealed_at = now()
    WHERE id = v_version;

    INSERT INTO app.recommendation_runs (
        trip_version_id, user_id, model_version, prompt_version, ranker_version, optimizer_version,
        status, constraints, validation, latency_ms
    ) VALUES (
        v_version, p_user,
        coalesce(p_run->>'model_version', 'stub-llm'),
        coalesce(p_run->>'prompt_version', 'intent-v1'),
        coalesce(p_run->>'ranker_version', 'ranker-v1'),
        coalesce(p_run->>'optimizer_version', 'greedy-v1'),
        coalesce(p_run->>'status', 'succeeded'),
        coalesce(p_constraints, '{}'::jsonb),
        coalesce(p_validation, '{}'::jsonb) || jsonb_build_object('total_minor', v_total),
        NULLIF(p_run->>'latency_ms', '')::integer
    ) RETURNING id INTO v_run;

    INSERT INTO app.recommendation_candidates (run_id, experience_id, rank, score, eligible, sponsored, reasons)
    SELECT v_run, (c->>'experience_id')::uuid, (c->>'rank')::integer, (c->>'score')::double precision,
           coalesce((c->>'eligible')::boolean, true), coalesce((c->>'sponsored')::boolean, false),
           coalesce(c->'reasons', '{}'::jsonb)
    FROM jsonb_array_elements(coalesce(p_run->'candidates', '[]'::jsonb)) AS c
    ON CONFLICT DO NOTHING;

    RETURN app.planner_version_payload(p_user, v_version, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_version_payload(p_user uuid, p_version uuid, p_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_version app.trip_versions;
    v_trip app.trips;
    v_stops jsonb;
    v_legs jsonb;
    v_costs jsonb;
    v_total bigint;
BEGIN
    SELECT * INTO v_version FROM app.trip_versions WHERE id = p_version;
    IF v_version.id IS NULL THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_trip FROM app.trips WHERE id = v_version.trip_id;
    IF v_trip.owner_id <> p_user AND NOT (p_admin AND app.is_platform_admin(p_user)) THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'experience_id', s.experience_id,
        'position', s.position,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'estimated_minor', s.estimated_minor,
        'price_kind', s.price_kind,
        'locked', s.locked,
        'snapshot', s.snapshot,
        'slug', e.slug,
        'title', e.title,
        'booking_mode', e.booking_mode
    ) ORDER BY s.position), '[]'::jsonb)
    INTO v_stops
    FROM app.trip_stops s
    JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = p_version;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'position', l.position,
        'provider', l.provider,
        'distance_m', l.distance_m,
        'duration_seconds', l.duration_seconds,
        'estimated_minor', l.estimated_minor,
        'status', l.status
    ) ORDER BY l.position), '[]'::jsonb)
    INTO v_legs
    FROM app.trip_legs l
    WHERE l.version_id = p_version;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'label', c.label, 'amount_minor', c.amount_minor
    )), '[]'::jsonb)
    INTO v_costs
    FROM app.trip_cost_items c
    WHERE c.version_id = p_version;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total FROM app.trip_stops WHERE version_id = p_version;
    v_total := v_total
        + coalesce((SELECT sum(estimated_minor) FROM app.trip_legs WHERE version_id = p_version), 0)
        + coalesce((SELECT sum(amount_minor) FROM app.trip_cost_items WHERE version_id = p_version), 0);

    RETURN jsonb_build_object(
        'trip_id', v_trip.id,
        'trip_title', v_trip.title,
        'trip_status', v_trip.status,
        'version_id', v_version.id,
        'version', v_version.version,
        'origin', v_version.origin,
        'sealed_at', v_version.sealed_at,
        'window_start', v_version.window_start,
        'return_by', v_version.return_by,
        'party_size', v_version.party_size,
        'budget_minor', v_version.budget_minor,
        'currency', v_version.currency,
        'strict_budget', v_version.strict_budget,
        'constraints', v_version.constraints,
        'validation', v_version.validation,
        'stops', v_stops,
        'legs', v_legs,
        'cost_items', v_costs,
        'total_minor', v_total
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_list_versions(p_user uuid, p_trip uuid, p_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_owner uuid;
BEGIN
    SELECT owner_id INTO v_owner FROM app.trips WHERE id = p_trip;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_owner <> p_user AND NOT (p_admin AND app.is_platform_admin(p_user)) THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'version_id', v.id,
            'version', v.version,
            'origin', v.origin,
            'sealed_at', v.sealed_at,
            'created_at', v.created_at,
            'party_size', v.party_size,
            'budget_minor', v.budget_minor,
            'currency', v.currency,
            'strict_budget', v.strict_budget,
            'constraints', v.constraints,
            'stop_count', (SELECT count(*) FROM app.trip_stops s WHERE s.version_id = v.id)
        ) ORDER BY v.version DESC)
        FROM app.trip_versions v
        WHERE v.trip_id = p_trip
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.link_booking_itinerary_version(
    p_user uuid,
    p_booking uuid,
    p_version uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip uuid;
BEGIN
    SELECT trip_id INTO v_trip FROM app.trip_versions WHERE id = p_version AND sealed_at IS NOT NULL;
    IF v_trip IS NULL THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = v_trip AND t.owner_id = p_user)
       AND NOT app.is_platform_admin(p_user) THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE app.account_bookings
    SET itinerary_version_id = p_version
    WHERE id = p_booking AND customer_id = p_user;
    IF FOUND THEN
        RETURN jsonb_build_object('booking_id', p_booking, 'itinerary_version_id', p_version, 'kind', 'account');
    END IF;

    UPDATE app.bookings
    SET itinerary_version_id = p_version
    WHERE id = p_booking AND customer_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('booking_id', p_booking, 'itinerary_version_id', p_version, 'kind', 'inventory');
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_log_safety_event(
    p_user uuid,
    p_session uuid,
    p_kind text,
    p_pattern text,
    p_excerpt text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO app.ai_safety_events (user_id, session_id, kind, pattern, excerpt)
    VALUES (
        p_user, p_session, p_kind, left(coalesce(p_pattern, 'unknown'), 120),
        left(coalesce(p_excerpt, ''), 240)
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_list_safety_events(p_admin uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', e.id,
            'user_id', e.user_id,
            'session_id', e.session_id,
            'kind', e.kind,
            'pattern', e.pattern,
            'excerpt', e.excerpt,
            'created_at', e.created_at
        ) ORDER BY e.created_at DESC)
        FROM (
            SELECT * FROM app.ai_safety_events
            ORDER BY created_at DESC
            LIMIT GREATEST(coalesce(p_limit, 50), 1)
        ) e
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_admin_health(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'injection_events_24h', (
            SELECT count(*) FROM app.ai_safety_events
            WHERE created_at > now() - interval '24 hours'
        ),
        'planned_sessions_24h', (
            SELECT count(*) FROM app.planner_sessions
            WHERE status = 'planned' AND updated_at > now() - interval '24 hours'
        ),
        'degraded_sessions_24h', (
            SELECT count(*) FROM app.planner_sessions
            WHERE degraded AND updated_at > now() - interval '24 hours'
        ),
        'active_ranker', (SELECT version FROM app.planner_ranker_weights WHERE active LIMIT 1)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.planner_rag_chunks(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'chunk_id', c.id,
        'body', c.body,
        'document_id', d.id,
        'source_uri', d.source_uri
    ) ORDER BY c.position), '[]'::jsonb)
    FROM app.knowledge_documents d
    JOIN app.knowledge_chunks c ON c.document_id = d.id
    WHERE d.experience_id = p_experience
      AND d.approved_at IS NOT NULL
      AND d.revoked_at IS NULL
      AND (d.expires_at IS NULL OR d.expires_at > now());
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
