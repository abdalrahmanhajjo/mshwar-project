-- 028_group_itinerary.sql
-- Group-scoped read of a trip's current itinerary.
--
-- Until now only the trip owner could read the planned stops (via
-- app.planner_version_payload, which enforces ownership). A tour guide sharing a
-- trip needs every participant who joined through a share link to see the day's
-- itinerary too. This adds a SECURITY DEFINER reader authorised by group role
-- (the same app.require_group_role gate the rest of group planning uses), returning
-- the latest version's stops in the same shape as planner_version_payload so the
-- web client can render it with the existing timeline. Read-only; it never exposes
-- trips the caller is not a member of.

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
            'trip_id', v_trip.id,
            'trip_title', v_trip.title,
            'trip_status', v_trip.status,
            'version_id', NULL,
            'stops', '[]'::jsonb,
            'legs', '[]'::jsonb,
            'total_minor', 0
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
        'booking_mode', e.booking_mode
    ) ORDER BY s.position), '[]'::jsonb)
    INTO v_stops
    FROM app.trip_stops s
    JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = v_version.id;

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
    WHERE l.version_id = v_version.id;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total
    FROM app.trip_stops
    WHERE version_id = v_version.id;

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
