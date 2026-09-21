SET search_path = app, public;

-- ============================================================
-- Migration 007: Local email/password credentials and sessions
-- ============================================================
-- users + user_private already exist (001). This adds:
--   * unique lower(email) on user_private
--   * app.credentials — Argon2id hashes only (never plaintext)
--   * app.sessions — opaque token hashes, 7-day sliding expiry
-- Session schedule: issued for 7 days; refresh extends by 7 days when
-- less than half the remaining lifetime is left. Revoke on sign-out.

CREATE TABLE app.credentials (
    user_id uuid PRIMARY KEY REFERENCES app.users(id),
    password_hash text NOT NULL,
    algorithm text NOT NULL DEFAULT 'argon2id' CHECK (algorithm = 'argon2id'),
    created_at timestamptz NOT NULL DEFAULT now(),
    rotated_at timestamptz
);

CREATE UNIQUE INDEX user_private_email_lower_uidx
    ON app.user_private (lower(email))
    WHERE email IS NOT NULL;

CREATE TABLE app.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    user_agent text,
    CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_active_idx
    ON app.sessions (user_id)
    WHERE revoked_at IS NULL;

ALTER TABLE app.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY credential_self_access ON app.credentials FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

CREATE POLICY session_self_access ON app.sessions FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

REVOKE ALL ON app.credentials FROM PUBLIC;
REVOKE ALL ON app.sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON app.credentials, app.sessions TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.register_local_user(
    p_email text,
    p_display_name text,
    p_locale text,
    p_password_hash text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user_id uuid;
    v_email text := lower(btrim(p_email));
BEGIN
    IF v_email IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'email required' USING ERRCODE = '23502';
    END IF;
    IF EXISTS (SELECT 1 FROM app.user_private WHERE lower(email) = v_email) THEN
        RAISE EXCEPTION 'email already registered' USING ERRCODE = '23505';
    END IF;
    INSERT INTO app.users (auth_issuer, auth_subject, display_name, locale)
    VALUES ('mshwar.local', v_email, p_display_name, p_locale)
    RETURNING id INTO v_user_id;
    INSERT INTO app.user_private (user_id, email) VALUES (v_user_id, v_email);
    INSERT INTO app.credentials (user_id, password_hash, algorithm)
    VALUES (v_user_id, p_password_hash, 'argon2id');
    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.lookup_local_credential(p_email text)
RETURNS TABLE (
    user_id uuid,
    password_hash text,
    display_name text,
    status text,
    locale text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT u.id, c.password_hash, u.display_name, u.status, u.locale
    FROM app.user_private p
    JOIN app.users u ON u.id = p.user_id
    JOIN app.credentials c ON c.user_id = u.id
    WHERE lower(p.email) = lower(btrim(p_email))
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app.issue_session(
    p_user_id uuid,
    p_token_hash text,
    p_expires_at timestamptz,
    p_user_agent text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO app.sessions (user_id, token_hash, expires_at, user_agent)
    VALUES (p_user_id, p_token_hash, p_expires_at, p_user_agent)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_session(p_token_hash text)
RETURNS TABLE (
    session_id uuid,
    user_id uuid,
    display_name text,
    email text,
    locale text,
    status text,
    expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT s.id, u.id, u.display_name, p.email, u.locale, u.status, s.expires_at
    FROM app.sessions s
    JOIN app.users u ON u.id = s.user_id
    JOIN app.user_private p ON p.user_id = u.id
    WHERE s.token_hash = p_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION app.revoke_session(p_token_hash text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.sessions
    SET revoked_at = now()
    WHERE token_hash = p_token_hash AND revoked_at IS NULL;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.refresh_session(p_token_hash text, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.sessions
    SET expires_at = p_expires_at, last_seen_at = now()
    WHERE token_hash = p_token_hash AND revoked_at IS NULL AND expires_at > now();
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION app.register_local_user(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.lookup_local_credential(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.issue_session(uuid, text, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.revoke_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.refresh_session(text, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.register_local_user(text, text, text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.lookup_local_credential(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.issue_session(uuid, text, timestamptz, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_session(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.revoke_session(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.refresh_session(text, timestamptz) TO mshwar_backend;
