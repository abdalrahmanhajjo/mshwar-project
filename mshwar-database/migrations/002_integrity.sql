SET search_path = app, public;

CREATE FUNCTION app.actor_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('app.user_id',true),'')::uuid
$$;

CREATE FUNCTION app.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable record: %',TG_TABLE_NAME; END $$;

CREATE FUNCTION app.audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE oldj jsonb; newj jsonb; pk jsonb;
BEGIN
 oldj := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 newj := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 pk := jsonb_build_object('id',coalesce(newj->'id',oldj->'id'),
                         'organization_id',coalesce(newj->'organization_id',oldj->'organization_id'));
 -- Deliberately whitelist operational state; never log private profiles, prompts, contact info or payment payloads.
 INSERT INTO app.audit_log(actor_id,request_id,action,table_name,row_key,changes,reason)
 VALUES(app.actor_id(),current_setting('app.request_id',true),TG_OP,TG_TABLE_NAME,pk,
 jsonb_build_object('old_status',oldj->'status','new_status',newj->'status',
 'old_capacity',oldj->'capacity','new_capacity',newj->'capacity',
 'old_verification',oldj->'verification','new_verification',newj->'verification'),
 current_setting('app.reason',true));
 RETURN coalesce(NEW,OLD);
END $$;

CREATE FUNCTION app.check_booking_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE paid bigint;
BEGIN
 IF ROW(NEW.customer_id,NEW.organization_id,NEW.experience_id,NEW.slot_id,NEW.trip_stop_id,NEW.party_size,
 NEW.currency,NEW.total_minor,NEW.payment_required,NEW.price_snapshot,NEW.policy_snapshot,NEW.request_key,NEW.request_hash,NEW.mode)
 IS DISTINCT FROM ROW(OLD.customer_id,OLD.organization_id,OLD.experience_id,OLD.slot_id,OLD.trip_stop_id,OLD.party_size,
 OLD.currency,OLD.total_minor,OLD.payment_required,OLD.price_snapshot,OLD.policy_snapshot,OLD.request_key,OLD.request_hash,OLD.mode)
 THEN RAISE EXCEPTION 'booking contract is immutable'; END IF;
 IF NEW.status<>OLD.status THEN
  IF NOT ((OLD.status='pending' AND NEW.status IN ('confirmed','rejected','cancelled','expired')) OR
          (OLD.status='confirmed' AND NEW.status IN ('cancelled','completed')))
  THEN RAISE EXCEPTION 'invalid booking transition % -> %',OLD.status,NEW.status; END IF;
  IF NEW.status='confirmed' THEN
   IF OLD.hold_until<=clock_timestamp() THEN RAISE EXCEPTION 'booking hold expired'; END IF;
   IF NOT NEW.inventory_reserved THEN RAISE EXCEPTION 'confirmation requires capacity'; END IF;
   SELECT coalesce(sum(amount_minor),0) INTO paid FROM app.payments WHERE booking_id=NEW.id AND status='succeeded';
   IF NEW.payment_required AND paid<NEW.total_minor THEN RAISE EXCEPTION 'payment not settled'; END IF;
  END IF;
  IF NEW.status='completed' AND (SELECT ends_at FROM app.slots WHERE id=NEW.slot_id)>clock_timestamp()
  THEN RAISE EXCEPTION 'cannot complete before service ends'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_guard BEFORE UPDATE ON app.bookings FOR EACH ROW EXECUTE FUNCTION app.check_booking_update();

CREATE FUNCTION app.booking_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior text; event_uuid uuid;
BEGIN
 prior := CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END;
 IF TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO app.booking_events(booking_id,actor_id,from_status,to_status,reason)
  VALUES(NEW.id,app.actor_id(),prior,NEW.status,NEW.reason) RETURNING id INTO event_uuid;
  INSERT INTO app.outbox(event_type,aggregate_id,dedupe_key,payload)
  VALUES('booking.'||NEW.status,NEW.id,event_uuid::text,jsonb_build_object('booking_id',NEW.id,'status',NEW.status));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_event AFTER INSERT OR UPDATE ON app.bookings FOR EACH ROW EXECUTE FUNCTION app.booking_event();

CREATE FUNCTION app.guard_trip_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
 v:=CASE WHEN TG_OP='DELETE' THEN OLD.version_id ELSE NEW.version_id END;
 PERFORM 1 FROM app.trip_versions WHERE id=v FOR UPDATE;
 IF EXISTS(SELECT 1 FROM app.trip_versions WHERE id=v AND sealed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'sealed itinerary cannot change'; END IF;
 IF TG_OP='UPDATE' AND NEW.version_id<>OLD.version_id THEN RAISE EXCEPTION 'cannot move itinerary child'; END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER stop_guard BEFORE INSERT OR UPDATE OR DELETE ON app.trip_stops FOR EACH ROW EXECUTE FUNCTION app.guard_trip_child();
CREATE TRIGGER leg_guard BEFORE INSERT OR UPDATE OR DELETE ON app.trip_legs FOR EACH ROW EXECUTE FUNCTION app.guard_trip_child();
CREATE TRIGGER cost_guard BEFORE INSERT OR UPDATE OR DELETE ON app.trip_cost_items FOR EACH ROW EXECUTE FUNCTION app.guard_trip_child();

CREATE FUNCTION app.guard_trip_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric; n integer;
BEGIN
 IF OLD.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'sealed version is immutable; create a new version'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.sealed_at IS NOT NULL THEN
  SELECT count(*),coalesce(sum(estimated_minor),0) INTO n,total FROM app.trip_stops WHERE version_id=NEW.id;
  IF n=0 THEN RAISE EXCEPTION 'empty itinerary'; END IF;
  total:=total+coalesce((SELECT sum(estimated_minor) FROM app.trip_legs WHERE version_id=NEW.id),0)
              +coalesce((SELECT sum(amount_minor) FROM app.trip_cost_items WHERE version_id=NEW.id),0);
  IF NEW.strict_budget AND total>NEW.budget_minor THEN RAISE EXCEPTION 'strict budget exceeded'; END IF;
  IF EXISTS(SELECT 1 FROM app.trip_stops s JOIN app.experiences e ON e.id=s.experience_id
   JOIN app.organizations o ON o.id=e.organization_id WHERE s.version_id=NEW.id
   AND (s.starts_at<NEW.window_start OR s.ends_at>NEW.return_by OR e.status<>'published'
        OR o.status<>'active' OR o.verification<>'verified'))
  THEN RAISE EXCEPTION 'ineligible stop or time window'; END IF;
  IF (SELECT max(position) FROM app.trip_stops WHERE version_id=NEW.id)<>n THEN RAISE EXCEPTION 'non-contiguous stop order'; END IF;
  -- The deterministic service must validate hours, travel, currencies, party fit and provider freshness.
  IF NEW.validation->>'feasible' IS DISTINCT FROM 'true' OR NULLIF(NEW.validation->>'validator_version','') IS NULL
  THEN RAISE EXCEPTION 'deterministic validation required'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER version_guard BEFORE UPDATE OR DELETE ON app.trip_versions FOR EACH ROW EXECUTE FUNCTION app.guard_trip_version();

CREATE FUNCTION app.guard_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.bookings WHERE id=NEW.booking_id AND customer_id=NEW.author_id AND status='completed')
 THEN RAISE EXCEPTION 'review requires own completed booking'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER review_guard BEFORE INSERT OR UPDATE OF booking_id,author_id ON app.reviews FOR EACH ROW EXECUTE FUNCTION app.guard_review();

CREATE FUNCTION app.guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b app.bookings;
BEGIN
 SELECT * INTO b FROM app.bookings WHERE id=NEW.booking_id FOR UPDATE;
 IF NEW.amount_minor<>b.total_minor OR NEW.currency<>b.currency OR NOT b.payment_required
 THEN RAISE EXCEPTION 'payment amount/currency does not match booking'; END IF;
 IF TG_OP='INSERT' AND (b.status<>'pending' OR b.hold_until<=clock_timestamp()) THEN RAISE EXCEPTION 'booking not payable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.booking_id,NEW.currency,NEW.provider,NEW.provider_account,NEW.live_mode,NEW.amount_minor,NEW.idempotency_key)
   IS DISTINCT FROM ROW(OLD.booking_id,OLD.currency,OLD.provider,OLD.provider_account,OLD.live_mode,OLD.amount_minor,OLD.idempotency_key)
   OR (OLD.external_id IS NOT NULL AND NEW.external_id IS DISTINCT FROM OLD.external_id)
  THEN RAISE EXCEPTION 'immutable payment identifiers/amount'; END IF;
  IF OLD.status<>NEW.status AND NOT ((OLD.status='created' AND NEW.status IN ('pending','succeeded','failed','cancelled')) OR
    (OLD.status='pending' AND NEW.status IN ('succeeded','failed','cancelled')) OR
    (OLD.status IN ('failed','cancelled') AND NEW.status='succeeded'))
  THEN RAISE EXCEPTION 'invalid payment transition'; END IF;
 END IF;
 -- Late settlement is always recorded, even after cancellation; reconciliation initiates refund.
 RETURN NEW;
END $$;
CREATE TRIGGER payment_guard BEFORE INSERT OR UPDATE ON app.payments FOR EACH ROW EXECUTE FUNCTION app.guard_payment();
CREATE UNIQUE INDEX one_open_payment_per_booking ON app.payments(booking_id) WHERE status IN ('created','pending');

CREATE FUNCTION app.guard_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p app.payments; used numeric;
BEGIN
 SELECT * INTO p FROM app.payments WHERE id=NEW.payment_id FOR UPDATE;
 IF p.status<>'succeeded' THEN RAISE EXCEPTION 'refund requires settled payment'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.payment_id,NEW.amount_minor,NEW.idempotency_key) IS DISTINCT FROM ROW(OLD.payment_id,OLD.amount_minor,OLD.idempotency_key)
  THEN RAISE EXCEPTION 'immutable refund contract'; END IF;
  IF OLD.status<>NEW.status AND NOT ((OLD.status='requested' AND NEW.status IN ('pending','succeeded','failed')) OR
  (OLD.status='pending' AND NEW.status IN ('succeeded','failed')) OR (OLD.status='failed' AND NEW.status='succeeded'))
  THEN RAISE EXCEPTION 'invalid refund transition'; END IF;
 END IF;
 SELECT coalesce(sum(amount_minor),0) INTO used FROM app.refunds WHERE payment_id=NEW.payment_id AND id<>NEW.id AND status<>'failed';
 IF NEW.status<>'failed' AND used+NEW.amount_minor>p.amount_minor THEN RAISE EXCEPTION 'refund exceeds payment'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER refund_guard BEFORE INSERT OR UPDATE ON app.refunds FOR EACH ROW EXECUTE FUNCTION app.guard_refund();

CREATE FUNCTION app.guard_vote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM app.trips WHERE id=NEW.trip_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM app.trips WHERE id=NEW.trip_id AND status='draft') OR
 NOT EXISTS(SELECT 1 FROM app.trip_members WHERE trip_id=NEW.trip_id AND user_id=NEW.user_id AND role IN ('vote','edit'))
 THEN RAISE EXCEPTION 'trip locked or voter lacks permission'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vote_guard BEFORE INSERT OR UPDATE ON app.votes FOR EACH ROW EXECUTE FUNCTION app.guard_vote();

DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['policies','booking_events','audit_log','verification_events','consent_events','configuration_versions','commission_terms','recommendation_runs','recommendation_candidates','retrieval_sources'] LOOP
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.reject_mutation()',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['organizations','organization_members','experiences','slots','price_rules','bookings','payments','refunds','configuration_versions','verification_events','reviews'] LOOP
 EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.audit_change()',n);
 END LOOP;
END $$;
