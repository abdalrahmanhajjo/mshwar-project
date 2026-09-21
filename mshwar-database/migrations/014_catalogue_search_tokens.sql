SET search_path = app, public;

-- ============================================================
-- Migration 014: Token-based catalogue search
-- MSHWAR-37
-- Phrase ILIKE plus simple FTS require every word, including
-- stopwords like "in". Natural queries such as "cedars in Bsharri"
-- must still hit published listings that contain those keywords.
-- ============================================================

CREATE OR REPLACE FUNCTION app.catalogue_search_tokens(p_q text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT coalesce(array_agg(DISTINCT tok), '{}'::text[])
    FROM unnest(regexp_split_to_array(lower(btrim(coalesce(p_q, ''))), '[[:space:][:punct:]]+')) AS tok
    WHERE length(tok) >= 2
      AND tok NOT IN (
          'in', 'the', 'a', 'an', 'of', 'and', 'or', 'not', 'to', 'at', 'on',
          'for', 'with', 'from', 'by', 'near', 'around', 'dans', 'de', 'et',
          'la', 'le', 'les', 'un', 'une', 'du', 'des',
          'في', 'من', 'إلى', 'و'
      );
$$;

CREATE OR REPLACE FUNCTION app.catalogue_text_matches(p_search_text text, p_q text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        btrim(coalesce(p_q, '')) = ''
        OR strpos(lower(coalesce(p_search_text, '')), lower(btrim(p_q))) > 0
        OR (
            cardinality(app.catalogue_search_tokens(p_q)) > 0
            AND (
                SELECT bool_and(strpos(lower(coalesce(p_search_text, '')), tok) > 0)
                FROM unnest(app.catalogue_search_tokens(p_q)) AS tok
            )
        );
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
          AND app.catalogue_text_matches(e.search_text, p_q)
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
    v_tokens text[] := app.catalogue_search_tokens(v_q);
    v_tsquery tsquery := NULL;
    v_items jsonb;
BEGIN
    BEGIN
        IF cardinality(v_tokens) > 0 THEN
            v_tsquery := to_tsquery(
                'simple',
                array_to_string(ARRAY(SELECT tok || ':*' FROM unnest(v_tokens) AS tok), ' & ')
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            v_tsquery := NULL;
    END;

    WITH scored AS (
        SELECT e.id,
            CASE
                WHEN v_tsquery IS NULL THEN 0::float4
                ELSE ts_rank_cd(to_tsvector('simple', e.search_text), v_tsquery)
            END AS fts,
            (1 - (e.embedding <=> app.stub_embedding(v_q))) AS vec
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND e.embedding IS NOT NULL
          AND app.catalogue_text_matches(e.search_text, v_q)
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

GRANT EXECUTE ON FUNCTION app.catalogue_search_tokens(text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.catalogue_text_matches(text, text) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_experiences(text, text, text, text, boolean, integer, integer, text, integer, integer) TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.public_catalogue_search(text, text, text, text, text, integer) TO mshwar_backend;
