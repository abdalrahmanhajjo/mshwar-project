SET search_path = app, public;
-- Functions are SECURITY INVOKER and available only to the trusted backend role.
-- Backend authenticates session, sets app.user_id with SET LOCAL, and checks endpoint permissions.
CREATE FUNCTION app.reserve_booking(p_customer uuid,p_slot uuid,p_party integer,p_key text,p_hash text,
 p_price_rule uuid,p_policy uuid,p_payment_required boolean DEFAULT true,p_stop uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE s app.slots; e app.experiences; pr app.price_rules; pol app.policies; b app.bookings;
 total bigint; result uuid; mode text;
BEGIN
 IF p_customer IS DISTINCT FROM app.actor_id() THEN RAISE EXCEPTION 'actor mismatch'; END IF;
 IF p_party<=0 OR p_key IS NULL OR length(p_key)<8 OR p_hash IS NULL OR length(p_hash)<16 THEN RAISE EXCEPTION 'invalid request'; END IF;
 -- Same-user request retries serialize before inventory locking.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_customer::text||':'||p_key,0));
 SELECT * INTO b FROM app.bookings WHERE customer_id=p_customer AND request_key=p_key;
 IF FOUND THEN
  IF b.request_hash<>p_hash THEN RAISE EXCEPTION 'idempotency key reused for different request'; END IF;
  RETURN b.id;
 END IF;
 SELECT * INTO s FROM app.slots WHERE id=p_slot FOR UPDATE;
 IF NOT FOUND OR s.status<>'open' OR s.starts_at<=clock_timestamp() THEN RAISE EXCEPTION 'slot unavailable'; END IF;
 SELECT * INTO e FROM app.experiences WHERE id=s.experience_id FOR SHARE;
 IF e.status<>'published' OR NOT EXISTS(SELECT 1 FROM app.organizations WHERE id=e.organization_id AND status='active' AND verification='verified')
 THEN RAISE EXCEPTION 'experience not eligible'; END IF;
 IF p_party<e.min_party OR p_party>e.max_party THEN RAISE EXCEPTION 'party outside limits'; END IF;
 IF EXISTS(SELECT 1 FROM app.blackouts WHERE experience_id=e.id AND period && tstzrange(s.starts_at,s.ends_at,'[)'))
 THEN RAISE EXCEPTION 'slot blacked out'; END IF;
 mode:=e.booking_mode;
 IF mode='inquiry' THEN RAISE EXCEPTION 'use inquiry flow'; END IF;
 IF mode='instant' AND (NOT s.authoritative OR s.observed_at<clock_timestamp()-make_interval(secs=>e.freshness_seconds)) THEN mode:='request'; END IF;
 SELECT * INTO pr FROM app.price_rules WHERE id=p_price_rule AND experience_id=e.id AND valid_during @> s.starts_at;
 IF NOT FOUND OR pr.price_type<>'fixed' THEN RAISE EXCEPTION 'fixed valid quote required before reservation'; END IF;
 SELECT * INTO pol FROM app.policies WHERE id=p_policy AND experience_id=e.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid policy'; END IF;
 IF p_stop IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.trip_stops st JOIN app.trip_versions v ON v.id=st.version_id
 JOIN app.trips t ON t.id=v.trip_id WHERE st.id=p_stop AND st.experience_id=e.id AND v.sealed_at IS NOT NULL
 AND t.owner_id=p_customer) THEN RAISE EXCEPTION 'invalid itinerary booking link'; END IF;
 total:=pr.amount_minor * CASE WHEN pr.unit='person' THEN p_party ELSE 1 END;
 -- Initial implementation: fixed all-inclusive amount; tax/fee detail lives in the snapshot.
 IF s.authoritative THEN
  UPDATE app.slots SET reserved=reserved+p_party WHERE id=s.id AND reserved+p_party<=capacity;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient capacity'; END IF;
 END IF;
 INSERT INTO app.bookings(customer_id,organization_id,experience_id,slot_id,trip_stop_id,party_size,mode,
 hold_until,response_due_at,inventory_reserved,currency,total_minor,payment_required,price_snapshot,policy_snapshot,request_key,request_hash)
 VALUES(p_customer,e.organization_id,e.id,s.id,p_stop,p_party,mode,
 least(s.starts_at,clock_timestamp()+CASE WHEN mode='instant' THEN interval '15 minutes' ELSE interval '24 hours' END),
 CASE WHEN mode='request' THEN least(s.starts_at,clock_timestamp()+interval '24 hours') END,
 s.authoritative,pr.currency,total,p_payment_required AND total>0,
 jsonb_build_object('schema_version',1,'rule_id',pr.id,'unit',pr.unit,'unit_minor',pr.amount_minor,'quantity',p_party,
 'total_minor',total,'currency',pr.currency,'source',pr.source,'experience_title',e.title,'starts_at',s.starts_at,'ends_at',s.ends_at),
 jsonb_build_object('schema_version',1,'policy_id',pol.id,'version',pol.version,'rules',pol.cancellation_rules,'terms',pol.terms_text),p_key,p_hash)
 RETURNING id INTO result;
 RETURN result;
END $$;

CREATE FUNCTION app.transition_booking(p_booking uuid,p_status text,p_reason text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE b app.bookings; s app.slots;
BEGIN
 SELECT * INTO b FROM app.bookings WHERE id=p_booking FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
 IF b.status=p_status THEN RETURN; END IF;
 IF NULLIF(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'reason required'; END IF;
 -- Slot row serializes confirmation, release and competing reservations.
 SELECT * INTO s FROM app.slots WHERE id=b.slot_id FOR UPDATE;
 IF p_status='confirmed' THEN
  IF s.status<>'open' OR s.starts_at<=clock_timestamp() OR
   EXISTS(SELECT 1 FROM app.blackouts WHERE experience_id=b.experience_id AND period && tstzrange(s.starts_at,s.ends_at,'[)'))
  THEN RAISE EXCEPTION 'slot no longer available'; END IF;
  IF NOT b.inventory_reserved THEN
   IF NOT s.authoritative THEN RAISE EXCEPTION 'business must reconcile and mark capacity authoritative before confirming'; END IF;
   UPDATE app.slots SET reserved=reserved+b.party_size WHERE id=s.id AND reserved+b.party_size<=capacity;
   IF NOT FOUND THEN RAISE EXCEPTION 'insufficient capacity'; END IF;
   b.inventory_reserved:=true;
  END IF;
 ELSIF p_status IN ('cancelled','rejected','expired') AND b.inventory_reserved THEN
  UPDATE app.slots SET reserved=reserved-b.party_size WHERE id=s.id;
  b.inventory_reserved:=false;
 END IF;
 UPDATE app.bookings SET status=p_status,reason=p_reason,inventory_reserved=b.inventory_reserved WHERE id=p_booking;
END $$;

CREATE FUNCTION app.expire_bookings(p_limit integer DEFAULT 100) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE b record; n integer:=0;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid batch size'; END IF;
 FOR b IN SELECT id FROM app.bookings WHERE status='pending' AND hold_until<=clock_timestamp()
  ORDER BY hold_until,id FOR UPDATE SKIP LOCKED LIMIT p_limit LOOP
  PERFORM app.transition_booking(b.id,'expired','Reservation deadline elapsed'); n:=n+1;
 END LOOP;
 RETURN n;
END $$;

CREATE FUNCTION app.guard_inventory_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; expected bigint; actual integer;
BEGIN
 IF TG_TABLE_NAME='slots' THEN sid:=NEW.id; ELSE sid:=NEW.slot_id; END IF;
 SELECT reserved INTO actual FROM app.slots WHERE id=sid FOR UPDATE;
 SELECT coalesce(sum(party_size),0) INTO expected FROM app.bookings WHERE slot_id=sid AND inventory_reserved;
 IF actual<>expected THEN RAISE EXCEPTION 'inventory mismatch for slot %: counter %, bookings %',sid,actual,expected; END IF;
 IF EXISTS(SELECT 1 FROM app.bookings WHERE slot_id=sid AND
  ((status IN ('confirmed','completed') AND NOT inventory_reserved) OR
   (status IN ('rejected','cancelled','expired') AND inventory_reserved)))
 THEN RAISE EXCEPTION 'booking state/inventory mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER slot_consistency AFTER INSERT OR UPDATE ON app.slots DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION app.guard_inventory_consistency();
CREATE CONSTRAINT TRIGGER booking_consistency AFTER INSERT OR UPDATE ON app.bookings DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION app.guard_inventory_consistency();
-- Historical financial and booking rows cannot be deleted by normal operations.
CREATE TRIGGER booking_no_delete BEFORE DELETE ON app.bookings FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER payment_no_delete BEFORE DELETE ON app.payments FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER refund_no_delete BEFORE DELETE ON app.refunds FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();

CREATE VIEW app.booking_financial_status WITH(security_invoker=true) AS
WITH p AS (SELECT booking_id,sum(amount_minor) FILTER(WHERE status='succeeded') AS paid_minor,
 count(*) FILTER(WHERE status='succeeded') AS settlement_count FROM app.payments GROUP BY booking_id),
r AS (SELECT p.booking_id,sum(r.amount_minor) FILTER(WHERE r.status='succeeded') AS refunded_minor
 FROM app.payments p JOIN app.refunds r ON r.payment_id=p.id GROUP BY p.booking_id)
SELECT b.id,b.status,b.currency,b.total_minor,coalesce(p.paid_minor,0) AS paid_minor,
 coalesce(r.refunded_minor,0) AS refunded_minor,
 CASE WHEN coalesce(r.refunded_minor,0)>0 AND r.refunded_minor>=p.paid_minor THEN 'refunded'
 WHEN coalesce(r.refunded_minor,0)>0 THEN 'partially_refunded'
 WHEN coalesce(p.paid_minor,0)>=b.total_minor AND b.total_minor>0 THEN 'paid'
 WHEN b.total_minor=0 OR NOT b.payment_required THEN 'not_required' ELSE 'unpaid' END AS financial_status,
 ((b.payment_required AND b.status IN ('confirmed','completed') AND coalesce(p.paid_minor,0)<b.total_minor)
 OR (coalesce(p.paid_minor,0)>coalesce(r.refunded_minor,0) AND b.status IN ('expired','cancelled','rejected'))
 OR coalesce(p.settlement_count,0)>1) AS needs_reconciliation
FROM app.bookings b LEFT JOIN p ON p.booking_id=b.id LEFT JOIN r ON r.booking_id=b.id;

CREATE VIEW app.trip_totals WITH(security_invoker=true) AS
SELECT v.id,v.currency,coalesce((SELECT sum(estimated_minor) FROM app.trip_stops WHERE version_id=v.id),0)
 +coalesce((SELECT sum(estimated_minor) FROM app.trip_legs WHERE version_id=v.id),0)
 +coalesce((SELECT sum(amount_minor) FROM app.trip_cost_items WHERE version_id=v.id),0) AS total_minor
FROM app.trip_versions v;
