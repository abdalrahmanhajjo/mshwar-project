SET search_path = app, public;

-- ============================================================
-- Migration 009: Email verification (single-use, time-limited)
-- ============================================================
-- New accounts stay unverified until the emailed link is used.
-- Tokens are stored as SHA-256 hashes. TTL is applied by the API
-- (default 24 hours). Confirming a token:
--   * is single-use
--   * invalidates unused tokens for that user
--   * stamps users.email_verified_at

ALTER TABLE app.users
    ADD COLUMN email_verified_at timestamptz;

CREATE TABLE app.email_verification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE INDEX email_verification_tokens_user_active_idx
    ON app.email_verification_tokens (user_id)
    WHERE used_at IS NULL;

ALTER TABLE app.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.email_verification_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY email_verification_self_access ON app.email_verification_tokens FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

REVOKE ALL ON app.email_verification_tokens FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON app.email_verification_tokens TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.issue_email_verification(
    p_email text,
    p_token_hash text,
    p_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT u.id INTO v_user_id
    FROM app.user_private p
    JOIN app.users u ON u.id = p.user_id
    WHERE lower(p.email) = lower(btrim(p_email))
      AND u.status = 'active'
      AND u.email_verified_at IS NULL
    LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    UPDATE app.email_verification_tokens
    SET used_at = now()
    WHERE user_id = v_user_id AND used_at IS NULL;
    INSERT INTO app.email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (v_user_id, p_token_hash, p_expires_at);
    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.confirm_email_verification(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user_id uuid;
    v_token_id uuid;
BEGIN
    SELECT t.user_id, t.id INTO v_user_id, v_token_id
    FROM app.email_verification_tokens t
    WHERE t.token_hash = p_token_hash
      AND t.used_at IS NULL
      AND t.expires_at > now()
    FOR UPDATE;
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    UPDATE app.email_verification_tokens SET used_at = now() WHERE id = v_token_id;
    UPDATE app.email_verification_tokens
    SET used_at = now()
    WHERE user_id = v_user_id AND used_at IS NULL;
    UPDATE app.users
    SET email_verified_at = COALESCE(email_verified_at, now())
    WHERE id = v_user_id;
    RETURN v_user_id;
END;
$$;

DROP FUNCTION IF EXISTS app.get_session(text);
CREATE FUNCTION app.get_session(p_token_hash text)
RETURNS TABLE (
    session_id uuid,
    user_id uuid,
    display_name text,
    email text,
    locale text,
    status text,
    expires_at timestamptz,
    email_verified_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT s.id, u.id, u.display_name, p.email, u.locale, u.status, s.expires_at, u.email_verified_at
    FROM app.sessions s
    JOIN app.users u ON u.id = s.user_id
    JOIN app.user_private p ON p.user_id = u.id
    WHERE s.token_hash = p_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now();
$$;

DROP FUNCTION IF EXISTS app.lookup_local_credential(text);
CREATE FUNCTION app.lookup_local_credential(p_email text)
RETURNS TABLE (
    user_id uuid,
    password_hash text,
    display_name text,
    status text,
    locale text,
    email_verified_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT u.id, c.password_hash, u.display_name, u.status, u.locale, u.email_verified_at
    FROM app.user_private p
    JOIN app.users u ON u.id = p.user_id
    JOIN app.credentials c ON c.user_id = u.id
    WHERE lower(p.email) = lower(btrim(p_email))
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app.list_user_verification_states()
RETURNS TABLE (
    user_id uuid,
    email text,
    display_name text,
    locale text,
    status text,
    email_verified_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT u.id, p.email, u.display_name, u.locale, u.status, u.email_verified_at
    FROM app.users u
    JOIN app.user_private p ON p.user_id = u.id
    ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION app.issue_email_verification(text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.confirm_email_verification(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.get_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.lookup_local_credential(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_user_verification_states() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.issue_email_verification(text, text, timestamptz) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.confirm_email_verification(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.get_session(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.lookup_local_credential(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.list_user_verification_states() TO mshwar_backend;
