SET search_path = app, public;

-- ============================================================
-- Migration 021: Group planning, voting, reviews (Epic 11)
-- ============================================================
-- Shareable group links with view/vote/edit roles, guest join,
-- participant voting until lock, privacy-filtered summaries,
-- review eligibility, business replies, and honest aggregates.
-- Reviews are moderated for abuse but never rewritten.
-- Composes with Epic 6 moderation (hide/restore/escalate).

-- ---- trip lock + share-link extras ----------------------------------

ALTER TABLE app.trips
    ADD COLUMN IF NOT EXISTS locked_at timestamptz,
    ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES app.users(id);

ALTER TABLE app.trip_share_links
    ADD COLUMN IF NOT EXISTS allow_guest boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES app.users(id);

ALTER TABLE app.reviews
    ADD COLUMN IF NOT EXISTS dimensions jsonb NOT NULL DEFAULT '{}'
        CHECK (jsonb_typeof(dimensions) = 'object');

COMMENT ON COLUMN app.reviews.dimensions IS
    'Optional rating dimensions. The review body is immutable.';

-- ---- guests, suggestions, attributed votes --------------------------

CREATE TABLE IF NOT EXISTS app.guest_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash text NOT NULL UNIQUE,
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (length(btrim(display_name)) BETWEEN 1 AND 80)
);

CREATE TABLE IF NOT EXISTS app.trip_guests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES app.trips(id),
    guest_id uuid NOT NULL REFERENCES app.guest_identities(id),
    share_link_id uuid REFERENCES app.trip_share_links(id),
    role text NOT NULL CHECK (role IN ('view', 'vote', 'edit')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (trip_id, guest_id)
);

CREATE TABLE IF NOT EXISTS app.trip_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES app.trips(id),
    experience_id uuid REFERENCES app.experiences(id),
    term_id uuid REFERENCES app.taxonomy(id),
    added_by_user_id uuid REFERENCES app.users(id),
    added_by_guest_id uuid REFERENCES app.guest_identities(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(experience_id, term_id) = 1),
    UNIQUE NULLS NOT DISTINCT (trip_id, experience_id, term_id)
);

CREATE TABLE IF NOT EXISTS app.group_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES app.trips(id),
    user_id uuid REFERENCES app.users(id),
    guest_id uuid REFERENCES app.guest_identities(id),
    experience_id uuid REFERENCES app.experiences(id),
    term_id uuid REFERENCES app.taxonomy(id),
    value smallint NOT NULL CHECK (value IN (-1, 0, 1)),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(user_id, guest_id) = 1),
    CHECK (num_nonnulls(experience_id, term_id) = 1),
    CONSTRAINT group_votes_actor_target UNIQUE NULLS NOT DISTINCT (trip_id, user_id, guest_id, experience_id, term_id)
);

CREATE TABLE IF NOT EXISTS app.review_aggregates (
    experience_id uuid PRIMARY KEY REFERENCES app.experiences(id),
    rating_average numeric(4, 2),
    rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    distribution jsonb NOT NULL DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0}'::jsonb,
    low_sample boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.review_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES app.reviews(id),
    reporter_id uuid NOT NULL REFERENCES app.users(id),
    reason text NOT NULL,
    support_case_id uuid REFERENCES app.support_cases(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (length(btrim(reason)) BETWEEN 3 AND 500)
);

CREATE INDEX IF NOT EXISTS trip_share_links_trip_idx ON app.trip_share_links (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trip_guests_trip_idx ON app.trip_guests (trip_id);
CREATE INDEX IF NOT EXISTS trip_suggestions_trip_idx ON app.trip_suggestions (trip_id);
CREATE INDEX IF NOT EXISTS group_votes_trip_idx ON app.group_votes (trip_id);
CREATE INDEX IF NOT EXISTS review_reports_review_idx ON app.review_reports (review_id, created_at DESC);

-- ---- RLS ------------------------------------------------------------

ALTER TABLE app.guest_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guest_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trip_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trip_guests FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trip_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trip_suggestions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.group_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.group_votes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.review_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.review_aggregates FORCE ROW LEVEL SECURITY;
ALTER TABLE app.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.review_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_identity_none ON app.guest_identities;
CREATE POLICY guest_identity_none ON app.guest_identities FOR ALL TO mshwar_backend USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS trip_guest_member ON app.trip_guests;
CREATE POLICY trip_guest_member ON app.trip_guests FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.trips t
        WHERE t.id = trip_guests.trip_id
          AND (t.owner_id = app.current_user_id()
               OR EXISTS (SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id()))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.trips t
        WHERE t.id = trip_guests.trip_id
          AND (t.owner_id = app.current_user_id()
               OR EXISTS (SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id()))
    ));

DROP POLICY IF EXISTS trip_suggestion_member ON app.trip_suggestions;
CREATE POLICY trip_suggestion_member ON app.trip_suggestions FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.trips t
        WHERE t.id = trip_suggestions.trip_id
          AND (t.owner_id = app.current_user_id()
               OR EXISTS (SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id()))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.trips t
        WHERE t.id = trip_suggestions.trip_id
          AND (t.owner_id = app.current_user_id()
               OR EXISTS (SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id()))
    ));

DROP POLICY IF EXISTS group_vote_actor ON app.group_votes;
CREATE POLICY group_vote_actor ON app.group_votes FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id() OR EXISTS (
        SELECT 1 FROM app.trips t
        WHERE t.id = group_votes.trip_id AND t.owner_id = app.current_user_id()
    ))
    WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS review_aggregate_read ON app.review_aggregates;
CREATE POLICY review_aggregate_read ON app.review_aggregates FOR SELECT TO mshwar_backend USING (true);
DROP POLICY IF EXISTS review_aggregate_write ON app.review_aggregates;
CREATE POLICY review_aggregate_write ON app.review_aggregates FOR ALL TO mshwar_backend USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS review_report_own ON app.review_reports;
CREATE POLICY review_report_own ON app.review_reports FOR ALL TO mshwar_backend
    USING (reporter_id = app.current_user_id())
    WITH CHECK (reporter_id = app.current_user_id());

GRANT SELECT, INSERT, UPDATE ON app.guest_identities, app.trip_guests, app.trip_suggestions,
    app.group_votes, app.review_aggregates, app.review_reports TO mshwar_backend;
GRANT SELECT ON app.review_aggregates TO mshwar_reader;

-- ---- immutability ---------------------------------------------------

CREATE OR REPLACE FUNCTION app.forbid_review_response_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body THEN
        RAISE EXCEPTION 'review response text cannot be rewritten' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS review_responses_forbid_body_rewrite ON app.review_responses;
CREATE TRIGGER review_responses_forbid_body_rewrite
    BEFORE UPDATE ON app.review_responses
    FOR EACH ROW
    EXECUTE FUNCTION app.forbid_review_response_rewrite();

-- ---- owner is a member so votes/participants stay consistent --------

CREATE OR REPLACE FUNCTION app.ensure_trip_owner_member(p_trip uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_owner uuid;
BEGIN
    SELECT owner_id INTO v_owner FROM app.trips WHERE id = p_trip;
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.trip_members (trip_id, user_id, role, shared_preferences)
    VALUES (p_trip, v_owner, 'edit', '{}'::jsonb)
    ON CONFLICT (trip_id, user_id) DO NOTHING;
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
    PERFORM app.ensure_trip_owner_member(v_id);
    RETURN QUERY
        SELECT v_id, btrim(p_title), 'draft'::text, v_overrides;
END;
$$;

-- ---- role helpers ---------------------------------------------------

CREATE OR REPLACE FUNCTION app.group_role_rank(p_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_role
        WHEN 'owner' THEN 4
        WHEN 'edit' THEN 3
        WHEN 'vote' THEN 2
        WHEN 'view' THEN 1
        ELSE 0
    END
$$;

CREATE OR REPLACE FUNCTION app.actor_group_role(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_owner uuid;
    v_status text;
    v_role text;
BEGIN
    SELECT owner_id, status INTO v_owner, v_status FROM app.trips WHERE id = p_trip;
    IF v_owner IS NULL THEN
        RETURN NULL;
    END IF;
    IF p_user IS NOT NULL AND p_user = v_owner THEN
        RETURN 'owner';
    END IF;
    IF p_user IS NOT NULL THEN
        SELECT m.role INTO v_role FROM app.trip_members m WHERE m.trip_id = p_trip AND m.user_id = p_user;
        IF v_role IS NOT NULL THEN
            RETURN v_role;
        END IF;
    END IF;
    IF p_guest IS NOT NULL THEN
        SELECT g.role INTO v_role FROM app.trip_guests g WHERE g.trip_id = p_trip AND g.guest_id = p_guest;
        RETURN v_role;
    END IF;
    RETURN NULL;
END;
$$;

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
    IF v_role IS NULL OR app.group_role_rank(v_role) < app.group_role_rank(p_min) THEN
        RAISE EXCEPTION 'group permission denied' USING ERRCODE = '42501';
    END IF;
    RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION app.ensure_guest(p_token_hash text, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_name text := btrim(coalesce(p_display_name, 'Guest'));
BEGIN
    IF p_token_hash IS NULL OR length(p_token_hash) < 16 THEN
        RAISE EXCEPTION 'invalid guest session' USING ERRCODE = '22023';
    END IF;
    IF length(v_name) < 1 THEN
        v_name := 'Guest';
    END IF;
    INSERT INTO app.guest_identities (token_hash, display_name)
    VALUES (p_token_hash, left(v_name, 80))
    ON CONFLICT (token_hash) DO UPDATE
        SET display_name = CASE
            WHEN btrim(EXCLUDED.display_name) IN ('', 'Guest') THEN app.guest_identities.display_name
            ELSE EXCLUDED.display_name
        END
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- ---- share links ----------------------------------------------------

CREATE OR REPLACE FUNCTION app.create_share_link(
    p_owner uuid,
    p_trip uuid,
    p_token_hash text,
    p_role text,
    p_allow_guest boolean,
    p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_expires timestamptz;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = p_trip AND t.owner_id = p_owner AND t.status <> 'archived') THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_role NOT IN ('view', 'vote', 'edit') THEN
        RAISE EXCEPTION 'invalid share role' USING ERRCODE = '22023';
    END IF;
    IF p_token_hash IS NULL OR length(p_token_hash) < 16 THEN
        RAISE EXCEPTION 'invalid share token' USING ERRCODE = '22023';
    END IF;
    v_expires := coalesce(p_expires_at, now() + interval '30 days');
    IF v_expires <= now() THEN
        RAISE EXCEPTION 'share link already expired' USING ERRCODE = '22023';
    END IF;
    PERFORM app.ensure_trip_owner_member(p_trip);
    INSERT INTO app.trip_share_links (trip_id, token_hash, role, expires_at, allow_guest, created_by)
    VALUES (p_trip, p_token_hash, p_role, v_expires, coalesce(p_allow_guest, false), p_owner)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id,
        'trip_id', p_trip,
        'role', p_role,
        'allow_guest', coalesce(p_allow_guest, false),
        'expires_at', v_expires,
        'revoked_at', NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_share_links(p_owner uuid, p_trip uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = p_trip AND t.owner_id = p_owner) THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', l.id,
            'role', l.role,
            'allow_guest', l.allow_guest,
            'expires_at', l.expires_at,
            'revoked_at', l.revoked_at,
            'created_at', l.created_at
        ) ORDER BY l.created_at DESC)
        FROM app.trip_share_links l
        WHERE l.trip_id = p_trip
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.revoke_share_link(p_owner uuid, p_link uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_link app.trip_share_links;
BEGIN
    SELECT * INTO v_link FROM app.trip_share_links WHERE id = p_link FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'share link not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = v_link.trip_id AND t.owner_id = p_owner) THEN
        RAISE EXCEPTION 'share link not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.trip_share_links SET revoked_at = coalesce(revoked_at, now()) WHERE id = p_link
    RETURNING * INTO v_link;
    RETURN jsonb_build_object(
        'id', v_link.id,
        'trip_id', v_link.trip_id,
        'role', v_link.role,
        'allow_guest', v_link.allow_guest,
        'expires_at', v_link.expires_at,
        'revoked_at', v_link.revoked_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.peek_share_link(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_link app.trip_share_links;
    v_trip app.trips;
BEGIN
    SELECT * INTO v_link FROM app.trip_share_links WHERE token_hash = p_token_hash;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'share link not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_trip FROM app.trips WHERE id = v_link.trip_id;
    RETURN jsonb_build_object(
        'trip_id', v_trip.id,
        'title', v_trip.title,
        'status', v_trip.status,
        'role', v_link.role,
        'allow_guest', v_link.allow_guest,
        'expired', v_link.expires_at <= now(),
        'revoked', v_link.revoked_at IS NOT NULL,
        'joinable', v_link.revoked_at IS NULL AND v_link.expires_at > now() AND v_trip.status <> 'archived'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.join_share_link(
    p_token_hash text,
    p_user uuid,
    p_guest_hash text,
    p_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_link app.trip_share_links;
    v_trip app.trips;
    v_guest uuid;
    v_role text;
BEGIN
    SELECT * INTO v_link FROM app.trip_share_links WHERE token_hash = p_token_hash FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'share link not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_trip FROM app.trips WHERE id = v_link.trip_id FOR UPDATE;
    IF v_link.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'share link revoked' USING ERRCODE = '42501';
    END IF;
    IF v_link.expires_at <= now() THEN
        RAISE EXCEPTION 'share link expired' USING ERRCODE = '42501';
    END IF;
    IF v_trip.status = 'archived' THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app.ensure_trip_owner_member(v_trip.id);
    IF p_user IS NOT NULL THEN
        INSERT INTO app.trip_members (trip_id, user_id, role, shared_preferences)
        VALUES (v_trip.id, p_user, v_link.role, '{}'::jsonb)
        ON CONFLICT (trip_id, user_id) DO UPDATE
            SET role = CASE
                WHEN app.group_role_rank(app.trip_members.role) >= app.group_role_rank(EXCLUDED.role)
                    THEN app.trip_members.role
                ELSE EXCLUDED.role
            END;
        v_role := app.actor_group_role(v_trip.id, p_user, NULL);
        RETURN jsonb_build_object(
            'trip_id', v_trip.id,
            'title', v_trip.title,
            'status', v_trip.status,
            'role', v_role,
            'actor', 'user',
            'guest_id', NULL
        );
    END IF;
    IF NOT v_link.allow_guest THEN
        RAISE EXCEPTION 'guest join is not allowed' USING ERRCODE = '42501';
    END IF;
    v_guest := app.ensure_guest(p_guest_hash, p_display_name);
    INSERT INTO app.trip_guests (trip_id, guest_id, share_link_id, role)
    VALUES (v_trip.id, v_guest, v_link.id, v_link.role)
    ON CONFLICT (trip_id, guest_id) DO UPDATE
        SET role = CASE
            WHEN app.group_role_rank(app.trip_guests.role) >= app.group_role_rank(EXCLUDED.role)
                THEN app.trip_guests.role
            ELSE EXCLUDED.role
        END;
    v_role := app.actor_group_role(v_trip.id, NULL, v_guest);
    RETURN jsonb_build_object(
        'trip_id', v_trip.id,
        'title', v_trip.title,
        'status', v_trip.status,
        'role', v_role,
        'actor', 'guest',
        'guest_id', v_guest
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_group_participants(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_owner uuid;
    v_items jsonb;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'view');
    SELECT owner_id INTO v_owner FROM app.trips WHERE id = p_trip;
    SELECT coalesce(jsonb_agg(item ORDER BY item->>'joined_at'), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT jsonb_build_object(
            'kind', 'owner',
            'user_id', u.id,
            'guest_id', NULL,
            'display_name', u.display_name,
            'role', 'owner',
            'joined_at', t.created_at
        ) AS item
        FROM app.trips t
        JOIN app.users u ON u.id = t.owner_id
        WHERE t.id = p_trip
        UNION ALL
        SELECT jsonb_build_object(
            'kind', 'member',
            'user_id', u.id,
            'guest_id', NULL,
            'display_name', u.display_name,
            'role', m.role,
            'joined_at', t.created_at
        )
        FROM app.trip_members m
        JOIN app.trips t ON t.id = m.trip_id
        JOIN app.users u ON u.id = m.user_id
        WHERE m.trip_id = p_trip AND m.user_id <> v_owner
        UNION ALL
        SELECT jsonb_build_object(
            'kind', 'guest',
            'user_id', NULL,
            'guest_id', g.guest_id,
            'display_name', i.display_name,
            'role', g.role,
            'joined_at', g.created_at
        )
        FROM app.trip_guests g
        JOIN app.guest_identities i ON i.id = g.guest_id
        WHERE g.trip_id = p_trip
    ) listed;
    RETURN jsonb_build_object('items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION app.get_group_trip(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip app.trips;
    v_role text;
    v_locker text;
BEGIN
    v_role := app.require_group_role(p_trip, p_user, p_guest, 'view');
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip;
    IF v_trip.locked_by IS NOT NULL THEN
        SELECT display_name INTO v_locker FROM app.users WHERE id = v_trip.locked_by;
    END IF;
    RETURN jsonb_build_object(
        'id', v_trip.id,
        'title', v_trip.title,
        'status', v_trip.status,
        'role', v_role,
        'locked_at', v_trip.locked_at,
        'locked_by', v_trip.locked_by,
        'locked_by_name', v_locker,
        'can_share', v_role = 'owner',
        'can_vote', app.group_role_rank(v_role) >= app.group_role_rank('vote') AND v_trip.status = 'draft',
        'can_edit', app.group_role_rank(v_role) >= app.group_role_rank('edit') AND v_trip.status = 'draft',
        'can_lock', v_role = 'owner' AND v_trip.status = 'draft'
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.set_shared_preferences(
    p_trip uuid,
    p_user uuid,
    p_prefs jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_prefs jsonb := coalesce(p_prefs, '{}'::jsonb);
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, NULL, 'view');
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'group permission denied' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(v_prefs) <> 'object' THEN
        RAISE EXCEPTION 'invalid shared preferences' USING ERRCODE = '22023';
    END IF;
    PERFORM app.ensure_trip_owner_member(p_trip);
    INSERT INTO app.trip_members (trip_id, user_id, role, shared_preferences)
    VALUES (p_trip, p_user, 'view', v_prefs)
    ON CONFLICT (trip_id, user_id) DO UPDATE SET shared_preferences = v_prefs;
    RETURN jsonb_build_object('shared_preferences', v_prefs);
END;
$$;

-- ---- suggestions, votes, lock, tally, summary -----------------------

CREATE OR REPLACE FUNCTION app.add_trip_suggestion(
    p_trip uuid,
    p_user uuid,
    p_guest uuid,
    p_experience uuid,
    p_term uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_trip app.trips;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'edit');
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip;
    IF v_trip.status <> 'draft' THEN
        RAISE EXCEPTION 'trip is locked' USING ERRCODE = '42501';
    END IF;
    IF num_nonnulls(p_experience, p_term) <> 1 THEN
        RAISE EXCEPTION 'suggest an experience or a category' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.trip_suggestions (trip_id, experience_id, term_id, added_by_user_id, added_by_guest_id)
    VALUES (p_trip, p_experience, p_term, p_user, p_guest)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM app.trip_suggestions
        WHERE trip_id = p_trip
          AND experience_id IS NOT DISTINCT FROM p_experience
          AND term_id IS NOT DISTINCT FROM p_term;
    END IF;
    RETURN jsonb_build_object(
        'id', v_id,
        'trip_id', p_trip,
        'experience_id', p_experience,
        'term_id', p_term
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_trip_suggestions(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'view');
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', s.id,
            'experience_id', s.experience_id,
            'experience_title', e.title,
            'experience_slug', e.slug,
            'term_id', s.term_id,
            'term_slug', t.slug,
            'term_label', t.label,
            'kind', CASE WHEN s.experience_id IS NOT NULL THEN 'experience' ELSE 'category' END
        ) ORDER BY s.created_at)
        FROM app.trip_suggestions s
        LEFT JOIN app.experiences e ON e.id = s.experience_id
        LEFT JOIN app.taxonomy t ON t.id = s.term_id
        WHERE s.trip_id = p_trip
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.cast_group_vote(
    p_trip uuid,
    p_user uuid,
    p_guest uuid,
    p_experience uuid,
    p_term uuid,
    p_value integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip app.trips;
    v_id uuid;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'vote');
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip FOR UPDATE;
    IF v_trip.status <> 'draft' THEN
        RAISE EXCEPTION 'voting is closed' USING ERRCODE = '42501';
    END IF;
    IF p_value NOT IN (-1, 0, 1) THEN
        RAISE EXCEPTION 'invalid vote' USING ERRCODE = '22023';
    END IF;
    IF num_nonnulls(p_experience, p_term) <> 1 THEN
        RAISE EXCEPTION 'vote on an experience or a category' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM app.trip_suggestions s
        WHERE s.trip_id = p_trip
          AND s.experience_id IS NOT DISTINCT FROM p_experience
          AND s.term_id IS NOT DISTINCT FROM p_term
    ) THEN
        RAISE EXCEPTION 'suggestion not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.group_votes (trip_id, user_id, guest_id, experience_id, term_id, value)
    VALUES (p_trip, p_user, p_guest, p_experience, p_term, p_value)
    ON CONFLICT ON CONSTRAINT group_votes_actor_target DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
    RETURNING id INTO v_id;
    RETURN app.group_vote_tally(p_trip, p_user, p_guest);
END;
$$;

CREATE OR REPLACE FUNCTION app.group_vote_tally(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip app.trips;
    v_locker text;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'view');
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip;
    IF v_trip.locked_by IS NOT NULL THEN
        SELECT display_name INTO v_locker FROM app.users WHERE id = v_trip.locked_by;
    END IF;
    RETURN jsonb_build_object(
        'trip_id', p_trip,
        'status', v_trip.status,
        'locked_at', v_trip.locked_at,
        'locked_by', v_trip.locked_by,
        'locked_by_name', v_locker,
        'polled', true,
        'items', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'experience_id', s.experience_id,
                'term_id', s.term_id,
                'kind', CASE WHEN s.experience_id IS NOT NULL THEN 'experience' ELSE 'category' END,
                'label', coalesce(e.title, t.label),
                'yes', coalesce(v.yes_count, 0),
                'no', coalesce(v.no_count, 0),
                'abstain', coalesce(v.abstain_count, 0),
                'updated_at', v.updated_at
            ) ORDER BY coalesce(e.title, t.label))
            FROM app.trip_suggestions s
            LEFT JOIN app.experiences e ON e.id = s.experience_id
            LEFT JOIN app.taxonomy t ON t.id = s.term_id
            LEFT JOIN LATERAL (
                SELECT
                    count(*) FILTER (WHERE gv.value = 1) AS yes_count,
                    count(*) FILTER (WHERE gv.value = -1) AS no_count,
                    count(*) FILTER (WHERE gv.value = 0) AS abstain_count,
                    max(gv.updated_at) AS updated_at
                FROM app.group_votes gv
                WHERE gv.trip_id = s.trip_id
                  AND gv.experience_id IS NOT DISTINCT FROM s.experience_id
                  AND gv.term_id IS NOT DISTINCT FROM s.term_id
            ) v ON true
            WHERE s.trip_id = p_trip
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.lock_group_trip(p_owner uuid, p_trip uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip app.trips;
    v_name text;
BEGIN
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip AND owner_id = p_owner FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_trip.status = 'archived' THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.trips
    SET status = 'locked',
        locked_at = coalesce(locked_at, now()),
        locked_by = coalesce(locked_by, p_owner)
    WHERE id = p_trip
    RETURNING * INTO v_trip;
    SELECT display_name INTO v_name FROM app.users WHERE id = v_trip.locked_by;
    RETURN jsonb_build_object(
        'id', v_trip.id,
        'status', v_trip.status,
        'locked_at', v_trip.locked_at,
        'locked_by', v_trip.locked_by,
        'locked_by_name', v_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.group_recommendation_summary(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_items jsonb;
    v_agreement jsonb := '[]'::jsonb;
    v_disagreement jsonb := '[]'::jsonb;
    v_tradeoffs jsonb := '[]'::jsonb;
    v_shared jsonb := '[]'::jsonb;
    v_yes jsonb;
    v_no jsonb;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'view');
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'label', coalesce(e.title, tx.label),
        'kind', CASE WHEN s.experience_id IS NOT NULL THEN 'experience' ELSE 'category' END,
        'yes', coalesce(v.yes_count, 0),
        'no', coalesce(v.no_count, 0),
        'total', coalesce(v.yes_count, 0) + coalesce(v.no_count, 0)
    )), '[]'::jsonb)
    INTO v_items
    FROM app.trip_suggestions s
    LEFT JOIN app.experiences e ON e.id = s.experience_id
    LEFT JOIN app.taxonomy tx ON tx.id = s.term_id
    LEFT JOIN LATERAL (
        SELECT
            count(*) FILTER (WHERE gv.value = 1) AS yes_count,
            count(*) FILTER (WHERE gv.value = -1) AS no_count
        FROM app.group_votes gv
        WHERE gv.trip_id = s.trip_id
          AND gv.experience_id IS NOT DISTINCT FROM s.experience_id
          AND gv.term_id IS NOT DISTINCT FROM s.term_id
    ) v ON true
    WHERE s.trip_id = p_trip;

    SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
    INTO v_agreement
    FROM jsonb_array_elements(v_items) item
    WHERE (item->>'total')::int >= 1
      AND (item->>'yes')::int >= (item->>'no')::int
      AND (item->>'yes')::numeric / GREATEST((item->>'total')::numeric, 1) >= 0.67;

    SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
    INTO v_disagreement
    FROM jsonb_array_elements(v_items) item
    WHERE (item->>'total')::int >= 1
      AND (item->>'yes')::numeric / GREATEST((item->>'total')::numeric, 1) > 0.33
      AND (item->>'yes')::numeric / GREATEST((item->>'total')::numeric, 1) < 0.67;

    SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
    INTO v_yes
    FROM jsonb_array_elements(v_items) item
    WHERE (item->>'total')::int >= 1 AND (item->>'yes')::int > (item->>'no')::int;
    SELECT coalesce(jsonb_agg(item), '[]'::jsonb)
    INTO v_no
    FROM jsonb_array_elements(v_items) item
    WHERE (item->>'total')::int >= 1 AND (item->>'no')::int > (item->>'yes')::int;
    IF jsonb_array_length(v_yes) > 0 AND jsonb_array_length(v_no) > 0 THEN
        v_tradeoffs := jsonb_build_array(jsonb_build_object(
            'keep', v_yes,
            'drop', v_no,
            'note', 'The group is split: keep high-agreement items and drop the rest.'
        ));
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'preferences', m.shared_preferences - 'share'
    )), '[]'::jsonb)
    INTO v_shared
    FROM app.trip_members m
    WHERE m.trip_id = p_trip
      AND coalesce(m.shared_preferences->>'share', '') IN ('true', '1')
      AND m.shared_preferences - 'share' <> '{}'::jsonb;

    RETURN jsonb_build_object(
        'sources', jsonb_build_array('votes', 'shared_preferences'),
        'agreement', v_agreement,
        'disagreement', v_disagreement,
        'tradeoffs', v_tradeoffs,
        'shared_preferences', v_shared
    );
END;
$$;

-- ---- reviews --------------------------------------------------------

CREATE OR REPLACE FUNCTION app.review_is_public(p_moderation text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_moderation IS NULL OR p_moderation IN ('pending', 'approved', 'escalated')
$$;

CREATE OR REPLACE FUNCTION app.recompute_review_aggregates(p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_count integer := 0;
    v_avg numeric(4, 2);
    v_dist jsonb;
BEGIN
    SELECT
        count(*),
        round(avg(r.rating)::numeric, 2),
        jsonb_build_object(
            '1', count(*) FILTER (WHERE r.rating = 1),
            '2', count(*) FILTER (WHERE r.rating = 2),
            '3', count(*) FILTER (WHERE r.rating = 3),
            '4', count(*) FILTER (WHERE r.rating = 4),
            '5', count(*) FILTER (WHERE r.rating = 5)
        )
    INTO v_count, v_avg, v_dist
    FROM app.reviews r
    JOIN app.bookings b ON b.id = r.booking_id
    WHERE b.experience_id = p_experience
      AND app.review_is_public(r.moderation);

    INSERT INTO app.review_aggregates (experience_id, rating_average, rating_count, distribution, low_sample, updated_at)
    VALUES (p_experience, v_avg, v_count, v_dist, v_count < 3, now())
    ON CONFLICT (experience_id) DO UPDATE
        SET rating_average = EXCLUDED.rating_average,
            rating_count = EXCLUDED.rating_count,
            distribution = EXCLUDED.distribution,
            low_sample = EXCLUDED.low_sample,
            updated_at = now();

    RETURN jsonb_build_object(
        'experience_id', p_experience,
        'average', v_avg,
        'count', v_count,
        'distribution', v_dist,
        'low_sample', v_count < 3,
        'honest', CASE
            WHEN v_count = 0 THEN 'No verified traveller reviews yet.'
            WHEN v_count < 3 THEN 'Too few reviews to show a reliable average.'
            ELSE NULL
        END
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.review_eligibility(p_user uuid, p_experience uuid, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_experience uuid;
    v_items jsonb;
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    IF p_experience IS NOT NULL THEN
        v_experience := p_experience;
    ELSIF p_slug IS NOT NULL THEN
        SELECT id INTO v_experience FROM app.experiences WHERE slug = p_slug;
    END IF;
    IF v_experience IS NULL THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'booking_id', b.id,
        'experience_id', b.experience_id,
        'status', b.status,
        'eligible', b.status IN ('confirmed', 'completed') AND r.id IS NULL,
        'reviewed', r.id IS NOT NULL,
        'review_id', r.id
    ) ORDER BY b.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM app.bookings b
    LEFT JOIN app.reviews r ON r.booking_id = b.id
    WHERE b.customer_id = p_user AND b.experience_id = v_experience;
    RETURN jsonb_build_object(
        'experience_id', v_experience,
        'items', v_items,
        'can_review', EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_items) item
            WHERE (item->>'eligible')::boolean
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.submit_review(
    p_user uuid,
    p_booking uuid,
    p_rating integer,
    p_body text,
    p_dimensions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_booking app.bookings;
    v_id uuid;
    v_existing uuid;
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_booking FROM app.bookings WHERE id = p_booking FOR UPDATE;
    IF NOT FOUND OR v_booking.customer_id <> p_user THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_booking.status NOT IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION 'review requires a confirmed or completed stay' USING ERRCODE = '42501';
    END IF;
    IF p_rating NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'invalid rating' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(p_body, ''))) < 3 THEN
        RAISE EXCEPTION 'review text required' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_existing FROM app.reviews WHERE booking_id = p_booking;
    IF v_existing IS NOT NULL THEN
        RAISE EXCEPTION 'review already submitted' USING ERRCODE = '23505';
    END IF;
    INSERT INTO app.reviews (booking_id, author_id, rating, body, dimensions, moderation)
    VALUES (p_booking, p_user, p_rating, btrim(p_body), coalesce(p_dimensions, '{}'::jsonb), 'pending')
    RETURNING id INTO v_id;
    PERFORM app.recompute_review_aggregates(v_booking.experience_id);
    RETURN jsonb_build_object(
        'id', v_id,
        'booking_id', p_booking,
        'author_id', p_user,
        'rating', p_rating,
        'body', btrim(p_body),
        'dimensions', coalesce(p_dimensions, '{}'::jsonb),
        'moderation', 'pending',
        'verified', true
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.report_review(p_user uuid, p_review uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_review app.reviews;
    v_case uuid;
    v_report uuid;
    v_booking app.bookings;
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'reason required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_review FROM app.reviews WHERE id = p_review FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_booking FROM app.bookings WHERE id = v_review.booking_id;
    INSERT INTO app.support_cases (
        reporter_id, booking_id, experience_id, review_id, organization_id, reason, evidence, status
    )
    VALUES (
        p_user, v_review.booking_id, v_booking.experience_id, p_review, v_booking.organization_id,
        btrim(p_reason), '[]'::jsonb, 'open'
    )
    RETURNING id INTO v_case;
    INSERT INTO app.review_reports (review_id, reporter_id, reason, support_case_id)
    VALUES (p_review, p_user, btrim(p_reason), v_case)
    RETURNING id INTO v_report;
    IF v_review.moderation NOT IN ('hidden', 'rejected') THEN
        UPDATE app.reviews SET moderation = 'escalated' WHERE id = p_review AND body = v_review.body;
    END IF;
    INSERT INTO app.moderation_events (actor_id, entity_type, entity_id, action, reason, snapshot)
    VALUES (
        p_user, 'review', p_review, 'escalate', btrim(p_reason),
        jsonb_build_object('body', v_review.body, 'rating', v_review.rating, 'moderation', v_review.moderation)
    );
    RETURN jsonb_build_object(
        'id', v_report,
        'review_id', p_review,
        'support_case_id', v_case,
        'queued', true
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_public_reviews(p_experience uuid, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_experience uuid;
    v_agg jsonb;
BEGIN
    IF p_experience IS NOT NULL THEN
        v_experience := p_experience;
    ELSIF p_slug IS NOT NULL THEN
        SELECT id INTO v_experience FROM app.experiences WHERE slug = p_slug;
    END IF;
    IF v_experience IS NULL THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    v_agg := app.recompute_review_aggregates(v_experience);
    RETURN jsonb_build_object(
        'experience_id', v_experience,
        'aggregate', v_agg,
        'items', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', r.id,
                'rating', r.rating,
                'body', r.body,
                'dimensions', r.dimensions,
                'verified', true,
                'created_at', r.created_at,
                'response', CASE
                    WHEN rr.id IS NULL OR NOT app.review_is_public(rr.moderation) THEN NULL
                    ELSE jsonb_build_object(
                        'id', rr.id,
                        'body', rr.body,
                        'label', 'Business response',
                        'moderation', rr.moderation,
                        'created_at', rr.created_at
                    )
                END
            ) ORDER BY r.created_at DESC)
            FROM app.reviews r
            JOIN app.bookings b ON b.id = r.booking_id
            LEFT JOIN app.review_responses rr ON rr.review_id = r.id
            WHERE b.experience_id = v_experience
              AND app.review_is_public(r.moderation)
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_review_aggregates(p_experience uuid, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_experience uuid;
BEGIN
    IF p_experience IS NOT NULL THEN
        v_experience := p_experience;
    ELSIF p_slug IS NOT NULL THEN
        SELECT id INTO v_experience FROM app.experiences WHERE slug = p_slug;
    END IF;
    IF v_experience IS NULL THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.recompute_review_aggregates(v_experience);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_portal_reviews(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'bookings');
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', r.id,
            'rating', r.rating,
            'body', r.body,
            'moderation', r.moderation,
            'experience_id', e.id,
            'experience_title', e.title,
            'created_at', r.created_at,
            'response', CASE
                WHEN rr.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'id', rr.id,
                    'body', rr.body,
                    'label', 'Business response',
                    'moderation', rr.moderation,
                    'created_at', rr.created_at
                )
            END
        ) ORDER BY r.created_at DESC)
        FROM app.reviews r
        JOIN app.bookings b ON b.id = r.booking_id
        JOIN app.experiences e ON e.id = b.experience_id
        LEFT JOIN app.review_responses rr ON rr.review_id = r.id
        WHERE e.organization_id = p_org
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.respond_to_review(p_user uuid, p_review uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_review app.reviews;
    v_booking app.bookings;
    v_id uuid;
BEGIN
    SELECT * INTO v_review FROM app.reviews WHERE id = p_review FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_booking FROM app.bookings WHERE id = v_review.booking_id;
    PERFORM app.require_capability(p_user, v_booking.organization_id, 'bookings');
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
DECLARE
    v_org uuid;
BEGIN
    SELECT b.organization_id INTO v_org
    FROM app.reviews r
    JOIN app.bookings b ON b.id = r.booking_id
    WHERE r.id = p_review;
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app.require_capability(p_user, v_org, 'bookings');
    RAISE EXCEPTION 'businesses cannot edit, hide or delete reviews' USING ERRCODE = '42501';
END;
$$;

-- ---- compose Epic 6 moderation --------------------------------------

ALTER TABLE app.moderation_events DROP CONSTRAINT IF EXISTS moderation_events_entity_type_check;
ALTER TABLE app.moderation_events
    ADD CONSTRAINT moderation_events_entity_type_check
    CHECK (entity_type IN ('listing', 'image', 'review', 'review_response'));

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
    v_responses jsonb := '[]'::jsonb;
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
    IF p_type IS NULL OR p_type IN ('', 'all', 'review', 'review_response') THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'entity_type', 'review_response',
            'id', rr.id,
            'body', rr.body,
            'moderation', rr.moderation,
            'review_id', rr.review_id,
            'created_at', rr.created_at
        ) ORDER BY rr.created_at DESC), '[]'::jsonb)
        INTO v_responses
        FROM app.review_responses rr;
    END IF;
    RETURN jsonb_build_object(
        'listings', v_listings,
        'images', v_images,
        'reviews', v_reviews,
        'responses', v_responses
    );
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
    v_response app.review_responses;
    v_experience uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_entity_type NOT IN ('listing', 'image', 'review', 'review_response') THEN
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
    ELSIF p_entity_type = 'review_response' THEN
        SELECT * INTO v_response FROM app.review_responses WHERE id = p_entity_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'review response not found' USING ERRCODE = 'P0002';
        END IF;
        v_snapshot := jsonb_build_object(
            'body', v_response.body,
            'moderation', v_response.moderation
        );
        UPDATE app.review_responses
        SET moderation = CASE p_action
            WHEN 'hide' THEN 'hidden'
            WHEN 'restore' THEN 'approved'
            ELSE 'escalated'
        END
        WHERE id = p_entity_id AND body = v_response.body;
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
        WHERE id = p_entity_id AND body = v_review.body;
        SELECT b.experience_id INTO v_experience FROM app.bookings b WHERE b.id = v_review.booking_id;
        IF v_experience IS NOT NULL THEN
            PERFORM app.recompute_review_aggregates(v_experience);
        END IF;
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

-- ---- grants ---------------------------------------------------------

REVOKE ALL ON FUNCTION app.ensure_trip_owner_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.group_role_rank(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.actor_group_role(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.require_group_role(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ensure_guest(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_share_link(uuid, uuid, text, text, boolean, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_share_links(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.revoke_share_link(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.peek_share_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.join_share_link(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_group_participants(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_group_trip(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_shared_preferences(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.add_trip_suggestion(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_trip_suggestions(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cast_group_vote(uuid, uuid, uuid, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.group_vote_tally(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.lock_group_trip(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.group_recommendation_summary(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.review_eligibility(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.submit_review(uuid, uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.report_review(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_public_reviews(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_review_aggregates(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_portal_reviews(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.respond_to_review(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.forbid_business_review_mutation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.recompute_review_aggregates(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.ensure_trip_owner_member(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.group_role_rank(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.actor_group_role(uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.require_group_role(uuid, uuid, uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.ensure_guest(text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.create_share_link(uuid, uuid, text, text, boolean, timestamptz) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_share_links(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.revoke_share_link(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.peek_share_link(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.join_share_link(text, uuid, text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_group_participants(uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_group_trip(uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.set_shared_preferences(uuid, uuid, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.add_trip_suggestion(uuid, uuid, uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_trip_suggestions(uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.cast_group_vote(uuid, uuid, uuid, uuid, uuid, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.group_vote_tally(uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.lock_group_trip(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.group_recommendation_summary(uuid, uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.review_eligibility(uuid, uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.submit_review(uuid, uuid, integer, text, jsonb) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.report_review(uuid, uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_public_reviews(uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_review_aggregates(uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_portal_reviews(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.respond_to_review(uuid, uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.forbid_business_review_mutation(uuid, uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.recompute_review_aggregates(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.create_trip_draft(uuid, text, jsonb) TO mshwar_backend;
