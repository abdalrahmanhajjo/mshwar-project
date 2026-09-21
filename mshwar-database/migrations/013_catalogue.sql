SET search_path = app, public;

-- ============================================================
-- Migration 013: Catalogue, search, collections, favorites toggle
-- MSHWAR-35 / 37 / 40 / 41 / 42
-- Extends the 001 catalogue tables. Public reads are SECURITY DEFINER
-- and only return active organizations + published destinations/experiences.
-- ============================================================

-- --- Constraints: taxonomy kinds + price types -------------------

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname, c.oid
        FROM pg_constraint c
        WHERE c.conrelid = 'app.taxonomy'::regclass AND c.contype = 'c'
    LOOP
        IF pg_get_constraintdef(r.oid) ILIKE '%kind%' THEN
            EXECUTE format('ALTER TABLE app.taxonomy DROP CONSTRAINT %I', r.conname);
        END IF;
    END LOOP;
END $$;

ALTER TABLE app.taxonomy
    ADD CONSTRAINT taxonomy_kind_check
    CHECK (kind IN (
        'category', 'amenity', 'dietary', 'accessibility', 'interest',
        'suitability', 'weather', 'tag'
    ));

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname, c.oid
        FROM pg_constraint c
        WHERE c.conrelid = 'app.price_rules'::regclass AND c.contype = 'c'
    LOOP
        IF pg_get_constraintdef(r.oid) ILIKE '%price_type%' THEN
            EXECUTE format('ALTER TABLE app.price_rules DROP CONSTRAINT %I', r.conname);
        END IF;
    END LOOP;
END $$;

ALTER TABLE app.price_rules
    ADD CONSTRAINT price_rules_price_type_check
    CHECK (price_type IN ('fixed', 'from', 'range', 'quote', 'estimated', 'quote-required'));

ALTER TABLE app.price_rules
    ADD CONSTRAINT price_rules_amount_by_type_check
    CHECK (
        (price_type IN ('quote', 'quote-required') AND amount_minor IS NULL AND max_amount_minor IS NULL)
        OR (price_type IN ('fixed', 'from', 'estimated') AND amount_minor IS NOT NULL AND max_amount_minor IS NULL)
        OR (price_type = 'range' AND amount_minor IS NOT NULL AND max_amount_minor >= amount_minor)
    );

-- --- Destination + experience catalogue fields -------------------

ALTER TABLE app.destinations
    ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS blurb text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS image_url text,
    ADD COLUMN IF NOT EXISTS image_alt text,
    ADD COLUMN IF NOT EXISTS location geography(Point, 4326),
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'destinations_status_check'
    ) THEN
        ALTER TABLE app.destinations
            ADD CONSTRAINT destinations_status_check
            CHECK (status IN ('draft', 'published', 'paused', 'archived'));
    END IF;
END $$;

ALTER TABLE app.experiences
    ADD COLUMN IF NOT EXISTS weather_sensitivity text NOT NULL DEFAULT 'outdoor',
    ADD COLUMN IF NOT EXISTS listing_kind text NOT NULL DEFAULT 'experience',
    ADD COLUMN IF NOT EXISTS inventory_available boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS catalogue_summary text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS catalogue_facts jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS sample_rating numeric(2, 1),
    ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedding vector(8);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'experiences_weather_sensitivity_check'
    ) THEN
        ALTER TABLE app.experiences
            ADD CONSTRAINT experiences_weather_sensitivity_check
            CHECK (weather_sensitivity IN ('indoor', 'outdoor', 'weather-sensitive'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'experiences_listing_kind_check'
    ) THEN
        ALTER TABLE app.experiences
            ADD CONSTRAINT experiences_listing_kind_check
            CHECK (listing_kind IN ('experience', 'attraction', 'restaurant'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'experiences_facts_is_array'
    ) THEN
        ALTER TABLE app.experiences
            ADD CONSTRAINT experiences_facts_is_array
            CHECK (jsonb_typeof(catalogue_facts) = 'array');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.catalogue_collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    kicker text NOT NULL DEFAULT '',
    image_url text,
    image_alt text,
    accent boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.catalogue_collection_items (
    collection_id uuid NOT NULL REFERENCES app.catalogue_collections(id) ON DELETE CASCADE,
    experience_id uuid NOT NULL REFERENCES app.experiences(id),
    position integer NOT NULL CHECK (position > 0),
    PRIMARY KEY (collection_id, position),
    UNIQUE (collection_id, experience_id)
);

ALTER TABLE app.catalogue_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalogue_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogue_collections_backend ON app.catalogue_collections
    FOR ALL TO mshwar_backend USING (true) WITH CHECK (true);
CREATE POLICY catalogue_collection_items_backend ON app.catalogue_collection_items
    FOR ALL TO mshwar_backend USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON app.catalogue_collections, app.catalogue_collection_items TO mshwar_backend;

CREATE INDEX IF NOT EXISTS experience_search_text_gin
    ON app.experiences USING gin (to_tsvector('simple', search_text));

-- --- Helpers -----------------------------------------------------

CREATE OR REPLACE FUNCTION app.stub_embedding(p_text text)
RETURNS vector
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY[
        ((hashtext(coalesce(p_text, '') || ':0') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':1') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':2') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':3') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':4') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':5') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':6') % 2000) - 1000)::float8 / 1000.0,
        ((hashtext(coalesce(p_text, '') || ':7') % 2000) - 1000)::float8 / 1000.0
    ]::vector(8);
$$;

CREATE OR REPLACE FUNCTION app.public_price_type(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_type IN ('quote', 'quote-required') THEN 'quote-required'
        WHEN p_type = 'estimated' THEN 'estimated'
        WHEN p_type = 'fixed' THEN 'fixed'
        ELSE 'from'
    END;
$$;

CREATE OR REPLACE FUNCTION app.refresh_experience_search(p_experience_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_blob text;
BEGIN
    SELECT trim(both ' ' FROM concat_ws(' ',
        e.title, e.description, e.catalogue_summary, e.listing_kind,
        d.name, d.region, d.slug, v.name,
        (SELECT string_agg(t.label, ' ') FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id WHERE et.experience_id = e.id),
        (SELECT string_agg(x.title || ' ' || x.description, ' ') FROM app.experience_translations x
            WHERE x.experience_id = e.id),
        (SELECT string_agg(y.title || ' ' || y.description, ' ') FROM app.destination_translations y
            WHERE y.destination_id = d.id)
    ))
    INTO v_blob
    FROM app.experiences e
    JOIN app.venues v ON v.id = e.venue_id
    LEFT JOIN app.destinations d ON d.id = v.destination_id
    WHERE e.id = p_experience_id;

    UPDATE app.experiences
    SET search_text = coalesce(v_blob, title || ' ' || description),
        embedding = app.stub_embedding(coalesce(v_blob, title))
    WHERE id = p_experience_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.transition_experience_status(p_experience_id uuid, p_to text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_from text;
BEGIN
    IF p_to NOT IN ('draft', 'published', 'paused', 'archived') THEN
        RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
    SELECT status INTO v_from FROM app.experiences WHERE id = p_experience_id;
    IF v_from IS NULL THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_from = p_to THEN
        RETURN v_from;
    END IF;
    IF v_from = 'archived' THEN
        RAISE EXCEPTION 'archived experiences cannot change status' USING ERRCODE = '22023';
    END IF;
    IF v_from = 'draft' AND p_to NOT IN ('published', 'archived') THEN
        RAISE EXCEPTION 'invalid transition' USING ERRCODE = '22023';
    END IF;
    IF v_from = 'published' AND p_to NOT IN ('paused', 'archived') THEN
        RAISE EXCEPTION 'invalid transition' USING ERRCODE = '22023';
    END IF;
    IF v_from = 'paused' AND p_to NOT IN ('published', 'archived') THEN
        RAISE EXCEPTION 'invalid transition' USING ERRCODE = '22023';
    END IF;
    UPDATE app.experiences SET status = p_to, updated_at = now() WHERE id = p_experience_id;
    RETURN p_to;
END;
$$;

CREATE OR REPLACE FUNCTION app.transition_experience_status_by_slug(p_slug text, p_to text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM app.experiences WHERE slug = p_slug;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.transition_experience_status(v_id, p_to);
END;
$$;

CREATE OR REPLACE FUNCTION app.catalogue_listing_row(p_experience_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', e.id,
        'slug', e.slug,
        'title', e.title,
        'summary', NULLIF(e.catalogue_summary, ''),
        'body', e.description,
        'category', coalesce(
            (SELECT t.slug FROM app.experience_taxonomy et
             JOIN app.taxonomy t ON t.id = et.term_id
             WHERE et.experience_id = e.id AND t.kind = 'category'
             ORDER BY t.slug LIMIT 1),
            'city'
        ),
        'tags', coalesce((
            SELECT jsonb_agg(t.label ORDER BY t.slug)
            FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'tag'
        ), '[]'::jsonb),
        'amenities', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug)
            FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'amenity'
        ), '[]'::jsonb),
        'suitability', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug)
            FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'suitability'
        ), '[]'::jsonb),
        'destination_slug', d.slug,
        'place_label', v.name || ' · ' || coalesce(NULLIF(d.region, ''), d.name),
        'hours', round((e.duration_minutes / 60.0)::numeric, 1),
        'booking_mode', e.booking_mode,
        'kind', e.listing_kind,
        'available', e.inventory_available,
        'weather_sensitivity', e.weather_sensitivity,
        'setting', e.setting,
        'group_min', e.min_party,
        'group_max', e.max_party,
        'facts', e.catalogue_facts,
        'rating', e.sample_rating,
        'lat', ST_Y(v.location::geometry),
        'lng', ST_X(v.location::geometry),
        'distance_km', CASE
            WHEN v.location IS NULL THEN NULL
            ELSE round((ST_Distance(
                v.location,
                ST_SetSRID(ST_MakePoint(35.5018, 33.8938), 4326)::geography
            ) / 1000.0)::numeric, 1)
        END,
        'image', (SELECT m.object_key FROM app.media m
                  WHERE m.experience_id = e.id AND m.moderation = 'approved'
                  ORDER BY m.sort_order LIMIT 1),
        'image_alt', (SELECT m.alt_text FROM app.media m
                      WHERE m.experience_id = e.id AND m.moderation = 'approved'
                      ORDER BY m.sort_order LIMIT 1),
        'gallery', coalesce((
            SELECT jsonb_agg(m.object_key ORDER BY m.sort_order)
            FROM app.media m
            WHERE m.experience_id = e.id AND m.moderation = 'approved'
        ), '[]'::jsonb),
        'price', jsonb_build_object(
            'currency', coalesce(pr.currency, 'USD'),
            'type', app.public_price_type(coalesce(pr.price_type, 'from')),
            'source', coalesce(pr.source, 'unknown'),
            'amount_minor', pr.amount_minor,
            'amount', CASE WHEN pr.amount_minor IS NULL THEN 0 ELSE pr.amount_minor / 100.0 END
        )
    )
    FROM app.experiences e
    JOIN app.organizations o ON o.id = e.organization_id
    JOIN app.venues v ON v.id = e.venue_id
    LEFT JOIN app.destinations d ON d.id = v.destination_id
    LEFT JOIN LATERAL (
        SELECT currency, price_type, source, amount_minor
        FROM app.price_rules
        WHERE experience_id = e.id
        ORDER BY verified_at DESC NULLS LAST
        LIMIT 1
    ) pr ON true
    WHERE e.id = p_experience_id
      AND e.status = 'published'
      AND o.status = 'active'
      AND (d.id IS NULL OR d.status = 'published');
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_destinations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'slug', d.slug,
        'name', d.name,
        'region', d.region,
        'country', 'Lebanon',
        'blurb', d.blurb,
        'image', d.image_url,
        'image_alt', d.image_alt,
        'lat', ST_Y(d.location::geometry),
        'lng', ST_X(d.location::geometry),
        'tags', to_jsonb(d.tags)
    ) ORDER BY d.name), '[]'::jsonb)
    FROM app.destinations d
    WHERE d.status = 'published'
      AND d.slug IN ('byblos', 'batroun', 'bsharri', 'qadisha-valley', 'baalbek', 'beirut');
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_experiences(
    p_q text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_destination text DEFAULT NULL,
    p_kind text DEFAULT NULL,
    p_available boolean DEFAULT NULL,
    p_price_max integer DEFAULT NULL,
    p_party integer DEFAULT NULL,
    p_sort text DEFAULT NULL,
    p_limit integer DEFAULT 24,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (listing jsonb, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH published AS (
        SELECT e.id, e.slug, e.title, e.duration_minutes, e.listing_kind, e.inventory_available,
               e.sample_rating, e.search_text, d.slug AS destination_slug,
               (SELECT t.slug FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' LIMIT 1) AS category,
               (SELECT amount_minor FROM app.price_rules pr WHERE pr.experience_id = e.id LIMIT 1) AS amount_minor
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND (
                btrim(coalesce(p_q, '')) = ''
                OR e.search_text ILIKE '%' || btrim(p_q) || '%'
                OR (
                    btrim(coalesce(p_q, '')) <> ''
                    AND to_tsvector('simple', e.search_text) @@ websearch_to_tsquery('simple', btrim(p_q))
                )
          )
          AND (p_category IS NULL OR p_category IN ('', 'all') OR EXISTS (
                SELECT 1 FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' AND t.slug = p_category
          ))
          AND (p_destination IS NULL OR p_destination = '' OR d.slug = p_destination)
          AND (p_kind IS NULL OR p_kind IN ('', 'all') OR e.listing_kind = p_kind)
          AND (p_available IS NOT TRUE OR e.inventory_available)
          AND (p_price_max IS NULL OR (
                SELECT coalesce(amount_minor, 0) FROM app.price_rules pr
                WHERE pr.experience_id = e.id LIMIT 1
              ) <= p_price_max * 100)
          AND (p_party IS NULL OR (e.min_party <= p_party AND e.max_party >= p_party))
    ),
    ordered AS (
        SELECT p.*, COUNT(*) OVER () AS total
        FROM published p
        ORDER BY
            CASE WHEN p_sort = 'price' THEN p.amount_minor END ASC NULLS LAST,
            CASE WHEN p_sort = 'duration' THEN p.duration_minutes END ASC,
            CASE WHEN p_sort = 'rating' THEN p.sample_rating END DESC NULLS LAST,
            p.title
    )
    SELECT app.catalogue_listing_row(o.id), o.total
    FROM ordered o
    LIMIT GREATEST(coalesce(p_limit, 24), 1)
    OFFSET GREATEST(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_experience(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.catalogue_listing_row(e.id)
    FROM app.experiences e
    JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
    WHERE e.slug = p_slug AND e.status = 'published';
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_search(
    p_q text,
    p_locale text DEFAULT 'en',
    p_category text DEFAULT NULL,
    p_destination text DEFAULT NULL,
    p_kind text DEFAULT NULL,
    p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_q text := btrim(coalesce(p_q, ''));
    v_items jsonb;
BEGIN
    WITH scored AS (
        SELECT e.id,
            CASE
                WHEN v_q = '' THEN 0::float4
                ELSE ts_rank_cd(to_tsvector('simple', e.search_text), websearch_to_tsquery('simple', v_q))
            END AS fts,
            (1 - (e.embedding <=> app.stub_embedding(v_q))) AS vec
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND e.embedding IS NOT NULL
          AND (
            v_q = ''
            OR e.search_text ILIKE '%' || v_q || '%'
            OR (v_q <> '' AND to_tsvector('simple', e.search_text) @@ websearch_to_tsquery('simple', v_q))
            OR (e.embedding <=> app.stub_embedding(v_q)) < 0.55
          )
          AND (p_category IS NULL OR p_category IN ('', 'all') OR EXISTS (
                SELECT 1 FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' AND t.slug = p_category
          ))
          AND (p_destination IS NULL OR p_destination = '' OR d.slug = p_destination)
          AND (p_kind IS NULL OR p_kind IN ('', 'all') OR e.listing_kind = p_kind)
    )
    SELECT coalesce(jsonb_agg(app.catalogue_listing_row(s.id) || jsonb_build_object(
        'score', round((0.7 * s.fts + 0.3 * greatest(s.vec, 0))::numeric, 4)
    ) ORDER BY (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) DESC, s.id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT * FROM scored
        ORDER BY (0.7 * fts + 0.3 * greatest(vec, 0)) DESC
        LIMIT GREATEST(coalesce(p_limit, 20), 1)
    ) s;

    RETURN jsonb_build_object('items', v_items, 'query', v_q, 'locale', coalesce(p_locale, 'en'));
END;
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_related(
    p_slug text,
    p_radius_m integer DEFAULT 80000,
    p_limit integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH src AS (
        SELECT e.id, e.listing_kind, v.location, v.destination_id,
               (SELECT t.slug FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' LIMIT 1) AS category
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        WHERE e.slug = p_slug AND e.status = 'published'
    )
    SELECT coalesce(jsonb_agg(item ORDER BY rank), '[]'::jsonb)
    FROM (
        SELECT app.catalogue_listing_row(e.id)
            || jsonb_build_object(
                'distance_km', round((ST_Distance(v.location, s.location) / 1000.0)::numeric, 1),
                'travel_seconds', greatest(300, round(ST_Distance(v.location, s.location) / 8.5)::int)
            ) AS item,
            (
                CASE WHEN v.destination_id = s.destination_id THEN 2 ELSE 0 END
                + CASE WHEN EXISTS (
                    SELECT 1 FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category' AND t.slug = s.category
                ) THEN 2 ELSE 0 END
                + CASE WHEN e.listing_kind = s.listing_kind THEN 1 ELSE 0 END
            ) AS rank
        FROM src s
        JOIN app.experiences e ON e.id <> s.id AND e.status = 'published'
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE ST_DWithin(v.location, s.location, GREATEST(coalesce(p_radius_m, 80000), 1000))
        ORDER BY rank DESC, ST_Distance(v.location, s.location)
        LIMIT GREATEST(coalesce(p_limit, 3), 1)
    ) ranked;
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_collections()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', c.slug,
        'title', c.title,
        'description', c.description,
        'kicker', c.kicker,
        'image', c.image_url,
        'image_alt', c.image_alt,
        'accent', c.accent,
        'stops', (SELECT count(*) FROM app.catalogue_collection_items i WHERE i.collection_id = c.id),
        'experience_slugs', coalesce((
            SELECT jsonb_agg(e.slug ORDER BY i.position)
            FROM app.catalogue_collection_items i
            JOIN app.experiences e ON e.id = i.experience_id AND e.status = 'published'
            JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
            WHERE i.collection_id = c.id
        ), '[]'::jsonb),
        'price_from', coalesce((
            SELECT sum(coalesce(pr.amount_minor, 0)) / 100
            FROM app.catalogue_collection_items i
            JOIN app.experiences e ON e.id = i.experience_id AND e.status = 'published'
            LEFT JOIN LATERAL (
                SELECT amount_minor FROM app.price_rules WHERE experience_id = e.id LIMIT 1
            ) pr ON true
            WHERE i.collection_id = c.id
        ), 0)
    ) ORDER BY c.title), '[]'::jsonb)
    FROM app.catalogue_collections c
    WHERE c.status = 'published';
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_collection(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT (
        SELECT value FROM jsonb_array_elements(app.public_catalogue_collections()) AS t(value)
        WHERE value->>'slug' = p_slug
        LIMIT 1
    );
$$;

CREATE OR REPLACE FUNCTION app.upsert_catalogue_collection(
    p_slug text,
    p_title text,
    p_description text,
    p_kicker text,
    p_image_url text,
    p_image_alt text,
    p_accent boolean,
    p_status text,
    p_experience_slugs text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_slug text := btrim(p_slug);
    v_pos integer := 1;
    v_exp uuid;
    v_item text;
BEGIN
    IF v_slug IS NULL OR length(v_slug) < 1 THEN
        RAISE EXCEPTION 'invalid slug' USING ERRCODE = '22023';
    END IF;
    IF coalesce(p_status, 'draft') NOT IN ('draft', 'published', 'archived') THEN
        RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.catalogue_collections (slug, title, description, kicker, image_url, image_alt, accent, status)
    VALUES (
        v_slug, btrim(p_title), coalesce(p_description, ''), coalesce(p_kicker, ''),
        p_image_url, p_image_alt, coalesce(p_accent, false), coalesce(p_status, 'draft')
    )
    ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        kicker = EXCLUDED.kicker,
        image_url = EXCLUDED.image_url,
        image_alt = EXCLUDED.image_alt,
        accent = EXCLUDED.accent,
        status = EXCLUDED.status,
        updated_at = now()
    RETURNING id INTO v_id;

    DELETE FROM app.catalogue_collection_items WHERE collection_id = v_id;
    IF p_experience_slugs IS NOT NULL THEN
        FOREACH v_item IN ARRAY p_experience_slugs LOOP
            SELECT id INTO v_exp FROM app.experiences WHERE slug = btrim(v_item);
            IF v_exp IS NULL THEN
                RAISE EXCEPTION 'unknown experience' USING ERRCODE = 'P0002';
            END IF;
            INSERT INTO app.catalogue_collection_items (collection_id, experience_id, position)
            VALUES (v_id, v_exp, v_pos);
            v_pos := v_pos + 1;
        END LOOP;
    END IF;
    RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_trip_from_collection(p_user_id uuid, p_slug text)
RETURNS TABLE (trip_id uuid, title text, status text, preference_overrides jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_title text;
    v_id uuid;
BEGIN
    SELECT c.title INTO v_title
    FROM app.catalogue_collections c
    WHERE c.slug = p_slug AND c.status = 'published';
    IF v_title IS NULL THEN
        RAISE EXCEPTION 'collection not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.trips (owner_id, title, status, preference_overrides)
    VALUES (p_user_id, v_title, 'draft', jsonb_build_object('source', 'explicit'))
    RETURNING id INTO v_id;
    RETURN QUERY SELECT v_id, v_title, 'draft'::text, jsonb_build_object('source', 'explicit', 'collection_slug', p_slug);
END;
$$;

CREATE OR REPLACE FUNCTION app.toggle_my_favorite(p_user_id uuid, p_listing_slug text)
RETURNS TABLE (id uuid, listing_slug text, created_at timestamptz, saved boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_slug text := btrim(p_listing_slug);
    v_id uuid;
    v_created timestamptz;
BEGIN
    IF length(v_slug) < 1 THEN
        RAISE EXCEPTION 'invalid listing' USING ERRCODE = '22023';
    END IF;
    SELECT f.id, f.created_at INTO v_id, v_created
    FROM app.account_favorites f
    WHERE f.user_id = p_user_id AND f.listing_slug = v_slug;
    IF v_id IS NOT NULL THEN
        DELETE FROM app.account_favorites f WHERE f.id = v_id AND f.user_id = p_user_id;
        RETURN QUERY SELECT v_id, v_slug, v_created, false;
        RETURN;
    END IF;
    INSERT INTO app.account_favorites (user_id, listing_slug)
    VALUES (p_user_id, v_slug)
    ON CONFLICT ON CONSTRAINT account_favorites_user_slug
        DO UPDATE SET listing_slug = EXCLUDED.listing_slug
    RETURNING account_favorites.id, account_favorites.listing_slug, account_favorites.created_at
    INTO v_id, v_slug, v_created;
    RETURN QUERY SELECT v_id, v_slug, v_created, true;
END;
$$;

CREATE OR REPLACE FUNCTION app.merge_my_favorites(p_user_id uuid, p_slugs text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_slug text;
    v_count integer := 0;
BEGIN
    IF p_slugs IS NULL THEN
        RETURN 0;
    END IF;
    FOREACH v_slug IN ARRAY p_slugs LOOP
        IF length(btrim(coalesce(v_slug, ''))) < 1 THEN
            CONTINUE;
        END IF;
        INSERT INTO app.account_favorites (user_id, listing_slug)
        VALUES (p_user_id, btrim(v_slug))
        ON CONFLICT ON CONSTRAINT account_favorites_user_slug DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION app.stub_embedding(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_price_type(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.refresh_experience_search(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.transition_experience_status(uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.transition_experience_status_by_slug(text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.catalogue_listing_row(uuid) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_destinations() TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_experiences(text, text, text, text, boolean, integer, integer, text, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_experience(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_search(text, text, text, text, text, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_related(text, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_collections() TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_collection(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.upsert_catalogue_collection(text, text, text, text, text, text, boolean, text, text[]) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.create_trip_from_collection(uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.toggle_my_favorite(uuid, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.merge_my_favorites(uuid, text[]) TO mshwar_backend;

-- --- Taxonomies --------------------------------------------------

INSERT INTO app.taxonomy (kind, slug, label) VALUES
    ('category', 'culture', 'Culture'),
    ('category', 'nature', 'Nature'),
    ('category', 'coast', 'Coast'),
    ('category', 'adventure', 'Adventure'),
    ('category', 'city', 'City'),
    ('amenity', 'restrooms', 'Restrooms'),
    ('amenity', 'shaded-seating', 'Shaded seating'),
    ('amenity', 'parking-nearby', 'Parking nearby'),
    ('amenity', 'wifi', 'Wifi'),
    ('suitability', 'families', 'Families'),
    ('suitability', 'easy-walking', 'Easy walking'),
    ('suitability', 'small-groups', 'Small groups'),
    ('suitability', 'active', 'Active'),
    ('tag', 'old-town', 'Old town'),
    ('tag', 'by-the-sea', 'By the sea'),
    ('tag', 'easy-walking', 'Easy walking'),
    ('tag', 'coast', 'Coast'),
    ('tag', 'friendly', 'Friendly'),
    ('tag', 'relaxed-pace', 'Relaxed pace'),
    ('tag', 'forest', 'Forest'),
    ('tag', 'outdoors', 'Outdoors'),
    ('tag', 'mountain-air', 'Mountain air'),
    ('tag', 'hiking', 'Hiking'),
    ('tag', 'scenic', 'Scenic'),
    ('tag', 'active', 'Active'),
    ('tag', 'heritage', 'Heritage'),
    ('tag', 'architecture', 'Architecture'),
    ('tag', 'history', 'History'),
    ('tag', 'city', 'City'),
    ('tag', 'coffee', 'Coffee'),
    ('tag', 'sunset', 'Sunset'),
    ('tag', 'harbour', 'Harbour'),
    ('tag', 'walking', 'Walking'),
    ('tag', 'lunch', 'Lunch')
ON CONFLICT (kind, slug) DO UPDATE SET label = EXCLUDED.label, active = true;

INSERT INTO app.taxonomy_translations (taxonomy_id, locale, title, description)
SELECT t.id, 'ar', t.label, t.kind
FROM app.taxonomy t
WHERE t.kind IN ('category', 'tag', 'amenity', 'suitability')
ON CONFLICT DO NOTHING;

INSERT INTO app.taxonomy_translations (taxonomy_id, locale, title, description)
SELECT t.id, 'fr', t.label, t.kind
FROM app.taxonomy t
WHERE t.kind IN ('category', 'tag', 'amenity', 'suitability')
ON CONFLICT DO NOTHING;

-- --- Seed org + destinations + listings --------------------------

INSERT INTO app.organizations (name, slug, status, verification)
VALUES ('Mshwar Catalogue', 'mshwar-catalogue', 'active', 'verified')
ON CONFLICT (slug) DO UPDATE SET status = 'active', verification = 'verified';

INSERT INTO app.destinations (slug, country_code, name, region, blurb, image_url, image_alt, location, status, tags)
VALUES
    ('byblos', 'LB', 'Byblos', 'Mount Lebanon',
     'Wander stone lanes, pause by the old harbour, and make time for a long lunch beside the Mediterranean.',
     'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1600&q=80',
     'Fishing boats in a stone harbour',
     ST_SetSRID(ST_MakePoint(35.6481, 34.1230), 4326)::geography, 'published',
     ARRAY['Old town', 'By the sea', 'Easy walking']),
    ('batroun', 'LB', 'Batroun', 'North Lebanon',
     'A friendly coastal town for a slower day by the water.',
     'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1600&q=80',
     'Stone church by the coast',
     ST_SetSRID(ST_MakePoint(35.6581, 34.2553), 4326)::geography, 'published',
     ARRAY['Coast', 'Friendly', 'Relaxed pace']),
    ('bsharri', 'LB', 'Bsharri', 'North Lebanon',
     'Mountain air, cedar forest, and a different perspective.',
     'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
     'Cedar tree against a clear sky',
     ST_SetSRID(ST_MakePoint(36.0106, 34.2508), 4326)::geography, 'published',
     ARRAY['Forest', 'Outdoors', 'Mountain air']),
    ('qadisha-valley', 'LB', 'Qadisha Valley', 'North Lebanon',
     'A valley road for people who want the journey itself.',
     'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
     'Valley road through the mountains',
     ST_SetSRID(ST_MakePoint(35.9520, 34.2450), 4326)::geography, 'published',
     ARRAY['Hiking', 'Scenic', 'Active']),
    ('baalbek', 'LB', 'Baalbek', 'Bekaa',
     'Columns, courtyards, and time to stand still.',
     'https://images.unsplash.com/photo-1555993533-2719c56586d4?auto=format&fit=crop&w=1600&q=80',
     'Ancient columns in Baalbek',
     ST_SetSRID(ST_MakePoint(36.2042, 34.0069), 4326)::geography, 'published',
     ARRAY['Heritage', 'Architecture', 'History']),
    ('beirut', 'LB', 'Beirut', 'Beirut',
     'Neighbourhoods, a long walk, and a seat facing the sea.',
     'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80',
     'Beirut coastline at dusk',
     ST_SetSRID(ST_MakePoint(35.5018, 33.8938), 4326)::geography, 'published',
     ARRAY['City', 'Coffee', 'Sunset'])
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    region = EXCLUDED.region,
    blurb = EXCLUDED.blurb,
    image_url = EXCLUDED.image_url,
    image_alt = EXCLUDED.image_alt,
    location = EXCLUDED.location,
    status = 'published',
    tags = EXCLUDED.tags;

INSERT INTO app.destination_translations (destination_id, locale, title, description)
SELECT d.id, x.locale, x.title, x.description
FROM app.destinations d
JOIN (VALUES
    ('byblos', 'ar', 'جبيل', 'أزقة حجرية وميناء قديم'),
    ('byblos', 'fr', 'Byblos', 'Ruelles de pierre et vieux port'),
    ('batroun', 'ar', 'البترون', 'بلدة ساحلية هادئة'),
    ('batroun', 'fr', 'Batroun', 'Ville côtière tranquille'),
    ('bsharri', 'ar', 'بشري', 'أرز وهواء الجبل'),
    ('bsharri', 'fr', 'Bcharre', 'Cèdres et air de montagne'),
    ('qadisha-valley', 'ar', 'وادي قاديشا', 'طريق الوادي'),
    ('qadisha-valley', 'fr', 'Vallée de Qadisha', 'La route de la vallée'),
    ('baalbek', 'ar', 'بعلبك', 'أعمدة وساحات'),
    ('baalbek', 'fr', 'Baalbek', 'Colonnes et cours'),
    ('beirut', 'ar', 'بيروت', 'من الشارع إلى البحر'),
    ('beirut', 'fr', 'Beyrouth', 'De la rue à la mer')
) AS x(slug, locale, title, description) ON x.slug = d.slug
ON CONFLICT DO NOTHING;

INSERT INTO app.venues (organization_id, destination_id, name, address, location, location_source)
SELECT o.id, d.id, d.name, d.region || ', Lebanon', d.location, 'catalogue-seed'
FROM app.organizations o
JOIN app.destinations d ON d.slug IN ('byblos', 'batroun', 'bsharri', 'qadisha-valley', 'baalbek', 'beirut')
WHERE o.slug = 'mshwar-catalogue'
  AND NOT EXISTS (
      SELECT 1 FROM app.venues v
      WHERE v.organization_id = o.id AND v.destination_id = d.id
  );

-- Seed listings via a helper so slugs stay stable.
DO $$
DECLARE
    v_org uuid;
    v_dest uuid;
    v_venue uuid;
    v_exp uuid;
    rec record;
BEGIN
    SELECT id INTO v_org FROM app.organizations WHERE slug = 'mshwar-catalogue';

    FOR rec IN
        SELECT * FROM (VALUES
            ('slow-day-byblos', 'A slow day in Byblos', 'byblos', 'culture', 'experience', 'request', 'estimated', 3500,
             'Wander stone lanes, pause by the old harbour.',
             'A slow harbour day: lanes, lunch, and time beside the water.',
             180, 'weather-sensitive', 'mixed', true, 4.6, ARRAY['old-town', 'by-the-sea', 'easy-walking'],
             'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1600&q=80',
             'Fishing boats in a stone harbour',
             '[{"title":"Time to enjoy it","body":"Allow around 3 hours for this sample experience."}]'::jsonb,
             'يوم هادئ في جبيل', 'Une journée lente à Byblos'),
            ('coastal-escapes-batroun', 'Coastal escapes in Batroun', 'batroun', 'coast', 'experience', 'request', 'from', 4500,
             'A friendly coastal town for a slower day by the water.',
             'Salt air, a swim if the sea is kind, and a long lunch.',
             240, 'weather-sensitive', 'outdoor', true, 4.4, ARRAY['coast', 'friendly', 'relaxed-pace'],
             'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
             'A quiet stretch of Mediterranean coast',
             '[{"title":"Time to enjoy it","body":"Allow around 4 hours for this sample experience."}]'::jsonb,
             'هروب ساحلي في البترون', 'Escapades côtières à Batroun'),
            ('among-ancient-cedars', 'Among the ancient cedars', 'bsharri', 'nature', 'experience', 'inquiry', 'from', 2500,
             'A day above it all.',
             'Cedar forest and a different perspective. Short walks, cooler air, and time to look up.',
             120, 'outdoor', 'outdoor', true, 4.9, ARRAY['forest', 'outdoors', 'mountain-air'],
             'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
             'Cedar tree in mountain light',
             '[{"title":"Time to enjoy it","body":"Allow around 2 hours for this sample experience."}]'::jsonb,
             'بين الأرز القديم', 'Parmi les cèdres anciens'),
            ('take-the-valley-road', 'Take the valley road', 'qadisha-valley', 'adventure', 'experience', 'request', 'from', 4000,
             'The scenic route, on purpose.',
             'A longer day for people who want the road itself — viewpoints, short walks, and a slower descent.',
             300, 'outdoor', 'outdoor', true, 4.6, ARRAY['hiking', 'scenic', 'active'],
             'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
             'Valley road through the mountains',
             '[{"title":"Time to enjoy it","body":"Allow around 5 hours for this sample experience."}]'::jsonb,
             'خذ طريق الوادي', 'Prendre la route de la vallée'),
            ('journey-through-baalbek', 'A journey through Baalbek', 'baalbek', 'culture', 'experience', 'request', 'estimated', 3000,
             'Following the stories.',
             'Give Lebanon’s history a day of your own — columns, courtyards, and time to stand still.',
             180, 'weather-sensitive', 'outdoor', true, 4.7, ARRAY['heritage', 'architecture', 'history'],
             'https://images.unsplash.com/photo-1555993533-2719c56586d4?auto=format&fit=crop&w=1600&q=80',
             'Ancient columns in Baalbek',
             '[{"title":"Time to enjoy it","body":"Allow around 3 hours for this sample experience."}]'::jsonb,
             'رحلة عبر بعلبك', 'Un voyage à Baalbek'),
            ('beirut-street-to-sea', 'Beirut, from street to sea', 'beirut', 'city', 'experience', 'inquiry', 'from', 2000,
             'Coffee, streets, and sunset.',
             'A city day that ends at the water — neighbourhoods, a long walk, and a seat facing the sea.',
             180, 'weather-sensitive', 'mixed', true, 4.6, ARRAY['city', 'coffee', 'sunset'],
             'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80',
             'Beirut coastline at dusk',
             '[{"title":"Time to enjoy it","body":"Allow around 3 hours for this sample experience."}]'::jsonb,
             'بيروت من الشارع إلى البحر', 'Beyrouth, de la rue à la mer'),
            ('byblos-harbour-walls', 'Byblos harbour walls', 'byblos', 'culture', 'attraction', 'inquiry', 'from', 1500,
             'The old harbour, at walking pace.',
             'A short wander along the harbour walls and lanes. Sample attraction details — hours and tickets must be confirmed on the day.',
             120, 'outdoor', 'outdoor', true, 4.7, ARRAY['harbour', 'heritage', 'easy-walking'],
             'https://images.unsplash.com/photo-1515542621654-7593cbd31345?auto=format&fit=crop&w=1600&q=80',
             'Stone walls and an old harbour lane',
             '[{"title":"Time to enjoy it","body":"Allow around 2 hours, including a pause by the water."}]'::jsonb,
             'أسوار ميناء جبيل', 'Remparts du port de Byblos'),
            ('beirut-souks-wander', 'Beirut Souks wander', 'beirut', 'city', 'attraction', 'inquiry', 'quote-required', NULL,
             'Lanes, coffee, and a little shade.',
             'A sample attraction card for a self-guided wander through the central lanes. No named shop is booked here.',
             120, 'indoor', 'mixed', false, 4.4, ARRAY['city', 'walking', 'coffee'],
             'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=80',
             'City lanes and shop fronts',
             '[{"title":"Time to enjoy it","body":"Allow around 2 hours if you like to linger."}]'::jsonb,
             'تجول في أسواق بيروت', 'Flânerie dans les souks de Beyrouth'),
            ('harbour-lunch-byblos', 'A harbour lunch in Byblos', 'byblos', 'coast', 'restaurant', 'request', 'estimated', 2800,
             'A long lunch beside the water.',
             'A sample restaurant idea for a harbour lunch. No specific kitchen is named or reserved.',
             120, 'indoor', 'indoor', true, 4.5, ARRAY['lunch', 'by-the-sea', 'relaxed-pace'],
             'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80',
             'A long lunch table by a window',
             '[{"title":"Time to enjoy it","body":"Allow around 2 hours for a slow lunch."}]'::jsonb,
             'غداء الميناء في جبيل', 'Un déjeuner au port de Byblos'),
            ('coastal-table-batroun', 'A coastal table in Batroun', 'batroun', 'coast', 'restaurant', 'request', 'from', 3200,
             'Salt air and a simple table.',
             'A sample restaurant idea for Batroun. This is not a reservation and does not name a kitchen.',
             120, 'weather-sensitive', 'mixed', true, 4.3, ARRAY['lunch', 'coast', 'friendly'],
             'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80',
             'A simple table set for lunch',
             '[{"title":"Time to enjoy it","body":"Allow around 2 hours, longer if the evening stretches."}]'::jsonb,
             'طاولة ساحلية في البترون', 'Une table côtière à Batroun')
        ) AS t(
            slug, title, dest, category, kind, booking, price_type, amount,
            summary, body, minutes, weather, setting, available, rating, tags,
            image, image_alt, facts, title_ar, title_fr
        )
    LOOP
        IF EXISTS (SELECT 1 FROM app.experiences WHERE slug = rec.slug) THEN
            CONTINUE;
        END IF;
        SELECT id INTO v_dest FROM app.destinations WHERE slug = rec.dest;
        SELECT id INTO v_venue FROM app.venues
        WHERE organization_id = v_org AND destination_id = v_dest LIMIT 1;

        INSERT INTO app.experiences (
            organization_id, venue_id, slug, title, description, status, booking_mode,
            duration_minutes, min_party, max_party, setting, weather_sensitivity,
            listing_kind, inventory_available, catalogue_summary, catalogue_facts, sample_rating
        ) VALUES (
            v_org, v_venue, rec.slug, rec.title, rec.body, 'published', rec.booking,
            rec.minutes, 1, 8, rec.setting, rec.weather,
            rec.kind, rec.available, rec.summary, rec.facts, rec.rating
        ) RETURNING id INTO v_exp;

        INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source)
        VALUES (
            v_exp, 'USD', rec.price_type, 'person', rec.amount, '(,)',
            'catalogue-seed'
        );

        INSERT INTO app.media (experience_id, provider, object_key, alt_text, sort_order, moderation)
        VALUES (v_exp, 'unsplash', rec.image, rec.image_alt, 0, 'approved');

        INSERT INTO app.experience_taxonomy (experience_id, term_id)
        SELECT v_exp, t.id FROM app.taxonomy t
        WHERE (t.kind = 'category' AND t.slug = rec.category)
           OR (t.kind = 'tag' AND t.slug = ANY(rec.tags))
           OR (t.kind = 'amenity' AND t.slug IN ('restrooms', 'shaded-seating'))
           OR (t.kind = 'suitability' AND t.slug IN ('families', 'easy-walking'))
        ON CONFLICT DO NOTHING;

        INSERT INTO app.experience_translations (experience_id, locale, title, description)
        VALUES
            (v_exp, 'en', rec.title, rec.body),
            (v_exp, 'ar', rec.title_ar, rec.body),
            (v_exp, 'fr', rec.title_fr, rec.body)
        ON CONFLICT DO NOTHING;

        PERFORM app.refresh_experience_search(v_exp);
    END LOOP;
END $$;

-- Draft listing used only as a leak-prevention fixture (never published).
DO $$
DECLARE
    v_org uuid;
    v_venue uuid;
    v_exp uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM app.experiences WHERE slug = 'unpublished-cedar-walk') THEN
        RETURN;
    END IF;
    SELECT id INTO v_org FROM app.organizations WHERE slug = 'mshwar-catalogue';
    SELECT v.id INTO v_venue
    FROM app.venues v
    JOIN app.destinations d ON d.id = v.destination_id
    WHERE v.organization_id = v_org AND d.slug = 'bsharri' LIMIT 1;
    INSERT INTO app.experiences (
        organization_id, venue_id, slug, title, description, status, booking_mode,
        duration_minutes, min_party, max_party, setting, weather_sensitivity, listing_kind
    ) VALUES (
        v_org, v_venue, 'unpublished-cedar-walk', 'Unpublished cedar walk',
        'Draft inventory that must never leak on public endpoints.',
        'draft', 'inquiry', 60, 1, 4, 'outdoor', 'outdoor', 'experience'
    ) RETURNING id INTO v_exp;
    INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source)
    VALUES (v_exp, 'USD', 'from', 'person', 99900, '(,)', 'catalogue-seed');
    PERFORM app.refresh_experience_search(v_exp);
END $$;

SELECT app.upsert_catalogue_collection(
    'coast-calling',
    'The coast is calling.',
    'Harbour lanes, old streets and a little sea air.',
    'Idea 01 · 2 stops',
    'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=1600&q=80',
    'Harbour boats along the coast',
    false,
    'published',
    ARRAY['slow-day-byblos', 'coastal-escapes-batroun']
);

SELECT app.upsert_catalogue_collection(
    'day-above',
    'A day above it all.',
    'Cedar forests and a different perspective.',
    'Idea 02 · 2 stops',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
    'Cedar forest in mountain light',
    true,
    'published',
    ARRAY['among-ancient-cedars', 'take-the-valley-road']
);

SELECT app.upsert_catalogue_collection(
    'following-stories',
    'Following the stories.',
    'Give Lebanon’s history a day of your own.',
    'Idea 03 · 1 stop',
    'https://images.unsplash.com/photo-1555993533-2719c56586d4?auto=format&fit=crop&w=1600&q=80',
    'Ancient columns',
    false,
    'published',
    ARRAY['journey-through-baalbek']
);

SELECT app.upsert_catalogue_collection(
    'draft-hidden-collection',
    'Hidden draft collection',
    'Must never appear on public collection endpoints.',
    'Draft',
    NULL,
    NULL,
    false,
    'draft',
    ARRAY['slow-day-byblos']
);
