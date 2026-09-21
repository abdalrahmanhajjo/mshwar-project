"""Checksum-verified, advisory-locked, forward-only SQL migration runner."""
import hashlib
import os
from pathlib import Path
import psycopg


def libpq_dsn(url: str) -> str:
    """Accept SQLAlchemy URLs such as postgresql+asyncpg://user@host/db."""
    scheme, sep, rest = url.partition("://")
    if sep and "+" in scheme:
        return f"{scheme.split('+', 1)[0]}://{rest}"
    return url


root = Path(__file__).resolve().parents[1]
with psycopg.connect(libpq_dsn(os.environ["DATABASE_URL"]), autocommit=True) as conn:
    conn.execute("SELECT pg_advisory_lock(73649201)")
    try:
        conn.execute("CREATE SCHEMA IF NOT EXISTS mshwar_migrations")
        conn.execute("REVOKE ALL ON SCHEMA mshwar_migrations FROM PUBLIC")
        conn.execute("CREATE TABLE IF NOT EXISTS mshwar_migrations.applied(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())")
        for path in sorted((root/'migrations').glob('*.sql')):
            content = path.read_bytes()
            checksum = hashlib.sha256(content).hexdigest()
            row = conn.execute('SELECT checksum FROM mshwar_migrations.applied WHERE name=%s',(path.name,)).fetchone()
            if row:
                if row[0] != checksum:
                    raise RuntimeError(f'Previously applied migration changed: {path.name}')
                print(f'Already applied {path.name}')
                continue
            with conn.transaction():
                conn.execute("SET LOCAL lock_timeout = '5s'")
                conn.execute("SET LOCAL statement_timeout = '5min'")
                conn.execute(content.decode())
                conn.execute('INSERT INTO mshwar_migrations.applied(name,checksum) VALUES(%s,%s)',(path.name,checksum))
            print(f'Applied {path.name}')
    finally:
        conn.execute('SELECT pg_advisory_unlock(73649201)')
