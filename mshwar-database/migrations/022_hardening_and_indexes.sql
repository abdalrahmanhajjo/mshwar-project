SET search_path = app, public;

-- ============================================================
-- Migration 022: code-quality audit fixes (docs/code-quality-audit.md)
-- ============================================================
-- * range prices must carry an upper bound (CHECK treated NULL as a pass)
-- * indexes for payment/webhook lookups, booking joins and catalogue search
-- * one helper for "the price rule in force", used by catalogue and planner reads
-- * bounded admin booking list and a direct single-row portal booking lookup

-- ---- constraints -----------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'price_rules_range_has_max_check'
    ) THEN
        ALTER TABLE app.price_rules
            ADD CONSTRAINT price_rules_range_has_max_check
            CHECK (price_type <> 'range' OR max_amount_minor IS NOT NULL);
    END IF;
END $$;

-- ---- indexes -----------------------------------------------------------

CREATE INDEX IF NOT EXISTS payments_booking_created_idx ON app.payments (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_external_id_idx ON app.payments (external_id);
CREATE INDEX IF NOT EXISTS bookings_slot_id_idx ON app.bookings (slot_id);
CREATE INDEX IF NOT EXISTS bookings_experience_id_idx ON app.bookings (experience_id);
CREATE INDEX IF NOT EXISTS bookings_admin_list_idx ON app.bookings (created_at DESC, id);
CREATE INDEX IF NOT EXISTS experiences_venue_id_idx ON app.experiences (venue_id);
CREATE INDEX IF NOT EXISTS catalogue_collection_items_experience_idx ON app.catalogue_collection_items (experience_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS experience_search_text_trgm
    ON app.experiences USING gin (lower(search_text) gin_trgm_ops);

-- ---- one price rule in force -------------------------------------------
-- Catalogue, portal and planner reads used "any rule, LIMIT 1" while checkout
-- uses the rule valid at the slot time. They now share this definition.

CREATE OR REPLACE FUNCTION app.current_price_rule(p_experience uuid, p_at timestamptz DEFAULT now())
RETURNS SETOF app.price_rules
LANGUAGE sql
STABLE
-- No SET clause: keeps the function inlinable into the calling queries.
AS $$
    SELECT *
    FROM app.price_rules
    WHERE experience_id = p_experience
      AND valid_during @> p_at
    ORDER BY verified_at DESC NULLS LAST, id
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.catalogue_listing_row(p_experience_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
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
        FROM app.current_price_rule(e.id)
    ) pr ON true
    WHERE e.id = p_experience_id
      AND e.status = 'published'
      AND o.status = 'active'
      AND (d.id IS NULL OR d.status = 'published');
$function$;

CREATE OR REPLACE FUNCTION app.planner_retrieve_candidates(p_constraints jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
DECLARE
    v_q text := btrim(coalesce(p_constraints->>'query', p_constraints->>'raw_text', ''));
    v_party integer := NULLIF(p_constraints->>'party_size', '')::integer;
    v_limit integer := GREATEST(coalesce(NULLIF(p_constraints->>'candidate_limit', '')::integer, 24), 1);
    v_items jsonb;
    v_tsq tsquery;
BEGIN
    IF v_q <> '' THEN
        BEGIN
            v_tsq := websearch_to_tsquery('simple', v_q);
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                v_tsq := plainto_tsquery('simple', v_q);
            EXCEPTION WHEN OTHERS THEN
                v_tsq := NULL;
            END;
        END;
    END IF;
    WITH scored AS (
        SELECT e.id,
            CASE
                WHEN v_tsq IS NULL THEN 0::float4
                ELSE ts_rank_cd(to_tsvector('simple', coalesce(e.search_text, e.title || ' ' || e.description)), v_tsq)
            END AS fts,
            CASE
                WHEN v_q = '' THEN 0::float4
                ELSE (1 - (e.embedding <=> app.stub_embedding(v_q)))
            END AS vec
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id
            AND o.status = 'active' AND o.verification = 'verified'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND e.embedding IS NOT NULL
          AND (v_party IS NULL OR (e.min_party <= v_party AND e.max_party >= v_party))
          AND (
                p_constraints->'destination_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'destination_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'destination_slugs') = 0
                OR d.slug IN (SELECT jsonb_array_elements_text(p_constraints->'destination_slugs'))
          )
          AND (
                p_constraints->'kind_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'kind_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'kind_slugs') = 0
                OR e.listing_kind IN (SELECT jsonb_array_elements_text(p_constraints->'kind_slugs'))
          )
          AND (
                p_constraints->'category_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'category_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'category_slugs') = 0
                OR EXISTS (
                    SELECT 1 FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category'
                      AND t.slug IN (SELECT jsonb_array_elements_text(p_constraints->'category_slugs'))
                )
          )
    )
    SELECT coalesce(jsonb_agg(item ORDER BY rank DESC, id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT s.id,
            (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) AS rank,
            jsonb_build_object(
                'id', e.id,
                'slug', e.slug,
                'title', e.title,
                'description', e.description,
                'status', e.status,
                'duration_minutes', e.duration_minutes,
                'min_party', e.min_party,
                'max_party', e.max_party,
                'setting', e.setting,
                'intensity', e.intensity,
                'listing_kind', e.listing_kind,
                'inventory_available', e.inventory_available,
                'destination_slug', d.slug,
                'destination_name', d.name,
                'venue_id', v.id,
                'venue_name', v.name,
                'lat', ST_Y(v.location::geometry),
                'lng', ST_X(v.location::geometry),
                'fts', s.fts,
                'vec', s.vec,
                'hybrid', round((0.7 * s.fts + 0.3 * greatest(s.vec, 0))::numeric, 4),
                'sponsored', EXISTS (
                    SELECT 1 FROM app.planner_sponsorships sp
                    WHERE sp.experience_id = e.id AND sp.active
                ),
                'sponsored_label', (
                    SELECT sp.label FROM app.planner_sponsorships sp
                    WHERE sp.experience_id = e.id AND sp.active
                ),
                'category_slugs', coalesce((
                    SELECT jsonb_agg(t.slug ORDER BY t.slug)
                    FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category'
                ), '[]'::jsonb),
                'interest_slugs', coalesce((
                    SELECT jsonb_agg(t.slug ORDER BY t.slug)
                    FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind IN ('interest', 'tag')
                ), '[]'::jsonb),
                'price', jsonb_build_object(
                    'currency', coalesce(pr.currency, 'USD'),
                    'type', coalesce(pr.price_type, 'from'),
                    'source', coalesce(pr.source, 'unknown'),
                    'amount_minor', pr.amount_minor,
                    'unit', coalesce(pr.unit, 'person')
                ),
                'hours', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                        'weekday', h.weekday, 'opens', h.opens, 'closes', h.closes
                    ) ORDER BY h.weekday)
                    FROM app.opening_hours h WHERE h.venue_id = v.id
                ), '[]'::jsonb),
                'exceptions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                        'local_date', x.local_date, 'closed', x.closed,
                        'opens', x.opens, 'closes', x.closes
                    ))
                    FROM app.opening_exceptions x WHERE x.venue_id = v.id
                ), '[]'::jsonb),
                'facts', coalesce(e.catalogue_facts, '[]'::jsonb)
            ) AS item
        FROM scored s
        JOIN app.experiences e ON e.id = s.id
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        LEFT JOIN LATERAL (
            SELECT currency, price_type, source, amount_minor, unit
            FROM app.current_price_rule(e.id)
        ) pr ON true
        ORDER BY (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) DESC, e.id
        LIMIT v_limit
    ) q;

    RETURN coalesce(v_items, '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION app.public_catalogue_collections()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
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
                SELECT amount_minor FROM app.current_price_rule(e.id)
            ) pr ON true
            WHERE i.collection_id = c.id
        ), 0)
    ) ORDER BY c.title), '[]'::jsonb)
    FROM app.catalogue_collections c
    WHERE c.status = 'published';
$function$;

CREATE OR REPLACE FUNCTION app.public_catalogue_experiences(p_q text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_destination text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_available boolean DEFAULT NULL::boolean, p_price_max integer DEFAULT NULL::integer, p_party integer DEFAULT NULL::integer, p_sort text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS TABLE(listing jsonb, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
    WITH published AS (
        SELECT e.id, e.slug, e.title, e.duration_minutes, e.listing_kind, e.inventory_available,
               e.sample_rating, e.search_text, d.slug AS destination_slug,
               (SELECT t.slug FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' LIMIT 1) AS category,
               (SELECT amount_minor FROM app.current_price_rule(e.id)) AS amount_minor
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
                SELECT coalesce(amount_minor, 0) FROM app.current_price_rule(e.id)
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
$function$;

CREATE OR REPLACE FUNCTION app.get_experience_portal(p_user uuid, p_org uuid, p_experience uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
DECLARE
    e app.experiences;
    v_lng double precision;
    v_lat double precision;
    v_venue app.venues;
BEGIN
    IF NOT app.has_capability(p_user, p_org, 'listings')
       AND NOT app.is_platform_admin(p_user) THEN
        RAISE EXCEPTION 'capability denied: listings' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = p_org;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'experience not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_venue FROM app.venues WHERE id = e.venue_id;
    SELECT ST_X(v_venue.location::geometry), ST_Y(v_venue.location::geometry) INTO v_lng, v_lat;
    RETURN jsonb_build_object(
        'id', e.id,
        'organization_id', e.organization_id,
        'venue_id', e.venue_id,
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'status', e.status,
        'booking_mode', e.booking_mode,
        'duration_minutes', e.duration_minutes,
        'min_party', e.min_party,
        'max_party', e.max_party,
        'min_age', e.min_age,
        'setting', e.setting,
        'intensity', e.intensity,
        'weather_sensitivity', e.weather_sensitivity,
        'weather_rules', e.weather_rules,
        'updated_at', e.updated_at,
        'venue', jsonb_build_object(
            'id', v_venue.id,
            'name', v_venue.name,
            'address', v_venue.address,
            'lng', v_lng,
            'lat', v_lat
        ),
        'category', (
            SELECT t.slug FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'category' LIMIT 1
        ),
        'suitability', coalesce((
            SELECT jsonb_agg(t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'suitability'
        ), '[]'::jsonb),
        'weather', coalesce((
            SELECT jsonb_agg(t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'weather'
        ), '[]'::jsonb),
        'images', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', m.id, 'object_key', m.object_key, 'alt_text', m.alt_text, 'sort_order', m.sort_order
            ) ORDER BY m.sort_order) FROM app.media m WHERE m.experience_id = e.id
        ), '[]'::jsonb),
        'price', (
            SELECT jsonb_build_object(
                'currency', pr.currency, 'price_type', pr.price_type, 'unit', pr.unit,
                'amount_minor', pr.amount_minor, 'max_amount_minor', pr.max_amount_minor
            ) FROM app.current_price_rule(e.id) pr
        ),
        'policy', (
            SELECT jsonb_build_object(
                'version', p.version, 'cancellation_rules', p.cancellation_rules, 'terms_text', p.terms_text
            ) FROM app.policies p WHERE p.experience_id = e.id ORDER BY p.version DESC LIMIT 1
        ),
        'publish_report', app.experience_publish_report(e.id)
    );
END;
$function$;

-- ---- bounded booking reads -----------------------------------------------

-- Returns one booking instead of building the organisation's whole list first.
-- Keep the fields in sync with app.list_portal_bookings.
CREATE OR REPLACE FUNCTION app.portal_booking_row(p_user uuid, p_org uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'bookings');
    RETURN (
        SELECT jsonb_build_object(
            'id', b.id,
            'status', b.status,
            'party_size', b.party_size,
            'traveller_note', b.traveller_note,
            'experience_id', b.experience_id,
            'experience_title', e.title,
            'slot_id', b.slot_id,
            'starts_at', s.starts_at,
            'ends_at', s.ends_at,
            'capacity', s.capacity,
            'reserved', s.reserved,
            'remaining', s.capacity - s.reserved,
            'customer_id', b.customer_id,
            'mode', b.mode,
            'total_minor', b.total_minor,
            'currency', b.currency,
            'reason', b.reason,
            'created_at', b.created_at,
            'trip_stop_id', b.trip_stop_id
        )
        FROM app.bookings b
        JOIN app.experiences e ON e.id = b.experience_id
        JOIN app.slots s ON s.id = b.slot_id
        WHERE b.id = p_booking AND b.organization_id = p_org
    );
END;
$$;

-- The admin list returned every booking on the platform in one response.
DROP FUNCTION IF EXISTS app.list_admin_bookings(uuid);
CREATE FUNCTION app.list_admin_bookings(p_admin uuid, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_limit < 1 OR p_limit > 500 OR p_offset < 0 THEN
        RAISE EXCEPTION 'invalid page' USING ERRCODE = '22023';
    END IF;
    RETURN (
        SELECT coalesce(jsonb_agg(row_json ORDER BY created_at DESC, id), '[]'::jsonb)
        FROM (
            SELECT b.id, b.created_at, jsonb_build_object(
                'id', b.id,
                'status', b.status,
                'organization_id', b.organization_id,
                'experience_id', b.experience_id,
                'experience_title', e.title,
                'party_size', b.party_size,
                'total_minor', b.total_minor,
                'currency', b.currency,
                'created_at', b.created_at
            ) AS row_json
            FROM app.bookings b
            JOIN app.experiences e ON e.id = b.experience_id
            ORDER BY b.created_at DESC, b.id
            LIMIT p_limit OFFSET p_offset
        ) page
    );
END;
$$;

-- ---- function privileges ---------------------------------------------
-- Functions get EXECUTE for PUBLIC by default. The per-schema default in 004 cannot
-- remove a global default, so functions added since then (019–021) were callable by
-- any role with schema usage, including SECURITY DEFINER payment functions.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO mshwar_backend;
GRANT EXECUTE ON FUNCTION app.actor_id() TO mshwar_reader;
