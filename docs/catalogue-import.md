# Catalogue import — real Lebanese places

This is the runbook for replacing the sample/placeholder catalogue with a real,
source-verified catalogue covering all eight governorates of Lebanon. It uses the
existing schema and the existing public catalogue API — **no parallel data model.**

## What it is

- **Dataset:** `services/api/app/seed/lebanon_catalogue.py` — 52 real places across
  the 8 muhafazat, each with real coordinates (validated to fall inside Lebanon),
  English/Arabic/French names, a normalised category + type tags, a short factual
  summary, a Wikimedia Commons image candidate, and a `source_url` for provenance.
- **Importer:** `services/api/app/seed/catalogue_import.py` — idempotent, RLS-aware,
  transactional; upserts into `app.destinations / venues / experiences /
experience_taxonomy / experience_translations / taxonomy / price_rules / media`.
- **Migration:** `mshwar-database/migrations/027_media_provenance.sql` — adds nullable
  image provenance/attribution columns to `app.media` (additive, reversible).

## Guarantees (why this is safe to run)

- **Idempotent.** Keys: `destinations.slug`, `experiences.slug`,
  `venues.source_reference = 'curated:<slug>'`, `taxonomy(kind,slug)`,
  `media(provider,object_key)`. Run it as many times as you like — no duplicates,
  no second image upload.
- **No invented data.** No ratings (`sample_rating` stays NULL). No prices — each
  listing gets a `quote-required` price rule that the UI shows as **"On request"**,
  never a fake `$0`. No phone numbers, no operating hours. `duration_minutes` is a
  schema-required _suggested visit time_ per category, never presented as opening
  hours. The only facts written are verifiable ones (e.g. UNESCO inscription) plus a
  photo credit.
- **Real, licensed images only.** Each image is resolved from Wikimedia Commons, the
  licence is checked against an allow-list (CC0 / CC-BY / CC-BY-SA / public domain;
  NC/ND/non-free rejected), the attribution is recorded, and the file is stored via
  the existing **ImageKit** integration. If the licence can't be confirmed, or
  ImageKit isn't configured, the listing stays **imageless** — a wrong or unlicensed
  image is never attached. A visible "Photo" credit is added for attribution.
- **Safe DB use.** Reads `DATABASE_URL` (never hardcoded). Single transaction, rolls
  back on any error. Refuses to write without `--yes`, and prints the target DB
  (host/name/user) first. Never runs DROP / TRUNCATE, never deletes user data.
- **Provenance.** `venues.location_source='curated'`, `venues.source_reference`,
  `venues.source_expires_at` (180 days → re-verify), and the new `media` columns
  (`source`, `source_url`, `license`, `license_url`, `attribution`, `captured_at`).

## Prerequisites

1. Migrations are applied (the migrate step runs `027_media_provenance.sql`).
2. Run with the **owner / migration** `DATABASE_URL` (the same one `migrate` uses —
   `postgres` on staging). The importer sets the RLS org context so it also works
   under `mshwar_backend`; a restricted `mshwar_api` role will be blocked by RLS.
3. For images: `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` set (otherwise use
   `--no-images` and add images later). The host needs outbound network to
   `commons.wikimedia.org` / `upload.wikimedia.org` — the server has it; the CI
   sandbox and the local device bridge do not.

## Running it

Preview only (no DB, no network) — validates the dataset and prints coverage:

```bash
python -m app.seed.catalogue_import --dry-run --report catalogue_report.md
```

Full import on the server (from the API container), text + images:

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml \
  exec -e DATABASE_URL="$OWNER_DATABASE_URL" api \
  python -m app.seed.catalogue_import --yes --report /tmp/catalogue_report.md
```

Text only (no ImageKit yet):

```bash
python -m app.seed.catalogue_import --yes --no-images
```

Also retire the old migration-013 sample listings (sets them to `archived`, never
deletes):

```bash
python -m app.seed.catalogue_import --yes --archive-samples
```

Flags: `--dry-run`, `--yes`, `--no-images`, `--archive-samples`, `--report PATH`,
`--database-url URL`.

## Turning off the sample fallback

The web app only shows the bundled sample catalogue when the API is unreachable and
`CATALOGUE_SAMPLE_FALLBACK` allows it. For production, set `CATALOGUE_SAMPLE_FALLBACK=false`
in the web service environment so the real catalogue (or an empty state) is the only
thing users ever see.

## Adding or correcting a place

Edit `lebanon_catalogue.py`: add a `Place` dict (unique `slug`, real `lat`/`lng`
inside Lebanon, `governorate` one of the 8, `category` one of the 5 facets, `tags`
from `TAG_LABELS`, a `source_url`). Run `--dry-run` — it validates coordinates,
duplicates and taxonomy. Then re-run the import; existing rows update in place.

## Extending taxonomy

Add a tag to `TAG_LABELS` before using it on a place (the validator rejects unknown
tags). Categories are intentionally fixed to the five schema facets; finer types are
tags, so the existing filters keep working.
