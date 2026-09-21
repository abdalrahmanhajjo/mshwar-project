SET search_path = app, public;

-- ============================================================
-- Migration 008: Password reset tokens (no account enumeration)
-- ============================================================
-- Tokens are stored as SHA-256 hashes only. TTL is applied by the
-- API (default 30 minutes). Consuming a token:
--   * is single-use
--   * invalidates unused tokens for that user
--   * rotates the Argon2id credential
--   * revokes every session for that user

CREATE TABLE app.password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_tokens_user_active_idx
    ON app.password_reset_tokens (user_id)
    WHERE used_at IS NULL;

ALTER TABLE app.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.password_reset_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY password_reset_self_access ON app.password_reset_tokens FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

REVOKE ALL ON app.password_reset_tokens FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON app.password_reset_tokens TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.issue_password_reset(
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
    LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    UPDATE app.password_reset_tokens
    SET used_at = now()
    WHERE user_id = v_user_id AND used_at IS NULL;
    INSERT INTO app.password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (v_user_id, p_token_hash, p_expires_at);
    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.consume_password_reset(
    p_token_hash text,
    p_password_hash text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_user_id uuid;
    v_token_id uuid;
BEGIN
    SELECT t.user_id, t.id INTO v_user_id, v_token_id
    FROM app.password_reset_tokens t
    WHERE t.token_hash = p_token_hash
      AND t.used_at IS NULL
      AND t.expires_at > now()
    FOR UPDATE;
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    UPDATE app.password_reset_tokens SET used_at = now() WHERE id = v_token_id;
    UPDATE app.password_reset_tokens
    SET used_at = now()
    WHERE user_id = v_user_id AND used_at IS NULL;
    UPDATE app.credentials
    SET password_hash = p_password_hash, rotated_at = now()
    WHERE user_id = v_user_id;
    UPDATE app.sessions
    SET revoked_at = now()
    WHERE user_id = v_user_id AND revoked_at IS NULL;
    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION app.issue_password_reset(text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.consume_password_reset(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.issue_password_reset(text, text, timestamptz) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.consume_password_reset(text, text) TO mshwar_backend;
