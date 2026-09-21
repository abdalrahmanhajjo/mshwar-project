SET search_path = app, public;
ALTER TABLE app.price_rules ADD CONSTRAINT range_requires_max CHECK(price_type<>'range' OR max_amount_minor IS NOT NULL);
ALTER TABLE app.bookings ADD CONSTRAINT cancellation_reason_required CHECK(status<>'cancelled' OR (reason IS NOT NULL AND length(trim(reason))>0));

CREATE FUNCTION app.guard_slot_contract() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.experience_id<>OLD.experience_id OR ((NEW.starts_at,NEW.ends_at) IS DISTINCT FROM (OLD.starts_at,OLD.ends_at)
 AND EXISTS(SELECT 1 FROM app.bookings WHERE slot_id=OLD.id)) THEN RAISE EXCEPTION 'booked slot identity/time is immutable'; END IF;
 IF OLD.authoritative AND NOT NEW.authoritative AND OLD.reserved>0 THEN RAISE EXCEPTION 'cannot downgrade allocated inventory'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER slot_contract BEFORE UPDATE ON app.slots FOR EACH ROW EXECUTE FUNCTION app.guard_slot_contract();

CREATE FUNCTION app.guard_new_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'create draft then validate and seal'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER new_version BEFORE INSERT ON app.trip_versions FOR EACH ROW EXECUTE FUNCTION app.guard_new_version();

CREATE FUNCTION app.guard_eval_case() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d uuid;
BEGIN
 d:=CASE WHEN TG_OP='DELETE' THEN OLD.dataset_id ELSE NEW.dataset_id END;
 PERFORM 1 FROM app.evaluation_datasets WHERE id=d FOR UPDATE;
 IF EXISTS(SELECT 1 FROM app.evaluation_datasets WHERE id=d AND sealed_at IS NOT NULL) THEN RAISE EXCEPTION 'evaluation dataset sealed'; END IF;
 IF TG_OP='UPDATE' AND NEW.dataset_id<>OLD.dataset_id THEN RAISE EXCEPTION 'cannot move evaluation case'; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER eval_case_guard BEFORE INSERT OR UPDATE OR DELETE ON app.evaluation_cases FOR EACH ROW EXECUTE FUNCTION app.guard_eval_case();
CREATE FUNCTION app.guard_eval_dataset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'sealed evaluation dataset immutable'; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER eval_dataset_guard BEFORE UPDATE OR DELETE ON app.evaluation_datasets FOR EACH ROW EXECUTE FUNCTION app.guard_eval_dataset();
CREATE FUNCTION app.guard_eval_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT dataset_id FROM app.evaluation_runs WHERE id=NEW.run_id) IS DISTINCT FROM
 (SELECT dataset_id FROM app.evaluation_cases WHERE id=NEW.case_id) THEN RAISE EXCEPTION 'evaluation dataset mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER eval_result_guard BEFORE INSERT OR UPDATE ON app.evaluation_results FOR EACH ROW EXECUTE FUNCTION app.guard_eval_result();
CREATE TRIGGER eval_result_immutable BEFORE UPDATE OR DELETE ON app.evaluation_results FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();

CREATE FUNCTION app.guard_review_response() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.reviews r JOIN app.bookings b ON b.id=r.booking_id
 JOIN app.organization_members m ON m.organization_id=b.organization_id WHERE r.id=NEW.review_id
 AND m.user_id=NEW.author_id AND m.active AND m.role IN ('owner','manager')) THEN RAISE EXCEPTION 'response author not authorized'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER review_response_guard BEFORE INSERT OR UPDATE ON app.review_responses FOR EACH ROW EXECUTE FUNCTION app.guard_review_response();
-- New trigger functions retain no PUBLIC execution privileges.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
