SET search_path = app, public;

-- ============================================================
-- Migration 024: authorisation everywhere (MSHWAR-108)
-- ============================================================
-- * catalogue writes check who is asking: collections are admin-only and a
--   listing's status can be changed only by an admin or the owning business
-- * object-level denials look exactly like "not found", so ids of other
--   people's trips and reviews cannot be probed
-- * unsubscribe links are stored as expiring hashes, never in plain text
-- * the few reads the API made straight against tables now go through
--   functions, so the API can run as a plain member of mshwar_backend

-- ---- catalogue writes ------------------------------------------------------

CREATE OR REPLACE FUNCTION app.set_listing_status(p_actor uuid, p_slug text, p_to text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_org uuid;
    v_from text;
    v_status text;
BEGIN
    SELECT id, organization_id, status INTO v_id, v_org, v_from
    FROM app.experiences
    WHERE slug = btrim(p_slug);
    IF v_id IS NULL
       OR p_actor IS NULL
       OR NOT (app.is_platform_admin(p_actor) OR app.has_capability(p_actor, v_org, 'listings')) THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    v_status := app.transition_experience_status(v_id, p_to);
    IF v_status IS DISTINCT FROM v_from THEN
        PERFORM app.write_audit(
            p_actor, 'listing.status_changed', 'experiences',
            jsonb_build_object('id', v_id, 'organization_id', v_org, 'slug', btrim(p_slug)),
            jsonb_build_object('status', jsonb_build_object('old', v_from, 'new', v_status))
        );
    END IF;
    RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_upsert_catalogue_collection(
    p_admin uuid,
    p_slug text,
    p_title text,
    p_description text,
    p_kicker text,
    p_image_url text,
    p_image_alt text,
    p_accent boolean,
    p_status text,
    p_experience_slugs text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_slug text;
    v_existed boolean;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    v_existed := EXISTS (SELECT 1 FROM app.catalogue_collections WHERE slug = btrim(p_slug));
    v_slug := app.upsert_catalogue_collection(
        p_slug, p_title, p_description, p_kicker, p_image_url, p_image_alt, p_accent, p_status, p_experience_slugs
    );
    PERFORM app.write_audit(
        p_admin,
        CASE WHEN v_existed THEN 'collection.updated' ELSE 'collection.created' END,
        'catalogue_collections',
        jsonb_build_object('slug', v_slug),
        jsonb_build_object('status', p_status, 'experience_count', coalesce(cardinality(p_experience_slugs), 0))
    );
    RETURN v_slug;
END;
$$;

-- The unchecked primitives stay for migrations and seeds only.
REVOKE EXECUTE ON FUNCTION app.upsert_catalogue_collection(text, text, text, text, text, text, boolean, text, text[]) FROM mshwar_backend;
REVOKE EXECUTE ON FUNCTION app.transition_experience_status_by_slug(text, text) FROM mshwar_backend;
REVOKE EXECUTE ON FUNCTION app.transition_experience_status(uuid, text) FROM mshwar_backend;

-- ---- no existence oracles ---------------------------------------------------

-- Not a member of the trip (or no such trip): "not found".
-- A member whose role is too low: "permission denied" (they know the trip exists).
CREATE OR REPLACE FUNCTION app.require_group_role(p_trip uuid, p_user uuid, p_guest uuid, p_min text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_role text;
BEGIN
    v_role := app.actor_group_role(p_trip, p_user, p_guest);
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    IF app.group_role_rank(v_role) < app.group_role_rank(p_min) THEN
        RAISE EXCEPTION 'group permission denied' USING ERRCODE = '42501';
    END IF;
    RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION app.review_org_for(p_user uuid, p_review uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org uuid;
BEGIN
    SELECT b.organization_id INTO v_org
    FROM app.reviews r
    JOIN app.bookings b ON b.id = r.booking_id
    WHERE r.id = p_review;
    IF v_org IS NULL OR NOT app.has_capability(p_user, v_org, 'bookings') THEN
        RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION app.respond_to_review(p_user uuid, p_review uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.review_org_for(p_user, p_review);
    PERFORM 1 FROM app.reviews WHERE id = p_review FOR UPDATE;
    IF length(btrim(coalesce(p_body, ''))) < 3 THEN
        RAISE EXCEPTION 'response text required' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM app.review_responses WHERE review_id = p_review) THEN
        RAISE EXCEPTION 'response already submitted' USING ERRCODE = '23505';
    END IF;
    INSERT INTO app.review_responses (review_id, author_id, body, moderation)
    VALUES (p_review, p_user, btrim(p_body), 'pending')
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id,
        'review_id', p_review,
        'body', btrim(p_body),
        'label', 'Business response',
        'moderation', 'pending'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.forbid_business_review_mutation(p_user uuid, p_review uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.review_org_for(p_user, p_review);
    RAISE EXCEPTION 'businesses cannot edit, hide or delete reviews' USING ERRCODE = '42501';
END;
$$;

-- ---- reference tables ----------------------------------------------------------
-- notification_templates (020) was the one app table without row-level security.
ALTER TABLE app.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notification_templates FORCE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON app.notification_templates FROM mshwar_backend;
DROP POLICY IF EXISTS notification_templates_read ON app.notification_templates;
CREATE POLICY notification_templates_read ON app.notification_templates
    FOR SELECT TO mshwar_backend, mshwar_reader USING (true);

-- ---- portal analytics events ----------------------------------------------------
-- Any signed-in traveller could record any event (including revenue) against
-- any organisation, and a repeated dedupe key overwrote someone else's event.
-- Travellers may now record only engagement events for a published listing of
-- that organisation; the organisation's own staff may record the rest; dedupe
-- keys are scoped to the caller and never overwrite.

CREATE OR REPLACE FUNCTION app.capture_org_event(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_name text,
    p_properties jsonb,
    p_dedupe text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_staff boolean := app.has_capability(p_user, p_org, 'listings');
    v_key text := coalesce(p_user::text, 'anonymous') || ':' || btrim(coalesce(p_dedupe, ''));
    v_id uuid;
BEGIN
    IF p_user IS NULL OR length(btrim(coalesce(p_dedupe, ''))) < 8 THEN
        RAISE EXCEPTION 'invalid analytics event' USING ERRCODE = '22023';
    END IF;
    IF NOT v_staff THEN
        IF p_name NOT IN ('listing_view', 'listing_save', 'itinerary_inclusion')
           OR p_experience IS NULL
           OR NOT EXISTS (
               SELECT 1 FROM app.experiences
               WHERE id = p_experience AND organization_id = p_org AND status = 'published'
           ) THEN
            RAISE EXCEPTION 'capability denied: listings' USING ERRCODE = '42501';
        END IF;
    ELSIF p_experience IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_name NOT IN (
        'listing_view', 'listing_save', 'itinerary_inclusion',
        'booking_request', 'booking_confirmation', 'revenue'
    ) THEN
        RAISE EXCEPTION 'unknown analytics event' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.analytics_events (event_name, user_id, organization_id, experience_id, properties, dedupe_key)
    VALUES (p_name, p_user, p_org, p_experience, coalesce(p_properties, '{}'::jsonb), v_key)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM app.analytics_events WHERE dedupe_key = v_key;
    END IF;
    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.record_analytics_event(text, uuid, uuid, uuid, jsonb, text) FROM mshwar_backend;

-- ---- unsubscribe links --------------------------------------------------------
-- Each marketing email gets its own random token; only its SHA-256 is kept,
-- and it stops working after 180 days. The old per-user plain-text token is
-- carried over as a hash (so links already in inboxes keep working) and dropped.

CREATE TABLE IF NOT EXISTS app.unsubscribe_tokens (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS unsubscribe_tokens_user_idx ON app.unsubscribe_tokens (user_id, expires_at);
-- RLS on with no policy: the API role cannot read it; only the definer functions below can.
ALTER TABLE app.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.unsubscribe_tokens FROM PUBLIC;
REVOKE ALL ON app.unsubscribe_tokens FROM mshwar_backend;

CREATE OR REPLACE FUNCTION app.hash_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT encode(sha256(convert_to(btrim(coalesce(p_token, '')), 'UTF8')), 'hex')
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'user_private' AND column_name = 'unsubscribe_token'
    ) THEN
        INSERT INTO app.unsubscribe_tokens (token_hash, user_id, expires_at)
        SELECT app.hash_token(unsubscribe_token), user_id, now() + interval '180 days'
        FROM app.user_private
        WHERE unsubscribe_token IS NOT NULL
        ON CONFLICT (token_hash) DO NOTHING;
        ALTER TABLE app.user_private DROP COLUMN unsubscribe_token;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION app.issue_unsubscribe_token(p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
    IF p_user IS NULL THEN
        RETURN NULL;
    END IF;
    DELETE FROM app.unsubscribe_tokens WHERE user_id = p_user AND expires_at < now();
    INSERT INTO app.unsubscribe_tokens (token_hash, user_id, expires_at)
    VALUES (app.hash_token(v_token), p_user, now() + interval '180 days');
    RETURN v_token;
END;
$$;

-- Kept for callers from 020 (notification enqueue): now issues a fresh token.
CREATE OR REPLACE FUNCTION app.ensure_unsubscribe_token(p_user uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.issue_unsubscribe_token(p_user)
$$;

CREATE OR REPLACE FUNCTION app.unsubscribe_token_user(p_token text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user uuid;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 32 THEN
        RAISE EXCEPTION 'invalid unsubscribe token' USING ERRCODE = 'P0002';
    END IF;
    SELECT user_id INTO v_user
    FROM app.unsubscribe_tokens
    WHERE token_hash = app.hash_token(p_token) AND expires_at > now();
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'invalid unsubscribe token' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION app.lookup_unsubscribe_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user uuid := app.unsubscribe_token_user(p_token);
    v_email text;
    v_marketing boolean;
BEGIN
    SELECT email, marketing_consent INTO v_email, v_marketing FROM app.user_private WHERE user_id = v_user;
    -- The holder of a link learns only the email domain, never the account id.
    RETURN jsonb_build_object(
        'email_domain', CASE WHEN v_email LIKE '%@%' THEN split_part(v_email, '@', 2) END,
        'marketing_email', coalesce(v_marketing, false)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.unsubscribe_marketing(p_token text, p_source text DEFAULT 'unsubscribe_link')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user uuid := app.unsubscribe_token_user(p_token);
    v_prefs jsonb;
BEGIN
    v_prefs := app.set_communication_preferences(v_user, false, false, coalesce(p_source, 'unsubscribe_link'));
    RETURN jsonb_build_object(
        'marketing_email', v_prefs -> 'marketing_email',
        'marketing_in_app', v_prefs -> 'marketing_in_app',
        'transactional_email', v_prefs -> 'transactional_email'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_communication_preferences(p_user uuid)
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
        'transactional_email', coalesce(p.transactional_email, true),
        'marketing_email', coalesce(p.marketing_consent, false),
        'marketing_in_app', coalesce(p.marketing_in_app, false),
        'locale', (SELECT locale FROM app.users WHERE id = p_user)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.claim_notification_batch(p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_ids uuid[];
BEGIN
    WITH claimed AS (
        SELECT n.id
        FROM app.notifications n
        WHERE n.channel = 'email'
          AND n.status IN ('pending', 'failed')
          AND n.dead_lettered_at IS NULL
          AND n.next_retry_at <= now()
        ORDER BY n.next_retry_at, n.created_at
        LIMIT GREATEST(coalesce(p_limit, 25), 1)
        FOR UPDATE SKIP LOCKED
    )
    SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM claimed;

    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', n.id,
            'user_id', n.user_id,
            'outbox_id', n.outbox_id,
            'channel', n.channel,
            'category', n.category,
            'event_type', n.event_type,
            'title', n.title,
            'body', n.body,
            'deep_link', n.deep_link,
            'locale', n.locale,
            'attempts', n.attempts,
            'email', p.email,
            'display_name', u.display_name,
            'unsubscribe_token', CASE WHEN n.category = 'marketing' THEN app.issue_unsubscribe_token(n.user_id) END,
            'marketing_consent', p.marketing_consent,
            'transactional_email', p.transactional_email
        ))
        FROM app.notifications n
        JOIN app.users u ON u.id = n.user_id
        LEFT JOIN app.user_private p ON p.user_id = n.user_id
        WHERE n.id = ANY (v_ids)
    ), '[]'::jsonb);
END;
$$;

-- ---- reads the API used to make straight against tables --------------------

CREATE OR REPLACE FUNCTION app.account_identity(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', u.id,
        'email', p.email,
        'display_name', u.display_name,
        'locale', u.locale,
        'email_verified_at', u.email_verified_at
    )
    FROM app.users u
    JOIN app.user_private p ON p.user_id = u.id
    WHERE u.id = p_user
$$;

CREATE OR REPLACE FUNCTION app.claim_confirmation_emails(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'email', q.email, 'category', q.category, 'payload', q.payload, 'event_type', q.event_type
    ) ORDER BY q.created_at, q.id), '[]'::jsonb)
    FROM (
        SELECT n.id, p.email, n.category, o.payload, o.event_type, o.created_at
        FROM app.notifications n
        JOIN app.outbox o ON o.id = n.outbox_id
        JOIN app.user_private p ON p.user_id = n.user_id
        WHERE n.channel = 'email' AND n.status = 'pending' AND p.email IS NOT NULL
        ORDER BY o.created_at, n.id
        LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
        FOR UPDATE OF n SKIP LOCKED
    ) q
$$;

CREATE OR REPLACE FUNCTION app.mark_confirmation_email(p_notification uuid, p_sent boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    UPDATE app.notifications
    SET status = CASE WHEN p_sent THEN 'sent' ELSE 'failed' END,
        attempts = attempts + CASE WHEN p_sent THEN 0 ELSE 1 END
    WHERE id = p_notification
$$;

CREATE OR REPLACE FUNCTION app.latest_customer_payment(p_user uuid, p_booking uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT p.id
    FROM app.payments p
    JOIN app.bookings b ON b.id = p.booking_id
    WHERE p.booking_id = p_booking AND b.customer_id = p_user
    ORDER BY p.created_at DESC
    LIMIT 1
$$;

-- Scheduled jobs: these ran with the caller's rights, so under the API role
-- (tenant-scoped RLS, no organisation bound) they silently touched nothing.
ALTER FUNCTION app.expire_bookings(integer) SECURITY DEFINER SET search_path = app, public;
ALTER FUNCTION app.expire_idempotency_keys() SECURITY DEFINER SET search_path = app, public;

-- Deployed environments refuse to serve when the API connects as a role that
-- bypasses row-level security (app/core/db_role.py).
CREATE OR REPLACE FUNCTION app.connection_privileges()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'role', current_user,
        'superuser', r.rolsuper,
        'bypass_rls', r.rolbypassrls,
        'backend_member', pg_has_role(current_user, 'mshwar_backend', 'MEMBER')
    )
    FROM pg_roles r
    WHERE r.rolname = current_user
$$;

-- ---- grants ------------------------------------------------------------------

REVOKE ALL ON FUNCTION app.set_listing_status(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.admin_upsert_catalogue_collection(uuid, text, text, text, text, text, text, boolean, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.review_org_for(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.issue_unsubscribe_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.unsubscribe_token_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.account_identity(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.claim_confirmation_emails(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mark_confirmation_email(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.latest_customer_payment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.connection_privileges() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.hash_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.capture_org_event(uuid, uuid, uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.capture_org_event(uuid, uuid, uuid, text, jsonb, text) TO mshwar_backend;

GRANT EXECUTE ON FUNCTION app.set_listing_status(uuid, text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.admin_upsert_catalogue_collection(uuid, text, text, text, text, text, text, boolean, text, text[]) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.issue_unsubscribe_token(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.account_identity(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.claim_confirmation_emails(integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.mark_confirmation_email(uuid, boolean) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.latest_customer_payment(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.connection_privileges() TO mshwar_backend;
