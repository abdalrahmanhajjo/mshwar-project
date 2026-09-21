SET search_path = app, public;

-- ============================================================
-- Migration 025: abuse and cost controls (MSHWAR-110, MSHWAR-112)
-- ============================================================
-- * AI generation spend per traveller per day and for the whole platform per
--   day (Asia/Beirut calendar), charged atomically before each generation
-- * upload quotas per organisation: total stored bytes and images per listing
-- * media rows record where the bytes live and what they are

-- ---- AI generation budget ------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.ai_usage_daily (
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    usage_date date NOT NULL,
    requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
    cost_micros bigint NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, usage_date)
);

CREATE TABLE IF NOT EXISTS app.ai_usage_global (
    usage_date date PRIMARY KEY,
    requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
    cost_micros bigint NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_usage_global ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.ai_usage_daily, app.ai_usage_global FROM PUBLIC;
REVOKE ALL ON app.ai_usage_daily, app.ai_usage_global FROM mshwar_backend;

CREATE OR REPLACE FUNCTION app.ai_budget_day() RETURNS date
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'Asia/Beirut')::date
$$;

CREATE OR REPLACE FUNCTION app.ai_budget_resets_at() RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
    SELECT ((app.ai_budget_day() + 1)::timestamp AT TIME ZONE 'Asia/Beirut')
$$;

-- Charge one generation. Limits are in micro-dollars; 0 means "no ceiling".
-- Called in its own short transaction by the API (app/planner/budget.py), so
-- the platform row lock is never held while a model is running.
CREATE OR REPLACE FUNCTION app.consume_ai_budget(
    p_user uuid,
    p_cost_micros bigint,
    p_user_limit_micros bigint,
    p_global_limit_micros bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_day date := app.ai_budget_day();
    v_user bigint;
    v_global bigint;
    v_cost bigint := greatest(coalesce(p_cost_micros, 0), 0);
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    INSERT INTO app.ai_usage_global (usage_date) VALUES (v_day) ON CONFLICT DO NOTHING;
    INSERT INTO app.ai_usage_daily (user_id, usage_date) VALUES (p_user, v_day) ON CONFLICT DO NOTHING;
    SELECT cost_micros INTO v_global FROM app.ai_usage_global WHERE usage_date = v_day FOR UPDATE;
    SELECT cost_micros INTO v_user FROM app.ai_usage_daily WHERE user_id = p_user AND usage_date = v_day FOR UPDATE;

    IF coalesce(p_global_limit_micros, 0) > 0 AND v_global + v_cost > p_global_limit_micros THEN
        RETURN jsonb_build_object('allowed', false, 'scope', 'platform', 'resets_at', app.ai_budget_resets_at());
    END IF;
    IF coalesce(p_user_limit_micros, 0) > 0 AND v_user + v_cost > p_user_limit_micros THEN
        RETURN jsonb_build_object(
            'allowed', false, 'scope', 'user', 'resets_at', app.ai_budget_resets_at(),
            'used_micros', v_user, 'limit_micros', p_user_limit_micros
        );
    END IF;

    UPDATE app.ai_usage_global
    SET requests = requests + 1, cost_micros = cost_micros + v_cost, updated_at = now()
    WHERE usage_date = v_day;
    UPDATE app.ai_usage_daily
    SET requests = requests + 1, cost_micros = cost_micros + v_cost, updated_at = now()
    WHERE user_id = p_user AND usage_date = v_day;
    RETURN jsonb_build_object(
        'allowed', true,
        'used_micros', v_user + v_cost,
        'limit_micros', p_user_limit_micros,
        'resets_at', app.ai_budget_resets_at()
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.ai_budget_status(p_user uuid, p_user_limit_micros bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'used_micros', coalesce((
            SELECT cost_micros FROM app.ai_usage_daily WHERE user_id = p_user AND usage_date = app.ai_budget_day()
        ), 0),
        'requests', coalesce((
            SELECT requests FROM app.ai_usage_daily WHERE user_id = p_user AND usage_date = app.ai_budget_day()
        ), 0),
        'limit_micros', p_user_limit_micros,
        'resets_at', app.ai_budget_resets_at()
    )
$$;

-- ---- media records -------------------------------------------------------------

ALTER TABLE app.media
    ADD COLUMN IF NOT EXISTS content_type text,
    ADD COLUMN IF NOT EXISTS byte_size bigint CHECK (byte_size IS NULL OR byte_size > 0),
    ADD COLUMN IF NOT EXISTS width integer CHECK (width IS NULL OR width > 0),
    ADD COLUMN IF NOT EXISTS height integer CHECK (height IS NULL OR height > 0),
    ADD COLUMN IF NOT EXISTS provider_file_id text,
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES app.users(id),
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Seeded catalogue photos (013) point at full URLs on third-party CDNs.
UPDATE app.media SET provider = 'external'
WHERE provider NOT IN ('imagekit', 'local', 'external');

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_provider_check') THEN
        ALTER TABLE app.media DROP CONSTRAINT media_provider_check;
    END IF;
    ALTER TABLE app.media
        ADD CONSTRAINT media_provider_check CHECK (provider IN ('imagekit', 'local', 'external'));
END $$;

CREATE INDEX IF NOT EXISTS media_experience_idx ON app.media (experience_id, sort_order);

-- ---- upload quotas --------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.organization_storage_bytes(p_org uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT sum(m.byte_size) FROM app.media m
        JOIN app.experiences e ON e.id = m.experience_id
        WHERE e.organization_id = p_org
    ), 0) + coalesce((
        SELECT sum(d.byte_size) FROM app.verification_documents d WHERE d.organization_id = p_org
    ), 0)
$$;

-- Checked before any bytes are stored (and again, under lock, when attaching).
CREATE OR REPLACE FUNCTION app.check_upload_allowance(
    p_user uuid,
    p_org uuid,
    p_purpose text,
    p_experience uuid,
    p_bytes bigint,
    p_quota_bytes bigint,
    p_max_images integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_used bigint;
    v_images integer;
BEGIN
    IF p_purpose NOT IN ('listing', 'verification') THEN
        RAISE EXCEPTION 'invalid upload purpose' USING ERRCODE = '22023';
    END IF;
    PERFORM app.require_capability(p_user, p_org, CASE WHEN p_purpose = 'listing' THEN 'listings' ELSE 'settings' END);
    -- Serialises concurrent uploads for one organisation.
    PERFORM 1 FROM app.organizations WHERE id = p_org FOR UPDATE;
    IF p_purpose = 'listing' THEN
        IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
            RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
        END IF;
        SELECT count(*) INTO v_images FROM app.media WHERE experience_id = p_experience AND moderation <> 'rejected';
        IF coalesce(p_max_images, 0) > 0 AND v_images >= p_max_images THEN
            RAISE EXCEPTION 'image limit reached for this listing' USING ERRCODE = '53400';
        END IF;
    END IF;
    v_used := app.organization_storage_bytes(p_org);
    IF coalesce(p_quota_bytes, 0) > 0 AND v_used + greatest(coalesce(p_bytes, 0), 0) > p_quota_bytes THEN
        RAISE EXCEPTION 'storage quota exceeded' USING ERRCODE = '53400';
    END IF;
    RETURN jsonb_build_object('used_bytes', v_used, 'quota_bytes', p_quota_bytes, 'images', v_images);
END;
$$;

CREATE OR REPLACE FUNCTION app.attach_listing_image(
    p_user uuid,
    p_org uuid,
    p_experience uuid,
    p_provider text,
    p_object_key text,
    p_provider_file_id text,
    p_alt text,
    p_content_type text,
    p_byte_size bigint,
    p_width integer,
    p_height integer,
    p_quota_bytes bigint,
    p_max_images integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_sort integer;
BEGIN
    PERFORM app.check_upload_allowance(p_user, p_org, 'listing', p_experience, p_byte_size, p_quota_bytes, p_max_images);
    IF p_provider NOT IN ('imagekit', 'local') THEN
        RAISE EXCEPTION 'invalid media provider' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(max(sort_order) + 1, 0) INTO v_sort FROM app.media WHERE experience_id = p_experience;
    INSERT INTO app.media (
        experience_id, provider, object_key, provider_file_id, alt_text, sort_order, moderation,
        content_type, byte_size, width, height, created_by
    ) VALUES (
        p_experience, p_provider, p_object_key, p_provider_file_id,
        coalesce(nullif(btrim(p_alt), ''), 'Experience image'), v_sort, 'pending',
        p_content_type, p_byte_size, p_width, p_height, p_user
    )
    RETURNING id INTO v_id;
    RETURN jsonb_build_object(
        'id', v_id, 'object_key', p_object_key, 'provider', p_provider, 'experience_id', p_experience,
        'moderation', 'pending', 'width', p_width, 'height', p_height
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION app.attach_experience_media(uuid, uuid, uuid, text, text, integer) FROM mshwar_backend;

-- ---- grants -----------------------------------------------------------------------

REVOKE ALL ON FUNCTION app.consume_ai_budget(uuid, bigint, bigint, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ai_budget_status(uuid, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.organization_storage_bytes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.check_upload_allowance(uuid, uuid, text, uuid, bigint, bigint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.attach_listing_image(uuid, uuid, uuid, text, text, text, text, text, bigint, integer, integer, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.consume_ai_budget(uuid, bigint, bigint, bigint) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.ai_budget_status(uuid, bigint) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.check_upload_allowance(uuid, uuid, text, uuid, bigint, bigint, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.attach_listing_image(uuid, uuid, uuid, text, text, text, text, text, bigint, integer, integer, bigint, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.ai_budget_day() TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.ai_budget_resets_at() TO mshwar_backend;
