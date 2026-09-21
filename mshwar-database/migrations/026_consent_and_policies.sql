SET search_path = app, public;

-- ============================================================
-- Migration 026: policy versions and consent (MSHWAR-113)
-- ============================================================
-- * the trust documents have versions and effective dates; accepting the terms
--   and privacy policy is recorded per version
-- * personalisation and marketing consent are separate, revocable, and every
--   change - from any code path - lands in the immutable consent history
-- * saved preferences shape plans only while personalisation consent is on

-- ---- document versions ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.legal_documents (
    kind text NOT NULL CHECK (kind IN ('terms', 'privacy', 'cancellation', 'community')),
    version text NOT NULL CHECK (version ~ '^\d{4}-\d{2}-\d{2}$'),
    effective_at timestamptz NOT NULL,
    requires_acceptance boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, version)
);
ALTER TABLE app.legal_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.legal_documents FROM PUBLIC;
REVOKE ALL ON app.legal_documents FROM mshwar_backend;

-- Keep in step with apps/web/src/lib/legal/versions.json (checked by tests).
INSERT INTO app.legal_documents (kind, version, effective_at, requires_acceptance) VALUES
    ('terms', '2026-09-16', '2026-09-16T00:00:00+03:00', true),
    ('privacy', '2026-09-16', '2026-09-16T00:00:00+03:00', true),
    ('cancellation', '2026-09-16', '2026-09-16T00:00:00+03:00', false),
    ('community', '2026-09-16', '2026-09-16T00:00:00+03:00', false)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION app.current_policy_version(p_kind text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT version FROM app.legal_documents
    WHERE kind = p_kind AND effective_at <= now()
    ORDER BY effective_at DESC, version DESC
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.current_policies()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_object_agg(d.kind, jsonb_build_object(
        'version', d.version,
        'effective_at', d.effective_at,
        'requires_acceptance', d.requires_acceptance
    )), '{}'::jsonb)
    FROM (
        SELECT DISTINCT ON (kind) kind, version, effective_at, requires_acceptance
        FROM app.legal_documents
        WHERE effective_at <= now()
        ORDER BY kind, effective_at DESC, version DESC
    ) d
$$;

-- ---- consent history ---------------------------------------------------------------

ALTER TABLE app.consent_events ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS consent_events_user_idx ON app.consent_events (user_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consent_events_purpose_check') THEN
        ALTER TABLE app.consent_events ADD CONSTRAINT consent_events_purpose_check CHECK (
            purpose IN ('terms', 'privacy', 'personalisation', 'marketing_email', 'marketing_in_app', 'training')
        ) NOT VALID;
    END IF;
END $$;

-- Every change to a consent flag is written to the history, whichever function
-- made it (the privacy reset and account deletion in 012 included). The source
-- is whatever the transaction declared in app.consent_source.
CREATE OR REPLACE FUNCTION app.log_consent_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_source text := coalesce(nullif(current_setting('app.consent_source', true), ''), 'system');
    v_version text := coalesce(app.current_policy_version('privacy'), 'unversioned');
BEGIN
    IF NEW.personalization_consent IS DISTINCT FROM OLD.personalization_consent THEN
        INSERT INTO app.consent_events (user_id, purpose, granted, policy_version, source)
        VALUES (NEW.user_id, 'personalisation', NEW.personalization_consent, v_version, v_source);
    END IF;
    IF NEW.marketing_consent IS DISTINCT FROM OLD.marketing_consent THEN
        INSERT INTO app.consent_events (user_id, purpose, granted, policy_version, source)
        VALUES (NEW.user_id, 'marketing_email', NEW.marketing_consent, v_version, v_source);
    END IF;
    IF NEW.marketing_in_app IS DISTINCT FROM OLD.marketing_in_app THEN
        INSERT INTO app.consent_events (user_id, purpose, granted, policy_version, source)
        VALUES (NEW.user_id, 'marketing_in_app', NEW.marketing_in_app, v_version, v_source);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_history ON app.user_private;
CREATE TRIGGER consent_history AFTER UPDATE OF personalization_consent, marketing_consent, marketing_in_app
    ON app.user_private FOR EACH ROW EXECUTE FUNCTION app.log_consent_change();

-- ---- setting consent ---------------------------------------------------------------

-- NULL leaves a flag unchanged. Returns the caller's full consent state.
CREATE OR REPLACE FUNCTION app.set_consents(
    p_user uuid,
    p_personalisation boolean,
    p_marketing_email boolean,
    p_marketing_in_app boolean,
    p_source text DEFAULT 'settings'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.user_private WHERE user_id = p_user) THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    IF coalesce(p_source, '') !~ '^[a-z_]{3,40}$' THEN
        RAISE EXCEPTION 'invalid consent source' USING ERRCODE = '22023';
    END IF;
    PERFORM set_config('app.consent_source', p_source, true);
    UPDATE app.user_private
    SET personalization_consent = coalesce(p_personalisation, personalization_consent),
        marketing_consent = coalesce(p_marketing_email, marketing_consent),
        marketing_in_app = coalesce(p_marketing_in_app, marketing_in_app),
        -- Marketing opt-out never touches transactional email.
        transactional_email = true,
        updated_at = now()
    WHERE user_id = p_user;
    PERFORM set_config('app.consent_source', '', true);
    RETURN app.get_consents(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.accept_policies(p_user uuid, p_versions jsonb, p_source text DEFAULT 'settings')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_kind text;
    v_current text;
BEGIN
    IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM app.users WHERE id = p_user) THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    IF jsonb_typeof(p_versions) <> 'object' OR p_versions = '{}'::jsonb THEN
        RAISE EXCEPTION 'policy versions required' USING ERRCODE = '22023';
    END IF;
    FOR v_kind IN SELECT jsonb_object_keys(p_versions) LOOP
        IF v_kind NOT IN ('terms', 'privacy') THEN
            RAISE EXCEPTION 'unknown policy' USING ERRCODE = '22023';
        END IF;
        v_current := app.current_policy_version(v_kind);
        -- Acceptance only counts for the text the person was actually shown.
        IF v_current IS NULL OR p_versions ->> v_kind IS DISTINCT FROM v_current THEN
            RAISE EXCEPTION 'policy version is out of date' USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.consent_events (user_id, purpose, granted, policy_version, source)
        VALUES (p_user, v_kind, true, v_current, coalesce(p_source, 'settings'));
    END LOOP;
    RETURN app.policy_status(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.policy_status(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_object_agg(d.kind, jsonb_build_object(
        'current', d.version,
        'accepted', (
            SELECT e.policy_version FROM app.consent_events e
            WHERE e.user_id = p_user AND e.purpose = d.kind AND e.granted
            ORDER BY e.created_at DESC LIMIT 1
        ),
        'effective_at', d.effective_at
    )), '{}'::jsonb)
    FROM (
        SELECT DISTINCT ON (kind) kind, version, effective_at
        FROM app.legal_documents
        WHERE effective_at <= now() AND requires_acceptance
        ORDER BY kind, effective_at DESC, version DESC
    ) d
$$;

CREATE OR REPLACE FUNCTION app.policies_to_accept(p_user uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(array_agg(key ORDER BY key), ARRAY[]::text[])
    FROM jsonb_each(app.policy_status(p_user))
    WHERE value ->> 'accepted' IS DISTINCT FROM value ->> 'current'
$$;

CREATE OR REPLACE FUNCTION app.get_consents(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    p app.user_private;
BEGIN
    SELECT * INTO p FROM app.user_private WHERE user_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'personalisation', coalesce(p.personalization_consent, false),
        'marketing_email', coalesce(p.marketing_consent, false),
        'marketing_in_app', coalesce(p.marketing_in_app, false),
        'policies', app.policy_status(p_user),
        'history', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'purpose', e.purpose,
                'granted', e.granted,
                'policy_version', e.policy_version,
                'source', e.source,
                'created_at', e.created_at
            ) ORDER BY e.created_at DESC)
            FROM (
                SELECT * FROM app.consent_events
                WHERE user_id = p_user
                ORDER BY created_at DESC
                LIMIT 50
            ) e
        ), '[]'::jsonb)
    );
END;
$$;

-- Marketing preferences (020) now go through the same path, so the history
-- carries a real policy version and the source separately.
CREATE OR REPLACE FUNCTION app.set_communication_preferences(
    p_user uuid,
    p_marketing_email boolean,
    p_marketing_in_app boolean,
    p_source text DEFAULT 'preferences'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.set_consents(p_user, NULL, p_marketing_email, p_marketing_in_app, coalesce(p_source, 'preferences'));
    RETURN app.get_communication_preferences(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_consent_history(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'purpose', e.purpose,
        'granted', e.granted,
        'policy_version', e.policy_version,
        'source', e.source,
        'created_at', e.created_at
    ) ORDER BY e.created_at DESC), '[]'::jsonb)
    FROM app.consent_events e
    WHERE e.user_id = p_user
$$;

-- ---- applying preferences ---------------------------------------------------------

CREATE OR REPLACE FUNCTION app.personalisation_preferences(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN p.personalization_consent THEN app.normalize_preferences(p.preferences)
        ELSE app.normalize_preferences('{}'::jsonb)
    END
    FROM app.user_private p
    WHERE p.user_id = p_user
$$;

-- Feedback may train ranking only with personalisation consent.
DO $$
BEGIN
    IF to_regclass('app.feedback_events') IS NOT NULL THEN
        EXECUTE $f$
            CREATE OR REPLACE FUNCTION app.guard_training_consent() RETURNS trigger
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = app, public
            AS $body$
            BEGIN
                IF NEW.training_consent AND NOT coalesce((
                    SELECT personalization_consent FROM app.user_private WHERE user_id = NEW.user_id
                ), false) THEN
                    NEW.training_consent := false;
                END IF;
                RETURN NEW;
            END;
            $body$
        $f$;
        DROP TRIGGER IF EXISTS training_consent_guard ON app.feedback_events;
        CREATE TRIGGER training_consent_guard BEFORE INSERT OR UPDATE OF training_consent
            ON app.feedback_events FOR EACH ROW EXECUTE FUNCTION app.guard_training_consent();
    END IF;
END $$;

-- ---- cancellations by the business ------------------------------------------------
-- The cancellation policy promises a full refund when the business cancels.
-- Until now the traveller's own policy window was applied to that case too.

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
    IF p_as_business THEN
        preview := preview || jsonb_build_object(
            'refund_bps', 10000, 'refund_minor', b.total_minor, 'cancelled_by', 'business'
        );
    END IF;
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
            PERFORM app.transition_booking(
                b.id, 'refunded',
                CASE WHEN p_as_business THEN 'Refunded in full: cancelled by the business' ELSE 'Refunded from policy snapshot' END
            );
        END IF;
    END IF;
    RETURN app.checkout_booking_json(b.id) || jsonb_build_object('cancellation_preview', preview, 'refund_id', refund_id);
END $$;

-- ---- grants --------------------------------------------------------------------------

REVOKE ALL ON FUNCTION app.current_policy_version(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_policies() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.log_consent_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_consents(uuid, boolean, boolean, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.accept_policies(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.policy_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.policies_to_accept(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_consents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.personalisation_preferences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_policies() TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.set_consents(uuid, boolean, boolean, boolean, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.accept_policies(uuid, jsonb, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.policy_status(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.policies_to_accept(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_consents(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.personalisation_preferences(uuid) TO mshwar_backend;
