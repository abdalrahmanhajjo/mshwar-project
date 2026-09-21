SET search_path = app, public;

-- ============================================================
-- Migration 017: Maps, routing & weather (Epic 7 / MSHWAR-62–67)
-- ============================================================
-- Route/weather caches carry provider, source and expiry. Unavailable
-- routing is stored as status=unavailable with NULL metrics — never a
-- silent fake estimate. Weather warnings never reference bookings.

CREATE TABLE IF NOT EXISTS app.route_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key text NOT NULL UNIQUE,
    origin_lat double precision NOT NULL,
    origin_lng double precision NOT NULL,
    dest_lat double precision NOT NULL,
    dest_lng double precision NOT NULL,
    mode text NOT NULL CHECK (mode IN ('driving', 'walking', 'transit')),
    time_bucket text NOT NULL,
    available boolean NOT NULL,
    provider text NOT NULL,
    source text NOT NULL,
    distance_m integer CHECK (distance_m IS NULL OR distance_m >= 0),
    duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    fetched_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    CHECK (expires_at > fetched_at),
    CHECK (available = false OR (distance_m IS NOT NULL AND duration_seconds IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS app.routing_cost_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id text NOT NULL,
    provider text NOT NULL,
    elements_requested integer NOT NULL CHECK (elements_requested >= 0),
    cache_hits integer NOT NULL CHECK (cache_hits >= 0),
    cache_misses integer NOT NULL CHECK (cache_misses >= 0),
    estimated_usd_micros bigint NOT NULL CHECK (estimated_usd_micros >= 0),
    within_budget boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.weather_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key text NOT NULL UNIQUE,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    forecast_date date NOT NULL,
    available boolean NOT NULL,
    provider text NOT NULL,
    source text NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    precip_mm numeric,
    wind_kmh numeric,
    temp_max_c numeric,
    temp_min_c numeric,
    weather_code integer,
    attribution text NOT NULL DEFAULT '',
    measurements jsonb NOT NULL DEFAULT '{}',
    CHECK (expires_at > fetched_at)
);

CREATE TABLE IF NOT EXISTS app.weather_warning_thresholds (
    key text PRIMARY KEY,
    value_numeric numeric NOT NULL,
    applies_to text NOT NULL CHECK (applies_to IN ('outdoor', 'weather-sensitive', 'indoor', 'all')),
    unit text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES app.users(id)
);

INSERT INTO app.weather_warning_thresholds (key, value_numeric, applies_to, unit) VALUES
    ('precip_mm', 5, 'outdoor', 'mm'),
    ('precip_mm_sensitive', 2, 'weather-sensitive', 'mm'),
    ('wind_kmh', 45, 'outdoor', 'km/h'),
    ('wind_kmh_sensitive', 30, 'weather-sensitive', 'km/h'),
    ('temp_max_c', 38, 'all', 'C'),
    ('temp_min_c', 4, 'outdoor', 'C')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app.route_cache IS
    'Distance/duration cache keyed by origin, destination, mode and time bucket. Unavailable rows keep NULL metrics.';
COMMENT ON TABLE app.routing_cost_events IS
    'Per-plan routing cost instrumentation. Estimated USD is a documented stub, not a billed invoice.';
COMMENT ON TABLE app.weather_forecasts IS
    'Forecasts per location+date with source and retrieval timestamp. Unavailable rows must not produce warnings.';
COMMENT ON TABLE app.weather_warning_thresholds IS
    'Configurable weather warning thresholds. Warnings never cancel or alter bookings.';

ALTER TABLE app.route_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.route_cache FORCE ROW LEVEL SECURITY;
ALTER TABLE app.routing_cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.routing_cost_events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.weather_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.weather_forecasts FORCE ROW LEVEL SECURITY;
ALTER TABLE app.weather_warning_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.weather_warning_thresholds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS route_cache_backend ON app.route_cache;
CREATE POLICY route_cache_backend ON app.route_cache FOR ALL TO mshwar_backend
    USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS routing_cost_backend ON app.routing_cost_events;
CREATE POLICY routing_cost_backend ON app.routing_cost_events FOR ALL TO mshwar_backend
    USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS weather_forecasts_backend ON app.weather_forecasts;
CREATE POLICY weather_forecasts_backend ON app.weather_forecasts FOR ALL TO mshwar_backend
    USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS weather_thresholds_backend ON app.weather_warning_thresholds;
CREATE POLICY weather_thresholds_backend ON app.weather_warning_thresholds FOR ALL TO mshwar_backend
    USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON
    app.route_cache, app.routing_cost_events, app.weather_forecasts, app.weather_warning_thresholds
    TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.normalize_preferences(p_prefs jsonb, p_partial boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = app, public
AS $$
DECLARE
    v_home uuid;
    v_size integer;
    v_intensity text;
    v_dietary text[];
    v_access text[];
    v_interests text[];
    v_start jsonb;
    v_lat double precision;
    v_lng double precision;
    v_label text;
    v_source text;
    v_out jsonb := jsonb_build_object('source', 'explicit');
BEGIN
    IF p_prefs IS NULL OR jsonb_typeof(p_prefs) <> 'object' THEN
        p_prefs := '{}'::jsonb;
    END IF;
    IF p_prefs ? 'home_area_id' THEN
        v_home := NULLIF(p_prefs->>'home_area_id', '')::uuid;
        IF v_home IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.destinations d WHERE d.id = v_home) THEN
            RAISE EXCEPTION 'unknown home area' USING ERRCODE = '22023';
        END IF;
        v_out := v_out || jsonb_build_object('home_area_id', to_jsonb(v_home));
    ELSIF NOT p_partial THEN
        v_out := v_out || jsonb_build_object('home_area_id', 'null'::jsonb);
    END IF;
    IF p_prefs ? 'default_group_size' THEN
        IF p_prefs->>'default_group_size' IS NULL OR p_prefs->>'default_group_size' = '' THEN
            v_size := NULL;
        ELSE
            v_size := (p_prefs->>'default_group_size')::integer;
            IF v_size < 1 OR v_size > 20 THEN
                RAISE EXCEPTION 'invalid group size' USING ERRCODE = '22023';
            END IF;
        END IF;
        v_out := v_out || jsonb_build_object('default_group_size', to_jsonb(v_size));
    ELSIF NOT p_partial THEN
        v_out := v_out || jsonb_build_object('default_group_size', 'null'::jsonb);
    END IF;
    IF p_prefs ? 'activity_intensity' THEN
        v_intensity := NULLIF(p_prefs->>'activity_intensity', '');
        IF v_intensity IS NOT NULL
           AND v_intensity NOT IN ('relaxed', 'moderate', 'active', 'strenuous') THEN
            RAISE EXCEPTION 'invalid activity intensity' USING ERRCODE = '22023';
        END IF;
        v_out := v_out || jsonb_build_object('activity_intensity', to_jsonb(v_intensity));
    ELSIF NOT p_partial THEN
        v_out := v_out || jsonb_build_object('activity_intensity', 'null'::jsonb);
    END IF;
    IF p_prefs ? 'dietary' OR NOT p_partial THEN
        SELECT COALESCE(array_agg(value), ARRAY[]::text[])
          INTO v_dietary
          FROM jsonb_array_elements_text(COALESCE(p_prefs->'dietary', '[]'::jsonb)) AS value;
        IF EXISTS (
            SELECT 1 FROM unnest(v_dietary) s
            WHERE NOT EXISTS (
                SELECT 1 FROM app.taxonomy t WHERE t.kind = 'dietary' AND t.slug = s AND t.active
            )
        ) THEN
            RAISE EXCEPTION 'invalid dietary preference' USING ERRCODE = '22023';
        END IF;
        v_out := v_out || jsonb_build_object('dietary', to_jsonb(COALESCE(v_dietary, ARRAY[]::text[])));
    END IF;
    IF p_prefs ? 'accessibility' OR NOT p_partial THEN
        SELECT COALESCE(array_agg(value), ARRAY[]::text[])
          INTO v_access
          FROM jsonb_array_elements_text(COALESCE(p_prefs->'accessibility', '[]'::jsonb)) AS value;
        IF EXISTS (
            SELECT 1 FROM unnest(v_access) s
            WHERE NOT EXISTS (
                SELECT 1 FROM app.taxonomy t WHERE t.kind = 'accessibility' AND t.slug = s AND t.active
            )
        ) THEN
            RAISE EXCEPTION 'invalid accessibility preference' USING ERRCODE = '22023';
        END IF;
        v_out := v_out || jsonb_build_object('accessibility', to_jsonb(COALESCE(v_access, ARRAY[]::text[])));
    END IF;
    IF p_prefs ? 'interests' OR NOT p_partial THEN
        SELECT COALESCE(array_agg(value), ARRAY[]::text[])
          INTO v_interests
          FROM jsonb_array_elements_text(COALESCE(p_prefs->'interests', '[]'::jsonb)) AS value;
        IF EXISTS (
            SELECT 1 FROM unnest(v_interests) s
            WHERE NOT EXISTS (
                SELECT 1 FROM app.taxonomy t WHERE t.kind = 'interest' AND t.slug = s AND t.active
            )
        ) THEN
            RAISE EXCEPTION 'invalid interest preference' USING ERRCODE = '22023';
        END IF;
        v_out := v_out || jsonb_build_object('interests', to_jsonb(COALESCE(v_interests, ARRAY[]::text[])));
    END IF;
    IF p_prefs ? 'start_location' THEN
        v_start := p_prefs->'start_location';
        IF v_start IS NULL OR v_start = 'null'::jsonb THEN
            v_out := v_out || jsonb_build_object('start_location', 'null'::jsonb);
        ELSE
            IF jsonb_typeof(v_start) <> 'object' THEN
                RAISE EXCEPTION 'invalid start location' USING ERRCODE = '22023';
            END IF;
            v_lat := (v_start->>'lat')::double precision;
            v_lng := (v_start->>'lng')::double precision;
            v_label := btrim(coalesce(v_start->>'label', ''));
            v_source := coalesce(NULLIF(v_start->>'source', ''), 'manual');
            IF v_lat IS NULL OR v_lng IS NULL OR v_lat < -90 OR v_lat > 90 OR v_lng < -180 OR v_lng > 180 THEN
                RAISE EXCEPTION 'invalid start location' USING ERRCODE = '22023';
            END IF;
            IF length(v_label) < 1 OR length(v_label) > 200 THEN
                RAISE EXCEPTION 'invalid start location label' USING ERRCODE = '22023';
            END IF;
            IF v_source NOT IN ('search', 'pin', 'device', 'manual') THEN
                RAISE EXCEPTION 'invalid start location source' USING ERRCODE = '22023';
            END IF;
            v_out := v_out || jsonb_build_object(
                'start_location', jsonb_build_object(
                    'lat', v_lat, 'lng', v_lng, 'label', v_label, 'source', v_source
                )
            );
        END IF;
    ELSIF NOT p_partial THEN
        v_out := v_out || jsonb_build_object('start_location', 'null'::jsonb);
    END IF;
    RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION app.set_experience_weather_sensitivity(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_value text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
BEGIN
    IF p_value NOT IN ('indoor', 'outdoor', 'weather-sensitive') THEN
        RAISE EXCEPTION 'invalid weather_sensitivity' USING ERRCODE = '22023';
    END IF;
    IF app.is_platform_admin(p_user) THEN
        UPDATE app.experiences
        SET weather_sensitivity = p_value, updated_at = now()
        WHERE id = p_experience AND (p_org IS NULL OR organization_id = p_org)
        RETURNING * INTO e;
    ELSE
        PERFORM app.require_capability(p_user, p_org, 'listings');
        UPDATE app.experiences
        SET weather_sensitivity = p_value, updated_at = now()
        WHERE id = p_experience AND organization_id = p_org AND status <> 'archived'
        RETURNING * INTO e;
    END IF;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.get_experience_portal(
        p_user,
        e.organization_id,
        e.id
    ) || jsonb_build_object('weather_sensitivity', e.weather_sensitivity);
END;
$$;

CREATE OR REPLACE FUNCTION app.get_experience_portal(p_user uuid, p_org uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
    v_lng double precision;
    v_lat double precision;
    v_venue app.venues;
BEGIN
    IF NOT app.has_capability(p_user, p_org, 'listings')
       AND NOT app.is_platform_admin(p_user) THEN
        RAISE EXCEPTION 'capability denied: listings' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_venue FROM app.venues WHERE id = e.venue_id;
    SELECT ST_X(v_venue.location::geometry), ST_Y(v_venue.location::geometry) INTO v_lng, v_lat;
    RETURN jsonb_build_object(
        'id', e.id,
        'organization_id', e.organization_id,
        'venue_id', e.venue_id,
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'status', e.status,
        'booking_mode', e.booking_mode,
        'duration_minutes', e.duration_minutes,
        'min_party', e.min_party,
        'max_party', e.max_party,
        'min_age', e.min_age,
        'setting', e.setting,
        'intensity', e.intensity,
        'weather_sensitivity', e.weather_sensitivity,
        'weather_rules', e.weather_rules,
        'updated_at', e.updated_at,
        'venue', jsonb_build_object(
            'id', v_venue.id,
            'name', v_venue.name,
            'address', v_venue.address,
            'lng', v_lng,
            'lat', v_lat
        ),
        'category', (
            SELECT t.slug FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'category' LIMIT 1
        ),
        'suitability', coalesce((
            SELECT jsonb_agg(t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'suitability'
        ), '[]'::jsonb),
        'weather', coalesce((
            SELECT jsonb_agg(t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'weather'
        ), '[]'::jsonb),
        'images', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', m.id, 'object_key', m.object_key, 'alt_text', m.alt_text, 'sort_order', m.sort_order
            ) ORDER BY m.sort_order) FROM app.media m WHERE m.experience_id = e.id
        ), '[]'::jsonb),
        'price', (
            SELECT jsonb_build_object(
                'currency', pr.currency, 'price_type', pr.price_type, 'unit', pr.unit,
                'amount_minor', pr.amount_minor, 'max_amount_minor', pr.max_amount_minor
            ) FROM app.price_rules pr WHERE pr.experience_id = e.id LIMIT 1
        ),
        'policy', (
            SELECT jsonb_build_object(
                'version', p.version, 'cancellation_rules', p.cancellation_rules, 'terms_text', p.terms_text
            ) FROM app.policies p WHERE p.experience_id = e.id ORDER BY p.version DESC LIMIT 1
        ),
        'publish_report', app.experience_publish_report(e.id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_weather_thresholds()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'key', key,
        'value_numeric', value_numeric,
        'applies_to', applies_to,
        'unit', unit,
        'updated_at', updated_at
    ) ORDER BY key), '[]'::jsonb)
    FROM app.weather_warning_thresholds;
$$;

CREATE OR REPLACE FUNCTION app.upsert_weather_threshold(
    p_admin uuid,
    p_key text,
    p_value numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT app.is_platform_admin(p_admin) THEN
        RAISE EXCEPTION 'capability denied: admin' USING ERRCODE = '42501';
    END IF;
    IF p_value < 0 OR p_value > 1000 THEN
        RAISE EXCEPTION 'invalid threshold' USING ERRCODE = '22023';
    END IF;
    UPDATE app.weather_warning_thresholds
    SET value_numeric = p_value, updated_at = now(), updated_by = p_admin
    WHERE key = p_key;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'threshold not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.list_weather_thresholds();
END;
$$;

CREATE OR REPLACE FUNCTION app.record_route_cache(
    p_cache_key text,
    p_origin_lat double precision,
    p_origin_lng double precision,
    p_dest_lat double precision,
    p_dest_lng double precision,
    p_mode text,
    p_time_bucket text,
    p_available boolean,
    p_provider text,
    p_source text,
    p_distance_m integer,
    p_duration_seconds integer,
    p_ttl_seconds integer,
    p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    INSERT INTO app.route_cache (
        cache_key, origin_lat, origin_lng, dest_lat, dest_lng, mode, time_bucket,
        available, provider, source, distance_m, duration_seconds, fetched_at, expires_at, payload
    ) VALUES (
        p_cache_key, p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng, p_mode, p_time_bucket,
        p_available, p_provider, p_source, p_distance_m, p_duration_seconds, now(),
        now() + make_interval(secs => greatest(p_ttl_seconds, 60)), coalesce(p_payload, '{}'::jsonb)
    )
    ON CONFLICT (cache_key) DO UPDATE SET
        available = excluded.available,
        provider = excluded.provider,
        source = excluded.source,
        distance_m = excluded.distance_m,
        duration_seconds = excluded.duration_seconds,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        payload = excluded.payload;
END;
$$;

CREATE OR REPLACE FUNCTION app.read_route_cache(p_cache_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'available', available,
        'provider', provider,
        'source', source,
        'distance_m', distance_m,
        'duration_seconds', duration_seconds,
        'fetched_at', fetched_at,
        'expires_at', expires_at
    )
    FROM app.route_cache
    WHERE cache_key = p_cache_key AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION app.record_routing_cost(
    p_plan_id text,
    p_provider text,
    p_requested integer,
    p_hits integer,
    p_misses integer,
    p_usd_micros bigint,
    p_within_budget boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO app.routing_cost_events (
        plan_id, provider, elements_requested, cache_hits, cache_misses,
        estimated_usd_micros, within_budget
    ) VALUES (
        p_plan_id, p_provider, p_requested, p_hits, p_misses, p_usd_micros, p_within_budget
    ) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.record_weather_forecast(
    p_cache_key text,
    p_lat double precision,
    p_lng double precision,
    p_forecast_date date,
    p_available boolean,
    p_provider text,
    p_source text,
    p_ttl_seconds integer,
    p_precip_mm numeric,
    p_wind_kmh numeric,
    p_temp_max_c numeric,
    p_temp_min_c numeric,
    p_weather_code integer,
    p_attribution text,
    p_measurements jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    INSERT INTO app.weather_forecasts (
        cache_key, lat, lng, forecast_date, available, provider, source,
        fetched_at, expires_at, precip_mm, wind_kmh, temp_max_c, temp_min_c,
        weather_code, attribution, measurements
    ) VALUES (
        p_cache_key, p_lat, p_lng, p_forecast_date, p_available, p_provider, p_source,
        now(), now() + make_interval(secs => greatest(p_ttl_seconds, 60)),
        p_precip_mm, p_wind_kmh, p_temp_max_c, p_temp_min_c, p_weather_code,
        coalesce(p_attribution, ''), coalesce(p_measurements, '{}'::jsonb)
    )
    ON CONFLICT (cache_key) DO UPDATE SET
        available = excluded.available,
        provider = excluded.provider,
        source = excluded.source,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        precip_mm = excluded.precip_mm,
        wind_kmh = excluded.wind_kmh,
        temp_max_c = excluded.temp_max_c,
        temp_min_c = excluded.temp_min_c,
        weather_code = excluded.weather_code,
        attribution = excluded.attribution,
        measurements = excluded.measurements;
END;
$$;

CREATE OR REPLACE FUNCTION app.read_weather_forecast(p_cache_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'available', available,
        'provider', provider,
        'source', source,
        'fetched_at', fetched_at,
        'forecast_date', forecast_date,
        'precip_mm', precip_mm,
        'wind_kmh', wind_kmh,
        'temp_max_c', temp_max_c,
        'temp_min_c', temp_min_c,
        'weather_code', weather_code,
        'attribution', attribution
    )
    FROM app.weather_forecasts
    WHERE cache_key = p_cache_key AND expires_at > now();
$$;

REVOKE ALL ON FUNCTION app.set_experience_weather_sensitivity(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_weather_thresholds() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.upsert_weather_threshold(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.record_route_cache(text, double precision, double precision, double precision, double precision, text, text, boolean, text, text, integer, integer, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.read_route_cache(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.record_routing_cost(text, text, integer, integer, integer, bigint, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.record_weather_forecast(text, double precision, double precision, date, boolean, text, text, integer, numeric, numeric, numeric, numeric, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.read_weather_forecast(text) FROM PUBLIC;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
