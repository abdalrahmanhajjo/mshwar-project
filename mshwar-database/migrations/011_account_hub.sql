SET search_path = app, public;

-- ============================================================
-- Migration 011: Traveller account hub
-- ============================================================
-- Trips stay on app.trips (owner_id). Favorites, preview bookings and
-- in-app notifications are user-owned tables so the hub can persist
-- catalog slugs without inventing inventory rows.
-- Every function takes p_user_id and filters on it. Bookings are
-- cancelled, never deleted.

CREATE TABLE IF NOT EXISTS app.account_favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    listing_slug text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT account_favorites_user_slug UNIQUE (user_id, listing_slug),
    CHECK (length(btrim(listing_slug)) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS app.account_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES app.users(id),
    listing_slug text NOT NULL,
    business_id integer,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'completed')),
    policy_summary text NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (length(btrim(listing_slug)) BETWEEN 1 AND 120),
    CHECK (status <> 'cancelled' OR length(btrim(coalesce(reason, ''))) > 0)
);

CREATE TABLE IF NOT EXISTS app.account_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    title text NOT NULL,
    body text NOT NULL,
    category text NOT NULL DEFAULT 'transactional'
        CHECK (category IN ('transactional', 'marketing')),
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_favorites_user_idx ON app.account_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_bookings_customer_idx ON app.account_bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_notifications_user_idx ON app.account_notifications (user_id, created_at DESC);

ALTER TABLE app.account_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.account_favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE app.account_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.account_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE app.account_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.account_notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_favorite_owner ON app.account_favorites;
CREATE POLICY account_favorite_owner ON app.account_favorites FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS account_booking_owner ON app.account_bookings;
CREATE POLICY account_booking_owner ON app.account_bookings FOR ALL TO mshwar_backend
    USING (customer_id = app.current_user_id())
    WITH CHECK (customer_id = app.current_user_id());

DROP POLICY IF EXISTS account_notification_owner ON app.account_notifications;
CREATE POLICY account_notification_owner ON app.account_notifications FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

GRANT SELECT, INSERT, UPDATE ON app.account_favorites, app.account_bookings, app.account_notifications TO mshwar_backend;
GRANT DELETE ON app.account_favorites TO mshwar_backend;
GRANT SELECT ON app.account_favorites, app.account_bookings, app.account_notifications TO mshwar_reader;

CREATE OR REPLACE FUNCTION app.list_my_trips(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
    id uuid,
    title text,
    status text,
    created_at timestamptz,
    total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT t.id, t.title, t.status, t.created_at, COUNT(*) OVER ()
    FROM app.trips t
    WHERE t.owner_id = p_user_id
    ORDER BY t.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.archive_my_trip(p_user_id uuid, p_trip_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    status text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
        UPDATE app.trips t
        SET status = 'archived'
        WHERE t.id = p_trip_id AND t.owner_id = p_user_id AND t.status <> 'archived'
        RETURNING t.id, t.title, t.status, t.created_at;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_my_favorites(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    created_at timestamptz,
    total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT f.id, f.listing_slug, f.created_at, COUNT(*) OVER ()
    FROM app.account_favorites f
    WHERE f.user_id = p_user_id
    ORDER BY f.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.add_my_favorite(p_user_id uuid, p_listing_slug text)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_slug text := btrim(p_listing_slug);
    v_created timestamptz;
BEGIN
    IF length(v_slug) < 1 THEN
        RAISE EXCEPTION 'invalid listing' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.account_favorites (user_id, listing_slug)
    VALUES (p_user_id, v_slug)
    ON CONFLICT ON CONSTRAINT account_favorites_user_slug
        DO UPDATE SET listing_slug = EXCLUDED.listing_slug
    RETURNING account_favorites.id, account_favorites.listing_slug, account_favorites.created_at
    INTO v_id, v_slug, v_created;
    RETURN QUERY SELECT v_id, v_slug, v_created;
END;
$$;

CREATE OR REPLACE FUNCTION app.remove_my_favorite(p_user_id uuid, p_favorite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    DELETE FROM app.account_favorites
    WHERE id = p_favorite_id AND user_id = p_user_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'favorite not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_my_bookings(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    business_id integer,
    status text,
    policy_summary text,
    reason text,
    created_at timestamptz,
    total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT b.id, b.listing_slug, b.business_id, b.status, b.policy_summary, b.reason, b.created_at, COUNT(*) OVER ()
    FROM app.account_bookings b
    WHERE b.customer_id = p_user_id
    ORDER BY b.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.create_my_booking(
    p_user_id uuid,
    p_listing_slug text,
    p_business_id integer,
    p_policy_summary text
)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    business_id integer,
    status text,
    policy_summary text,
    reason text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_slug text := btrim(p_listing_slug);
    v_policy text := btrim(p_policy_summary);
BEGIN
    IF length(v_slug) < 1 THEN
        RAISE EXCEPTION 'invalid listing' USING ERRCODE = '22023';
    END IF;
    IF length(v_policy) < 1 THEN
        v_policy := 'Preview booking. Cancel requires a reason. Bookings are never deleted.';
    END IF;
    RETURN QUERY
        INSERT INTO app.account_bookings (customer_id, listing_slug, business_id, status, policy_summary)
        VALUES (p_user_id, v_slug, p_business_id, 'confirmed', v_policy)
        RETURNING
            account_bookings.id,
            account_bookings.listing_slug,
            account_bookings.business_id,
            account_bookings.status,
            account_bookings.policy_summary,
            account_bookings.reason,
            account_bookings.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION app.cancel_my_booking(p_user_id uuid, p_booking_id uuid, p_reason text)
RETURNS TABLE (
    id uuid,
    listing_slug text,
    business_id integer,
    status text,
    policy_summary text,
    reason text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_reason text := btrim(p_reason);
BEGIN
    IF length(v_reason) < 1 THEN
        RAISE EXCEPTION 'cancel reason required' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
        UPDATE app.account_bookings b
        SET status = 'cancelled', reason = v_reason
        WHERE b.id = p_booking_id
          AND b.customer_id = p_user_id
          AND b.status IN ('pending', 'confirmed')
        RETURNING b.id, b.listing_slug, b.business_id, b.status, b.policy_summary, b.reason, b.created_at;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.account_notifications (user_id, title, body, category)
    VALUES (
        p_user_id,
        'Booking cancelled',
        'Your booking was cancelled. The record stays on your account.',
        'transactional'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_my_notifications(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
    id uuid,
    title text,
    body text,
    category text,
    read_at timestamptz,
    created_at timestamptz,
    total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT n.id, n.title, n.body, n.category, n.read_at, n.created_at, COUNT(*) OVER ()
    FROM app.account_notifications n
    WHERE n.user_id = p_user_id
    ORDER BY n.read_at IS NOT NULL, n.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.mark_my_notification_read(p_user_id uuid, p_notification_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    body text,
    category text,
    read_at timestamptz,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN QUERY
        UPDATE app.account_notifications n
        SET read_at = coalesce(n.read_at, now())
        WHERE n.id = p_notification_id AND n.user_id = p_user_id
        RETURNING n.id, n.title, n.body, n.category, n.read_at, n.created_at;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'notification not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION app.list_my_trips(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.archive_my_trip(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_my_favorites(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.add_my_favorite(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.remove_my_favorite(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_my_bookings(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_my_booking(uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cancel_my_booking(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_my_notifications(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mark_my_notification_read(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.list_my_trips(uuid, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.archive_my_trip(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_my_favorites(uuid, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.add_my_favorite(uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.remove_my_favorite(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_my_bookings(uuid, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.create_my_booking(uuid, text, integer, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.cancel_my_booking(uuid, uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_my_notifications(uuid, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.mark_my_notification_read(uuid, uuid) TO mshwar_backend;
