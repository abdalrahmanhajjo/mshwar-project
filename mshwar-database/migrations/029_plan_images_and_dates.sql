-- 029_plan_images_and_dates.sql
-- Three read-side improvements, all additive:
--   1. Itinerary reads (owner + group) now carry each stop's approved hero image,
--      so real published places show their photo in the plan timeline instead of a
--      placeholder. Resolved live from app.media, so existing saved trips get it too.
--   2. list_my_trips exposes the trip's planned day (latest version window_start) and
--      its stop count, powering the Trips calendar and richer cards.

-- ---- 1a. Group-scoped itinerary: add stop image -------------------------------
CREATE OR REPLACE FUNCTION app.get_group_itinerary(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip app.trips;
    v_version app.trip_versions;
    v_stops jsonb;
    v_legs jsonb;
    v_total bigint;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'view');
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip;
    IF v_trip.id IS NULL THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_version
    FROM app.trip_versions
    WHERE trip_id = p_trip
    ORDER BY version DESC
    LIMIT 1;

    IF v_version.id IS NULL THEN
        RETURN jsonb_build_object(
            'trip_id', v_trip.id, 'trip_title', v_trip.title, 'trip_status', v_trip.status,
            'version_id', NULL, 'stops', '[]'::jsonb, 'legs', '[]'::jsonb, 'total_minor', 0
        );
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
        'booking_mode', e.booking_mode,
        'image', (SELECT m.object_key FROM app.media m
                  WHERE m.experience_id = s.experience_id AND m.moderation = 'approved'
                  ORDER BY m.sort_order LIMIT 1),
        'image_alt', (SELECT m.alt_text FROM app.media m
                      WHERE m.experience_id = s.experience_id AND m.moderation = 'approved'
                      ORDER BY m.sort_order LIMIT 1)
    ) ORDER BY s.position), '[]'::jsonb)
    INTO v_stops
    FROM app.trip_stops s
    JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = v_version.id;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'position', l.position, 'provider', l.provider,
        'distance_m', l.distance_m, 'duration_seconds', l.duration_seconds,
        'estimated_minor', l.estimated_minor, 'status', l.status
    ) ORDER BY l.position), '[]'::jsonb)
    INTO v_legs
    FROM app.trip_legs l
    WHERE l.version_id = v_version.id;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total
    FROM app.trip_stops WHERE version_id = v_version.id;

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
        'stops', v_stops,
        'legs', v_legs,
        'total_minor', v_total
    );
END;
$$;

REVOKE ALL ON FUNCTION app.get_group_itinerary(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_group_itinerary(uuid, uuid, uuid) TO mshwar_backend;

-- ---- 1b. Owner version payload: add stop image --------------------------------
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
        'booking_mode', e.booking_mode,
        'image', (SELECT m.object_key FROM app.media m
                  WHERE m.experience_id = s.experience_id AND m.moderation = 'approved'
                  ORDER BY m.sort_order LIMIT 1),
        'image_alt', (SELECT m.alt_text FROM app.media m
                      WHERE m.experience_id = s.experience_id AND m.moderation = 'approved'
                      ORDER BY m.sort_order LIMIT 1)
    ) ORDER BY s.position), '[]'::jsonb)
    INTO v_stops
    FROM app.trip_stops s
    JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = p_version;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'position', l.position, 'provider', l.provider,
        'distance_m', l.distance_m, 'duration_seconds', l.duration_seconds,
        'estimated_minor', l.estimated_minor, 'status', l.status
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

REVOKE ALL ON FUNCTION app.planner_version_payload(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.planner_version_payload(uuid, uuid, boolean) TO mshwar_backend;

-- ---- 2. Trips list: planned day + stop count ----------------------------------
DROP FUNCTION IF EXISTS app.list_my_trips(uuid, integer, integer);
CREATE FUNCTION app.list_my_trips(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
    id uuid,
    title text,
    status text,
    created_at timestamptz,
    total bigint,
    planned_date timestamptz,
    stop_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH latest AS (
        SELECT DISTINCT ON (tv.trip_id) tv.trip_id, tv.id AS version_id, tv.window_start
        FROM app.trip_versions tv
        ORDER BY tv.trip_id, tv.version DESC
    )
    SELECT
        t.id, t.title, t.status, t.created_at, COUNT(*) OVER (),
        l.window_start AS planned_date,
        coalesce((SELECT count(*) FROM app.trip_stops s WHERE s.version_id = l.version_id), 0) AS stop_count
    FROM app.trips t
    LEFT JOIN latest l ON l.trip_id = t.id
    WHERE t.owner_id = p_user_id
    ORDER BY t.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION app.list_my_trips(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.list_my_trips(uuid, integer, integer) TO mshwar_backend;
