SET search_path = app, public;

-- ============================================================
-- Migration 016: Admin, moderation & operations console (Epic 6)
-- MSHWAR-53–61. Functions are SECURITY DEFINER; RLS stays forced.
-- ============================================================

-- ---- constraint relaxations -----------------------------------------

DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conrelid::regclass AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'c'
          AND (
              (conrelid = 'app.organizations'::regclass AND pg_get_constraintdef(oid) ILIKE '%verification%')
              OR (conrelid = 'app.verification_events'::regclass AND pg_get_constraintdef(oid) ILIKE '%decision%')
              OR (conrelid = 'app.reviews'::regclass AND pg_get_constraintdef(oid) ILIKE '%moderation%')
              OR (conrelid = 'app.review_responses'::regclass AND pg_get_constraintdef(oid) ILIKE '%moderation%')
              OR (conrelid = 'app.media'::regclass AND pg_get_constraintdef(oid) ILIKE '%moderation%')
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    END LOOP;
END $$;

ALTER TABLE app.organizations
    ADD CONSTRAINT organizations_verification_check
    CHECK (verification IN ('pending', 'verified', 'rejected', 'revoked', 'suspended'));

ALTER TABLE app.verification_events
    ADD CONSTRAINT verification_events_decision_check
    CHECK (decision IN ('verified', 'rejected', 'revoked', 'suspended', 're_verified'));

ALTER TABLE app.reviews
    ADD CONSTRAINT reviews_moderation_check
    CHECK (moderation IN ('pending', 'approved', 'rejected', 'hidden', 'escalated'));

ALTER TABLE app.review_responses
    ADD CONSTRAINT review_responses_moderation_check
    CHECK (moderation IN ('pending', 'approved', 'rejected', 'hidden', 'escalated'));

ALTER TABLE app.media
    ADD CONSTRAINT media_moderation_check
    CHECK (moderation IN ('pending', 'approved', 'rejected', 'hidden', 'escalated'));

-- ---- columns ---------------------------------------------------------

ALTER TABLE app.platform_admins
    ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'ops'
        CHECK (tier IN ('ops', 'elevated')),
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

ALTER TABLE app.taxonomy
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD COLUMN IF NOT EXISTS retired_at timestamptz,
    ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES app.taxonomy(id);

ALTER TABLE app.experiences
    ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
    ADD COLUMN IF NOT EXISTS hidden_reason text;

ALTER TABLE app.support_cases
    ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(evidence) = 'array'),
    ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES app.organizations(id);

ALTER TABLE app.data_quality_issues
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES app.organizations(id),
    ADD COLUMN IF NOT EXISTS fingerprint text,
    ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
    ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS data_quality_issues_open_fingerprint_uidx
    ON app.data_quality_issues (fingerprint)
    WHERE status = 'open' AND fingerprint IS NOT NULL;

-- ---- new tables ------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.admin_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    session_id uuid REFERENCES app.sessions(id),
    ip inet,
    user_agent text,
    started_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_sessions_user_open_idx
    ON app.admin_sessions (user_id)
    WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS app.moderation_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL REFERENCES app.users(id),
    entity_type text NOT NULL CHECK (entity_type IN ('listing', 'image', 'review')),
    entity_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('hide', 'restore', 'escalate')),
    reason text NOT NULL CHECK (length(btrim(reason)) > 0),
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_events_entity_idx
    ON app.moderation_events (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.taxonomy_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id uuid NOT NULL REFERENCES app.taxonomy(id),
    version integer NOT NULL CHECK (version > 0),
    action text NOT NULL CHECK (action IN ('create', 'rename', 'merge', 'retire')),
    actor_id uuid NOT NULL REFERENCES app.users(id),
    previous jsonb NOT NULL DEFAULT '{}'::jsonb,
    current jsonb NOT NULL DEFAULT '{}'::jsonb,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (term_id, version)
);

CREATE TABLE IF NOT EXISTS app.feature_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL,
    environment text NOT NULL CHECK (environment IN ('development', 'staging', 'production', 'all')),
    cohort text NOT NULL DEFAULT 'all',
    enabled boolean NOT NULL DEFAULT false,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(payload) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (key, environment, cohort)
);

CREATE TABLE IF NOT EXISTS app.support_case_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES app.support_cases(id),
    actor_id uuid NOT NULL REFERENCES app.users(id),
    action text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_case_events_case_idx
    ON app.support_case_events (case_id, created_at);

CREATE TABLE IF NOT EXISTS app.planner_health_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sampled_at timestamptz NOT NULL DEFAULT now(),
    generation_success_rate numeric(6, 4),
    infeasible_rate numeric(6, 4),
    fallback_rate numeric(6, 4),
    source text NOT NULL DEFAULT 'stub'
);

-- ---- RLS -------------------------------------------------------------

DO $$ DECLARE n text; BEGIN
  FOR n IN SELECT unnest(ARRAY[
    'admin_sessions', 'moderation_events', 'taxonomy_versions',
    'feature_flags', 'support_case_events', 'planner_health_samples'
  ]) LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', n);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', n);
    EXECUTE format('DROP POLICY IF EXISTS %I_deny ON app.%I', n, n);
    EXECUTE format(
        'CREATE POLICY %I_deny ON app.%I FOR ALL TO mshwar_backend USING (false) WITH CHECK (false)',
        n, n
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON
    app.admin_sessions, app.moderation_events, app.taxonomy_versions,
    app.feature_flags, app.support_case_events, app.planner_health_samples
    TO mshwar_backend;

-- ---- review body immutability ----------------------------------------

CREATE OR REPLACE FUNCTION app.forbid_review_body_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body THEN
        RAISE EXCEPTION 'review text cannot be rewritten' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_forbid_body_rewrite ON app.reviews;
CREATE TRIGGER reviews_forbid_body_rewrite
    BEFORE UPDATE ON app.reviews
    FOR EACH ROW
    EXECUTE FUNCTION app.forbid_review_body_rewrite();

CREATE OR REPLACE FUNCTION app.forbid_retired_taxonomy_assign()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM app.taxonomy t
        WHERE t.id = NEW.term_id AND (t.active IS NOT TRUE OR t.retired_at IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'retired taxonomy cannot be assigned' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experience_taxonomy_active_only ON app.experience_taxonomy;
CREATE TRIGGER experience_taxonomy_active_only
    BEFORE INSERT OR UPDATE ON app.experience_taxonomy
    FOR EACH ROW
    EXECUTE FUNCTION app.forbid_retired_taxonomy_assign();

-- ---- admin roles -----------------------------------------------------

CREATE OR REPLACE FUNCTION app.is_platform_admin(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM app.platform_admins
        WHERE user_id = p_user AND revoked_at IS NULL
    )
$$;

CREATE OR REPLACE FUNCTION app.admin_tier(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT a.tier
    FROM app.platform_admins a
    WHERE a.user_id = p_user AND a.revoked_at IS NULL
$$;

CREATE OR REPLACE FUNCTION app.require_admin(p_user uuid, p_elevated boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_tier text;
BEGIN
    v_tier := app.admin_tier(p_user);
    IF v_tier IS NULL THEN
        RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
    END IF;
    IF p_elevated AND v_tier <> 'elevated' THEN
        RAISE EXCEPTION 'elevated admin permission required' USING ERRCODE = '42501';
    END IF;
    RETURN v_tier;
END;
$$;

DROP FUNCTION IF EXISTS app.grant_platform_admin(uuid, uuid);

CREATE OR REPLACE FUNCTION app.grant_platform_admin(
    p_user uuid,
    p_granted_by uuid DEFAULT NULL,
    p_tier text DEFAULT 'ops'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF p_tier IS NULL OR p_tier NOT IN ('ops', 'elevated') THEN
        RAISE EXCEPTION 'invalid admin tier' USING ERRCODE = '22023';
    END IF;
    IF p_granted_by IS NOT NULL AND p_granted_by = p_user THEN
        RAISE EXCEPTION 'cannot self-grant admin' USING ERRCODE = '42501';
    END IF;
    INSERT INTO app.platform_admins (user_id, granted_by, tier, revoked_at)
    VALUES (p_user, p_granted_by, p_tier, NULL)
    ON CONFLICT (user_id) DO UPDATE
        SET granted_by = COALESCE(EXCLUDED.granted_by, app.platform_admins.granted_by),
            tier = EXCLUDED.tier,
            revoked_at = NULL,
            granted_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_grant_role(p_actor uuid, p_user uuid, p_tier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_actor, true);
    IF p_actor = p_user THEN
        RAISE EXCEPTION 'cannot self-grant admin' USING ERRCODE = '42501';
    END IF;
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
    END IF;
    PERFORM app.grant_platform_admin(p_user, p_actor, p_tier);
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_actor, 'admin_grant', 'platform_admins',
        jsonb_build_object('user_id', p_user),
        jsonb_build_object('tier', p_tier),
        'Granted by elevated admin'
    );
    RETURN jsonb_build_object('user_id', p_user, 'tier', p_tier);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_revoke_role(p_actor uuid, p_user uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_actor, true);
    IF p_actor = p_user THEN
        RAISE EXCEPTION 'cannot self-revoke last elevated grant via this path' USING ERRCODE = '42501';
    END IF;
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    UPDATE app.platform_admins
    SET revoked_at = now()
    WHERE user_id = p_user AND revoked_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'admin not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_actor, 'admin_revoke', 'platform_admins',
        jsonb_build_object('user_id', p_user),
        jsonb_build_object('revoked', true),
        btrim(p_reason)
    );
    RETURN jsonb_build_object('user_id', p_user, 'revoked', true);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_platform_admins(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'user_id', a.user_id,
            'email', p.email,
            'display_name', u.display_name,
            'tier', a.tier,
            'granted_at', a.granted_at,
            'granted_by', a.granted_by,
            'revoked_at', a.revoked_at
        ) ORDER BY a.granted_at), '[]'::jsonb)
        FROM app.platform_admins a
        JOIN app.users u ON u.id = a.user_id
        JOIN app.user_private p ON p.user_id = a.user_id
        WHERE a.revoked_at IS NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.touch_admin_session(
    p_user uuid,
    p_session uuid,
    p_ip text,
    p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_ip inet;
BEGIN
    PERFORM app.require_admin(p_user, false);
    BEGIN
        v_ip := NULLIF(p_ip, '')::inet;
    EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
    END;
    SELECT id INTO v_id
    FROM app.admin_sessions
    WHERE user_id = p_user AND ended_at IS NULL
      AND (p_session IS NULL OR session_id = p_session)
    ORDER BY last_seen_at DESC
    LIMIT 1;
    IF v_id IS NULL THEN
        INSERT INTO app.admin_sessions (user_id, session_id, ip, user_agent)
        VALUES (p_user, p_session, v_ip, NULLIF(p_user_agent, ''))
        RETURNING id INTO v_id;
    ELSE
        UPDATE app.admin_sessions
        SET last_seen_at = now(),
            ip = coalesce(v_ip, ip),
            user_agent = coalesce(NULLIF(p_user_agent, ''), user_agent)
        WHERE id = v_id;
    END IF;
    RETURN (
        SELECT jsonb_build_object(
            'id', s.id,
            'user_id', s.user_id,
            'ip', host(s.ip),
            'started_at', s.started_at,
            'last_seen_at', s.last_seen_at,
            'ended_at', s.ended_at,
            'duration_seconds', floor(extract(epoch FROM (coalesce(s.ended_at, s.last_seen_at) - s.started_at)))
        )
        FROM app.admin_sessions s
        WHERE s.id = v_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.close_admin_sessions(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.admin_sessions
    SET ended_at = now(), last_seen_at = now()
    WHERE user_id = p_user AND ended_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_admin_sessions(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id,
            'user_id', s.user_id,
            'email', p.email,
            'display_name', u.display_name,
            'ip', host(s.ip),
            'started_at', s.started_at,
            'last_seen_at', s.last_seen_at,
            'ended_at', s.ended_at,
            'duration_seconds', floor(extract(epoch FROM (coalesce(s.ended_at, s.last_seen_at) - s.started_at)))
        ) ORDER BY s.started_at DESC), '[]'::jsonb)
        FROM app.admin_sessions s
        JOIN app.users u ON u.id = s.user_id
        JOIN app.user_private p ON p.user_id = s.user_id
    );
END;
$$;

-- ---- verification queue ---------------------------------------------

CREATE OR REPLACE FUNCTION app.admin_notify_org_owners(
    p_org uuid,
    p_event_type text,
    p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_member record;
BEGIN
    FOR v_member IN
        SELECT user_id FROM app.organization_members
        WHERE organization_id = p_org AND active AND role IN ('owner', 'manager')
    LOOP
        PERFORM app.enqueue_notification(
            v_member.user_id,
            p_event_type,
            p_org,
            p_event_type || ':' || p_org::text || ':' || gen_random_uuid()::text,
            p_payload
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_transition_verification(
    p_admin uuid,
    p_org uuid,
    p_decision text,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org app.organizations;
    v_verification text;
    v_status text;
    v_event text;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_decision NOT IN ('verified', 'rejected', 'revoked', 'suspended', 're_verified') THEN
        RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = p_org FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'organisation not found' USING ERRCODE = 'P0002';
    END IF;
    v_event := p_decision;
    IF p_decision = 'verified' OR p_decision = 're_verified' THEN
        v_verification := 'verified';
        v_status := 'active';
        v_event := CASE WHEN p_decision = 're_verified' THEN 're_verified' ELSE 'verified' END;
    ELSIF p_decision = 'suspended' THEN
        v_verification := 'suspended';
        v_status := 'suspended';
    ELSIF p_decision = 'revoked' THEN
        v_verification := 'revoked';
        v_status := v_org.status;
    ELSE
        v_verification := 'rejected';
        v_status := v_org.status;
    END IF;
    UPDATE app.organizations
    SET verification = v_verification, status = v_status
    WHERE id = p_org;
    INSERT INTO app.verification_events (organization_id, reviewer_id, decision, reason)
    VALUES (p_org, p_admin, v_event, btrim(p_reason));
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_admin, 'verification_' || v_event, 'organizations',
        jsonb_build_object('organization_id', p_org),
        jsonb_build_object('from', v_org.verification, 'to', v_verification, 'status', v_status),
        btrim(p_reason)
    );
    PERFORM app.admin_notify_org_owners(
        p_org,
        'verification_decision',
        jsonb_build_object(
            'organization_id', p_org,
            'decision', v_event,
            'verification', v_verification,
            'reason', btrim(p_reason)
        )
    );
    RETURN jsonb_build_object(
        'id', p_org,
        'verification', v_verification,
        'status', v_status,
        'reason', btrim(p_reason),
        'reviewer_id', p_admin,
        'decision', v_event
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_admin_organizations(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN app.list_verification_queue(p_admin, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_verification_queue(p_admin uuid, p_filter jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_status text;
    v_sla integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    v_status := NULLIF(p_filter->>'verification', '');
    v_sla := NULLIF(p_filter->>'sla_hours_min', '')::integer;
    RETURN (
        SELECT coalesce(jsonb_agg(row_data ORDER BY submitted_at NULLS LAST, created_at), '[]'::jsonb)
        FROM (
            SELECT jsonb_build_object(
                'id', o.id,
                'name', o.name,
                'slug', o.slug,
                'status', o.status,
                'verification', o.verification,
                'created_at', o.created_at,
                'submitted_at', s.submitted_at,
                'sla_hours', CASE
                    WHEN s.submitted_at IS NULL THEN NULL
                    ELSE floor(extract(epoch FROM (now() - s.submitted_at)) / 3600)
                END,
                'document_count', (
                    SELECT count(*) FROM app.verification_documents d WHERE d.organization_id = o.id
                ),
                'paused_experiences', (
                    SELECT count(*) FROM app.experiences e
                    WHERE e.organization_id = o.id AND e.status = 'paused'
                ),
                'published_experiences', (
                    SELECT count(*) FROM app.experiences e
                    WHERE e.organization_id = o.id AND e.status = 'published'
                )
            ) AS row_data,
            o.created_at,
            s.submitted_at,
            o.verification,
            CASE
                WHEN s.submitted_at IS NULL THEN 0
                ELSE floor(extract(epoch FROM (now() - s.submitted_at)) / 3600)
            END AS sla_hours
            FROM app.organizations o
            LEFT JOIN LATERAL (
                SELECT vs.created_at AS submitted_at
                FROM app.verification_submissions vs
                WHERE vs.organization_id = o.id
                ORDER BY vs.created_at DESC
                LIMIT 1
            ) s ON true
        ) q
        WHERE (v_status IS NULL OR q.verification = v_status)
          AND (v_sla IS NULL OR q.sla_hours >= v_sla)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_verification_case(p_admin uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org app.organizations;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_org FROM app.organizations WHERE id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'organisation not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'slug', v_org.slug,
        'status', v_org.status,
        'verification', v_org.verification,
        'public_contact', v_org.public_contact,
        'verified_badge', v_org.verification = 'verified',
        'submissions', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', s.id,
                'registration_details', s.registration_details,
                'status', s.status,
                'created_at', s.created_at,
                'submitted_by', s.submitted_by
            ) ORDER BY s.created_at DESC), '[]'::jsonb)
            FROM app.verification_submissions s
            WHERE s.organization_id = p_org
        ),
        'documents', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', d.id,
                'object_key', d.object_key,
                'filename', d.filename,
                'content_type', d.content_type,
                'byte_size', d.byte_size,
                'created_at', d.created_at,
                'public', false
            ) ORDER BY d.created_at), '[]'::jsonb)
            FROM app.verification_documents d
            WHERE d.organization_id = p_org
        ),
        'events', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', e.id,
                'decision', e.decision,
                'reason', e.reason,
                'reviewer_id', e.reviewer_id,
                'created_at', e.created_at
            ) ORDER BY e.created_at DESC), '[]'::jsonb)
            FROM app.verification_events e
            WHERE e.organization_id = p_org
        )
    );
END;
$$;

-- ---- content moderation ---------------------------------------------

CREATE OR REPLACE FUNCTION app.list_moderation_queue(p_admin uuid, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_listings jsonb := '[]'::jsonb;
    v_images jsonb := '[]'::jsonb;
    v_reviews jsonb := '[]'::jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_type IS NULL OR p_type IN ('', 'all', 'listing') THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'entity_type', 'listing',
            'id', e.id,
            'title', e.title,
            'description', e.description,
            'status', e.status,
            'hidden', e.hidden_at IS NOT NULL,
            'moderation', CASE WHEN e.hidden_at IS NULL THEN 'visible' ELSE 'hidden' END,
            'organization_id', e.organization_id,
            'updated_at', e.updated_at
        ) ORDER BY e.updated_at DESC), '[]'::jsonb)
        INTO v_listings
        FROM app.experiences e;
    END IF;
    IF p_type IS NULL OR p_type IN ('', 'all', 'image') THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'entity_type', 'image',
            'id', m.id,
            'object_key', m.object_key,
            'alt_text', m.alt_text,
            'moderation', m.moderation,
            'experience_id', m.experience_id
        ) ORDER BY m.id), '[]'::jsonb)
        INTO v_images
        FROM app.media m;
    END IF;
    IF p_type IS NULL OR p_type IN ('', 'all', 'review') THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'entity_type', 'review',
            'id', r.id,
            'rating', r.rating,
            'body', r.body,
            'moderation', r.moderation,
            'author_id', r.author_id,
            'booking_id', r.booking_id,
            'created_at', r.created_at
        ) ORDER BY r.created_at DESC), '[]'::jsonb)
        INTO v_reviews
        FROM app.reviews r;
    END IF;
    RETURN jsonb_build_object('listings', v_listings, 'images', v_images, 'reviews', v_reviews);
END;
$$;

CREATE OR REPLACE FUNCTION app.moderate_content(
    p_admin uuid,
    p_entity_type text,
    p_entity_id uuid,
    p_action text,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_snapshot jsonb := '{}'::jsonb;
    v_listing app.experiences;
    v_media app.media;
    v_review app.reviews;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_entity_type NOT IN ('listing', 'image', 'review') THEN
        RAISE EXCEPTION 'invalid entity type' USING ERRCODE = '22023';
    END IF;
    IF p_action NOT IN ('hide', 'restore', 'escalate') THEN
        RAISE EXCEPTION 'invalid moderation action' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    IF p_entity_type = 'listing' THEN
        SELECT * INTO v_listing FROM app.experiences WHERE id = p_entity_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
        END IF;
        v_snapshot := jsonb_build_object(
            'title', v_listing.title,
            'description', v_listing.description,
            'status', v_listing.status,
            'hidden_at', v_listing.hidden_at
        );
        IF p_action = 'hide' THEN
            UPDATE app.experiences
            SET hidden_at = now(),
                hidden_reason = btrim(p_reason),
                status = CASE WHEN status = 'published' THEN 'paused' ELSE status END,
                updated_at = now()
            WHERE id = p_entity_id;
        ELSIF p_action = 'restore' THEN
            UPDATE app.experiences
            SET hidden_at = NULL,
                hidden_reason = NULL,
                status = CASE
                    WHEN status = 'paused' AND (v_snapshot->>'status') = 'published' THEN 'published'
                    ELSE status
                END,
                updated_at = now()
            WHERE id = p_entity_id;
        ELSE
            UPDATE app.experiences SET updated_at = now() WHERE id = p_entity_id;
        END IF;
    ELSIF p_entity_type = 'image' THEN
        SELECT * INTO v_media FROM app.media WHERE id = p_entity_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002';
        END IF;
        v_snapshot := jsonb_build_object(
            'object_key', v_media.object_key,
            'alt_text', v_media.alt_text,
            'moderation', v_media.moderation
        );
        UPDATE app.media
        SET moderation = CASE p_action
            WHEN 'hide' THEN 'hidden'
            WHEN 'restore' THEN 'approved'
            ELSE 'escalated'
        END
        WHERE id = p_entity_id;
    ELSE
        SELECT * INTO v_review FROM app.reviews WHERE id = p_entity_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
        END IF;
        v_snapshot := jsonb_build_object(
            'body', v_review.body,
            'rating', v_review.rating,
            'moderation', v_review.moderation
        );
        UPDATE app.reviews
        SET moderation = CASE p_action
            WHEN 'hide' THEN 'hidden'
            WHEN 'restore' THEN 'approved'
            ELSE 'escalated'
        END
        WHERE id = p_entity_id;
    END IF;
    INSERT INTO app.moderation_events (actor_id, entity_type, entity_id, action, reason, snapshot)
    VALUES (p_admin, p_entity_type, p_entity_id, p_action, btrim(p_reason), v_snapshot);
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_admin, 'moderation_' || p_action, p_entity_type,
        jsonb_build_object('entity_id', p_entity_id, 'entity_type', p_entity_type),
        v_snapshot,
        btrim(p_reason)
    );
    RETURN jsonb_build_object(
        'entity_type', p_entity_type,
        'entity_id', p_entity_id,
        'action', p_action,
        'snapshot', v_snapshot
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.bulk_moderate(
    p_admin uuid,
    p_entity_type text,
    p_ids uuid[],
    p_action text,
    p_reason text,
    p_confirm boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_results jsonb := '[]'::jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_confirm IS NOT TRUE THEN
        RAISE EXCEPTION 'bulk confirmation required' USING ERRCODE = '22023';
    END IF;
    IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'ids required' USING ERRCODE = '22023';
    END IF;
    FOREACH v_id IN ARRAY p_ids LOOP
        v_results := v_results || jsonb_build_array(
            app.moderate_content(p_admin, p_entity_type, v_id, p_action, p_reason)
        );
    END LOOP;
    RETURN jsonb_build_object('count', jsonb_array_length(v_results), 'results', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_moderation_events(p_admin uuid, p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id,
            'actor_id', e.actor_id,
            'entity_type', e.entity_type,
            'entity_id', e.entity_id,
            'action', e.action,
            'reason', e.reason,
            'snapshot', e.snapshot,
            'created_at', e.created_at
        ) ORDER BY e.created_at DESC), '[]'::jsonb)
        FROM app.moderation_events e
        WHERE p_entity_id IS NULL OR e.entity_id = p_entity_id
    );
END;
$$;

-- ---- taxonomy --------------------------------------------------------

CREATE OR REPLACE FUNCTION app.enqueue_taxonomy_reindex(p_term uuid, p_action text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO app.outbox (event_type, aggregate_id, dedupe_key, payload)
    VALUES (
        'taxonomy_reindex',
        p_term,
        'taxonomy_reindex:' || p_term::text || ':' || p_action || ':' || gen_random_uuid()::text,
        jsonb_build_object(
            'term_id', p_term,
            'action', p_action,
            'provider', 'stub',
            'queued_at', now()
        )
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_taxonomy_admin(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', t.id,
            'kind', t.kind,
            'slug', t.slug,
            'label', t.label,
            'active', t.active,
            'version', t.version,
            'retired_at', t.retired_at,
            'merged_into_id', t.merged_into_id
        ) ORDER BY t.kind, t.label), '[]'::jsonb)
        FROM app.taxonomy t
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.taxonomy_create(
    p_admin uuid,
    p_kind text,
    p_slug text,
    p_label text,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.taxonomy (kind, slug, label, active, version)
    VALUES (p_kind, app.slugify(p_slug), btrim(p_label), true, 1)
    RETURNING id INTO v_id;
    INSERT INTO app.taxonomy_versions (term_id, version, action, actor_id, previous, current, reason)
    VALUES (
        v_id, 1, 'create', p_admin, '{}'::jsonb,
        jsonb_build_object('kind', p_kind, 'slug', app.slugify(p_slug), 'label', btrim(p_label)),
        btrim(p_reason)
    );
    PERFORM app.enqueue_taxonomy_reindex(v_id, 'create');
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'taxonomy_create', 'taxonomy', jsonb_build_object('id', v_id), jsonb_build_object('slug', app.slugify(p_slug)), btrim(p_reason));
    RETURN jsonb_build_object('id', v_id, 'kind', p_kind, 'slug', app.slugify(p_slug), 'label', btrim(p_label), 'version', 1);
END;
$$;

CREATE OR REPLACE FUNCTION app.taxonomy_rename(
    p_admin uuid,
    p_term uuid,
    p_label text,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_term app.taxonomy;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_term FROM app.taxonomy WHERE id = p_term FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'term not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.taxonomy
    SET label = btrim(p_label), version = version + 1
    WHERE id = p_term;
    INSERT INTO app.taxonomy_versions (term_id, version, action, actor_id, previous, current, reason)
    VALUES (
        p_term, v_term.version + 1, 'rename', p_admin,
        jsonb_build_object('label', v_term.label),
        jsonb_build_object('label', btrim(p_label)),
        btrim(p_reason)
    );
    PERFORM app.enqueue_taxonomy_reindex(p_term, 'rename');
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'taxonomy_rename', 'taxonomy', jsonb_build_object('id', p_term), jsonb_build_object('from', v_term.label, 'to', btrim(p_label)), btrim(p_reason));
    RETURN jsonb_build_object('id', p_term, 'label', btrim(p_label), 'version', v_term.version + 1);
END;
$$;

CREATE OR REPLACE FUNCTION app.taxonomy_retire(
    p_admin uuid,
    p_term uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_term app.taxonomy;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_term FROM app.taxonomy WHERE id = p_term FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'term not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.taxonomy
    SET active = false, retired_at = now(), version = version + 1
    WHERE id = p_term;
    INSERT INTO app.taxonomy_versions (term_id, version, action, actor_id, previous, current, reason)
    VALUES (
        p_term, v_term.version + 1, 'retire', p_admin,
        jsonb_build_object('active', v_term.active),
        jsonb_build_object('active', false, 'retired_at', now()),
        btrim(p_reason)
    );
    PERFORM app.enqueue_taxonomy_reindex(p_term, 'retire');
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'taxonomy_retire', 'taxonomy', jsonb_build_object('id', p_term), jsonb_build_object('retired', true), btrim(p_reason));
    RETURN jsonb_build_object('id', p_term, 'active', false, 'retired', true, 'historical_assignments_kept', true);
END;
$$;

CREATE OR REPLACE FUNCTION app.taxonomy_merge(
    p_admin uuid,
    p_source uuid,
    p_target uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_source app.taxonomy;
    v_target app.taxonomy;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_source = p_target THEN
        RAISE EXCEPTION 'cannot merge a term into itself' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_source FROM app.taxonomy WHERE id = p_source FOR UPDATE;
    SELECT * INTO v_target FROM app.taxonomy WHERE id = p_target FOR UPDATE;
    IF v_source.id IS NULL OR v_target.id IS NULL THEN
        RAISE EXCEPTION 'term not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.experience_taxonomy (experience_id, term_id)
    SELECT et.experience_id, p_target
    FROM app.experience_taxonomy et
    WHERE et.term_id = p_source
    ON CONFLICT DO NOTHING;
    UPDATE app.taxonomy
    SET active = false, retired_at = now(), merged_into_id = p_target, version = version + 1
    WHERE id = p_source;
    INSERT INTO app.taxonomy_versions (term_id, version, action, actor_id, previous, current, reason)
    VALUES (
        p_source, v_source.version + 1, 'merge', p_admin,
        jsonb_build_object('slug', v_source.slug),
        jsonb_build_object('merged_into_id', p_target),
        btrim(p_reason)
    );
    PERFORM app.enqueue_taxonomy_reindex(p_source, 'merge');
    PERFORM app.enqueue_taxonomy_reindex(p_target, 'merge_target');
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'taxonomy_merge', 'taxonomy', jsonb_build_object('source', p_source, 'target', p_target), jsonb_build_object('merged', true), btrim(p_reason));
    RETURN jsonb_build_object('source_id', p_source, 'target_id', p_target, 'retired_source', true);
END;
$$;

-- ---- bookings / payments --------------------------------------------

CREATE OR REPLACE FUNCTION app.list_admin_bookings(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', b.id,
            'status', b.status,
            'organization_id', b.organization_id,
            'experience_id', b.experience_id,
            'experience_title', e.title,
            'party_size', b.party_size,
            'total_minor', b.total_minor,
            'currency', b.currency,
            'created_at', b.created_at
        ) ORDER BY b.created_at DESC), '[]'::jsonb)
        FROM app.bookings b
        JOIN app.experiences e ON e.id = b.experience_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.inspect_booking(p_admin uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_booking app.bookings;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_booking FROM app.bookings WHERE id = p_booking;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'id', v_booking.id,
        'status', v_booking.status,
        'party_size', v_booking.party_size,
        'currency', v_booking.currency,
        'total_minor', v_booking.total_minor,
        'reason', v_booking.reason,
        'price_snapshot', v_booking.price_snapshot,
        'policy_snapshot', v_booking.policy_snapshot,
        'organization_id', v_booking.organization_id,
        'experience_id', v_booking.experience_id,
        'customer_id', v_booking.customer_id,
        'created_at', v_booking.created_at,
        'timeline', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', ev.id,
                'actor_id', ev.actor_id,
                'from_status', ev.from_status,
                'to_status', ev.to_status,
                'reason', ev.reason,
                'created_at', ev.created_at
            ) ORDER BY ev.created_at), '[]'::jsonb)
            FROM app.booking_events ev
            WHERE ev.booking_id = p_booking
        ),
        'payments', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', p.id,
                'provider', p.provider,
                'external_id', p.external_id,
                'amount_minor', p.amount_minor,
                'currency', p.currency,
                'status', p.status,
                'live_mode', p.live_mode,
                'created_at', p.created_at
            ) ORDER BY p.created_at), '[]'::jsonb)
            FROM app.payments p
            WHERE p.booking_id = p_booking
        ),
        'refunds', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', r.id,
                'payment_id', r.payment_id,
                'amount_minor', r.amount_minor,
                'status', r.status,
                'reason', r.reason,
                'created_at', r.created_at
            ) ORDER BY r.created_at), '[]'::jsonb)
            FROM app.refunds r
            JOIN app.payments p ON p.id = r.payment_id
            WHERE p.booking_id = p_booking
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_force_cancel(p_admin uuid, p_booking uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_booking app.bookings;
BEGIN
    PERFORM app.require_admin(p_admin, true);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_booking FROM app.bookings WHERE id = p_booking FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app.transition_booking(p_booking, 'cancelled', btrim(p_reason));
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'booking_force_cancel', 'bookings', jsonb_build_object('booking_id', p_booking), jsonb_build_object('from', v_booking.status, 'to', 'cancelled'), btrim(p_reason));
    RETURN app.inspect_booking(p_admin, p_booking);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_mark_refunded(p_admin uuid, p_booking uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_payment app.payments;
BEGIN
    PERFORM app.require_admin(p_admin, true);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_payment FROM app.payments WHERE booking_id = p_booking ORDER BY created_at DESC LIMIT 1;
    IF v_payment.id IS NULL THEN
        RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.refunds (payment_id, amount_minor, idempotency_key, status, reason)
    VALUES (v_payment.id, v_payment.amount_minor, 'admin-refund-' || gen_random_uuid()::text, 'succeeded', btrim(p_reason));
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    SELECT p_booking, p_admin, b.status, b.status, 'marked_refunded: ' || btrim(p_reason)
    FROM app.bookings b WHERE b.id = p_booking;
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'booking_mark_refunded', 'payments', jsonb_build_object('booking_id', p_booking, 'payment_id', v_payment.id), jsonb_build_object('refund', 'stub'), btrim(p_reason));
    RETURN app.inspect_booking(p_admin, p_booking);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_resend_confirmation(p_admin uuid, p_booking uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_booking app.bookings;
BEGIN
    PERFORM app.require_admin(p_admin, true);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_booking FROM app.bookings WHERE id = p_booking;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app.enqueue_notification(
        v_booking.customer_id,
        'booking_confirmation_resend',
        p_booking,
        'booking_confirmation_resend:' || p_booking::text || ':' || gen_random_uuid()::text,
        jsonb_build_object('booking_id', p_booking, 'reason', btrim(p_reason), 'provider', 'stub')
    );
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (p_booking, p_admin, v_booking.status, v_booking.status, 'resend_confirmation: ' || btrim(p_reason));
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'booking_resend_confirmation', 'bookings', jsonb_build_object('booking_id', p_booking), jsonb_build_object('channel', 'stub'), btrim(p_reason));
    RETURN app.inspect_booking(p_admin, p_booking);
END;
$$;

-- ---- configuration / flags ------------------------------------------

CREATE OR REPLACE FUNCTION app.list_configuration(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(item ORDER BY key), '[]'::jsonb)
        FROM (
            SELECT DISTINCT ON (c.key) jsonb_build_object(
                'key', c.key,
                'version', c.version,
                'value', c.value,
                'changed_by', c.changed_by,
                'reason', c.reason,
                'created_at', c.created_at,
                'previous_value', (
                    SELECT p.value FROM app.configuration_versions p
                    WHERE p.key = c.key AND p.version = c.version - 1
                )
            ) AS item, c.key
            FROM app.configuration_versions c
            ORDER BY c.key, c.version DESC
        ) latest
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.put_configuration(
    p_admin uuid,
    p_key text,
    p_value jsonb,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_version integer;
    v_previous jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT version, value INTO v_version, v_previous
    FROM app.configuration_versions
    WHERE key = p_key
    ORDER BY version DESC
    LIMIT 1;
    v_version := coalesce(v_version, 0) + 1;
    INSERT INTO app.configuration_versions (key, version, value, changed_by, reason)
    VALUES (p_key, v_version, p_value, p_admin, btrim(p_reason));
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_admin, 'config_put', 'configuration_versions',
        jsonb_build_object('key', p_key, 'version', v_version),
        jsonb_build_object('previous', v_previous, 'value', p_value),
        btrim(p_reason)
    );
    RETURN jsonb_build_object('key', p_key, 'version', v_version, 'value', p_value, 'previous_value', v_previous);
END;
$$;

CREATE OR REPLACE FUNCTION app.rollback_configuration(p_admin uuid, p_key text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_current jsonb;
    v_previous jsonb;
    v_version integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT version, value INTO v_version, v_current
    FROM app.configuration_versions
    WHERE key = p_key
    ORDER BY version DESC
    LIMIT 1;
    IF v_version IS NULL OR v_version < 2 THEN
        RAISE EXCEPTION 'no previous version to roll back' USING ERRCODE = '22023';
    END IF;
    SELECT value INTO v_previous
    FROM app.configuration_versions
    WHERE key = p_key AND version = v_version - 1;
    RETURN app.put_configuration(p_admin, p_key, v_previous, coalesce(NULLIF(btrim(p_reason), ''), 'rollback to version ' || (v_version - 1)::text));
END;
$$;

CREATE OR REPLACE FUNCTION app.list_feature_flags(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', f.id,
            'key', f.key,
            'environment', f.environment,
            'cohort', f.cohort,
            'enabled', f.enabled,
            'payload', f.payload,
            'updated_at', f.updated_at
        ) ORDER BY f.key, f.environment, f.cohort), '[]'::jsonb)
        FROM app.feature_flags f
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.put_feature_flag(
    p_admin uuid,
    p_key text,
    p_environment text,
    p_cohort text,
    p_enabled boolean,
    p_payload jsonb,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_previous jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT jsonb_build_object('enabled', enabled, 'payload', payload)
    INTO v_previous
    FROM app.feature_flags
    WHERE key = p_key AND environment = p_environment AND cohort = coalesce(NULLIF(p_cohort, ''), 'all');
    INSERT INTO app.feature_flags (key, environment, cohort, enabled, payload)
    VALUES (p_key, p_environment, coalesce(NULLIF(p_cohort, ''), 'all'), coalesce(p_enabled, false), coalesce(p_payload, '{}'::jsonb))
    ON CONFLICT (key, environment, cohort) DO UPDATE
        SET enabled = EXCLUDED.enabled,
            payload = EXCLUDED.payload,
            updated_at = now()
    RETURNING id INTO v_id;
    PERFORM app.put_configuration(
        p_admin,
        'flag:' || p_key || ':' || p_environment || ':' || coalesce(NULLIF(p_cohort, ''), 'all'),
        jsonb_build_object('enabled', coalesce(p_enabled, false), 'payload', coalesce(p_payload, '{}'::jsonb)),
        coalesce(NULLIF(btrim(p_reason), ''), 'feature flag update')
    );
    RETURN jsonb_build_object('id', v_id, 'key', p_key, 'environment', p_environment, 'cohort', coalesce(NULLIF(p_cohort, ''), 'all'), 'enabled', coalesce(p_enabled, false), 'previous', v_previous);
END;
$$;

-- ---- KPIs ------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.admin_metric_definitions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_array(
        jsonb_build_object('key', 'users', 'label', 'Registered users', 'definition', 'Count of app.users rows created in the selected window, excluding deleted.'),
        jsonb_build_object('key', 'businesses', 'label', 'Organisations', 'definition', 'Count of app.organizations created in the window.'),
        jsonb_build_object('key', 'verified_businesses', 'label', 'Verified organisations', 'definition', 'Organisations whose verification equals verified at query time. The badge is only set by admin approval.'),
        jsonb_build_object('key', 'bookings', 'label', 'Bookings created', 'definition', 'Count of app.bookings created in the window.'),
        jsonb_build_object('key', 'confirmed_bookings', 'label', 'Confirmed bookings', 'definition', 'Bookings currently in confirmed status created in the window.'),
        jsonb_build_object('key', 'open_cases', 'label', 'Open support cases', 'definition', 'Support cases in open or investigating status.'),
        jsonb_build_object('key', 'case_backlog_hours', 'label', 'Mean open-case age (hours)', 'definition', 'Average age of open/investigating cases.'),
        jsonb_build_object('key', 'open_quality_issues', 'label', 'Open data-quality issues', 'definition', 'data_quality_issues currently open.'),
        jsonb_build_object('key', 'planner_success_rate', 'label', 'Planner generation success rate', 'definition', 'Share of recommendation_runs with status succeeded. Stubbed at 0 when the planner has not run.'),
        jsonb_build_object('key', 'planner_infeasible_rate', 'label', 'Planner infeasible rate', 'definition', 'Share of recommendation_runs with status infeasible.'),
        jsonb_build_object('key', 'planner_fallback_rate', 'label', 'Planner fallback rate', 'definition', 'Share of recommendation_runs with status fallback.')
    )
$$;

CREATE OR REPLACE FUNCTION app.admin_kpis(p_admin uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_from timestamptz;
    v_to timestamptz;
    v_runs integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    v_from := coalesce(p_from, now() - interval '30 days');
    v_to := coalesce(p_to, now());
    SELECT count(*) INTO v_runs
    FROM app.recommendation_runs
    WHERE created_at >= v_from AND created_at < v_to;
    RETURN jsonb_build_object(
        'from', v_from,
        'to', v_to,
        'metrics', jsonb_build_object(
            'users', (SELECT count(*) FROM app.users WHERE created_at >= v_from AND created_at < v_to AND status <> 'deleted'),
            'businesses', (SELECT count(*) FROM app.organizations WHERE created_at >= v_from AND created_at < v_to),
            'verified_businesses', (SELECT count(*) FROM app.organizations WHERE verification = 'verified'),
            'bookings', (SELECT count(*) FROM app.bookings WHERE created_at >= v_from AND created_at < v_to),
            'confirmed_bookings', (SELECT count(*) FROM app.bookings WHERE created_at >= v_from AND created_at < v_to AND status = 'confirmed'),
            'open_cases', (SELECT count(*) FROM app.support_cases WHERE status IN ('open', 'investigating')),
            'case_backlog_hours', coalesce((
                SELECT floor(avg(extract(epoch FROM (now() - created_at)) / 3600))
                FROM app.support_cases
                WHERE status IN ('open', 'investigating')
            ), 0),
            'open_quality_issues', (SELECT count(*) FROM app.data_quality_issues WHERE status = 'open'),
            'planner_success_rate', CASE WHEN v_runs = 0 THEN 0 ELSE (
                SELECT count(*) FILTER (WHERE status = 'succeeded')::numeric / v_runs
                FROM app.recommendation_runs
                WHERE created_at >= v_from AND created_at < v_to
            ) END,
            'planner_infeasible_rate', CASE WHEN v_runs = 0 THEN 0 ELSE (
                SELECT count(*) FILTER (WHERE status = 'infeasible')::numeric / v_runs
                FROM app.recommendation_runs
                WHERE created_at >= v_from AND created_at < v_to
            ) END,
            'planner_fallback_rate', CASE WHEN v_runs = 0 THEN 0 ELSE (
                SELECT count(*) FILTER (WHERE status = 'fallback')::numeric / v_runs
                FROM app.recommendation_runs
                WHERE created_at >= v_from AND created_at < v_to
            ) END
        ),
        'definitions', app.admin_metric_definitions(),
        'planner_source', CASE WHEN v_runs = 0 THEN 'stub' ELSE 'recommendation_runs' END
    );
END;
$$;

-- ---- support cases ---------------------------------------------------

CREATE OR REPLACE FUNCTION app.list_support_cases(p_admin uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', c.id,
            'status', c.status,
            'reason', c.reason,
            'resolution', c.resolution,
            'reporter_id', c.reporter_id,
            'assigned_to', c.assigned_to,
            'booking_id', c.booking_id,
            'experience_id', c.experience_id,
            'review_id', c.review_id,
            'organization_id', c.organization_id,
            'evidence', c.evidence,
            'escalated_at', c.escalated_at,
            'created_at', c.created_at,
            'updated_at', c.updated_at,
            'age_hours', floor(extract(epoch FROM (now() - c.created_at)) / 3600)
        ) ORDER BY c.created_at DESC), '[]'::jsonb)
        FROM app.support_cases c
        WHERE p_status IS NULL OR p_status = '' OR c.status = p_status
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.create_support_case(
    p_admin uuid,
    p_reason text,
    p_booking uuid,
    p_experience uuid,
    p_review uuid,
    p_evidence jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_org uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    IF p_experience IS NOT NULL THEN
        SELECT organization_id INTO v_org FROM app.experiences WHERE id = p_experience;
    ELSIF p_booking IS NOT NULL THEN
        SELECT organization_id INTO v_org FROM app.bookings WHERE id = p_booking;
    END IF;
    INSERT INTO app.support_cases (
        reporter_id, booking_id, experience_id, review_id, organization_id, reason, evidence, status
    ) VALUES (
        p_admin, p_booking, p_experience, p_review, v_org, btrim(p_reason), coalesce(p_evidence, '[]'::jsonb), 'open'
    ) RETURNING id INTO v_id;
    INSERT INTO app.support_case_events (case_id, actor_id, action, note)
    VALUES (v_id, p_admin, 'created', btrim(p_reason));
    RETURN jsonb_build_object('id', v_id, 'status', 'open');
END;
$$;

CREATE OR REPLACE FUNCTION app.assign_support_case(p_admin uuid, p_case uuid, p_assignee uuid, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    UPDATE app.support_cases
    SET assigned_to = p_assignee, status = CASE WHEN status = 'open' THEN 'investigating' ELSE status END, updated_at = now()
    WHERE id = p_case;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.support_case_events (case_id, actor_id, action, note)
    VALUES (p_case, p_admin, 'assigned', coalesce(p_note, ''));
    RETURN jsonb_build_object('id', p_case, 'assigned_to', p_assignee);
END;
$$;

CREATE OR REPLACE FUNCTION app.escalate_support_case(p_admin uuid, p_case uuid, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    UPDATE app.support_cases
    SET escalated_at = now(), status = 'investigating', updated_at = now()
    WHERE id = p_case;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.support_case_events (case_id, actor_id, action, note)
    VALUES (p_case, p_admin, 'escalated', coalesce(p_note, ''));
    RETURN jsonb_build_object('id', p_case, 'escalated', true);
END;
$$;

CREATE OR REPLACE FUNCTION app.resolve_support_case(p_admin uuid, p_case uuid, p_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NULLIF(btrim(p_outcome), '') IS NULL THEN
        RAISE EXCEPTION 'outcome note required' USING ERRCODE = '22023';
    END IF;
    UPDATE app.support_cases
    SET status = 'resolved', resolution = btrim(p_outcome), updated_at = now()
    WHERE id = p_case;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'case not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.support_case_events (case_id, actor_id, action, note)
    VALUES (p_case, p_admin, 'resolved', btrim(p_outcome));
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'support_resolve', 'support_cases', jsonb_build_object('case_id', p_case), jsonb_build_object('status', 'resolved'), btrim(p_outcome));
    RETURN jsonb_build_object('id', p_case, 'status', 'resolved', 'resolution', btrim(p_outcome));
END;
$$;

-- ---- data quality ----------------------------------------------------

CREATE OR REPLACE FUNCTION app.list_data_quality_issues(p_admin uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id,
            'experience_id', i.experience_id,
            'organization_id', i.organization_id,
            'rule_code', i.rule_code,
            'status', i.status,
            'details', i.details,
            'fingerprint', i.fingerprint,
            'created_at', i.created_at,
            'last_seen_at', i.last_seen_at,
            'notified_at', i.notified_at,
            'resolved_at', i.resolved_at
        ) ORDER BY i.created_at DESC), '[]'::jsonb)
        FROM app.data_quality_issues i
        WHERE p_status IS NULL OR p_status = '' OR i.status = p_status
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.run_data_quality_checks(p_admin uuid, p_notify boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_open integer := 0;
    v_closed integer := 0;
    v_fingerprints text[] := ARRAY[]::text[];
    v_row record;
    v_fp text;
    v_id uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);

    FOR v_row IN
        SELECT e.id AS experience_id, e.organization_id, e.title,
               max(oh.updated_at) AS hours_updated
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        LEFT JOIN app.opening_hours oh ON oh.venue_id = v.id
        WHERE e.status IN ('published', 'paused')
        GROUP BY e.id, e.organization_id, e.title
        HAVING max(oh.updated_at) IS NULL OR max(oh.updated_at) < now() - interval '14 days'
    LOOP
        v_fp := 'stale_availability:' || v_row.experience_id::text;
        v_fingerprints := array_append(v_fingerprints, v_fp);
        INSERT INTO app.data_quality_issues (
            experience_id, organization_id, rule_code, status, details, fingerprint, last_seen_at
        ) VALUES (
            v_row.experience_id, v_row.organization_id, 'stale_availability', 'open',
            jsonb_build_object('title', v_row.title, 'hours_updated', v_row.hours_updated),
            v_fp, now()
        )
        ON CONFLICT (fingerprint) WHERE status = 'open' AND fingerprint IS NOT NULL
        DO UPDATE SET last_seen_at = now(), details = EXCLUDED.details;
    END LOOP;

    FOR v_row IN
        SELECT e.id AS experience_id, e.organization_id, e.title
        FROM app.experiences e
        WHERE e.status IN ('published', 'paused')
          AND NOT EXISTS (
              SELECT 1 FROM app.price_rules pr
              WHERE pr.experience_id = e.id AND pr.amount_minor IS NOT NULL
          )
    LOOP
        v_fp := 'missing_price:' || v_row.experience_id::text;
        v_fingerprints := array_append(v_fingerprints, v_fp);
        INSERT INTO app.data_quality_issues (
            experience_id, organization_id, rule_code, status, details, fingerprint, last_seen_at
        ) VALUES (
            v_row.experience_id, v_row.organization_id, 'missing_price', 'open',
            jsonb_build_object('title', v_row.title),
            v_fp, now()
        )
        ON CONFLICT (fingerprint) WHERE status = 'open' AND fingerprint IS NOT NULL
        DO UPDATE SET last_seen_at = now(), details = EXCLUDED.details;
    END LOOP;

    FOR v_row IN
        SELECT e.id AS experience_id, e.organization_id, e.title,
               ST_X(v.location::geometry) AS lng, ST_Y(v.location::geometry) AS lat
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        WHERE NOT app.point_in_lebanon(ST_X(v.location::geometry), ST_Y(v.location::geometry))
    LOOP
        v_fp := 'coords_outside_lebanon:' || v_row.experience_id::text;
        v_fingerprints := array_append(v_fingerprints, v_fp);
        INSERT INTO app.data_quality_issues (
            experience_id, organization_id, rule_code, status, details, fingerprint, last_seen_at
        ) VALUES (
            v_row.experience_id, v_row.organization_id, 'coords_outside_lebanon', 'open',
            jsonb_build_object('title', v_row.title, 'lng', v_row.lng, 'lat', v_row.lat),
            v_fp, now()
        )
        ON CONFLICT (fingerprint) WHERE status = 'open' AND fingerprint IS NOT NULL
        DO UPDATE SET last_seen_at = now(), details = EXCLUDED.details;
    END LOOP;

    UPDATE app.data_quality_issues
    SET status = 'resolved', resolved_at = now()
    WHERE status = 'open'
      AND fingerprint IS NOT NULL
      AND NOT (fingerprint = ANY (v_fingerprints));
    GET DIAGNOSTICS v_closed = ROW_COUNT;

    SELECT count(*) INTO v_open FROM app.data_quality_issues WHERE status = 'open';

    IF p_notify THEN
        FOR v_row IN
            SELECT i.id, i.organization_id, i.rule_code, i.experience_id
            FROM app.data_quality_issues i
            WHERE i.status = 'open' AND i.notified_at IS NULL AND i.organization_id IS NOT NULL
        LOOP
            PERFORM app.admin_notify_org_owners(
                v_row.organization_id,
                'data_quality_issue',
                jsonb_build_object(
                    'issue_id', v_row.id,
                    'rule_code', v_row.rule_code,
                    'experience_id', v_row.experience_id
                )
            );
            UPDATE app.data_quality_issues SET notified_at = now() WHERE id = v_row.id;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'open', v_open,
        'auto_closed', v_closed,
        'fingerprints', to_jsonb(v_fingerprints),
        'source', 'on_demand'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.notify_data_quality_issue(p_admin uuid, p_issue uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_issue app.data_quality_issues;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_issue FROM app.data_quality_issues WHERE id = p_issue;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_issue.organization_id IS NULL THEN
        RAISE EXCEPTION 'issue has no organisation' USING ERRCODE = '22023';
    END IF;
    PERFORM app.admin_notify_org_owners(
        v_issue.organization_id,
        'data_quality_issue',
        jsonb_build_object('issue_id', p_issue, 'rule_code', v_issue.rule_code)
    );
    UPDATE app.data_quality_issues SET notified_at = now() WHERE id = p_issue;
    RETURN jsonb_build_object('id', p_issue, 'notified', true);
END;
$$;

REVOKE ALL ON FUNCTION app.require_admin(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_grant_role(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_force_cancel(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_mark_refunded(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
