SET search_path = app, public;

-- ============================================================
-- Migration 015: Business portal (Epic 5 / BIZ.1–BIZ.10)
-- ============================================================
-- Organisations, verification submissions, staff RBAC, listing
-- publish gates, availability provenance, booking inbox helpers,
-- analytics aggregation, and public vs internal contacts.
-- Functions are SECURITY DEFINER so the API can authorize in SQL
-- (same pattern as auth/profile). RLS remains forced on every table.

-- ---- schema additions ------------------------------------------------

ALTER TABLE app.organizations
    ADD COLUMN IF NOT EXISTS internal_contact jsonb NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(internal_contact) = 'object'),
    ADD COLUMN IF NOT EXISTS fulfilment_instructions text NOT NULL DEFAULT '';

COMMENT ON COLUMN app.organizations.internal_contact IS
    'Internal fulfilment contacts. Never returned by public serializers.';
COMMENT ON COLUMN app.organizations.fulfilment_instructions IS
    'Operator-only fulfilment notes. Confirmation notifications only.';

ALTER TABLE app.staff_invitations
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
    ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES app.users(id);

ALTER TABLE app.bookings
    ADD COLUMN IF NOT EXISTS traveller_note text NOT NULL DEFAULT '';

ALTER TABLE app.opening_hours
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal',
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES app.users(id);

ALTER TABLE app.opening_exceptions
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal',
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES app.users(id);

ALTER TABLE app.blackouts
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal',
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES app.users(id);

CREATE TABLE IF NOT EXISTS app.platform_admins (
    user_id uuid PRIMARY KEY REFERENCES app.users(id),
    granted_at timestamptz NOT NULL DEFAULT now(),
    granted_by uuid REFERENCES app.users(id)
);

CREATE TABLE IF NOT EXISTS app.verification_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES app.organizations(id),
    submitted_by uuid NOT NULL REFERENCES app.users(id),
    registration_details jsonb NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(registration_details) = 'object'),
    status text NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'withdrawn')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.verification_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES app.organizations(id),
    submission_id uuid REFERENCES app.verification_submissions(id),
    object_key text NOT NULL,
    filename text NOT NULL,
    content_type text NOT NULL,
    byte_size integer NOT NULL CHECK (byte_size >= 0),
    created_by uuid NOT NULL REFERENCES app.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, object_key)
);

CREATE INDEX IF NOT EXISTS verification_submissions_org_idx
    ON app.verification_submissions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS verification_documents_org_idx
    ON app.verification_documents (organization_id);
CREATE INDEX IF NOT EXISTS staff_invitations_email_idx
    ON app.staff_invitations (lower(email));

INSERT INTO app.taxonomy (kind, slug, label) VALUES
    ('category', 'food', 'Food'),
    ('category', 'nature', 'Nature'),
    ('category', 'heritage', 'Heritage'),
    ('category', 'adventure', 'Adventure'),
    ('category', 'workshop', 'Workshop'),
    ('category', 'wellness', 'Wellness'),
    ('suitability', 'families', 'Families'),
    ('suitability', 'couples', 'Couples'),
    ('suitability', 'groups', 'Groups'),
    ('suitability', 'solo', 'Solo'),
    ('suitability', 'kids', 'Kids'),
    ('weather', 'rain-sensitive', 'Rain sensitive'),
    ('weather', 'heat-sensitive', 'Heat sensitive'),
    ('weather', 'wind-sensitive', 'Wind sensitive'),
    ('weather', 'all-weather', 'All weather')
ON CONFLICT (kind, slug) DO NOTHING;

-- ---- RLS -------------------------------------------------------------

DO $$ DECLARE n text; BEGIN
  FOR n IN SELECT unnest(ARRAY[
    'platform_admins', 'verification_submissions', 'verification_documents'
  ]) LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', n);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', n);
  END LOOP;
END $$;

DROP POLICY IF EXISTS platform_admin_deny ON app.platform_admins;
CREATE POLICY platform_admin_deny ON app.platform_admins
    FOR ALL TO mshwar_backend USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS org_verification_submission_access ON app.verification_submissions;
CREATE POLICY org_verification_submission_access ON app.verification_submissions
    FOR ALL TO mshwar_backend
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

DROP POLICY IF EXISTS org_verification_document_access ON app.verification_documents;
CREATE POLICY org_verification_document_access ON app.verification_documents
    FOR ALL TO mshwar_backend
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

DROP POLICY IF EXISTS org_staff_invitation_access ON app.staff_invitations;
CREATE POLICY org_staff_invitation_access ON app.staff_invitations
    FOR ALL TO mshwar_backend
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

DROP POLICY IF EXISTS org_verification_event_access ON app.verification_events;
CREATE POLICY org_verification_event_access ON app.verification_events
    FOR ALL TO mshwar_backend
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

DROP POLICY IF EXISTS org_opening_hours_access ON app.opening_hours;
CREATE POLICY org_opening_hours_access ON app.opening_hours
    FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.venues v
        WHERE v.id = opening_hours.venue_id
          AND v.organization_id = app.current_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.venues v
        WHERE v.id = opening_hours.venue_id
          AND v.organization_id = app.current_organization_id()
    ));

DROP POLICY IF EXISTS org_opening_exception_access ON app.opening_exceptions;
CREATE POLICY org_opening_exception_access ON app.opening_exceptions
    FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.venues v
        WHERE v.id = opening_exceptions.venue_id
          AND v.organization_id = app.current_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.venues v
        WHERE v.id = opening_exceptions.venue_id
          AND v.organization_id = app.current_organization_id()
    ));

GRANT SELECT, INSERT, UPDATE ON app.platform_admins, app.verification_submissions, app.verification_documents
    TO mshwar_backend;
GRANT DELETE ON app.verification_documents TO mshwar_backend;

-- ---- helpers ---------------------------------------------------------

CREATE OR REPLACE FUNCTION app.lebanon_envelope()
RETURNS geometry
LANGUAGE sql
IMMUTABLE
AS $$
    -- Inclusive bounding box used to reject coordinates outside Lebanon.
    SELECT ST_MakeEnvelope(35.103, 33.047, 36.623, 34.692, 4326)
$$;

CREATE OR REPLACE FUNCTION app.point_in_lebanon(p_lng double precision, p_lat double precision)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ST_Covers(app.lebanon_envelope(), ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
$$;

CREATE OR REPLACE FUNCTION app.slugify(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT trim(both '-' FROM regexp_replace(lower(btrim(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION app.is_platform_admin(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT EXISTS (SELECT 1 FROM app.platform_admins WHERE user_id = p_user)
$$;

CREATE OR REPLACE FUNCTION app.grant_platform_admin(p_user uuid, p_granted_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    INSERT INTO app.platform_admins (user_id, granted_by)
    VALUES (p_user, p_granted_by)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION app.member_role(p_user uuid, p_org uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT m.role
    FROM app.organization_members m
    WHERE m.organization_id = p_org AND m.user_id = p_user AND m.active
$$;

CREATE OR REPLACE FUNCTION app.has_capability(p_user uuid, p_org uuid, p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_role text;
BEGIN
    IF app.is_platform_admin(p_user) AND p_capability = 'admin' THEN
        RETURN true;
    END IF;
    v_role := app.member_role(p_user, p_org);
    IF v_role IS NULL THEN
        RETURN false;
    END IF;
    IF v_role IN ('owner', 'manager') THEN
        RETURN p_capability IN ('listings', 'bookings', 'finance', 'settings', 'team');
    END IF;
    IF v_role = 'inventory' THEN
        RETURN p_capability = 'listings';
    END IF;
    IF v_role = 'bookings' THEN
        RETURN p_capability = 'bookings';
    END IF;
    IF v_role = 'finance' THEN
        RETURN p_capability = 'finance';
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION app.require_capability(p_user uuid, p_org uuid, p_capability text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT app.has_capability(p_user, p_org, p_capability) THEN
        RAISE EXCEPTION 'capability denied: %', p_capability USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.enqueue_notification(
    p_user uuid,
    p_event_type text,
    p_aggregate uuid,
    p_dedupe text,
    p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_outbox uuid;
BEGIN
    INSERT INTO app.outbox (event_type, aggregate_id, dedupe_key, payload)
    VALUES (p_event_type, p_aggregate, p_dedupe, p_payload)
    ON CONFLICT (dedupe_key) DO UPDATE SET payload = EXCLUDED.payload
    RETURNING id INTO v_outbox;
    INSERT INTO app.notifications (user_id, outbox_id, channel, category)
    VALUES (p_user, v_outbox, 'email', 'transactional')
    ON CONFLICT (user_id, outbox_id, channel) DO NOTHING;
    INSERT INTO app.notifications (user_id, outbox_id, channel, category)
    VALUES (p_user, v_outbox, 'in_app', 'transactional')
    ON CONFLICT (user_id, outbox_id, channel) DO NOTHING;
    RETURN v_outbox;
END;
$$;

-- ---- organisations / onboarding --------------------------------------

CREATE OR REPLACE FUNCTION app.register_organization(
    p_user uuid,
    p_name text,
    p_public_contact jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_slug text;
    v_base text;
BEGIN
    IF p_user IS NULL OR length(btrim(coalesce(p_name, ''))) < 2 THEN
        RAISE EXCEPTION 'organisation name required' USING ERRCODE = '22023';
    END IF;
    IF p_public_contact IS NULL OR jsonb_typeof(p_public_contact) <> 'object' THEN
        p_public_contact := '{}'::jsonb;
    END IF;
    v_base := NULLIF(app.slugify(p_name), '');
    IF v_base IS NULL THEN
        v_base := 'org';
    END IF;
    v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    INSERT INTO app.organizations (name, slug, status, verification, public_contact)
    VALUES (btrim(p_name), v_slug, 'active', 'pending', p_public_contact)
    RETURNING id INTO v_id;
    INSERT INTO app.organization_members (organization_id, user_id, role, active)
    VALUES (v_id, p_user, 'owner', true);
    RETURN app.get_organization_portal(p_user, v_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_my_organizations(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    -- plpgsql so this can call get_organization_portal defined later in the file.
    RETURN (
        SELECT coalesce(jsonb_agg(app.get_organization_portal(p_user, m.organization_id) ORDER BY o.created_at), '[]'::jsonb)
        FROM app.organization_members m
        JOIN app.organizations o ON o.id = m.organization_id
        WHERE m.user_id = p_user AND m.active
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.onboarding_checklist(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org app.organizations;
    v_docs integer;
    v_listings integer;
    v_submission integer;
BEGIN
    SELECT * INTO v_org FROM app.organizations WHERE id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'organisation not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT count(*) INTO v_docs FROM app.verification_documents WHERE organization_id = p_org;
    SELECT count(*) INTO v_listings FROM app.experiences WHERE organization_id = p_org;
    SELECT count(*) INTO v_submission FROM app.verification_submissions WHERE organization_id = p_org;
    RETURN jsonb_build_object(
        'verification', v_org.verification,
        'can_publish', v_org.verification = 'verified' AND v_org.status = 'active',
        'items', jsonb_build_array(
            jsonb_build_object('key', 'org_profile', 'done', length(btrim(v_org.name)) > 1),
            jsonb_build_object('key', 'public_contact', 'done', v_org.public_contact <> '{}'::jsonb),
            jsonb_build_object('key', 'verification_docs', 'done', v_docs > 0),
            jsonb_build_object('key', 'verification_submission', 'done', v_submission > 0),
            jsonb_build_object('key', 'first_listing', 'done', v_listings > 0),
            jsonb_build_object('key', 'verified', 'done', v_org.verification = 'verified')
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_organization_portal(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org app.organizations;
    v_role text;
BEGIN
    v_role := app.member_role(p_user, p_org);
    IF v_role IS NULL AND NOT app.is_platform_admin(p_user) THEN
        RAISE EXCEPTION 'not a member' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = p_org;
    RETURN jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'slug', v_org.slug,
        'status', v_org.status,
        'verification', v_org.verification,
        'role', coalesce(v_role, 'admin'),
        'public_contact', v_org.public_contact,
        'internal_contact', CASE
            WHEN v_role IN ('owner', 'manager') OR app.is_platform_admin(p_user)
            THEN v_org.internal_contact ELSE NULL END,
        'fulfilment_instructions', CASE
            WHEN v_role IN ('owner', 'manager', 'bookings') OR app.is_platform_admin(p_user)
            THEN v_org.fulfilment_instructions ELSE NULL END,
        'created_at', v_org.created_at,
        'onboarding', app.onboarding_checklist(p_org)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.update_organization_contacts(
    p_user uuid,
    p_org uuid,
    p_name text,
    p_public jsonb,
    p_internal jsonb,
    p_fulfilment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    UPDATE app.organizations
    SET name = coalesce(NULLIF(btrim(p_name), ''), name),
        public_contact = CASE WHEN p_public IS NULL THEN public_contact ELSE p_public END,
        internal_contact = CASE WHEN p_internal IS NULL THEN internal_contact ELSE p_internal END,
        fulfilment_instructions = coalesce(p_fulfilment, fulfilment_instructions)
    WHERE id = p_org;
    RETURN app.get_organization_portal(p_user, p_org);
END;
$$;

CREATE OR REPLACE FUNCTION app.public_organization(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org app.organizations;
    v_experiences jsonb;
BEGIN
    SELECT * INTO v_org FROM app.organizations WHERE slug = p_slug AND status = 'active';
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'status', e.status,
        'booking_mode', e.booking_mode,
        'duration_minutes', e.duration_minutes,
        'verified_badge', v_org.verification = 'verified'
    ) ORDER BY e.title), '[]'::jsonb)
    INTO v_experiences
    FROM app.experiences e
    WHERE e.organization_id = v_org.id AND e.status = 'published';
    RETURN jsonb_build_object(
        'id', v_org.id,
        'name', v_org.name,
        'slug', v_org.slug,
        'status', v_org.status,
        'verification', v_org.verification,
        'verified_badge', v_org.verification = 'verified',
        'public_contact', v_org.public_contact,
        'experiences', v_experiences
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_public_organizations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.public_organization(o.slug) ORDER BY o.name), '[]'::jsonb)
    FROM app.organizations o
    WHERE o.status = 'active' AND o.verification = 'verified'
$$;

-- ---- verification ----------------------------------------------------

CREATE OR REPLACE FUNCTION app.submit_verification(
    p_user uuid,
    p_org uuid,
    p_details jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_docs integer;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object' THEN
        RAISE EXCEPTION 'registration details required' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_docs FROM app.verification_documents WHERE organization_id = p_org;
    IF v_docs < 1 THEN
        RAISE EXCEPTION 'supporting document required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.verification_submissions (organization_id, submitted_by, registration_details)
    VALUES (p_org, p_user, p_details)
    RETURNING id INTO v_id;
    UPDATE app.verification_documents
    SET submission_id = v_id
    WHERE organization_id = p_org AND submission_id IS NULL;
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_user, 'verification_submitted', 'organizations',
        jsonb_build_object('organization_id', p_org, 'submission_id', v_id),
        jsonb_build_object('details', p_details),
        'Business submitted verification documents'
    );
    RETURN jsonb_build_object('id', v_id, 'organization_id', p_org, 'status', 'submitted');
END;
$$;

CREATE OR REPLACE FUNCTION app.attach_verification_document(
    p_user uuid,
    p_org uuid,
    p_object_key text,
    p_filename text,
    p_content_type text,
    p_byte_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    INSERT INTO app.verification_documents (
        organization_id, object_key, filename, content_type, byte_size, created_by
    ) VALUES (p_org, p_object_key, p_filename, p_content_type, p_byte_size, p_user)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id,
        'organization_id', p_org,
        'object_key', p_object_key,
        'filename', p_filename,
        'content_type', p_content_type,
        'byte_size', p_byte_size,
        'public', false
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_verification_documents(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT app.has_capability(p_user, p_org, 'settings') AND NOT app.is_platform_admin(p_user) THEN
        RAISE EXCEPTION 'capability denied: settings' USING ERRCODE = '42501';
    END IF;
    RETURN (
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
    );
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
BEGIN
    IF NOT app.is_platform_admin(p_admin) THEN
        RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
    END IF;
    IF p_decision NOT IN ('verified', 'rejected', 'revoked') THEN
        RAISE EXCEPTION 'invalid decision' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = p_org FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'organisation not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.organizations SET verification = p_decision WHERE id = p_org;
    INSERT INTO app.verification_events (organization_id, reviewer_id, decision, reason)
    VALUES (p_org, p_admin, p_decision, btrim(p_reason));
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (
        p_admin, 'verification_' || p_decision, 'organizations',
        jsonb_build_object('organization_id', p_org),
        jsonb_build_object('from', v_org.verification, 'to', p_decision),
        btrim(p_reason)
    );
    RETURN jsonb_build_object(
        'id', p_org,
        'verification', p_decision,
        'reason', btrim(p_reason),
        'reviewer_id', p_admin
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
    IF NOT app.is_platform_admin(p_admin) THEN
        RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
    END IF;
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'slug', o.slug,
            'status', o.status,
            'verification', o.verification,
            'created_at', o.created_at,
            'paused_experiences', (
                SELECT count(*) FROM app.experiences e
                WHERE e.organization_id = o.id AND e.status = 'paused'
            ),
            'published_experiences', (
                SELECT count(*) FROM app.experiences e
                WHERE e.organization_id = o.id AND e.status = 'published'
            )
        ) ORDER BY o.created_at DESC), '[]'::jsonb)
        FROM app.organizations o
    );
END;
$$;

-- ---- staff -----------------------------------------------------------

CREATE OR REPLACE FUNCTION app.invite_staff(
    p_user uuid,
    p_org uuid,
    p_email text,
    p_role text,
    p_token_hash text,
    p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_email text := lower(btrim(p_email));
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'team');
    IF p_role NOT IN ('manager', 'inventory', 'bookings', 'finance') THEN
        RAISE EXCEPTION 'invalid staff role' USING ERRCODE = '22023';
    END IF;
    IF v_email IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'email required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.staff_invitations (
        organization_id, email, role, token_hash, expires_at, invited_by
    ) VALUES (p_org, v_email, p_role, p_token_hash, p_expires_at, p_user)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id,
        'organization_id', p_org,
        'email', v_email,
        'role', p_role,
        'expires_at', p_expires_at,
        'revoked_at', NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.revoke_staff_invite(p_user uuid, p_org uuid, p_invite uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'team');
    UPDATE app.staff_invitations
    SET revoked_at = now(), revoked_by = p_user
    WHERE id = p_invite AND organization_id = p_org AND accepted_at IS NULL AND revoked_at IS NULL;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.accept_staff_invite(p_user uuid, p_email text, p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_inv app.staff_invitations;
BEGIN
    SELECT * INTO v_inv
    FROM app.staff_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;
    IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.accepted_at IS NOT NULL OR v_inv.expires_at <= now() THEN
        RAISE EXCEPTION 'invalid or expired invitation' USING ERRCODE = '22023';
    END IF;
    IF lower(v_inv.email) <> lower(btrim(p_email)) THEN
        RAISE EXCEPTION 'invitation email mismatch' USING ERRCODE = '42501';
    END IF;
    INSERT INTO app.organization_members (organization_id, user_id, role, active)
    VALUES (v_inv.organization_id, p_user, v_inv.role, true)
    ON CONFLICT (organization_id, user_id) DO UPDATE
        SET role = EXCLUDED.role, active = true;
    UPDATE app.staff_invitations SET accepted_at = now() WHERE id = v_inv.id;
    RETURN app.get_organization_portal(p_user, v_inv.organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_staff(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'team');
    RETURN jsonb_build_object(
        'members', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'user_id', m.user_id,
                'email', p.email,
                'display_name', u.display_name,
                'role', m.role,
                'active', m.active,
                'created_at', m.created_at
            ) ORDER BY m.created_at), '[]'::jsonb)
            FROM app.organization_members m
            JOIN app.users u ON u.id = m.user_id
            LEFT JOIN app.user_private p ON p.user_id = m.user_id
            WHERE m.organization_id = p_org
        ),
        'invitations', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', i.id,
                'email', i.email,
                'role', i.role,
                'expires_at', i.expires_at,
                'accepted_at', i.accepted_at,
                'revoked_at', i.revoked_at
            ) ORDER BY i.created_at DESC), '[]'::jsonb)
            FROM app.staff_invitations i
            WHERE i.organization_id = p_org
        )
    );
END;
$$;

-- ---- listings --------------------------------------------------------

CREATE OR REPLACE FUNCTION app.upsert_venue(
    p_user uuid,
    p_org uuid,
    p_venue uuid,
    p_name text,
    p_address text,
    p_lng double precision,
    p_lat double precision,
    p_destination_slug text DEFAULT 'beirut'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_dest uuid;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT app.point_in_lebanon(p_lng, p_lat) THEN
        RAISE EXCEPTION 'coordinates must fall inside Lebanon' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_dest FROM app.destinations WHERE slug = coalesce(p_destination_slug, 'beirut');
    IF p_venue IS NULL THEN
        INSERT INTO app.venues (
            organization_id, destination_id, name, address, timezone, location, location_source
        ) VALUES (
            p_org, v_dest, btrim(p_name), btrim(p_address), 'Asia/Beirut',
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            'portal-map'
        ) RETURNING id INTO v_id;
    ELSE
        UPDATE app.venues
        SET name = btrim(p_name),
            address = btrim(p_address),
            destination_id = v_dest,
            location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
            location_source = 'portal-map'
        WHERE id = p_venue AND organization_id = p_org
        RETURNING id INTO v_id;
        IF v_id IS NULL THEN
            RAISE EXCEPTION 'venue not found' USING ERRCODE = 'P0002';
        END IF;
    END IF;
    RETURN jsonb_build_object(
        'id', v_id,
        'organization_id', p_org,
        'name', btrim(p_name),
        'address', btrim(p_address),
        'lng', p_lng,
        'lat', p_lat,
        'in_lebanon', true
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.experience_publish_report(p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
    v_org app.organizations;
    v_lng double precision;
    v_lat double precision;
    v_images integer;
    v_prices integer;
    v_policies integer;
    v_category integer;
    v_issues jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE id = p_experience;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = e.organization_id;
    SELECT ST_X(location::geometry), ST_Y(location::geometry)
    INTO v_lng, v_lat FROM app.venues WHERE id = e.venue_id;
    SELECT count(*) INTO v_images FROM app.media WHERE experience_id = e.id;
    SELECT count(*) INTO v_prices FROM app.price_rules WHERE experience_id = e.id;
    SELECT count(*) INTO v_policies FROM app.policies WHERE experience_id = e.id;
    SELECT count(*) INTO v_category
    FROM app.experience_taxonomy et
    JOIN app.taxonomy t ON t.id = et.term_id
    WHERE et.experience_id = e.id AND t.kind = 'category';
    IF v_org.verification <> 'verified' THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'org_unverified', 'message', 'Organisation is not verified'));
    END IF;
    IF v_org.status <> 'active' THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'org_inactive', 'message', 'Organisation is not active'));
    END IF;
    IF length(btrim(e.title)) < 3 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'title', 'message', 'Title is required'));
    END IF;
    IF length(btrim(e.description)) < 8 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'description', 'message', 'Description is required'));
    END IF;
    IF v_category < 1 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'category', 'message', 'Category is required'));
    END IF;
    IF v_images < 1 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'images', 'message', 'At least one image is required'));
    END IF;
    IF v_prices < 1 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'pricing', 'message', 'A price rule is required'));
    END IF;
    IF v_policies < 1 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'policies', 'message', 'A policy is required'));
    END IF;
    IF e.duration_minutes IS NULL OR e.duration_minutes <= 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'duration', 'message', 'Duration is required'));
    END IF;
    IF NOT app.point_in_lebanon(v_lng, v_lat) THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'location', 'message', 'Location must be inside Lebanon'));
    END IF;
    RETURN jsonb_build_object(
        'experience_id', e.id,
        'ready', jsonb_array_length(v_issues) = 0,
        'issues', v_issues,
        'verification', v_org.verification
    );
END;
$$;

CREATE OR REPLACE FUNCTION app._sync_experience_terms(p_experience uuid, p_slugs text[], p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    DELETE FROM app.experience_taxonomy et
    USING app.taxonomy t
    WHERE et.experience_id = p_experience AND et.term_id = t.id AND t.kind = p_kind;
    IF p_slugs IS NULL THEN
        RETURN;
    END IF;
    INSERT INTO app.experience_taxonomy (experience_id, term_id)
    SELECT p_experience, t.id
    FROM app.taxonomy t
    WHERE t.kind = p_kind AND t.slug = ANY (p_slugs)
    ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION app.upsert_experience(p_user uuid, p_org uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
    v_venue uuid := NULLIF(p_payload->>'venue_id', '')::uuid;
    v_slug text;
    v_title text := btrim(p_payload->>'title');
    e app.experiences;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF v_venue IS NULL OR NOT EXISTS (
        SELECT 1 FROM app.venues WHERE id = v_venue AND organization_id = p_org
    ) THEN
        RAISE EXCEPTION 'venue required' USING ERRCODE = '22023';
    END IF;
    IF v_title IS NULL OR length(v_title) < 3 THEN
        RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
    END IF;
    IF v_id IS NULL THEN
        v_slug := coalesce(NULLIF(app.slugify(p_payload->>'slug'), ''), app.slugify(v_title));
        v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
        INSERT INTO app.experiences (
            organization_id, venue_id, slug, title, description, status, booking_mode,
            duration_minutes, min_party, max_party, min_age, setting, intensity, weather_rules
        ) VALUES (
            p_org, v_venue, v_slug, v_title, coalesce(p_payload->>'description', ''),
            'draft', coalesce(p_payload->>'booking_mode', 'request'),
            coalesce((p_payload->>'duration_minutes')::integer, 60),
            coalesce((p_payload->>'min_party')::integer, 1),
            coalesce((p_payload->>'max_party')::integer, 8),
            NULLIF(p_payload->>'min_age', '')::integer,
            coalesce(p_payload->>'setting', 'mixed'),
            NULLIF(p_payload->>'intensity', '')::smallint,
            coalesce(p_payload->'weather_rules', '{}'::jsonb)
        ) RETURNING * INTO e;
        v_id := e.id;
    ELSE
        UPDATE app.experiences
        SET venue_id = v_venue,
            title = v_title,
            description = coalesce(p_payload->>'description', description),
            booking_mode = coalesce(p_payload->>'booking_mode', booking_mode),
            duration_minutes = coalesce((p_payload->>'duration_minutes')::integer, duration_minutes),
            min_party = coalesce((p_payload->>'min_party')::integer, min_party),
            max_party = coalesce((p_payload->>'max_party')::integer, max_party),
            min_age = CASE WHEN p_payload ? 'min_age' THEN NULLIF(p_payload->>'min_age', '')::integer ELSE min_age END,
            setting = coalesce(p_payload->>'setting', setting),
            intensity = CASE WHEN p_payload ? 'intensity' THEN NULLIF(p_payload->>'intensity', '')::smallint ELSE intensity END,
            weather_rules = coalesce(p_payload->'weather_rules', weather_rules),
            updated_at = now()
        WHERE id = v_id AND organization_id = p_org AND status <> 'archived'
        RETURNING * INTO e;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
        END IF;
    END IF;
    IF p_payload ? 'category' THEN
        PERFORM app._sync_experience_terms(e.id, ARRAY[p_payload->>'category'], 'category');
    END IF;
    IF p_payload ? 'suitability' THEN
        PERFORM app._sync_experience_terms(
            e.id,
            ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'suitability', '[]'::jsonb))),
            'suitability'
        );
    END IF;
    IF p_payload ? 'weather' THEN
        PERFORM app._sync_experience_terms(
            e.id,
            ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'weather', '[]'::jsonb))),
            'weather'
        );
    END IF;
    IF p_payload ? 'price' AND jsonb_typeof(p_payload->'price') = 'object' THEN
        DELETE FROM app.price_rules WHERE experience_id = e.id;
        INSERT INTO app.price_rules (
            experience_id, currency, price_type, unit, amount_minor, max_amount_minor, valid_during, source, verified_at
        ) VALUES (
            e.id,
            coalesce(p_payload->'price'->>'currency', 'USD'),
            coalesce(p_payload->'price'->>'price_type', 'fixed'),
            coalesce(p_payload->'price'->>'unit', 'person'),
            NULLIF(p_payload->'price'->>'amount_minor', '')::bigint,
            NULLIF(p_payload->'price'->>'max_amount_minor', '')::bigint,
            tstzrange('2000-01-01', '2100-01-01', '[)'),
            'portal',
            now()
        );
    END IF;
    IF p_payload ? 'policy' AND jsonb_typeof(p_payload->'policy') = 'object' THEN
        INSERT INTO app.policies (experience_id, version, cancellation_rules, terms_text)
        SELECT e.id, coalesce((SELECT max(version) FROM app.policies WHERE experience_id = e.id), 0) + 1,
            coalesce(p_payload->'policy'->'cancellation_rules', '{}'::jsonb),
            coalesce(p_payload->'policy'->>'terms_text', 'Standard terms')
        ;
    END IF;
    RETURN app.get_experience_portal(p_user, p_org, e.id);
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

CREATE OR REPLACE FUNCTION app.list_experiences_portal(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT app.has_capability(p_user, p_org, 'listings')
       AND NOT app.is_platform_admin(p_user) THEN
        RAISE EXCEPTION 'capability denied: listings' USING ERRCODE = '42501';
    END IF;
    RETURN (
        SELECT coalesce(jsonb_agg(app.get_experience_portal(p_user, p_org, e.id) ORDER BY e.updated_at DESC), '[]'::jsonb)
        FROM app.experiences e
        WHERE e.organization_id = p_org AND e.status <> 'archived'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.publish_experience(p_user uuid, p_org uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_report jsonb;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    v_report := app.experience_publish_report(p_experience);
    IF NOT (v_report->>'ready')::boolean THEN
        RAISE EXCEPTION 'publish blocked: %', v_report USING ERRCODE = '22023';
    END IF;
    UPDATE app.experiences
    SET status = 'published', updated_at = now()
    WHERE id = p_experience AND organization_id = p_org;
    RETURN app.get_experience_portal(p_user, p_org, p_experience);
END;
$$;

CREATE OR REPLACE FUNCTION app.set_experience_status(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_current text;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF p_status NOT IN ('paused', 'draft', 'published') THEN
        RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
    SELECT status INTO v_current FROM app.experiences WHERE id = p_experience AND organization_id = p_org;
    IF v_current IS NULL THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_status = 'published' THEN
        RETURN app.publish_experience(p_user, p_org, p_experience);
    END IF;
    UPDATE app.experiences SET status = p_status, updated_at = now()
    WHERE id = p_experience AND organization_id = p_org;
    RETURN app.get_experience_portal(p_user, p_org, p_experience);
END;
$$;

CREATE OR REPLACE FUNCTION app.attach_experience_media(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_object_key text,
    p_alt text,
    p_sort integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.media (experience_id, provider, object_key, alt_text, sort_order, moderation)
    VALUES (p_experience, 'imagekit', p_object_key, coalesce(NULLIF(p_alt, ''), 'Experience image'), p_sort, 'pending')
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'object_key', p_object_key, 'experience_id', p_experience);
END;
$$;

CREATE OR REPLACE FUNCTION app.public_experience(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
    v_org app.organizations;
    v_lng double precision;
    v_lat double precision;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE slug = p_slug AND status = 'published';
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = e.organization_id;
    IF v_org.status <> 'active' OR v_org.verification <> 'verified' THEN
        RETURN NULL;
    END IF;
    SELECT ST_X(location::geometry), ST_Y(location::geometry)
    INTO v_lng, v_lat FROM app.venues WHERE id = e.venue_id;
    RETURN jsonb_build_object(
        'id', e.id,
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'status', e.status,
        'booking_mode', e.booking_mode,
        'duration_minutes', e.duration_minutes,
        'min_party', e.min_party,
        'max_party', e.max_party,
        'setting', e.setting,
        'verified_badge', true,
        'organization', jsonb_build_object(
            'id', v_org.id,
            'name', v_org.name,
            'slug', v_org.slug,
            'public_contact', v_org.public_contact
        ),
        'location', jsonb_build_object('lng', v_lng, 'lat', v_lat)
    );
END;
$$;

-- ---- availability ----------------------------------------------------

CREATE OR REPLACE FUNCTION app.replace_opening_hours(
    p_user uuid,
    p_org uuid,
    p_venue uuid,
    p_hours jsonb,
    p_source text DEFAULT 'portal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_item jsonb;
    v_id uuid;
    v_rows jsonb := '[]'::jsonb;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.venues WHERE id = p_venue AND organization_id = p_org) THEN
        RAISE EXCEPTION 'venue not found' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM app.opening_hours WHERE venue_id = p_venue;
    FOR v_item IN SELECT jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) LOOP
        INSERT INTO app.opening_hours (venue_id, weekday, opens, closes, source, updated_by, updated_at)
        VALUES (
            p_venue,
            (v_item->>'weekday')::smallint,
            (v_item->>'opens')::time,
            (v_item->>'closes')::time,
            coalesce(NULLIF(p_source, ''), 'portal'),
            p_user,
            now()
        ) RETURNING id INTO v_id;
        v_rows := v_rows || jsonb_build_array(jsonb_build_object(
            'id', v_id,
            'weekday', (v_item->>'weekday')::integer,
            'opens', v_item->>'opens',
            'closes', v_item->>'closes',
            'updated_at', now(),
            'source', coalesce(NULLIF(p_source, ''), 'portal'),
            'updated_by', p_user
        ));
    END LOOP;
    RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION app.upsert_opening_exception(
    p_user uuid,
    p_org uuid,
    p_venue uuid,
    p_date date,
    p_closed boolean,
    p_opens time,
    p_closes time,
    p_source text DEFAULT 'portal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.venues WHERE id = p_venue AND organization_id = p_org) THEN
        RAISE EXCEPTION 'venue not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.opening_exceptions (
        venue_id, local_date, closed, opens, closes, source, updated_by, updated_at
    ) VALUES (
        p_venue, p_date, p_closed,
        CASE WHEN p_closed THEN NULL ELSE p_opens END,
        CASE WHEN p_closed THEN NULL ELSE p_closes END,
        coalesce(NULLIF(p_source, ''), 'portal'), p_user, now()
    )
    ON CONFLICT (venue_id, local_date) DO UPDATE
        SET closed = EXCLUDED.closed,
            opens = EXCLUDED.opens,
            closes = EXCLUDED.closes,
            source = EXCLUDED.source,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id, 'venue_id', p_venue, 'local_date', p_date, 'closed', p_closed,
        'updated_at', now(), 'source', coalesce(NULLIF(p_source, ''), 'portal'), 'updated_by', p_user
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.upsert_blackout(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_start timestamptz,
    p_end timestamptz,
    p_reason text,
    p_source text DEFAULT 'portal'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.blackouts (experience_id, period, reason, source, updated_by, updated_at)
    VALUES (
        p_experience, tstzrange(p_start, p_end, '[)'), btrim(p_reason),
        coalesce(NULLIF(p_source, ''), 'portal'), p_user, now()
    )
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id, 'experience_id', p_experience, 'reason', btrim(p_reason),
        'start', p_start, 'end', p_end,
        'updated_at', now(), 'source', coalesce(NULLIF(p_source, ''), 'portal'), 'updated_by', p_user
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_blackout(p_user uuid, p_org uuid, p_blackout uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    DELETE FROM app.blackouts b
    USING app.experiences e
    WHERE b.id = p_blackout AND b.experience_id = e.id AND e.organization_id = p_org;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.generate_slots(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_from date,
    p_to date,
    p_capacity integer,
    p_source text DEFAULT 'portal-recurrence'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
    v_day date;
    v_opens time;
    v_closes time;
    v_closed boolean;
    v_start timestamptz;
    v_end timestamptz;
    v_created integer := 0;
    v_skipped integer := 0;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_capacity IS NULL OR p_capacity <= 0 THEN
        RAISE EXCEPTION 'capacity required' USING ERRCODE = '22023';
    END IF;
    v_day := p_from;
    WHILE v_day <= p_to LOOP
        v_closed := false;
        v_opens := NULL;
        v_closes := NULL;
        SELECT closed, opens, closes INTO v_closed, v_opens, v_closes
        FROM app.opening_exceptions
        WHERE venue_id = e.venue_id AND local_date = v_day;
        IF NOT FOUND THEN
            SELECT opens, closes INTO v_opens, v_closes
            FROM app.opening_hours
            WHERE venue_id = e.venue_id AND weekday = EXTRACT(DOW FROM v_day)::smallint
            ORDER BY opens LIMIT 1;
        END IF;
        IF v_closed OR v_opens IS NULL THEN
            v_skipped := v_skipped + 1;
        ELSE
            v_start := (v_day + v_opens) AT TIME ZONE 'Asia/Beirut';
            v_end := v_start + make_interval(mins => e.duration_minutes);
            IF v_end > ((v_day + v_closes) AT TIME ZONE 'Asia/Beirut') THEN
                v_end := (v_day + v_closes) AT TIME ZONE 'Asia/Beirut';
            END IF;
            IF v_end > v_start THEN
                INSERT INTO app.slots (
                    experience_id, starts_at, ends_at, capacity, reserved,
                    authoritative, source, observed_at, status
                ) VALUES (
                    e.id, v_start, v_end, p_capacity, 0, true,
                    coalesce(NULLIF(p_source, ''), 'portal-recurrence') || ':' || p_user::text,
                    now(), 'open'
                )
                ON CONFLICT (experience_id, starts_at) DO NOTHING;
                IF FOUND THEN
                    v_created := v_created + 1;
                ELSE
                    v_skipped := v_skipped + 1;
                END IF;
            ELSE
                v_skipped := v_skipped + 1;
            END IF;
        END IF;
        v_day := v_day + 1;
    END LOOP;
    RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_availability(p_user uuid, p_org uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'hours', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', h.id, 'weekday', h.weekday, 'opens', h.opens, 'closes', h.closes,
                'updated_at', h.updated_at, 'source', h.source, 'updated_by', h.updated_by
            ) ORDER BY h.weekday, h.opens)
            FROM app.opening_hours h WHERE h.venue_id = e.venue_id
        ), '[]'::jsonb),
        'exceptions', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', x.id, 'local_date', x.local_date, 'closed', x.closed,
                'opens', x.opens, 'closes', x.closes,
                'updated_at', x.updated_at, 'source', x.source, 'updated_by', x.updated_by
            ) ORDER BY x.local_date)
            FROM app.opening_exceptions x WHERE x.venue_id = e.venue_id
        ), '[]'::jsonb),
        'blackouts', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', b.id, 'start', lower(b.period), 'end', upper(b.period),
                'reason', b.reason, 'updated_at', b.updated_at, 'source', b.source, 'updated_by', b.updated_by
            ) ORDER BY lower(b.period))
            FROM app.blackouts b WHERE b.experience_id = e.id
        ), '[]'::jsonb),
        'slots', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'starts_at', s.starts_at,
                'ends_at', s.ends_at,
                'capacity', s.capacity,
                'reserved', s.reserved,
                'remaining', s.capacity - s.reserved,
                'blacked_out', EXISTS (
                    SELECT 1 FROM app.blackouts b
                    WHERE b.experience_id = e.id AND b.period && tstzrange(s.starts_at, s.ends_at, '[)')
                ),
                'status', s.status,
                'source', s.source,
                'observed_at', s.observed_at
            ) ORDER BY s.starts_at)
            FROM app.slots s WHERE s.experience_id = e.id
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- bookings --------------------------------------------------------

CREATE OR REPLACE FUNCTION app.list_portal_bookings(
    p_user uuid,
    p_org uuid,
    p_status text DEFAULT NULL,
    p_experience uuid DEFAULT NULL,
    p_from timestamptz DEFAULT NULL,
    p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'bookings');
    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', b.id,
            'status', b.status,
            'party_size', b.party_size,
            'traveller_note', b.traveller_note,
            'experience_id', b.experience_id,
            'experience_title', e.title,
            'slot_id', b.slot_id,
            'starts_at', s.starts_at,
            'ends_at', s.ends_at,
            'capacity', s.capacity,
            'reserved', s.reserved,
            'remaining', s.capacity - s.reserved,
            'customer_id', b.customer_id,
            'mode', b.mode,
            'total_minor', b.total_minor,
            'currency', b.currency,
            'reason', b.reason,
            'created_at', b.created_at,
            'trip_stop_id', b.trip_stop_id
        ) ORDER BY s.starts_at, b.created_at), '[]'::jsonb)
        FROM app.bookings b
        JOIN app.experiences e ON e.id = b.experience_id
        JOIN app.slots s ON s.id = b.slot_id
        WHERE b.organization_id = p_org
          AND (p_status IS NULL OR b.status = p_status)
          AND (p_experience IS NULL OR b.experience_id = p_experience)
          AND (p_from IS NULL OR s.starts_at >= p_from)
          AND (p_to IS NULL OR s.starts_at < p_to)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.respond_portal_booking(
    p_user uuid,
    p_org uuid,
    p_booking uuid,
    p_status text,
    p_reason text,
    p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings;
    v_org app.organizations;
    v_payload jsonb;
    v_dedupe text;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'bookings');
    IF p_status NOT IN ('confirmed', 'rejected') THEN
        RAISE EXCEPTION 'status must be confirmed or rejected' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND organization_id = p_org FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = p_org;
    PERFORM app.transition_booking(p_booking, p_status, p_reason);
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (p_booking, p_user, b.status, p_status, p_reason);
    IF b.trip_stop_id IS NOT NULL THEN
        UPDATE app.trip_stops
        SET snapshot = snapshot || jsonb_build_object(
            'booking_status', p_status,
            'booking_id', p_booking,
            'updated_by_org', p_org
        )
        WHERE id = b.trip_stop_id;
    END IF;
    v_payload := jsonb_build_object(
        'booking_id', p_booking,
        'status', p_status,
        'reason', p_reason,
        'message', p_message,
        'fulfilment_instructions', CASE WHEN p_status = 'confirmed' THEN v_org.fulfilment_instructions ELSE NULL END,
        'public_contact', v_org.public_contact
    );
    v_dedupe := 'booking-response:' || p_booking::text || ':' || p_status;
    PERFORM app.enqueue_notification(b.customer_id, 'booking.' || p_status, p_booking, v_dedupe, v_payload);
    IF p_status = 'confirmed' THEN
        INSERT INTO app.analytics_events (event_name, organization_id, experience_id, properties, dedupe_key)
        VALUES (
            'booking_confirmation', p_org, b.experience_id,
            jsonb_build_object('booking_id', p_booking, 'amount_minor', b.total_minor, 'currency', b.currency),
            'confirm:' || p_booking::text
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
        INSERT INTO app.analytics_events (event_name, organization_id, experience_id, properties, dedupe_key)
        VALUES (
            'revenue', p_org, b.experience_id,
            jsonb_build_object('booking_id', p_booking, 'amount_minor', b.total_minor, 'currency', b.currency),
            'revenue:' || p_booking::text
        )
        ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
    RETURN app.portal_booking_row(p_user, p_org, p_booking);
END;
$$;

CREATE OR REPLACE FUNCTION app.portal_booking_row(p_user uuid, p_org uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT elem
    FROM jsonb_array_elements(app.list_portal_bookings(p_user, p_org, NULL, NULL, NULL, NULL)) elem
    WHERE elem->>'id' = p_booking::text
    LIMIT 1
$$;

-- ---- analytics -------------------------------------------------------

CREATE OR REPLACE FUNCTION app.record_analytics_event(
    p_name text,
    p_org uuid,
    p_experience uuid,
    p_user uuid,
    p_properties jsonb,
    p_dedupe text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_name NOT IN (
        'listing_view', 'listing_save', 'itinerary_inclusion',
        'booking_request', 'booking_confirmation', 'revenue'
    ) THEN
        RAISE EXCEPTION 'unknown analytics event' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.analytics_events (
        event_name, user_id, organization_id, experience_id, properties, dedupe_key
    ) VALUES (
        p_name, p_user, p_org, p_experience, coalesce(p_properties, '{}'::jsonb), p_dedupe
    )
    ON CONFLICT (dedupe_key) DO UPDATE SET properties = EXCLUDED.properties
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.aggregate_org_metrics(
    p_user uuid,
    p_org uuid,
    p_from timestamptz,
    p_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_current jsonb;
    v_previous jsonb;
    v_delta interval;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'finance');
    v_delta := p_to - p_from;
    SELECT jsonb_build_object(
        'views', count(*) FILTER (WHERE event_name = 'listing_view'),
        'saves', count(*) FILTER (WHERE event_name = 'listing_save'),
        'itinerary_inclusions', count(*) FILTER (WHERE event_name = 'itinerary_inclusion'),
        'requests', count(*) FILTER (WHERE event_name = 'booking_request'),
        'confirmations', count(*) FILTER (WHERE event_name = 'booking_confirmation'),
        'revenue_minor', coalesce(sum((properties->>'amount_minor')::bigint) FILTER (WHERE event_name = 'revenue'), 0)
    ) INTO v_current
    FROM app.analytics_events
    WHERE organization_id = p_org AND created_at >= p_from AND created_at < p_to;
    SELECT jsonb_build_object(
        'views', count(*) FILTER (WHERE event_name = 'listing_view'),
        'saves', count(*) FILTER (WHERE event_name = 'listing_save'),
        'itinerary_inclusions', count(*) FILTER (WHERE event_name = 'itinerary_inclusion'),
        'requests', count(*) FILTER (WHERE event_name = 'booking_request'),
        'confirmations', count(*) FILTER (WHERE event_name = 'booking_confirmation'),
        'revenue_minor', coalesce(sum((properties->>'amount_minor')::bigint) FILTER (WHERE event_name = 'revenue'), 0)
    ) INTO v_previous
    FROM app.analytics_events
    WHERE organization_id = p_org AND created_at >= (p_from - v_delta) AND created_at < p_from;
    RETURN jsonb_build_object(
        'organization_id', p_org,
        'from', p_from,
        'to', p_to,
        'comparison_from', p_from - v_delta,
        'comparison_to', p_from,
        'current', v_current,
        'previous', v_previous
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_taxonomy_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'category', coalesce((SELECT jsonb_agg(jsonb_build_object('slug', slug, 'label', label) ORDER BY label) FROM app.taxonomy WHERE kind = 'category' AND active), '[]'::jsonb),
        'suitability', coalesce((SELECT jsonb_agg(jsonb_build_object('slug', slug, 'label', label) ORDER BY label) FROM app.taxonomy WHERE kind = 'suitability' AND active), '[]'::jsonb),
        'weather', coalesce((SELECT jsonb_agg(jsonb_build_object('slug', slug, 'label', label) ORDER BY label) FROM app.taxonomy WHERE kind = 'weather' AND active), '[]'::jsonb)
    )
$$;

REVOKE ALL ON FUNCTION app.register_organization(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_my_organizations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_organization_portal(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_transition_verification(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.invite_staff(uuid, uuid, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.accept_staff_invite(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.public_organization(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.public_experience(text) FROM PUBLIC;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
