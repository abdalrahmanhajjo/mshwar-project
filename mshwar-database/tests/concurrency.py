"""Native PostgreSQL last-seat test. Requires a separate EMPTY test database.
DATABASE_URL=... python tests/concurrency.py
Never run against production. No truncation or database deletion is performed.
"""
import os
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg
root = Path(__file__).resolve().parents[1]
url = os.environ['DATABASE_URL']
with psycopg.connect(url) as c:
    if c.execute("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='app')").fetchone()[0]:
        raise RuntimeError('Requires an EMPTY test database without app schema')
subprocess.run([sys.executable,str(root/'scripts/migrate.py')],check=True)
with psycopg.connect(url) as c:
    c.execute((root/'tests/seed.sql').read_text())
    c.execute("UPDATE app.slots SET capacity=1")
barrier=Barrier(2)
def reserve(i):
    try:
        with psycopg.connect(url) as c:
            c.execute("SET LOCAL lock_timeout='10s'")
            actor=f'00000000-0000-0000-0000-{i:012}'
            c.execute("SELECT set_config('app.user_id',%s,true)",(actor,))
            barrier.wait(timeout=10)
            c.execute("""SELECT app.reserve_booking(%s,'40000000-0000-0000-0000-000000000001',1,%s,%s,
              '50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',true)""",
              (actor,f'concurrency-key-{i}',f'concurrency-hash-{i}'))
        return 'reserved'
    except psycopg.errors.RaiseException as e:
        if 'insufficient capacity' not in str(e):
            raise
        return 'sold_out'
with ThreadPoolExecutor(max_workers=2) as executor:
    results=list(executor.map(reserve,[1,2]))
assert sorted(results)==['reserved','sold_out'],results
with psycopg.connect(url) as c:
    slot_id='40000000-0000-0000-0000-000000000001'
    assert c.execute('SELECT reserved FROM app.slots WHERE id=%s',(slot_id,)).fetchone()[0]==1
    assert c.execute('SELECT count(*) FROM app.bookings WHERE slot_id=%s',(slot_id,)).fetchone()[0]==1
print('PASS: two independent connections contested the final seat; exactly one reservation committed')
