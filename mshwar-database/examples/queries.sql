-- Parameter placeholders are illustrative $1 syntax for drivers that support it.
-- psycopg uses %s; always bind parameters rather than interpolating user input.

-- 1. Published, verified candidates within a radius in meters.
SELECT e.id,e.title,v.name,ST_Distance(v.location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance_m
FROM app.experiences e JOIN app.venues v ON v.id=e.venue_id
JOIN app.organizations o ON o.id=e.organization_id
WHERE e.status='published' AND o.status='active' AND o.verification='verified'
AND ST_DWithin(v.location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3)
ORDER BY v.location <-> ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,e.id LIMIT 50;

-- 2. Keyset pagination instead of large OFFSET scans.
SELECT id,status,created_at FROM app.bookings WHERE customer_id=$1
AND (created_at,id)<($2::timestamptz,$3::uuid) ORDER BY created_at DESC,id DESC LIMIT 30;

-- 3. Exact structured inventory retrieval; the planner applies hours/routing/group constraints.
SELECT s.id,s.starts_at,s.ends_at,s.capacity-s.reserved AS remaining,s.authoritative,s.observed_at
FROM app.slots s WHERE s.experience_id=$1 AND s.status='open'
AND s.starts_at>=$2 AND s.starts_at<$3 AND s.capacity-s.reserved>=$4 ORDER BY s.starts_at;

-- 4. RAG retrieval must join current approval/visibility and a compatible embedding model.
-- A filtered HNSW query can return fewer than LIMIT; bounded exact fallback may be needed.
SELECT c.id,c.body,d.id AS document_id,d.version,d.source_uri,c.embedding <=> $1::vector AS distance
FROM app.knowledge_chunks c JOIN app.knowledge_documents d ON d.id=c.document_id
LEFT JOIN app.experiences e ON e.id=d.experience_id
LEFT JOIN app.organizations o ON o.id=e.organization_id
WHERE c.embedding_model=$2 AND d.approved_at IS NOT NULL AND d.revoked_at IS NULL
AND (d.expires_at IS NULL OR d.expires_at>now())
AND (d.destination_id IS NOT NULL OR (e.status='published' AND o.status='active' AND o.verification='verified'))
ORDER BY c.embedding <=> $1::vector LIMIT 8;

-- 5. Outbox lease claim: short transaction; send outside it, acknowledge afterwards.
WITH jobs AS (
 SELECT id FROM app.outbox WHERE processed_at IS NULL AND available_at<=now()
 AND (claimed_until IS NULL OR claimed_until<now())
 ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 50
)
UPDATE app.outbox o SET claimed_until=now()+interval '2 minutes',attempts=o.attempts+1
FROM jobs WHERE jobs.id=o.id RETURNING o.*;
-- Receiver uses dedupe_key. Delivery is at-least-once, not exactly-once.

-- 6. Financial exceptions to investigate, not silently "repair" with a status update.
SELECT * FROM app.booking_financial_status WHERE needs_reconciliation;

-- 7. Hold expiry; schedule every minute and alert on oldest expired pending hold.
SELECT app.expire_bookings(100);

-- 8. Request-local identity with a pooled connection.
BEGIN;
SET LOCAL ROLE mshwar_reader;
SELECT set_config('app.user_id',$1,true); -- value comes from a validated session mapping
SELECT id,status,total_minor,currency FROM app.bookings ORDER BY created_at DESC LIMIT 30;
COMMIT;
