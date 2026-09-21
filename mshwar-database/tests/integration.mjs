import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { vector } from "@electric-sql/pglite-pgvector";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite({ extensions: { postgis, vector, btree_gist, pg_trgm } });
const report = [];
const sql = (s, p = []) => db.query(s, p);
const one = async (s, p = []) => (await sql(s, p)).rows[0];
const good = async (name, fn) => {
  await fn();
  report.push({ name, status: "PASS" });
  console.log("PASS", name);
};
const bad = async (name, s, pattern) =>
  good(name, async () => {
    await db.exec("BEGIN");
    let rejected = false;
    try {
      await db.exec(s);
      await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    } catch (e) {
      assert.match(e.message, pattern);
      rejected = true;
    } finally {
      await db.exec("ROLLBACK");
    }
    assert.ok(rejected, "expected rejection");
  });
const alice = "00000000-0000-0000-0000-000000000001",
  bob = "00000000-0000-0000-0000-000000000002";
const slot = "40000000-0000-0000-0000-000000000001",
  exp = "30000000-0000-0000-0000-000000000001";
const price = "50000000-0000-0000-0000-000000000001",
  policy = "60000000-0000-0000-0000-000000000001";
const reserve = (key = "test-key-001", hash = "0123456789abcdef", party = 2) =>
  `SELECT app.reserve_booking('${alice}','${slot}',${party},'${key}','${hash}','${price}','${policy}',true) AS id`;
const migrationFiles = fs
  .readdirSync(root + "/migrations")
  .filter((x) => x.endsWith(".sql"))
  .sort();
try {
  for (const f of migrationFiles) {
    await db.exec(fs.readFileSync(root + "/migrations/" + f, "utf8"));
    console.log("APPLIED", f);
  }
  await db.exec(fs.readFileSync(root + "/tests/seed.sql", "utf8"));
  await sql("SELECT set_config('app.user_id',$1,false)", [alice]);
  await good("all app tables have forced RLS", async () =>
    assert.ok(
      (
        await one(
          "SELECT count(*)::int AS n FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname WHERE t.schemaname='app' AND c.relrowsecurity AND c.relforcerowsecurity",
        )
      ).n >= 66,
    ),
  );
  await good("PostGIS distance uses meters", async () =>
    assert.equal(
      (
        await one(
          `SELECT ST_DWithin(location,ST_SetSRID(ST_MakePoint(35.5018,33.8938),4326)::geography,10) AS ok FROM app.venues WHERE id='20000000-0000-0000-0000-000000000001'`,
        )
      ).ok,
      true,
    ),
  );
  await good("pgvector cosine operator available", async () =>
    assert.equal((await one("SELECT '[1,0,0]'::vector <=> '[1,0,0]'::vector AS d")).d, 0),
  );
  await bad(
    "cross-organization venue assignment rejected",
    `UPDATE app.experiences SET organization_id='10000000-0000-0000-0000-000000000002' WHERE id='${exp}'`,
    /foreign key/,
  );
  await bad(
    "overlapping price periods rejected",
    `INSERT INTO app.price_rules(experience_id,currency,price_type,unit,amount_minor,valid_during,source) VALUES('${exp}','USD','fixed','person',1,'(,)','test')`,
    /exclusion/,
  );
  await bad(
    "negative prices rejected",
    `UPDATE app.price_rules SET amount_minor=-1 WHERE id='${price}'`,
    /check constraint/,
  );
  await bad(
    "incomplete range price rejected",
    `UPDATE app.price_rules SET price_type='range',max_amount_minor=NULL WHERE id='${price}'`,
    /check constraint/,
  );
  await bad("invalid capacity rejected", `UPDATE app.slots SET capacity=0 WHERE id='${slot}'`, /check constraint/);
  await bad(
    "actor spoof in reservation rejected",
    `SELECT set_config('app.user_id','${bob}',true); ${reserve()}`,
    /actor mismatch/,
  );
  let booking;
  await good("atomic reservation calculates 2 x USD 25 and allocates capacity", async () => {
    booking = (await one(reserve())).id;
    assert.equal((await one("SELECT total_minor::int AS n FROM app.bookings WHERE id=$1", [booking])).n, 5000);
    assert.equal((await one("SELECT reserved FROM app.slots WHERE id=$1", [slot])).reserved, 2);
  });
  await good("idempotent retry returns original booking", async () => assert.equal((await one(reserve())).id, booking));
  await bad("idempotency conflict rejected", reserve("test-key-001", "different-hash-123456"), /idempotency/);
  await bad("no remaining capacity rejected", reserve("test-key-002"), /insufficient capacity/);
  await bad(
    "unpaid confirmation rejected",
    `SELECT app.transition_booking('${booking}','confirmed','test')`,
    /payment not settled/,
  );
  await bad(
    "booking price snapshot immutable",
    `UPDATE app.bookings SET price_snapshot='{}' WHERE id='${booking}'`,
    /immutable/,
  );
  await bad(
    "booked slot time immutable",
    `UPDATE app.slots SET starts_at=starts_at+interval '1 minute' WHERE id='${slot}'`,
    /immutable/,
  );
  await bad(
    "counter cannot drift from reservations",
    `UPDATE app.slots SET reserved=0 WHERE id='${slot}'`,
    /inventory mismatch/,
  );
  await bad(
    "payment amount mismatch rejected",
    `INSERT INTO app.payments(booking_id,currency,provider,provider_account,idempotency_key,amount_minor) VALUES('${booking}','USD','test','a','wrong',4000)`,
    /amount/,
  );
  let payment;
  await good("settled payment permits confirmation", async () => {
    payment = (
      await one(
        `INSERT INTO app.payments(booking_id,currency,provider,provider_account,idempotency_key,amount_minor) VALUES('${booking}','USD','test','a','pay-001',5000) RETURNING id`,
      )
    ).id;
    await sql("UPDATE app.payments SET status='succeeded' WHERE id=$1", [payment]);
    await sql("SELECT app.transition_booking($1,'confirmed','Test settlement')", [booking]);
    assert.equal((await one("SELECT status FROM app.bookings WHERE id=$1", [booking])).status, "confirmed");
  });
  await bad(
    "payment settlement cannot regress",
    `UPDATE app.payments SET status='pending' WHERE id='${payment}'`,
    /invalid payment transition/,
  );
  await bad(
    "invalid booking transition rejected",
    `SELECT app.transition_booking('${booking}','pending','test')`,
    /invalid booking transition/,
  );
  await bad(
    "completion before service ends rejected",
    `SELECT app.transition_booking('${booking}','completed','test')`,
    /before service ends/,
  );
  await bad(
    "review before completed interaction rejected",
    `INSERT INTO app.reviews(booking_id,author_id,rating,body) VALUES('${booking}','${alice}',5,'test')`,
    /completed booking/,
  );
  await bad(
    "refund above paid amount rejected",
    `INSERT INTO app.refunds(payment_id,amount_minor,idempotency_key,reason) VALUES('${payment}',5001,'too-much','test')`,
    /exceeds payment/,
  );
  await good("partial refund is separate from booking state", async () => {
    await sql(
      `INSERT INTO app.refunds(payment_id,amount_minor,idempotency_key,reason,status) VALUES('${payment}',1000,'partial','test','succeeded')`,
    );
    const r = await one("SELECT financial_status,status FROM app.booking_financial_status WHERE id=$1", [booking]);
    assert.equal(r.financial_status, "partially_refunded");
    assert.equal(r.status, "confirmed");
  });
  await bad(
    "aggregate refunds cannot exceed settlement",
    `INSERT INTO app.refunds(payment_id,amount_minor,idempotency_key,reason) VALUES('${payment}',4001,'sum-over','test')`,
    /exceeds payment/,
  );
  await good("cancellation releases seats and flags outstanding refund", async () => {
    await sql("SELECT app.transition_booking($1,'cancelled','Supplier cancelled')", [booking]);
    assert.equal((await one("SELECT reserved FROM app.slots WHERE id=$1", [slot])).reserved, 0);
    assert.equal(
      (await one("SELECT needs_reconciliation FROM app.booking_financial_status WHERE id=$1", [booking]))
        .needs_reconciliation,
      true,
    );
  });
  await good("repeated cancellation does not release twice", async () => {
    await sql("SELECT app.transition_booking($1,'cancelled','retry')", [booking]);
    assert.equal((await one("SELECT reserved FROM app.slots WHERE id=$1", [slot])).reserved, 0);
  });
  await good("expiry releases hold and allows new reservation", async () => {
    const b = (await one(reserve("expiry-key"))).id;
    await sql("UPDATE app.bookings SET hold_until=now()-interval '1 minute' WHERE id=$1", [b]);
    assert.equal((await one("SELECT app.expire_bookings() AS n")).n, 1);
    assert.equal((await one("SELECT reserved FROM app.slots WHERE id=$1", [slot])).reserved, 0);
  });
  await good("stale instant inventory downgrades to request", async () => {
    await sql("UPDATE app.slots SET observed_at=now()-interval '3 days' WHERE id=$1", [slot]);
    const b = (await one(reserve("stale-key"))).id;
    assert.equal((await one("SELECT mode FROM app.bookings WHERE id=$1", [b])).mode, "request");
    await sql("SELECT app.transition_booking($1,'cancelled','test cleanup')", [b]);
  });
  await good("booking state changes enqueue durable notifications", async () =>
    assert.ok((await one("SELECT count(*)::int AS n FROM app.outbox")).n >= 5),
  );
  await bad("audit rows cannot be deleted", `DELETE FROM app.audit_log`, /immutable/);
  await good("other business reader cannot see Alice booking", async () => {
    await db.exec("BEGIN; SET LOCAL ROLE mshwar_reader");
    await sql("SELECT set_config('app.user_id',$1,true)", [bob]);
    assert.equal((await one("SELECT count(*)::int AS n FROM app.bookings")).n, 0);
    await db.exec("ROLLBACK");
  });
  await good("customer reader sees own booking history", async () => {
    await db.exec("BEGIN; SET LOCAL ROLE mshwar_reader");
    await sql("SELECT set_config('app.user_id',$1,true)", [alice]);
    assert.ok((await one("SELECT count(*)::int AS n FROM app.bookings")).n >= 1);
    await db.exec("ROLLBACK");
  });
  await bad(
    "reader cannot mutate bookings",
    `SET LOCAL ROLE mshwar_reader; UPDATE app.bookings SET reason='tamper'`,
    /permission denied/,
  );
  await bad(
    "reader cannot call booking transition",
    `SET LOCAL ROLE mshwar_reader; SELECT app.transition_booking('${booking}','confirmed','tamper')`,
    /permission denied/,
  );
  await good("private functions do not grant PUBLIC execution", async () =>
    assert.equal(
      (
        await one(
          `SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='app' AND a.grantee=0 AND a.privilege_type='EXECUTE'`,
        )
      ).n,
      0,
    ),
  );
  await bad(
    "duplicate webhook rejected",
    `INSERT INTO app.webhook_inbox(provider,provider_account,live_mode,event_id,payload_hash,sanitized_payload,verified_at) VALUES('test','a',false,'evt-1','hash','{}',now()),('test','a',false,'evt-1','hash','{}',now())`,
    /unique constraint/,
  );
  await good("trusted backend booking path works with RLS enabled", async () => {
    // The API books through SECURITY DEFINER functions; the backend role alone cannot
    // read another organisation's slots under the org-scoped RLS policies (migration 006).
    await db.exec("BEGIN; SET LOCAL ROLE mshwar_backend");
    const b = await one(
      `SELECT app.commit_checkout($1,'synthetic-walk',$2,1,'backend-key-001','backend-hash-0001',$3,$4,NULL,'corr-1') AS booking`,
      [alice, slot, price, policy],
    );
    assert.ok(b.booking.id);
    await db.exec("COMMIT");
  });

  const trip = (await one(`INSERT INTO app.trips(owner_id,title) VALUES('${alice}','Synthetic plan') RETURNING id`)).id;
  const makeVersion = async (budget = 5000) =>
    (
      await one(`INSERT INTO app.trip_versions(trip_id,version,created_by,origin,window_start,return_by,start_location,party_size,budget_minor,currency)
 VALUES('${trip}',(SELECT coalesce(max(version),0)+1 FROM app.trip_versions WHERE trip_id='${trip}'),'${alice}','manual',now()+interval '7 days',now()+interval '8 days',ST_SetSRID(ST_MakePoint(35.5,33.9),4326)::geography,2,${budget},'USD') RETURNING id`)
    ).id;
  const tv = await makeVersion();
  await sql(`INSERT INTO app.trip_stops(version_id,experience_id,position,starts_at,ends_at,estimated_minor,price_kind,snapshot)
 VALUES('${tv}','${exp}',1,now()+interval '7 days 1 hour',now()+interval '7 days 2 hours',5000,'fixed','{}')`);
  await bad(
    "sealing requires deterministic validation",
    `UPDATE app.trip_versions SET sealed_at=now() WHERE id='${tv}'`,
    /validation required/,
  );
  await good("validated itinerary seals successfully", async () => {
    await sql(
      `UPDATE app.trip_versions SET validation='{"feasible":true,"validator_version":"test-1"}',sealed_at=now() WHERE id='${tv}'`,
    );
  });
  await bad(
    "sealed stop cannot change",
    `UPDATE app.trip_stops SET estimated_minor=0 WHERE version_id='${tv}'`,
    /sealed itinerary/,
  );
  await bad(
    "sealed itinerary cannot be unsealed",
    `UPDATE app.trip_versions SET sealed_at=NULL WHERE id='${tv}'`,
    /immutable/,
  );
  await bad(
    "sealed itinerary cannot gain stops",
    `INSERT INTO app.trip_stops(version_id,experience_id,position,starts_at,ends_at,estimated_minor,price_kind,snapshot) VALUES('${tv}','${exp}',2,now()+interval '7 days 3 hours',now()+interval '7 days 4 hours',0,'fixed','{}')`,
    /sealed itinerary/,
  );
  const over = await makeVersion(100);
  await sql(
    `INSERT INTO app.trip_stops(version_id,experience_id,position,starts_at,ends_at,estimated_minor,price_kind,snapshot) VALUES('${over}','${exp}',1,now()+interval '7 days 1 hour',now()+interval '7 days 2 hours',5000,'fixed','{}')`,
  );
  await bad(
    "strict itinerary budget enforced",
    `UPDATE app.trip_versions SET validation='{"feasible":true,"validator_version":"test-1"}',sealed_at=now() WHERE id='${over}'`,
    /budget exceeded/,
  );
  await bad(
    "overlapping itinerary stops rejected",
    `INSERT INTO app.trip_stops(version_id,experience_id,position,starts_at,ends_at,estimated_minor,price_kind,snapshot) VALUES('${over}','${exp}',2,now()+interval '7 days 1 hour',now()+interval '7 days 2 hours',0,'fixed','{}')`,
    /exclusion/,
  );
  await sql(`INSERT INTO app.trip_members(trip_id,user_id,role) VALUES('${trip}','${bob}','view')`);
  await bad(
    "view-only group member cannot vote",
    `INSERT INTO app.votes(trip_id,user_id,experience_id,value) VALUES('${trip}','${bob}','${exp}',1)`,
    /lacks permission/,
  );
  await sql(`UPDATE app.trip_members SET role='vote' WHERE trip_id='${trip}' AND user_id='${bob}'`);
  await good("voting member can vote once", async () => {
    await sql(`INSERT INTO app.votes(trip_id,user_id,experience_id,value) VALUES('${trip}','${bob}','${exp}',1)`);
  });
  await bad(
    "duplicate vote rejected",
    `INSERT INTO app.votes(trip_id,user_id,experience_id,value) VALUES('${trip}','${bob}','${exp}',-1)`,
    /unique constraint/,
  );
  await sql(`UPDATE app.trips SET status='locked' WHERE id='${trip}'`);
  await bad("locked trip vote cannot change", `UPDATE app.votes SET value=-1 WHERE trip_id='${trip}'`, /trip locked/);
  await sql(`INSERT INTO app.favorites(user_id,experience_id) VALUES('${alice}','${exp}')`);
  await bad(
    "duplicate favorite rejected",
    `INSERT INTO app.favorites(user_id,experience_id) VALUES('${alice}','${exp}')`,
    /unique constraint/,
  );
  const ds = (
    await one(`INSERT INTO app.evaluation_datasets(name,version,checksum) VALUES('test',1,'testhash') RETURNING id`)
  ).id;
  await sql(`UPDATE app.evaluation_datasets SET sealed_at=now() WHERE id='${ds}'`);
  await bad(
    "sealed evaluation dataset cannot gain cases",
    `INSERT INTO app.evaluation_cases(dataset_id,locale,prompt,expected_constraints,fixture_version) VALUES('${ds}','ar-LB','test','{}','1')`,
    /dataset sealed/,
  );
  // ---- MSHWAR-13: security, privacy and trust (migrations 023-026) ----
  await good("audit entries record actor, action and request id", async () => {
    await sql("SELECT set_config('app.request_id','pglite-req-0001',false)");
    await sql(
      `SELECT app.write_audit('${alice}','test.checked','user','{"id":"${alice}"}','{"field":"value"}','integration test')`,
    );
    const row = await one("SELECT actor_id, request_id FROM app.audit_log WHERE action='test.checked'");
    assert.equal(row.actor_id, alice);
    assert.equal(row.request_id, "pglite-req-0001");
  });
  await bad(
    "audit entries cannot be edited",
    "UPDATE app.audit_log SET action='x' WHERE action='test.checked'",
    /immutable/,
  );
  await bad("audit entries cannot be deleted", "DELETE FROM app.audit_log WHERE action='test.checked'", /immutable/);
  await bad("audit log cannot be truncated", "TRUNCATE app.audit_log", /immutable|cannot be truncated/);
  await good("AI spend stops at the per-person daily ceiling", async () => {
    const first = (await one(`SELECT app.consume_ai_budget('${alice}',6000,10000,1000000) AS r`)).r;
    const second = (await one(`SELECT app.consume_ai_budget('${alice}',6000,10000,1000000) AS r`)).r;
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, false);
    assert.equal(second.scope, "user");
  });
  await good("platform AI ceiling applies to everyone", async () => {
    const blocked = (await one(`SELECT app.consume_ai_budget('${bob}',1,0,1) AS r`)).r;
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.scope, "platform");
  });
  await good("consent changes are logged with their source", async () => {
    await sql(`INSERT INTO app.user_private(user_id,email) VALUES('${bob}','bob@example.com') ON CONFLICT DO NOTHING`);
    const state = (await one(`SELECT app.set_consents('${bob}',true,NULL,NULL,'settings') AS r`)).r;
    assert.equal(state.personalisation, true);
    assert.equal(state.marketing_email, false);
    const event = await one(
      `SELECT granted, source FROM app.consent_events WHERE user_id='${bob}' AND purpose='personalisation' ORDER BY created_at DESC LIMIT 1`,
    );
    assert.deepEqual(event, { granted: true, source: "settings" });
  });
  await good("saved preferences apply only with personalisation consent", async () => {
    await sql(`UPDATE app.user_private SET preferences='{"interests":["food"]}' WHERE user_id='${bob}'`);
    const on = (await one(`SELECT app.personalisation_preferences('${bob}') AS p`)).p;
    await sql(`SELECT app.set_consents('${bob}',false,NULL,NULL,'settings')`);
    const off = (await one(`SELECT app.personalisation_preferences('${bob}') AS p`)).p;
    assert.deepEqual(on.interests, ["food"]);
    assert.deepEqual(off.interests ?? [], []);
  });
  await bad(
    "policy acceptance must name the current version",
    `SELECT app.accept_policies('${bob}','{"terms":"2000-01-01"}'::jsonb,'settings')`,
    /out of date/,
  );
  await good("accepting current policies clears the pending list", async () => {
    const policies = (await one("SELECT app.current_policies() AS p")).p;
    const before = (await one(`SELECT app.policies_to_accept('${bob}') AS p`)).p;
    await sql(`SELECT app.accept_policies('${bob}',$1::jsonb,'signup')`, [
      JSON.stringify({ terms: policies.terms.version, privacy: policies.privacy.version }),
    ]);
    const after = (await one(`SELECT app.policies_to_accept('${bob}') AS p`)).p;
    assert.deepEqual(before, ["privacy", "terms"]);
    assert.deepEqual(after, []);
  });
  const version = (await one("SELECT version() AS version")).version;
  fs.writeFileSync(
    root + "/docs/TEST_RESULTS.json",
    JSON.stringify(
      {
        engine: version,
        migrations: migrationFiles.length,
        passed: report.length,
        tests: report,
        limitations: [
          "Single connection embedded PostgreSQL; native multi-session concurrency and PostgreSQL 17 deployment still require validation.",
          "No external auth, payment, email or routing services exercised.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${report.length} tests passed`);
} catch (e) {
  console.error("FAIL", e.message, e.detail || "", e.where || "");
  process.exitCode = 1;
} finally {
  await db.close();
}
