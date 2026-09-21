-- Synthetic only. Fixtures are deliberately labelled; not a real partner inventory.
SET search_path=app,public;
INSERT INTO app.users(id,auth_issuer,auth_subject,display_name) VALUES
 ('00000000-0000-0000-0000-000000000001','test','alice','Test Alice'),
 ('00000000-0000-0000-0000-000000000002','test','bob','Test Bob');
INSERT INTO app.organizations(id,name,slug,verification) VALUES
 ('10000000-0000-0000-0000-000000000001','Synthetic Mshwar Supplier','synthetic-mshwar','verified'),
 ('10000000-0000-0000-0000-000000000002','Other Synthetic Supplier','synthetic-other','verified');
INSERT INTO app.organization_members(organization_id,user_id,role) VALUES
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','owner');
INSERT INTO app.venues(id,organization_id,name,address,location,location_source) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Synthetic Beirut Venue','Synthetic address',
 ST_SetSRID(ST_MakePoint(35.5018,33.8938),4326)::geography,'synthetic');
INSERT INTO app.experiences(id,organization_id,venue_id,slug,title,status,booking_mode,duration_minutes,max_party,setting) VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 'synthetic-walk','Synthetic test walk','draft','instant',60,8,'outdoor');
INSERT INTO app.slots(id,experience_id,starts_at,ends_at,capacity,authoritative,source,observed_at) VALUES
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',now()+interval '7 days',now()+interval '7 days 1 hour',2,true,'synthetic',now());
INSERT INTO app.price_rules(id,experience_id,currency,price_type,unit,amount_minor,valid_during,source) VALUES
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','USD','fixed','person',2500,'(,)','synthetic');
INSERT INTO app.policies(id,experience_id,version,cancellation_rules,terms_text) VALUES
 ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'{"free_before_hours":24}','Synthetic policy; no commercial effect');
-- Instant mode may only be published once authoritative capacity exists (migration 019).
UPDATE app.experiences SET status='published' WHERE id='30000000-0000-0000-0000-000000000001';
