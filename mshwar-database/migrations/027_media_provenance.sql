SET search_path = app, public;

-- ============================================================
-- Migration 027: Image provenance / attribution on app.media
--
-- Additive and reversible. Adds nullable columns so catalogue images imported
-- from external sources (e.g. Wikimedia Commons) can record where each image
-- came from, under what licence, and who to credit — as required to reuse
-- CC-BY / CC-BY-SA images lawfully. Existing rows are untouched (all NULL).
--
-- No data is moved or deleted; no policy or grant changes are needed (the
-- existing org_access policy and GRANTs on app.media already cover these
-- columns). Down-migration, if ever needed:
--   ALTER TABLE app.media
--     DROP COLUMN captured_at, DROP COLUMN attribution, DROP COLUMN license_url,
--     DROP COLUMN license, DROP COLUMN source_url, DROP COLUMN source;
-- ============================================================

ALTER TABLE app.media
    ADD COLUMN IF NOT EXISTS source text,
    ADD COLUMN IF NOT EXISTS source_url text,
    ADD COLUMN IF NOT EXISTS license text,
    ADD COLUMN IF NOT EXISTS license_url text,
    ADD COLUMN IF NOT EXISTS attribution text,
    ADD COLUMN IF NOT EXISTS captured_at timestamptz;

COMMENT ON COLUMN app.media.source IS 'Provenance: origin of the image, e.g. ''wikimedia-commons'', ''owner-upload''.';
COMMENT ON COLUMN app.media.source_url IS 'Canonical URL of the source record (e.g. the Commons file description page).';
COMMENT ON COLUMN app.media.license IS 'Licence short name as recorded at import, e.g. ''CC BY-SA 4.0''.';
COMMENT ON COLUMN app.media.license_url IS 'URL of the licence deed.';
COMMENT ON COLUMN app.media.attribution IS 'Required credit line for the image (author / uploader).';
COMMENT ON COLUMN app.media.captured_at IS 'When provenance was recorded by the importer.';
