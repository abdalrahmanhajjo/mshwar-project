SET search_path = app, public;
-- Private backend architecture; never add app to a public Data API schema list.
-- Migration login must be able to create NOLOGIN roles; provision separately if managed hosting restricts it.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mshwar_backend') THEN CREATE ROLE mshwar_backend NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='mshwar_reader') THEN CREATE ROLE mshwar_reader NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO mshwar_backend,mshwar_reader;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA app TO mshwar_backend;
-- The backend is trusted to perform endpoint and actor authorization. It is not a browser role.
GRANT DELETE ON app.favorites,app.votes,app.trip_members,app.trip_share_links,app.staff_invitations TO mshwar_backend;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.actor_id() TO mshwar_reader;
DO $$ DECLARE n text; BEGIN
 FOR n IN SELECT tablename FROM pg_tables WHERE schemaname='app' LOOP
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY backend_access ON app.%I TO mshwar_backend USING(true) WITH CHECK(true)',n);
 END LOOP;
END $$;
-- Restricted read connection: user id comes only from validated server session, never request JSON.
GRANT SELECT ON app.users,app.user_private,app.organization_members,app.trips,app.trip_members,
 app.trip_versions,app.trip_stops,app.trip_legs,app.trip_cost_items,app.bookings,app.favorites TO mshwar_reader;
CREATE POLICY own_user ON app.users FOR SELECT TO mshwar_reader USING(id=(SELECT app.actor_id()));
CREATE POLICY own_private ON app.user_private FOR SELECT TO mshwar_reader USING(user_id=(SELECT app.actor_id()));
CREATE POLICY own_memberships ON app.organization_members FOR SELECT TO mshwar_reader USING(user_id=(SELECT app.actor_id()) AND active);
CREATE POLICY own_trip_memberships ON app.trip_members FOR SELECT TO mshwar_reader USING(user_id=(SELECT app.actor_id()));
CREATE POLICY trip_access ON app.trips FOR SELECT TO mshwar_reader USING(owner_id=(SELECT app.actor_id()) OR
 EXISTS(SELECT 1 FROM app.trip_members m WHERE m.trip_id=trips.id AND m.user_id=(SELECT app.actor_id())));
CREATE POLICY version_access ON app.trip_versions FOR SELECT TO mshwar_reader USING(EXISTS(SELECT 1 FROM app.trips t WHERE t.id=trip_versions.trip_id));
CREATE POLICY stop_access ON app.trip_stops FOR SELECT TO mshwar_reader USING(EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id=trip_stops.version_id));
CREATE POLICY leg_access ON app.trip_legs FOR SELECT TO mshwar_reader USING(EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id=trip_legs.version_id));
CREATE POLICY cost_access ON app.trip_cost_items FOR SELECT TO mshwar_reader USING(EXISTS(SELECT 1 FROM app.trip_versions v WHERE v.id=trip_cost_items.version_id));
CREATE POLICY booking_access ON app.bookings FOR SELECT TO mshwar_reader USING(customer_id=(SELECT app.actor_id()) OR
 EXISTS(SELECT 1 FROM app.organization_members m WHERE m.organization_id=bookings.organization_id AND m.user_id=(SELECT app.actor_id())
 AND m.active AND m.role IN ('owner','manager','bookings','finance')));
CREATE POLICY favorite_access ON app.favorites FOR SELECT TO mshwar_reader USING(user_id=(SELECT app.actor_id()));
-- No grants to anon/authenticated; no public profile joins exposing customer identity.
