SET search_path = app, public;

-- ============================================================
-- Migration 010: Profile + travel preferences (controlled vocab)
-- ============================================================
-- Preferences live in user_private.preferences (json object).
-- Every stored preference is explicit — the API always writes
-- source='explicit'. Nothing is inferred from behaviour.
-- Trip.preference_overrides are defaults for that plan only,
-- not hard constraints. The map location picker is not built
-- yet; list_home_areas() is the catalog seam it will replace.

ALTER TABLE app.trips
    ADD COLUMN preference_overrides jsonb NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(preference_overrides) = 'object');

COMMENT ON COLUMN app.trips.preference_overrides IS
    'Per-trip preference defaults. Overrides profile values for this plan only; never hard constraints. Map picker can later fill home_area_id.';

INSERT INTO app.destinations (slug, country_code, name) VALUES
    ('beirut', 'LB', 'Beirut'),
    ('mount-lebanon', 'LB', 'Mount Lebanon'),
    ('north-lebanon', 'LB', 'North Lebanon'),
    ('south-lebanon', 'LB', 'South Lebanon'),
    ('bekaa', 'LB', 'Bekaa'),
    ('nabatieh', 'LB', 'Nabatieh')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO app.taxonomy (kind, slug, label) VALUES
    ('dietary', 'vegetarian', 'Vegetarian'),
    ('dietary', 'vegan', 'Vegan'),
    ('dietary', 'halal', 'Halal'),
    ('dietary', 'gluten-free', 'Gluten free'),
    ('dietary', 'dairy-free', 'Dairy free'),
    ('accessibility', 'step-free', 'Step-free access'),
    ('accessibility', 'wheelchair', 'Wheelchair accessible'),
    ('accessibility', 'seating', 'Seating available'),
    ('accessibility', 'quiet', 'Quiet environment'),
    ('interest', 'food', 'Food'),
    ('interest', 'nature', 'Nature'),
    ('interest', 'heritage', 'Heritage'),
    ('interest', 'nightlife', 'Nightlife'),
    ('interest', 'family', 'Family'),
    ('interest', 'adventure', 'Adventure')
ON CONFLICT (kind, slug) DO NOTHING;

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
    RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_home_areas()
RETURNS TABLE (id uuid, slug text, name text, country_code text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT d.id, d.slug, d.name, d.country_code
    FROM app.destinations d
    WHERE d.country_code = 'LB'
    ORDER BY d.name;
$$;

CREATE OR REPLACE FUNCTION app.list_preference_terms()
RETURNS TABLE (kind text, slug text, label text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT t.kind, t.slug, t.label
    FROM app.taxonomy t
    WHERE t.active AND t.kind IN ('dietary', 'accessibility', 'interest')
    ORDER BY t.kind, t.label;
$$;

CREATE OR REPLACE FUNCTION app.get_profile(p_user_id uuid)
RETURNS TABLE (
    user_id uuid,
    display_name text,
    locale text,
    email text,
    preferences jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT u.id, u.display_name, u.locale, p.email, app.normalize_preferences(p.preferences)
    FROM app.users u
    JOIN app.user_private p ON p.user_id = u.id
    WHERE u.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION app.upsert_profile(
    p_user_id uuid,
    p_display_name text,
    p_locale text,
    p_preferences jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_prefs jsonb;
BEGIN
    IF p_locale NOT IN ('ar', 'en', 'fr') THEN
        RAISE EXCEPTION 'invalid locale' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(p_display_name)) < 1 OR length(btrim(p_display_name)) > 80 THEN
        RAISE EXCEPTION 'invalid display name' USING ERRCODE = '22023';
    END IF;
    v_prefs := app.normalize_preferences(p_preferences);
    UPDATE app.users
    SET display_name = btrim(p_display_name), locale = p_locale
    WHERE id = p_user_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.user_private
    SET preferences = v_prefs, updated_at = now()
    WHERE user_id = p_user_id;
    RETURN v_prefs;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_trip_draft(
    p_user_id uuid,
    p_title text,
    p_preference_overrides jsonb
) RETURNS TABLE (
    trip_id uuid,
    title text,
    status text,
    preference_overrides jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_overrides jsonb;
    v_id uuid;
BEGIN
    IF length(btrim(p_title)) < 1 THEN
        RAISE EXCEPTION 'invalid title' USING ERRCODE = '22023';
    END IF;
    v_overrides := CASE
        WHEN p_preference_overrides IS NULL OR p_preference_overrides = '{}'::jsonb
            THEN '{}'::jsonb
        ELSE app.normalize_preferences(p_preference_overrides, true)
    END;
    INSERT INTO app.trips (owner_id, title, status, preference_overrides)
    VALUES (p_user_id, btrim(p_title), 'draft', v_overrides)
    RETURNING id INTO v_id;
    RETURN QUERY
        SELECT v_id, btrim(p_title), 'draft'::text, v_overrides;
END;
$$;

REVOKE ALL ON FUNCTION app.normalize_preferences(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_home_areas() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_preference_terms() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.upsert_profile(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_trip_draft(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.normalize_preferences(jsonb, boolean) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_home_areas() TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_preference_terms() TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_profile(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.upsert_profile(uuid, text, text, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.create_trip_draft(uuid, text, jsonb) TO mshwar_backend;
