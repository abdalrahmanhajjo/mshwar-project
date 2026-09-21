SET search_path = app, public;

-- ============================================================
-- Migration 012: Export, personalisation reset, account deletion
-- ============================================================
-- Export is a JSON snapshot of the caller's own records.
-- Personalisation reset clears signals/prefs, not identity or bookings.
-- Deletion anonymises PII and revokes access. Booking and accounting
-- rows stay with the anonymised user id. Both actions write audit_log.

CREATE OR REPLACE FUNCTION app._privacy_audit(
    p_user_id uuid,
    p_action text,
    p_reason text,
    p_changes jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    INSERT INTO app.audit_log (actor_id, request_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_user_id,
        current_setting('app.request_id', true),
        p_action,
        'users',
        jsonb_build_object('user_id', p_user_id),
        coalesce(p_changes, '{}'::jsonb),
        p_reason
    );
$$;

CREATE OR REPLACE FUNCTION app.export_my_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_export jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.users u WHERE u.id = p_user_id AND u.status = 'active') THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT jsonb_build_object(
        'exported_at', now(),
        'profile', (
            SELECT jsonb_build_object(
                'id', u.id,
                'display_name', u.display_name,
                'locale', u.locale,
                'email', p.email,
                'preferences', p.preferences
            )
            FROM app.users u
            JOIN app.user_private p ON p.user_id = u.id
            WHERE u.id = p_user_id
        ),
        'trips', coalesce((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'name', t.title,
                    'status', t.status,
                    'created_at', t.created_at
                )
                ORDER BY t.created_at DESC
            )
            FROM app.trips t
            WHERE t.owner_id = p_user_id
        ), '[]'::jsonb),
        'favorites', coalesce((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', f.id,
                    'listing_slug', f.listing_slug,
                    'created_at', f.created_at
                )
                ORDER BY f.created_at DESC
            )
            FROM app.account_favorites f
            WHERE f.user_id = p_user_id
        ), '[]'::jsonb),
        'reviews', coalesce((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'booking_id', r.booking_id,
                    'rating', r.rating,
                    'body', r.body,
                    'created_at', r.created_at
                )
                ORDER BY r.created_at DESC
            )
            FROM app.reviews r
            WHERE r.author_id = p_user_id
        ), '[]'::jsonb),
        'bookings', coalesce((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', b.id,
                    'listing_slug', b.listing_slug,
                    'business_id', b.business_id,
                    'status', b.status,
                    'policy_summary', b.policy_summary,
                    'reason', b.reason,
                    'created_at', b.created_at
                )
                ORDER BY b.created_at DESC
            )
            FROM app.account_bookings b
            WHERE b.customer_id = p_user_id
        ), '[]'::jsonb)
    ) INTO v_export;

    PERFORM app._privacy_audit(p_user_id, 'export', 'user data export', jsonb_build_object('sections', ARRAY['profile','trips','favorites','reviews','bookings']));
    RETURN v_export;
END;
$$;

CREATE OR REPLACE FUNCTION app.reset_my_personalisation(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.users u WHERE u.id = p_user_id AND u.status = 'active') THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE app.user_private
    SET preferences = '{}'::jsonb,
        personalization_consent = false,
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE app.trips
    SET preference_overrides = '{}'::jsonb
    WHERE owner_id = p_user_id;

    UPDATE app.feedback_events
    SET user_id = NULL,
        changes = '{}'::jsonb,
        training_consent = false
    WHERE user_id = p_user_id;

    PERFORM app._privacy_audit(
        p_user_id,
        'reset_personalisation',
        'clear personalisation signals',
        jsonb_build_object('preferences', '{}'::jsonb, 'bookings_kept', true, 'identity_kept', true)
    );

    RETURN jsonb_build_object(
        'ok', true,
        'preferences', '{}'::jsonb,
        'identity_kept', true,
        'bookings_kept', true
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.anonymise_my_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_bookings integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.users u WHERE u.id = p_user_id AND u.status = 'active') THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;

    UPDATE app.sessions
    SET revoked_at = now()
    WHERE user_id = p_user_id AND revoked_at IS NULL;

    DELETE FROM app.credentials WHERE user_id = p_user_id;
    DELETE FROM app.password_reset_tokens WHERE user_id = p_user_id;
    DELETE FROM app.email_verification_tokens WHERE user_id = p_user_id;
    DELETE FROM app.account_favorites WHERE user_id = p_user_id;
    DELETE FROM app.account_notifications WHERE user_id = p_user_id;

    UPDATE app.user_private
    SET email = NULL,
        phone = NULL,
        preferences = '{}'::jsonb,
        personalization_consent = false,
        marketing_consent = false,
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE app.users
    SET display_name = 'Deleted user',
        status = 'deleted',
        auth_subject = 'deleted:' || id::text
    WHERE id = p_user_id;

    SELECT count(*) INTO v_bookings
    FROM app.account_bookings
    WHERE customer_id = p_user_id;

    PERFORM app._privacy_audit(
        p_user_id,
        'delete_account',
        'anonymise account; keep booking and accounting rows',
        jsonb_build_object('status', 'deleted', 'bookings_kept', v_bookings)
    );

    RETURN jsonb_build_object(
        'ok', true,
        'status', 'deleted',
        'bookings_kept', v_bookings
    );
END;
$$;

REVOKE ALL ON FUNCTION app._privacy_audit(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.export_my_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reset_my_personalisation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.anonymise_my_account(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app._privacy_audit(uuid, text, text, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.export_my_data(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.reset_my_personalisation(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.anonymise_my_account(uuid) TO mshwar_backend;
