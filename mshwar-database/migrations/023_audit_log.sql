SET search_path = app, public;

-- ============================================================
-- Migration 023: audit log (MSHWAR-109)
-- ============================================================
-- * append-only for everyone but the migration owner: no UPDATE, DELETE or
--   TRUNCATE (triggers), and the API role cannot touch the table directly
-- * one write helper, app.write_audit, used by every explicit audit call
-- * the generic trigger records who (app.actor_id), which request, what
--   changed (field names always; values only for non-personal state fields)
--   and covers the rest of the consequential tables
-- * admin search with filters and keyset paging

-- ---- who is acting ---------------------------------------------------------
-- The API binds app.actor_id for every signed-in request (app/core/auth_session.py).
-- app.user_id is the older GUC used by tenant-scoped RLS; both are honoured.

CREATE OR REPLACE FUNCTION app.actor_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT coalesce(
        nullif(current_setting('app.actor_id', true), ''),
        nullif(current_setting('app.user_id', true), '')
    )::uuid
$$;

-- ---- schema --------------------------------------------------------------

ALTER TABLE app.audit_log
    ADD COLUMN IF NOT EXISTS target_id text
        GENERATED ALWAYS AS (coalesce(
            row_key->>'id', row_key->>'entity_id', row_key->>'booking_id', row_key->>'case_id',
            row_key->>'user_id', row_key->>'organization_id', row_key->>'key', row_key->>'slug',
            row_key->>'version'
        )) STORED,
    ADD COLUMN IF NOT EXISTS organization_id uuid
        GENERATED ALWAYS AS (CASE
            WHEN row_key->>'organization_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (row_key->>'organization_id')::uuid
        END) STORED;

CREATE INDEX IF NOT EXISTS audit_log_recent_idx ON app.audit_log (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON app.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON app.audit_log (action text_pattern_ops, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_idx ON app.audit_log (table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON app.audit_log (target_id);
CREATE INDEX IF NOT EXISTS audit_log_org_idx ON app.audit_log (organization_id, created_at DESC)
    WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_request_idx ON app.audit_log (request_id) WHERE request_id IS NOT NULL;

-- ---- append-only ---------------------------------------------------------

CREATE OR REPLACE FUNCTION app.reject_truncate() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'immutable record: % cannot be truncated', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;

DO $$
DECLARE
    n text;
BEGIN
    FOREACH n IN ARRAY ARRAY[
        'policies', 'booking_events', 'audit_log', 'verification_events', 'consent_events',
        'configuration_versions', 'commission_terms', 'recommendation_runs',
        'recommendation_candidates', 'retrieval_sources'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'immutable_truncate' AND tgrelid = format('app.%I', n)::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON app.%I '
                'FOR EACH STATEMENT EXECUTE FUNCTION app.reject_truncate()', n);
        END IF;
    END LOOP;
END $$;

-- Every row carries the request, actor and reason of the transaction that wrote
-- it, including rows from the explicit INSERTs in migrations 012-021 that did
-- not pass them.
CREATE OR REPLACE FUNCTION app.audit_log_defaults() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.request_id := coalesce(NEW.request_id, nullif(current_setting('app.request_id', true), ''));
    NEW.actor_id := coalesce(NEW.actor_id, app.actor_id());
    NEW.reason := coalesce(nullif(btrim(NEW.reason), ''), nullif(current_setting('app.reason', true), ''));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_defaults ON app.audit_log;
CREATE TRIGGER audit_log_defaults BEFORE INSERT ON app.audit_log
    FOR EACH ROW EXECUTE FUNCTION app.audit_log_defaults();

-- The API role reads and writes the audit log only through the functions below.
REVOKE ALL ON app.audit_log FROM PUBLIC;
REVOKE ALL ON app.audit_log FROM mshwar_backend;
REVOKE ALL ON app.audit_log FROM mshwar_reader;

-- ---- writing -------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.write_audit(
    p_actor uuid,
    p_action text,
    p_target_type text,
    p_target jsonb,
    p_changes jsonb DEFAULT '{}'::jsonb,
    p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF coalesce(btrim(p_action), '') = '' OR coalesce(btrim(p_target_type), '') = '' THEN
        RAISE EXCEPTION 'audit action and target are required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.audit_log (actor_id, request_id, action, table_name, row_key, changes, reason)
    VALUES (
        coalesce(p_actor, app.actor_id()),
        nullif(current_setting('app.request_id', true), ''),
        p_action,
        p_target_type,
        coalesce(p_target, '{}'::jsonb),
        coalesce(p_changes, '{}'::jsonb),
        nullif(btrim(coalesce(p_reason, current_setting('app.reason', true), '')), '')
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- The privacy helper from 012 now goes through the shared writer.
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
    SELECT app.write_audit(p_user_id, p_action, 'users', jsonb_build_object('user_id', p_user_id), p_changes, p_reason);
$$;

-- Values of these columns are operational state and safe to keep. Every other
-- changed column is recorded by name only, so personal data, prompts, contact
-- details, tokens and payment payloads never enter the audit log.
CREATE OR REPLACE FUNCTION app.audit_value_fields() RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY[
        'status', 'state', 'capacity', 'reserved', 'verification', 'verified_badge', 'moderation',
        'role', 'tier', 'active', 'enabled', 'revoked', 'revoked_at', 'expires_at', 'accepted_at',
        'suspended_at', 'published_at', 'weather_sensitivity', 'booking_mode', 'visibility', 'hidden',
        'decision', 'priority', 'assignee_id', 'amount_minor', 'total_minor', 'refunded_minor',
        'refund_minor', 'currency', 'key', 'value', 'version', 'slug', 'kind', 'label', 'allow_guest',
        'locked', 'outcome', 'reason_code', 'threshold', 'metric', 'weights', 'price_type', 'max_party',
        'min_party', 'starts_at', 'ends_at', 'channel', 'event_type', 'escalation_minutes'
    ]::text[]
$$;

-- SECURITY DEFINER: the trigger must write the log even though the role that
-- fired it (the API) has no privileges on app.audit_log.
CREATE OR REPLACE FUNCTION app.audit_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    oldj jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
    newj jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
    v_values jsonb := '{}'::jsonb;
    v_fields text[] := ARRAY[]::text[];
    v_safe text[] := app.audit_value_fields();
    v_key text;
    pk jsonb;
BEGIN
    FOR v_key IN SELECT jsonb_object_keys(oldj || newj) ORDER BY 1 LOOP
        CONTINUE WHEN v_key IN ('updated_at', 'created_at', 'search_text', 'embedding', 'search_tsv', 'observed_at');
        IF (oldj -> v_key) IS DISTINCT FROM (newj -> v_key) THEN
            v_fields := v_fields || v_key;
            IF v_key = ANY (v_safe) THEN
                v_values := v_values || jsonb_build_object(
                    v_key, jsonb_build_object('old', oldj -> v_key, 'new', newj -> v_key));
            END IF;
        END IF;
    END LOOP;
    IF TG_OP = 'UPDATE' AND cardinality(v_fields) = 0 THEN
        RETURN NEW;
    END IF;
    pk := jsonb_strip_nulls(jsonb_build_object(
        'id', coalesce(newj -> 'id', oldj -> 'id'),
        'organization_id', coalesce(newj -> 'organization_id', oldj -> 'organization_id'),
        'user_id', coalesce(newj -> 'user_id', oldj -> 'user_id'),
        'key', coalesce(newj -> 'key', oldj -> 'key'),
        'slug', coalesce(newj -> 'slug', oldj -> 'slug'),
        'version', coalesce(newj -> 'version', oldj -> 'version')
    ));
    INSERT INTO app.audit_log (actor_id, request_id, action, table_name, row_key, changes, reason)
    VALUES (
        app.actor_id(),
        nullif(current_setting('app.request_id', true), ''),
        TG_TABLE_NAME || '.' || lower(TG_OP),
        TG_TABLE_NAME,
        pk,
        jsonb_build_object('fields', to_jsonb(v_fields), 'values', v_values),
        nullif(current_setting('app.reason', true), '')
    );
    RETURN coalesce(NEW, OLD);
END;
$$;

-- Tables whose changes are consequential (verification, moderation, money,
-- access, configuration) and were not audited yet. platform_admins and
-- taxonomy already write explicit rows with a reason.
DO $$
DECLARE
    n text;
BEGIN
    FOREACH n IN ARRAY ARRAY[
        'users', 'catalogue_collections', 'weather_warning_thresholds', 'planner_ranker_weights',
        'staff_invitations', 'support_cases', 'feature_flags', 'media', 'verification_documents',
        'review_responses', 'review_reports', 'trip_share_links', 'reconciliation_items',
        'notification_role_prefs', 'notification_org_settings', 'blackouts', 'moderation_events'
    ] LOOP
        IF to_regclass(format('app.%I', n)) IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'audit' AND tgrelid = format('app.%I', n)::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.%I '
                'FOR EACH ROW EXECUTE FUNCTION app.audit_change()', n);
        END IF;
    END LOOP;
END $$;

-- ---- explicit audit for security events -------------------------------------

CREATE OR REPLACE FUNCTION app.consume_password_reset(
    p_token_hash text,
    p_password_hash text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user_id uuid;
    v_token_id uuid;
    v_revoked integer;
BEGIN
    SELECT t.user_id, t.id INTO v_user_id, v_token_id
    FROM app.password_reset_tokens t
    WHERE t.token_hash = p_token_hash
      AND t.used_at IS NULL
      AND t.expires_at > now()
    FOR UPDATE;
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    UPDATE app.password_reset_tokens SET used_at = now() WHERE id = v_token_id;
    UPDATE app.password_reset_tokens
    SET used_at = now()
    WHERE user_id = v_user_id AND used_at IS NULL;
    UPDATE app.credentials
    SET password_hash = p_password_hash, rotated_at = now()
    WHERE user_id = v_user_id;
    UPDATE app.sessions
    SET revoked_at = now()
    WHERE user_id = v_user_id AND revoked_at IS NULL;
    GET DIAGNOSTICS v_revoked = ROW_COUNT;
    PERFORM app.write_audit(
        v_user_id, 'account.password_reset', 'users', jsonb_build_object('user_id', v_user_id),
        jsonb_build_object('sessions_revoked', v_revoked), 'password reset link used'
    );
    RETURN v_user_id;
END;
$$;

-- ---- reading -------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.admin_search_audit(
    p_admin uuid,
    p_action text DEFAULT NULL,
    p_actor uuid DEFAULT NULL,
    p_table text DEFAULT NULL,
    p_target text DEFAULT NULL,
    p_organization uuid DEFAULT NULL,
    p_request_id text DEFAULT NULL,
    p_from timestamptz DEFAULT NULL,
    p_to timestamptz DEFAULT NULL,
    p_before timestamptz DEFAULT NULL,
    p_before_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
    v_action text := nullif(btrim(coalesce(p_action, '')), '');
    v_rows jsonb;
    v_count integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF (p_before IS NULL) <> (p_before_id IS NULL) THEN
        RAISE EXCEPTION 'cursor needs both time and id' USING ERRCODE = '22023';
    END IF;
    WITH page AS (
        SELECT a.*
        FROM app.audit_log a
        WHERE (v_action IS NULL OR a.action LIKE replace(replace(replace(v_action, '\', '\\'), '%', '\%'), '_', '\_') || '%')
          AND (p_actor IS NULL OR a.actor_id = p_actor)
          AND (p_table IS NULL OR a.table_name = p_table)
          AND (p_target IS NULL OR a.target_id = p_target)
          AND (p_organization IS NULL OR a.organization_id = p_organization)
          AND (p_request_id IS NULL OR a.request_id = p_request_id)
          AND (p_from IS NULL OR a.created_at >= p_from)
          AND (p_to IS NULL OR a.created_at < p_to)
          AND (p_before IS NULL OR (a.created_at, a.id) < (p_before, p_before_id))
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT v_limit + 1
    )
    SELECT
        coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id,
            'created_at', p.created_at,
            'action', p.action,
            'target_type', p.table_name,
            'target_id', p.target_id,
            'target', p.row_key,
            'organization_id', p.organization_id,
            'changes', p.changes,
            'reason', p.reason,
            'request_id', p.request_id,
            'actor', CASE WHEN p.actor_id IS NULL THEN jsonb_build_object('kind', 'system')
                ELSE jsonb_build_object(
                    'kind', CASE WHEN pa.user_id IS NOT NULL THEN 'admin' ELSE 'user' END,
                    'id', p.actor_id,
                    'display_name', u.display_name
                ) END
        ) ORDER BY p.created_at DESC, p.id DESC) FILTER (WHERE p.rn <= v_limit), '[]'::jsonb),
        count(*)
    INTO v_rows, v_count
    FROM (SELECT page.*, row_number() OVER (ORDER BY page.created_at DESC, page.id DESC) AS rn FROM page) p
    LEFT JOIN app.users u ON u.id = p.actor_id
    LEFT JOIN app.platform_admins pa ON pa.user_id = p.actor_id;

    RETURN jsonb_build_object(
        'items', v_rows,
        'next_cursor', CASE WHEN v_count > v_limit THEN jsonb_build_object(
            'before', v_rows -> (v_limit - 1) ->> 'created_at',
            'before_id', v_rows -> (v_limit - 1) ->> 'id'
        ) END
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_audit_filters(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'actions', coalesce((
            SELECT jsonb_agg(action ORDER BY action)
            FROM (
                SELECT DISTINCT action FROM app.audit_log
                WHERE created_at > now() - interval '90 days'
                LIMIT 300
            ) a
        ), '[]'::jsonb),
        'target_types', coalesce((
            SELECT jsonb_agg(table_name ORDER BY table_name)
            FROM (
                SELECT DISTINCT table_name FROM app.audit_log
                WHERE created_at > now() - interval '90 days'
                LIMIT 100
            ) t
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- grants --------------------------------------------------------------

REVOKE ALL ON FUNCTION app.write_audit(uuid, text, text, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_search_audit(uuid, text, uuid, text, text, uuid, text, timestamptz, timestamptz, timestamptz, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_audit_filters(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.audit_value_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reject_truncate() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.audit_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.audit_log_defaults() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.write_audit(uuid, text, text, jsonb, jsonb, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_search_audit(uuid, text, uuid, text, text, uuid, text, timestamptz, timestamptz, timestamptz, uuid, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_audit_filters(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.actor_id() TO mshwar_backend, mshwar_reader;
