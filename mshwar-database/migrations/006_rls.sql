SET search_path = app, public;

-- ============================================================
-- Migration 006: Cross-Tenant RLS Policies
-- ============================================================
-- Revises the overly-permissive backend_access policies from migration 004
-- and enforces strict organization-scoped isolation.
-- All policies use app.current_organization_id() and app.current_user_id()
-- which read from SET LOCAL session context set by the FastAPI middleware.

-- Create session context helper functions
CREATE OR REPLACE FUNCTION app.current_organization_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

-- Ensure BYPASSRLS is revoked from all non-superuser roles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mshwar_backend' AND rolbypassrls) THEN
    ALTER ROLE mshwar_backend NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mshwar_reader' AND rolbypassrls) THEN
    ALTER ROLE mshwar_reader NOBYPASSRLS;
  END IF;
END $$;

-- Drop the overly-permissive backend_access policies from migration 004
DO $$ DECLARE n text; BEGIN
  FOR n IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('DROP POLICY IF EXISTS backend_access ON app.%I', n);
  END LOOP;
END $$;

-- ============================================================
-- Org-scoped policies (must filter by organization_id)
-- ============================================================

-- venues and experiences have organization_id
DO $$ DECLARE n text; BEGIN
  FOR n IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' AND tablename IN (
    'venues', 'experiences'
  ) LOOP
    EXECUTE format(
      'CREATE POLICY org_access ON app.%I FOR ALL TO mshwar_backend '
      'USING (organization_id = app.current_organization_id()) '
      'WITH CHECK (organization_id = app.current_organization_id())',
      n
    );
  END LOOP;
END $$;

-- slots, blackouts, price_rules, policies, media are scoped via experience_id
DO $$ DECLARE n text; BEGIN
  FOR n IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' AND tablename IN (
    'slots', 'blackouts', 'price_rules', 'policies', 'media'
  ) LOOP
    EXECUTE format(
      'CREATE POLICY org_access ON app.%I FOR ALL TO mshwar_backend '
      'USING (EXISTS (SELECT 1 FROM app.experiences e WHERE e.id = %I.experience_id AND e.organization_id = app.current_organization_id())) '
      'WITH CHECK (EXISTS (SELECT 1 FROM app.experiences e WHERE e.id = %I.experience_id AND e.organization_id = app.current_organization_id()))',
      n, n, n
    );
  END LOOP;
END $$;

-- bookings: must be scoped to organization_id
CREATE POLICY org_booking_access ON app.bookings FOR ALL TO mshwar_backend
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

-- reviews follow the booking's organization
CREATE POLICY org_review_access ON app.reviews FOR ALL TO mshwar_backend
  USING (EXISTS (
    SELECT 1 FROM app.bookings b
    WHERE b.id = reviews.booking_id AND b.organization_id = app.current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.bookings b
    WHERE b.id = reviews.booking_id AND b.organization_id = app.current_organization_id()
  ));

CREATE POLICY org_review_response_access ON app.review_responses FOR ALL TO mshwar_backend
  USING (EXISTS (
    SELECT 1 FROM app.reviews r
    JOIN app.bookings b ON b.id = r.booking_id
    WHERE r.id = review_responses.review_id AND b.organization_id = app.current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.reviews r
    JOIN app.bookings b ON b.id = r.booking_id
    WHERE r.id = review_responses.review_id AND b.organization_id = app.current_organization_id()
  ));

CREATE POLICY org_support_case_access ON app.support_cases FOR ALL TO mshwar_backend
  USING (
    reporter_id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM app.bookings b
      WHERE b.id = support_cases.booking_id AND b.organization_id = app.current_organization_id()
    )
    OR EXISTS (
      SELECT 1 FROM app.experiences e
      WHERE e.id = support_cases.experience_id AND e.organization_id = app.current_organization_id()
    )
  )
  WITH CHECK (
    reporter_id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM app.bookings b
      WHERE b.id = support_cases.booking_id AND b.organization_id = app.current_organization_id()
    )
    OR EXISTS (
      SELECT 1 FROM app.experiences e
      WHERE e.id = support_cases.experience_id AND e.organization_id = app.current_organization_id()
    )
  );

-- outbox has no tenant column; require a session organization
CREATE POLICY org_outbox_access ON app.outbox FOR ALL TO mshwar_backend
  USING (app.current_organization_id() IS NOT NULL)
  WITH CHECK (app.current_organization_id() IS NOT NULL);

CREATE POLICY user_notification_access ON app.notifications FOR ALL TO mshwar_backend
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- knowledge_documents: scoped by experience_id -> organization_id
CREATE POLICY org_knowledge_access ON app.knowledge_documents FOR ALL TO mshwar_backend
  USING (EXISTS(SELECT 1 FROM app.experiences e WHERE e.id = knowledge_documents.experience_id AND e.organization_id = app.current_organization_id()))
  WITH CHECK (EXISTS(SELECT 1 FROM app.experiences e WHERE e.id = knowledge_documents.experience_id AND e.organization_id = app.current_organization_id()));

CREATE POLICY org_analytics_access ON app.analytics_events FOR ALL TO mshwar_backend
  USING (
    organization_id = app.current_organization_id()
    OR EXISTS (
      SELECT 1 FROM app.experiences e
      WHERE e.id = analytics_events.experience_id AND e.organization_id = app.current_organization_id()
    )
  )
  WITH CHECK (
    organization_id = app.current_organization_id()
    OR EXISTS (
      SELECT 1 FROM app.experiences e
      WHERE e.id = analytics_events.experience_id AND e.organization_id = app.current_organization_id()
    )
  );

CREATE POLICY org_data_quality_access ON app.data_quality_issues FOR ALL TO mshwar_backend
  USING (EXISTS (
    SELECT 1 FROM app.experiences e
    WHERE e.id = data_quality_issues.experience_id AND e.organization_id = app.current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app.experiences e
    WHERE e.id = data_quality_issues.experience_id AND e.organization_id = app.current_organization_id()
  ));

-- ============================================================
-- User-scoped policies (must filter by user_id or owner_id)
-- ============================================================

-- trips: owner_id or trip_members
CREATE POLICY user_trip_access ON app.trips FOR ALL TO mshwar_backend
  USING (owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = trips.id AND m.user_id = app.current_user_id()))
  WITH CHECK (owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = trips.id AND m.user_id = app.current_user_id()));

-- trip_versions, trip_stops, trip_legs, trip_cost_items: follow trip ownership
CREATE POLICY user_trip_version_access ON app.trip_versions FOR ALL TO mshwar_backend
  USING (EXISTS(SELECT 1 FROM app.trips t WHERE t.id = trip_versions.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id()))))
  WITH CHECK (EXISTS(SELECT 1 FROM app.trips t WHERE t.id = trip_versions.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id()))));

CREATE POLICY user_trip_stop_access ON app.trip_stops FOR ALL TO mshwar_backend
  USING (EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id = trip_stops.version_id AND EXISTS(SELECT 1 FROM app.trips t WHERE t.id = v.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id())))))
  WITH CHECK (EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id = trip_stops.version_id AND EXISTS(SELECT 1 FROM app.trips t WHERE t.id = v.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id())))));

CREATE POLICY user_trip_leg_access ON app.trip_legs FOR ALL TO mshwar_backend
  USING (EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id = trip_legs.version_id AND EXISTS(SELECT 1 FROM app.trips t WHERE t.id = v.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id())))))
  WITH CHECK (EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id = trip_legs.version_id AND EXISTS(SELECT 1 FROM app.trips t WHERE t.id = v.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id())))));

CREATE POLICY user_trip_cost_access ON app.trip_cost_items FOR ALL TO mshwar_backend
  USING (EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id = trip_cost_items.version_id AND EXISTS(SELECT 1 FROM app.trips t WHERE t.id = v.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id())))))
  WITH CHECK (EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id = trip_cost_items.version_id AND EXISTS(SELECT 1 FROM app.trips t WHERE t.id = v.trip_id AND (t.owner_id = app.current_user_id() OR EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id = t.id AND m.user_id = app.current_user_id())))));

-- favorites, votes: user_id
CREATE POLICY user_favorite_access ON app.favorites FOR ALL TO mshwar_backend
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

CREATE POLICY user_vote_access ON app.votes FOR ALL TO mshwar_backend
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- trip_members: user is a member
CREATE POLICY user_trip_member_access ON app.trip_members FOR ALL TO mshwar_backend
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- user_private, consent_events: user_id
CREATE POLICY user_private_access ON app.user_private FOR SELECT TO mshwar_backend
  USING (user_id = app.current_user_id());

CREATE POLICY user_consent_access ON app.consent_events FOR ALL TO mshwar_backend
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- organizations: user must be a member
CREATE POLICY org_member_access ON app.organizations FOR ALL TO mshwar_backend
  USING (EXISTS(SELECT 1 FROM app.organization_members m WHERE m.organization_id = organizations.id AND m.user_id = app.current_user_id()))
  WITH CHECK (EXISTS(SELECT 1 FROM app.organization_members m WHERE m.organization_id = organizations.id AND m.user_id = app.current_user_id()));

CREATE POLICY org_member_access2 ON app.organization_members FOR ALL TO mshwar_backend
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- ============================================================
-- Revoke PUBLIC access and ensure mshwar_backend has proper grants
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;

-- Grant proper access to mshwar_backend
GRANT USAGE ON SCHEMA app TO mshwar_backend;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO mshwar_backend;
GRANT DELETE ON app.favorites, app.votes, app.trip_members, app.trip_share_links, app.staff_invitations TO mshwar_backend;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;

-- Grant SELECT to mshwar_reader on appropriate tables
GRANT SELECT ON app.users, app.user_private, app.organization_members, app.trips, app.trip_members,
  app.trip_versions, app.trip_stops, app.trip_legs, app.trip_cost_items, app.bookings, app.favorites TO mshwar_reader;

-- Verify all tables have RLS enabled and forced
DO $$ DECLARE n text; BEGIN
  FOR n IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', n);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', n);
  END LOOP;
END $$;