# mypy: ignore-errors
# Operational seed script (the whole app/seed/ package is excluded from mypy);
# this marker keeps that true even when a type-checked test imports from it.
"""Idempotent importer for the real Lebanese catalogue.

Loads ``lebanon_catalogue.py`` (real, source-verified places) and upserts it into
the live schema — the same ``app.*`` tables the public catalogue API already reads.
It creates **no parallel data model**: destinations, venues, experiences, media,
taxonomy and translations are the existing tables.

Guarantees
----------
* **Idempotent.** Every row is keyed on a stable identity (destination.slug,
  experience.slug, venue.source_reference = ``curated:<slug>``, taxonomy(kind,slug),
  media(provider,object_key)). Running twice makes no duplicates and no second
  ImageKit upload.
* **No invented data.** No ratings (``sample_rating`` stays NULL), no prices
  (a ``quote-required`` price rule marks "price on request"), no phone numbers,
  no operating hours. ``duration_minutes`` is a schema-required *suggested visit
  time*, never presented as opening hours. Only verifiable facts (e.g. UNESCO
  inscription) are written as ``catalogue_facts``.
* **Real, licensed images only.** Each image is resolved from Wikimedia Commons,
  its licence is checked against an allow-list, its attribution recorded, and it
  is stored through the existing ImageKit integration. If the licence cannot be
  confirmed the listing stays imageless — a wrong or unlicensed image is never
  attached.
* **Safe DB use.** Single transaction, rolls back on error. Reads ``DATABASE_URL``
  (never hardcoded). Refuses to run without an explicit confirmation. Never drops,
  truncates or deletes user data.
* **Provenance.** venue.location_source='curated', venue.source_reference,
  venue.source_expires_at; media provenance columns (migration 027) record the
  Commons source URL, licence and attribution.

Run it with the **owner/migration** ``DATABASE_URL`` (the same one the migrate
step uses). It sets the RLS org context so it also works under ``mshwar_backend``.

Usage
-----
    python -m app.seed.catalogue_import --dry-run          # validate + plan, no writes
    python -m app.seed.catalogue_import --yes              # import (text + images)
    python -m app.seed.catalogue_import --yes --no-images  # import text only
    python -m app.seed.catalogue_import --yes --archive-samples
    python -m app.seed.catalogue_import --report report.md # write a deliverables report

``--dry-run`` needs neither the database nor the network.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from app.seed.lebanon_catalogue import (
    GOVERNORATES,
    LEBANON_BBOX,
    PLACES,
    TAG_LABELS,
    Place,
)

CATALOGUE_ORG_SLUG = "mshwar-catalogue"

VALID_CATEGORIES = {"culture", "nature", "coast", "adventure", "city"}
VALID_LISTING_KINDS = {"experience", "attraction", "restaurant"}

# The base category taxonomy (migration 013 seeds exactly these five).
CATEGORY_LABELS = {
    "culture": "Culture",
    "nature": "Nature",
    "coast": "Coast",
    "adventure": "Adventure",
    "city": "City",
}

# Schema requires duration_minutes > 0. This is a *suggested visit time* per
# category, NOT operating hours and NOT a claim about any business. Documented
# as such; never surfaced as a fact.
SUGGESTED_VISIT_MINUTES = {
    "museum": 90,
    "shrine": 45,
    "viewpoint": 45,
    "ski": 240,
    "winery": 90,
    "waterfall": 90,
    "cave": 75,
}
DEFAULT_VISIT_MINUTES = 120

# Two coordinates closer than this (deg) for two different slugs are flagged as a
# likely duplicate. ~0.0004 deg ~= 40 m.
DUP_COORD_EPSILON = 0.0004

# Wikimedia Commons licences we accept are decided in _license_allowed().
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
_UA = "MshwarCatalogueImporter/1.0 (+https://mshwar-lb.com; contact abedhajjo57@gmail.com)"


# ---------------------------------------------------------------------------
# Validation (pure — no DB, no network)
# ---------------------------------------------------------------------------
def _in_lebanon(lat: float, lng: float) -> bool:
    return (
        LEBANON_BBOX["lat_min"] <= lat <= LEBANON_BBOX["lat_max"]
        and LEBANON_BBOX["lng_min"] <= lng <= LEBANON_BBOX["lng_max"]
    )


def _place_field_errors(p: Place, gov_slugs: set[str]) -> list[str]:
    """Field-level checks for a single place (no cross-record state)."""
    errors: list[str] = []
    where = p.get("slug") or p.get("name_en", "?")
    if not p.get("slug"):
        errors.append(f"{where}: missing slug")
    if not p.get("name_en"):
        errors.append(f"{where}: missing name_en")
    if not p.get("summary_en"):
        errors.append(f"{where}: missing summary_en")
    if not p.get("source_url"):
        errors.append(f"{where}: missing source_url (provenance)")
    if p.get("governorate") not in gov_slugs:
        errors.append(f"{where}: governorate '{p.get('governorate')}' is not one of the 8 muhafazat")
    if p.get("category") not in VALID_CATEGORIES:
        errors.append(f"{where}: category '{p.get('category')}' not in {sorted(VALID_CATEGORIES)}")
    if p.get("listing_kind") not in VALID_LISTING_KINDS:
        errors.append(f"{where}: listing_kind '{p.get('listing_kind')}' invalid")
    errors.extend(
        f"{where}: tag '{tag}' not in normalised vocabulary" for tag in p.get("tags", []) if tag not in TAG_LABELS
    )
    lat, lng = p.get("lat"), p.get("lng")
    if lat is None or lng is None:
        errors.append(f"{where}: missing coordinates")
    elif not _in_lebanon(float(lat), float(lng)):
        errors.append(f"{where}: coordinate ({lat},{lng}) is outside Lebanon")
    return errors


def _duplicate_errors(coords: list[tuple[str, float, float]]) -> list[str]:
    errors: list[str] = []
    for i in range(len(coords)):
        s1, la1, ln1 = coords[i]
        for j in range(i + 1, len(coords)):
            s2, la2, ln2 = coords[j]
            if abs(la1 - la2) < DUP_COORD_EPSILON and abs(ln1 - ln2) < DUP_COORD_EPSILON:
                errors.append(f"{s1} and {s2}: coordinates are duplicates (<~40m apart)")
    return errors


def validate_dataset() -> list[str]:
    """Return a list of human-readable problems; empty means the dataset is clean."""
    errors: list[str] = []
    gov_slugs = {g["slug"] for g in GOVERNORATES}
    seen_slugs: set[str] = set()
    coords: list[tuple[str, float, float]] = []

    for p in PLACES:
        slug = p.get("slug", "")
        if slug and slug in seen_slugs:
            errors.append(f"{slug}: duplicate slug")
        seen_slugs.add(slug)
        errors.extend(_place_field_errors(p, gov_slugs))
        lat, lng = p.get("lat"), p.get("lng")
        if lat is not None and lng is not None and _in_lebanon(float(lat), float(lng)):
            coords.append((slug, float(lat), float(lng)))

    errors.extend(_duplicate_errors(coords))
    return errors


def suggested_minutes(p: Place) -> int:
    for tag in p.get("tags", []):
        if tag in SUGGESTED_VISIT_MINUTES:
            return SUGGESTED_VISIT_MINUTES[tag]
    return DEFAULT_VISIT_MINUTES


def derive_setting(p: Place) -> str:
    tags = set(p.get("tags", []))
    if "museum" in tags:
        return "indoor"
    outdoorish = {
        "archaeological-site",
        "waterfall",
        "cave",
        "forest",
        "mountain",
        "viewpoint",
        "beach",
        "ski",
        "hiking",
        "castle",
        "citadel",
        "temple",
        "seaside",
        "river",
        "lake",
        "nature-reserve",
        "cedars",
        "promenade",
        "garden",
        "port",
    }
    if p.get("category") in {"nature", "coast", "adventure"} or (tags & outdoorish):
        return "outdoor"
    return "mixed"


def derive_weather(setting: str) -> str:
    return {"indoor": "indoor", "outdoor": "outdoor"}.get(setting, "weather-sensitive")


def build_facts(p: Place) -> list[dict[str, str]]:
    """Only verifiable, non-business facts."""
    facts: list[dict[str, str]] = []
    if "unesco" in p.get("tags", []):
        facts.append({"title": "UNESCO World Heritage", "body": "Part of a UNESCO World Heritage inscription."})
    return facts


def _photo_credit_fact(attribution: str, license_name: str) -> dict[str, str]:
    """A visible photo credit satisfies CC-BY / CC-BY-SA attribution."""
    body = (
        f"{attribution} — {license_name} (via Wikimedia Commons)"
        if license_name
        else f"{attribution} (via Wikimedia Commons)"
    )
    return {"title": "Photo", "body": body}


def coverage(places: list[Place]) -> dict[str, Any]:
    by_gov: dict[str, int] = {}
    by_cat: dict[str, int] = {}
    by_kind: dict[str, int] = {}
    by_tag: dict[str, int] = {}
    with_image = 0
    for p in places:
        by_gov[p["governorate"]] = by_gov.get(p["governorate"], 0) + 1
        by_cat[p["category"]] = by_cat.get(p["category"], 0) + 1
        by_kind[p["listing_kind"]] = by_kind.get(p["listing_kind"], 0) + 1
        for t in p.get("tags", []):
            by_tag[t] = by_tag.get(t, 0) + 1
        if p.get("image_commons"):
            with_image += 1
    return {
        "total": len(places),
        "by_governorate": dict(sorted(by_gov.items())),
        "by_category": dict(sorted(by_cat.items())),
        "by_listing_kind": dict(sorted(by_kind.items())),
        "by_tag": dict(sorted(by_tag.items(), key=lambda kv: (-kv[1], kv[0]))),
        "with_commons_image": with_image,
        "without_image": len(places) - with_image,
    }


# ---------------------------------------------------------------------------
# Image resolution (network — only used during a real import)
# ---------------------------------------------------------------------------
@dataclass
class ResolvedImage:
    upload_bytes: bytes
    content_type: str
    filename: str
    source_url: str
    license: str
    license_url: str
    attribution: str


def _license_allowed(short: str, raw: str) -> bool:
    """True only for reusable licences (CC0 / CC-BY / CC-BY-SA / public domain).
    Non-commercial (NC), no-derivatives (ND), non-free and 'all rights reserved'
    are rejected."""
    text = f"{short} {raw}".lower().strip()
    rejected = (
        "cc-by-nc",
        "cc by-nc",
        "cc-by-nd",
        "cc by-nd",
        "noncommercial",
        "non-commercial",
        "noderiv",
        "no derivative",
        "non-free",
        "nonfree",
        "fair use",
        "all rights reserved",
    )
    if any(marker in text for marker in rejected):
        return False
    if "public domain" in text or text.startswith("pd"):
        return True
    return text.startswith("cc0") or text.startswith("cc-by") or text.startswith("cc by")


def _ext_value(ext: dict[str, Any], key: str) -> str:
    node = ext.get(key)
    return str(node.get("value", "")) if isinstance(node, dict) else ""


def _parse_imageinfo(info: dict[str, Any], title: str) -> ResolvedImage | None:
    """Turn a Commons imageinfo record into a ResolvedImage (metadata only, no bytes)
    if the licence is reusable and it is really an image; otherwise None."""
    ext = info.get("extmetadata", {}) or {}
    short = _ext_value(ext, "LicenseShortName")
    raw = _ext_value(ext, "License")
    if not _license_allowed(short, raw):
        return None
    mime = str(info.get("mime", "image/jpeg"))
    url = info.get("url")
    if not mime.startswith("image/") or not url:
        return None
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/svg+xml": ".svg"}
    base = title.split(":", 1)[-1].rsplit(".", 1)[0][:80]
    descr_url = info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}"
    return ResolvedImage(
        upload_bytes=b"",  # filled by the caller after download
        content_type=mime,
        filename=f"{base}{ext_map.get(mime, '.jpg')}",
        source_url=descr_url,
        license=short or raw,
        license_url=_ext_value(ext, "LicenseUrl"),
        attribution=_strip_html(_ext_value(ext, "Artist")) or "Wikimedia Commons",
    )


def resolve_commons_image(commons_file: str, *, timeout: float = 20.0) -> ResolvedImage | None:
    """Fetch a Commons file's URL + licence + attribution, verify the licence, and
    return the bytes to upload. Returns None if the file is missing, the licence is
    not reusable, or the download fails. Never raises for a single bad image."""
    import httpx  # lazy: not needed for --dry-run

    title = commons_file if commons_file.lower().startswith("file:") else f"File:{commons_file}"
    params = {
        "action": "query",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "format": "json",
        "formatversion": "2",
    }
    headers = {"User-Agent": _UA}
    try:
        with httpx.Client(timeout=timeout, headers=headers, follow_redirects=True) as client:
            resp = client.get(COMMONS_API, params=params)
            if resp.status_code != 200:
                return None
            pages = resp.json().get("query", {}).get("pages", [])
            if not pages or "imageinfo" not in pages[0]:
                return None
            meta = _parse_imageinfo(pages[0]["imageinfo"][0], title)
            if meta is None:
                return None
            img = client.get(pages[0]["imageinfo"][0]["url"])
            if img.status_code != 200 or not img.content or len(img.content) > 15 * 1024 * 1024:
                return None
            meta.upload_bytes = img.content
            return meta
    except Exception:
        return None


def _wiki_title_from_url(source_url: str) -> str | None:
    """Extract the article title from an en.wikipedia.org/wiki/<Title> URL."""
    from urllib.parse import unquote

    marker = "/wiki/"
    if "wikipedia.org" not in source_url or marker not in source_url:
        return None
    title = source_url.split(marker, 1)[1].split("#", 1)[0].split("?", 1)[0]
    return unquote(title).replace("_", " ") or None


def wikipedia_lead_image(title: str, *, timeout: float = 20.0) -> str | None:
    """Return the Commons file name of a Wikipedia article's lead image (the actual
    photo shown on the page), or None. This replaces guessing Commons filenames."""
    import httpx  # lazy: not needed for --dry-run

    params = {
        "action": "query",
        "prop": "pageimages",
        "piprop": "name",
        "titles": title,
        "format": "json",
        "formatversion": "2",
        "redirects": "1",
    }
    try:
        with httpx.Client(timeout=timeout, headers={"User-Agent": _UA}, follow_redirects=True) as client:
            resp = client.get(WIKIPEDIA_API, params=params)
            if resp.status_code != 200:
                return None
            pages = resp.json().get("query", {}).get("pages", [])
            if not pages:
                return None
            name = pages[0].get("pageimage")
            return str(name) if name else None
    except Exception:
        return None


def _year_of(datestr: str) -> int:
    """Extract a plausible 19xx/20xx year from a Commons DateTimeOriginal, else 0."""
    import re

    m = re.search(r"(19|20)\d{2}", datestr or "")
    return int(m.group(0)) if m else 0


# Skip obvious non-photographs even when geotagged near a place.
_BAD_TITLE_HINTS = ("locator", "location map", "coat of arms", "flag of", "logo", ".svg", "diagram", "plan of")


def _commons_geosearch(
    lat: float, lng: float, *, radius: int, limit: int, timeout: float = 30.0
) -> list[dict[str, Any]]:
    """Files geotagged within `radius` m of a point, with imageinfo + key metadata."""
    import httpx  # lazy

    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "geosearch",
        "ggscoord": f"{lat}|{lng}",
        "ggsradius": str(radius),
        "ggslimit": str(limit),
        "ggsnamespace": "6",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "iiextmetadatafilter": "DateTimeOriginal|License|LicenseShortName|LicenseUrl|Artist",
    }
    try:
        with httpx.Client(timeout=timeout, headers={"User-Agent": _UA}, follow_redirects=True) as client:
            resp = client.get(COMMONS_API, params=params)
            if resp.status_code != 200:
                return []
            return resp.json().get("query", {}).get("pages", []) or []
    except Exception:
        return []


def _download(url: str, *, timeout: float = 30.0) -> bytes | None:
    import httpx  # lazy

    try:
        with httpx.Client(timeout=timeout, headers={"User-Agent": _UA}, follow_redirects=True) as client:
            img = client.get(url)
            if img.status_code != 200 or not img.content or len(img.content) > 15 * 1024 * 1024:
                return None
            return img.content
    except Exception:
        return None


def _geosearch_best_image(lat: float, lng: float, radius: int) -> ResolvedImage | None:
    """Newest licence-clean photo geotagged near the coordinates (fallback source)."""
    ranked: list[tuple[int, int, str, ResolvedImage]] = []
    for page in _commons_geosearch(lat, lng, radius=radius, limit=80):
        title = str(page.get("title", ""))
        if any(h in title.lower() for h in _BAD_TITLE_HINTS):
            continue
        info_list = page.get("imageinfo") or []
        if not info_list:
            continue
        info = info_list[0]
        meta = _parse_imageinfo(info, title)  # licence + mime gate
        if meta is None:
            continue
        width = int(info.get("width") or 0)
        if width and width < 800:  # skip tiny images
            continue
        year = _year_of(_ext_value(info.get("extmetadata", {}) or {}, "DateTimeOriginal"))
        ranked.append((year, width, str(info.get("url", "")), meta))

    ranked.sort(key=lambda r: (r[0], r[1]), reverse=True)
    for _year, _w, url, meta in ranked[:4]:
        data = _download(url)
        if data:
            meta.upload_bytes = data
            return meta
    return None


def resolve_place_image(p: Place, *, radius: int = 3000) -> ResolvedImage | None:
    """Resolve a photo that actually represents the place. Primary source is the
    place's Wikipedia article lead image — the shot editors chose to depict it, so
    it matches the place and is usually its most attractive view. Only when the
    article has no usable image do we fall back to the newest licence-clean photo
    geotagged at the coordinates."""
    title = _wiki_title_from_url(p.get("source_url", ""))
    if title:
        lead = wikipedia_lead_image(title)
        if lead:
            resolved = resolve_commons_image(lead)
            if resolved is not None:
                return resolved
    return _geosearch_best_image(float(p["lat"]), float(p["lng"]), radius)


def _strip_html(value: str) -> str:
    import re

    text = re.sub(r"<[^>]+>", " ", value)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:300]


def _imagekit_upload(img: ResolvedImage, folder: str) -> str | None:
    """Upload through the existing ImageKit integration. Returns the full ImageKit
    delivery URL (stored as object_key) or None if ImageKit is not configured / the
    upload fails. A full URL is stored so the web resolves it without depending on
    NEXT_PUBLIC_IMAGEKIT_URL, and gets responsive srcset for the ik.imagekit.io host."""
    import asyncio

    from app.core import imagekit

    if not imagekit.enabled():
        return None
    try:
        client = imagekit.ImageKitClient()
        result = asyncio.run(
            client.upload(
                img.upload_bytes,
                filename=img.filename,
                folder=folder,
                content_type=img.content_type,
            )
        )
        return result.url or imagekit.delivery_url(result.file_path)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Import (DB)
# ---------------------------------------------------------------------------
@dataclass
class ImportStats:
    destinations: int = 0
    taxonomy: int = 0
    venues: int = 0
    experiences_inserted: int = 0
    experiences_updated: int = 0
    media_added: int = 0
    images_skipped_no_license: int = 0
    images_skipped_no_imagekit: int = 0
    images_replaced: int = 0
    places_skipped: list[str] = field(default_factory=list)
    samples_archived: int = 0
    destination_covers: int = 0
    collections_upserted: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "destinations_upserted": self.destinations,
            "taxonomy_upserted": self.taxonomy,
            "venues_upserted": self.venues,
            "experiences_inserted": self.experiences_inserted,
            "experiences_updated": self.experiences_updated,
            "media_added": self.media_added,
            "images_replaced": self.images_replaced,
            "images_skipped_no_license": self.images_skipped_no_license,
            "images_skipped_no_imagekit": self.images_skipped_no_imagekit,
            "places_skipped": self.places_skipped,
            "samples_archived": self.samples_archived,
            "destination_covers": self.destination_covers,
            "collections_upserted": self.collections_upserted,
        }


# Sample listings seeded by migration 013 (placeholder content). --archive-samples
# sets these to status='archived' so they leave the public catalogue without being
# deleted (nothing is hard-deleted).
SAMPLE_EXPERIENCE_SLUGS = [
    "slow-day-byblos",
    "coastal-escapes-batroun",
    "among-ancient-cedars",
    "take-the-valley-road",
    "journey-through-baalbek",
    "beirut-street-to-sea",
    "byblos-harbour-walls",
    "beirut-souks-wander",
    "harbour-lunch-byblos",
    "coastal-table-batroun",
]

# Listings removed from the dataset that must be retired from the live catalogue
# (archived, never hard-deleted) on the next run, even without --archive-samples.
RETIRED_SLUGS = [
    "ouyoun-orghosh",  # misplaced/weak entry — removed from the dataset
    "tell-arqa",  # trimmed: not scenic/attractive
    "orontes-source-hermel",  # trimmed: not scenic/attractive
    "deir-mar-maroun-hermel",  # trimmed: not scenic/attractive
    "nahr-el-kalb",  # trimmed: not scenic/attractive
    "martyrs-square-beirut",  # trimmed: not scenic/attractive
    "nabatieh-old-souk",  # trimmed: not scenic/attractive
    "khan-el-franj-sidon",  # trimmed: not scenic/attractive
]

# Genuinely free, public, un-gated places (no admission booth). Everything not
# listed here shows "On request" rather than an invented fee. Kept conservative:
# when in doubt a place is left as on-request, never wrongly labelled free.
FREE_ADMISSION_SLUGS: set[str] = {
    "raouche-pigeon-rocks",
    "corniche-beirut",
    "beirut-souks",
    "mohammad-al-amin-mosque",
    "our-lady-of-lebanon-harissa",
    "deir-el-qamar",
    "batroun-old-town",
    "zahle-berdawni",
    "marjeyoun",
    "our-lady-of-mantara-maghdouche",
    "akkar-el-atika",
    "pyramid-of-hermel",
    "qammoua-forest",
}


# Destination cover images reuse a representative place photo already uploaded (and
# attributed) for an experience in that destination — so covers are real photos of
# real places with no separate, un-attributed upload. Keys are destination slugs
# (the 6 featured towns from migration 013 + the 8 governorates); values are the
# experience slug whose primary image becomes the cover.
DESTINATION_COVERS: dict[str, str] = {
    # Featured towns (public_catalogue_destinations)
    "byblos": "byblos-archaeological-site",
    "batroun": "batroun-old-town",
    "bsharri": "cedars-of-god",
    "qadisha-valley": "qadisha-valley",
    "baalbek": "baalbek-temples",
    "beirut": "raouche-pigeon-rocks",
    # Governorates
    "mount-lebanon": "jeita-grotto",
    "north-lebanon": "cedars-of-god",
    "beqaa": "anjar-umayyad-city",
    "baalbek-hermel": "baalbek-temples",
    "south-lebanon": "sidon-sea-castle",
    "nabatieh": "beaufort-castle",
    # akkar's places have no free image yet → no cover (left as-is), by omission.
}

# Real curated collections. Each cover reuses a representative place's photo; each
# links real imported experiences by slug. Idempotent on collection slug.
COLLECTIONS: list[dict[str, Any]] = [
    {
        "slug": "unesco-lebanon",
        "title": "Lebanon's World Heritage",
        "kicker": "UNESCO sites",
        "description": "The six inscriptions that trace Lebanon from Phoenician ports to Roman temples.",
        "cover": "baalbek-temples",
        "slugs": [
            "baalbek-temples",
            "byblos-archaeological-site",
            "anjar-umayyad-city",
            "tyre-al-bass",
            "cedars-of-god",
            "qadisha-valley",
        ],
    },
    {
        "slug": "coast-and-sea",
        "title": "Along the coast",
        "kicker": "Sea & shore",
        "description": "Sea castles, old harbours and a protected beach down the Mediterranean shore.",
        "cover": "raouche-pigeon-rocks",
        "slugs": [
            "raouche-pigeon-rocks",
            "batroun-old-town",
            "byblos-castle",
            "sidon-sea-castle",
            "tyre-coast-reserve",
        ],
    },
    {
        "slug": "mountains-and-cedars",
        "title": "Mountains & cedars",
        "kicker": "High country",
        "description": "Cedar forests, a river gorge of cliff monasteries, waterfalls and a grotto.",
        "cover": "cedars-of-god",
        "slugs": [
            "cedars-of-god",
            "qadisha-valley",
            "tannourine-cedar-reserve",
            "jabal-moussa-reserve",
            "baatara-gorge-waterfall",
            "jeita-grotto",
        ],
    },
    {
        "slug": "old-towns-and-souks",
        "title": "Old towns & souks",
        "kicker": "Heritage cities",
        "description": "Stone lanes, citadels and markets from Tripoli to Sidon and the Chouf.",
        "cover": "deir-el-qamar",
        "slugs": [
            "byblos-archaeological-site",
            "deir-el-qamar",
            "citadel-of-tripoli",
            "batroun-old-town",
            "beiteddine-palace",
        ],
    },
]


def _connect(db_url: str | None):
    import os

    import psycopg  # lazy

    url = db_url or os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL must be set (or pass --database-url).")
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return psycopg.connect(url, autocommit=False)


def _sanitize_dsn(conn) -> str:
    info = conn.info
    return f"host={info.host} dbname={info.dbname} user={info.user}"


def run_import(
    *,
    db_url: str | None,
    do_images: bool,
    archive_samples: bool,
    stats: ImportStats,
    refresh_images: bool = False,
) -> ImportStats:
    conn = _connect(db_url)
    try:
        # Resolve the catalogue organisation and pin the RLS org context to it so
        # inserts pass WITH CHECK under mshwar_backend, and are a no-op under a
        # superuser owner (which bypasses RLS anyway).
        org_row = conn.execute("SELECT id FROM app.organizations WHERE slug = %s", (CATALOGUE_ORG_SLUG,)).fetchone()
        if not org_row:
            raise SystemExit(f"Organisation '{CATALOGUE_ORG_SLUG}' not found. Run migrations first (013 creates it).")
        org_id = org_row[0]
        conn.execute("SELECT set_config('app.organization_id', %s, true)", (str(org_id),))
        conn.execute("SELECT set_config('app.user_id', %s, true)", (str(org_id),))

        # Currencies referenced by price rules must exist (migration/seed usually
        # creates them; ensure USD is present so quote-required rules insert).
        conn.execute("INSERT INTO app.currencies (code, minor_digits) VALUES ('USD', 2) ON CONFLICT (code) DO NOTHING")

        # 1) Taxonomy: categories + tags (normalised, idempotent).
        term_ids: dict[tuple[str, str], uuid.UUID] = {}
        for slug, label in CATEGORY_LABELS.items():
            term_ids[("category", slug)] = _upsert_taxonomy(conn, "category", slug, label)
            stats.taxonomy += 1
        for slug, label in TAG_LABELS.items():
            term_ids[("tag", slug)] = _upsert_taxonomy(conn, "tag", slug, label)
            stats.taxonomy += 1

        # 2) Governorate destinations (idempotent on slug) + translations.
        dest_ids: dict[str, uuid.UUID] = {}
        for g in GOVERNORATES:
            dest_ids[g["slug"]] = _upsert_destination(conn, g)
            stats.destinations += 1

        # 3) Places → venue + experience + taxonomy + translations + media.
        for p in PLACES:
            try:
                _import_place(conn, p, org_id, dest_ids[p["governorate"]], term_ids, do_images, stats, refresh_images)
            except Exception as exc:  # noqa: BLE001 - one bad place must not abort the run
                conn.rollback()
                raise SystemExit(f"Import failed on '{p.get('slug')}': {exc}") from exc

        # 4) Destination covers reuse a representative place's real photo.
        _set_destination_covers(conn, stats)

        # 5) Real curated collections (idempotent on slug), covers reuse a place photo.
        _upsert_collections(conn, stats)

        # 6) Retire listings removed from the dataset (always, never hard-deleted).
        res = conn.execute(
            "UPDATE app.experiences SET status = 'archived' WHERE slug = ANY(%s) AND status <> 'archived'",
            (RETIRED_SLUGS,),
        )
        stats.samples_archived += res.rowcount or 0

        # 7) Optionally archive migration-013 sample listings (never delete).
        if archive_samples:
            res = conn.execute(
                "UPDATE app.experiences SET status = 'archived' WHERE slug = ANY(%s) AND status <> 'archived'",
                (SAMPLE_EXPERIENCE_SLUGS,),
            )
            stats.samples_archived += res.rowcount or 0

        conn.commit()
        return stats
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _upsert_taxonomy(conn, kind: str, slug: str, label: str) -> uuid.UUID:
    row = conn.execute(
        "INSERT INTO app.taxonomy (id, kind, slug, label, active) VALUES (%s, %s, %s, %s, true) "
        "ON CONFLICT (kind, slug) DO UPDATE SET label = EXCLUDED.label, active = true RETURNING id",
        (uuid.uuid4(), kind, slug, label),
    ).fetchone()
    return row[0]


def _upsert_destination(conn, g: dict[str, Any]) -> uuid.UUID:
    row = conn.execute(
        "INSERT INTO app.destinations (id, slug, country_code, name, region, blurb, status, location) "
        "VALUES (%s, %s, 'LB', %s, %s, %s, 'published', "
        "ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) "
        "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region, "
        "blurb = EXCLUDED.blurb, status = 'published', location = EXCLUDED.location RETURNING id",
        (uuid.uuid4(), g["slug"], g["name_en"], g["region"], g.get("blurb_en", ""), g["lng"], g["lat"]),
    ).fetchone()
    dest_id = row[0]
    for locale, name in (("en", g["name_en"]), ("ar", g.get("name_ar")), ("fr", g.get("name_fr"))):
        if name:
            conn.execute(
                "INSERT INTO app.destination_translations (destination_id, locale, title, description) "
                "VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (destination_id, locale) DO UPDATE SET title = EXCLUDED.title",
                (dest_id, locale, name, g.get("blurb_en", "") if locale == "en" else ""),
            )
    return dest_id


def _upsert_venue(conn, p: Place, org_id: uuid.UUID, dest_id: uuid.UUID) -> uuid.UUID:
    source_ref = f"curated:{p['slug']}"
    expires = datetime.now(UTC) + timedelta(days=180)
    existing = conn.execute(
        "SELECT id FROM app.venues WHERE organization_id = %s AND source_reference = %s",
        (org_id, source_ref),
    ).fetchone()
    address = f"{next(g['region'] for g in GOVERNORATES if g['slug'] == p['governorate'])}, Lebanon"
    if existing:
        venue_id = existing[0]
        conn.execute(
            "UPDATE app.venues SET destination_id = %s, name = %s, address = %s, "
            "location = ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, "
            "location_source = 'curated', source_expires_at = %s WHERE id = %s",
            (dest_id, p["name_en"], address, p["lng"], p["lat"], expires, venue_id),
        )
        return venue_id
    row = conn.execute(
        "INSERT INTO app.venues (id, organization_id, destination_id, name, address, timezone, "
        "location, location_source, source_reference, source_expires_at) "
        "VALUES (%s, %s, %s, %s, %s, 'Asia/Beirut', ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, "
        "'curated', %s, %s) RETURNING id",
        (uuid.uuid4(), org_id, dest_id, p["name_en"], address, p["lng"], p["lat"], source_ref, expires),
    ).fetchone()
    return row[0]


def _set_price(conn, exp_id: uuid.UUID, slug: str) -> None:
    """No invented amounts: genuinely public open places are free (fixed 0),
    everything else is 'on request' (quote-required). Idempotent."""
    conn.execute("DELETE FROM app.price_rules WHERE experience_id = %s AND source LIKE 'curated:%%'", (exp_id,))
    if slug in FREE_ADMISSION_SLUGS:
        conn.execute(
            "INSERT INTO app.price_rules (id, experience_id, currency, price_type, unit, amount_minor, "
            "valid_during, source) VALUES (%s, %s, 'USD', 'fixed', 'person', 0, '(,)', 'curated:free')",
            (uuid.uuid4(), exp_id),
        )
    else:
        conn.execute(
            "INSERT INTO app.price_rules (id, experience_id, currency, price_type, unit, amount_minor, "
            "valid_during, source) VALUES (%s, %s, 'USD', 'quote-required', 'person', NULL, '(,)', 'curated:none')",
            (uuid.uuid4(), exp_id),
        )


def _import_place(
    conn,
    p: Place,
    org_id: uuid.UUID,
    dest_id: uuid.UUID,
    term_ids: dict[tuple[str, str], uuid.UUID],
    do_images: bool,
    stats: ImportStats,
    refresh_images: bool = False,
) -> None:
    venue_id = _upsert_venue(conn, p, org_id, dest_id)
    stats.venues += 1

    setting = derive_setting(p)
    weather = derive_weather(setting)
    minutes = suggested_minutes(p)
    summary = p["summary_en"]
    body = p["summary_en"]

    existing = conn.execute("SELECT id FROM app.experiences WHERE slug = %s", (p["slug"],)).fetchone()
    exp_id = existing[0] if existing else None

    facts = build_facts(p)
    # Keep an existing image's photo credit stable across re-runs (facts are rebuilt
    # each run, so re-derive the credit from already-stored media). When refreshing
    # images we're about to replace the photo, so skip the stale credit here.
    if exp_id is not None and not refresh_images:
        cred = conn.execute(
            "SELECT attribution, license FROM app.media WHERE experience_id = %s "
            "AND source = 'wikimedia-commons' ORDER BY sort_order LIMIT 1",
            (exp_id,),
        ).fetchone()
        if cred and cred[0]:
            facts.append(_photo_credit_fact(cred[0], cred[1] or ""))

    if exp_id is not None:
        conn.execute(
            "UPDATE app.experiences SET organization_id = %s, venue_id = %s, title = %s, description = %s, "
            "status = 'published', booking_mode = 'inquiry', duration_minutes = %s, min_party = 1, "
            "max_party = 20, setting = %s, weather_sensitivity = %s, listing_kind = %s, "
            "inventory_available = true, catalogue_summary = %s, catalogue_facts = %s "
            "WHERE id = %s",
            (
                org_id,
                venue_id,
                p["name_en"],
                body,
                minutes,
                setting,
                weather,
                p["listing_kind"],
                summary,
                json.dumps(facts),
                exp_id,
            ),
        )
        stats.experiences_updated += 1
    else:
        row = conn.execute(
            "INSERT INTO app.experiences (id, organization_id, venue_id, slug, title, description, status, "
            "booking_mode, duration_minutes, min_party, max_party, setting, weather_sensitivity, "
            "listing_kind, inventory_available, catalogue_summary, catalogue_facts) "
            "VALUES (%s, %s, %s, %s, %s, %s, 'published', 'inquiry', %s, 1, 20, %s, %s, %s, true, %s, %s) "
            "RETURNING id",
            (
                uuid.uuid4(),
                org_id,
                venue_id,
                p["slug"],
                p["name_en"],
                body,
                minutes,
                setting,
                weather,
                p["listing_kind"],
                summary,
                json.dumps(facts),
            ),
        ).fetchone()
        exp_id = row[0]
        stats.experiences_inserted += 1

    _set_price(conn, exp_id, p["slug"])

    # Taxonomy links: re-sync (category + tags). Remove stale, add current.
    wanted: list[uuid.UUID] = [term_ids[("category", p["category"])]]
    wanted += [term_ids[("tag", t)] for t in p.get("tags", []) if ("tag", t) in term_ids]
    conn.execute("DELETE FROM app.experience_taxonomy WHERE experience_id = %s", (exp_id,))
    for term_id in wanted:
        conn.execute(
            "INSERT INTO app.experience_taxonomy (experience_id, term_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (exp_id, term_id),
        )

    # Translations (only where a real localisation exists).
    for locale, title in (("en", p["name_en"]), ("ar", p.get("name_ar")), ("fr", p.get("name_fr"))):
        if not title:
            continue
        descr = {"en": p.get("summary_en"), "ar": p.get("summary_ar"), "fr": p.get("summary_fr")}[locale] or ""
        conn.execute(
            "INSERT INTO app.experience_translations (experience_id, locale, title, description) "
            "VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (experience_id, locale) DO UPDATE SET title = EXCLUDED.title, "
            "description = EXCLUDED.description",
            (exp_id, locale, title, descr),
        )

    # Media: add a real photo when none is present, or replace it under
    # --refresh-images (e.g. to switch to a newer photo). Replacement happens only
    # after a new photo is successfully fetched, so a flaky fetch never blanks a
    # listing.
    if do_images:
        has_media = conn.execute("SELECT 1 FROM app.media WHERE experience_id = %s LIMIT 1", (exp_id,)).fetchone()
        if refresh_images or not has_media:
            credit = _add_image(conn, exp_id, p, stats, replace=refresh_images)
            if credit is not None:
                facts_with_photo = facts + [_photo_credit_fact(credit[0], credit[1])]
                conn.execute(
                    "UPDATE app.experiences SET catalogue_facts = %s WHERE id = %s",
                    (json.dumps(facts_with_photo), exp_id),
                )

    # Refresh denormalised search text (SECURITY DEFINER helper from migration 013).
    conn.execute("SELECT app.refresh_experience_search(%s)", (exp_id,))


def _add_image(
    conn, exp_id: uuid.UUID, p: Place, stats: ImportStats, *, replace: bool = False
) -> tuple[str, str] | None:
    """Resolve (newest geotagged photo of the place, preferring 2021+), licence-check
    and store one real image. Returns (attribution, license) when stored, else None.
    With replace=True, the existing curated photo is removed only after a new one is
    fetched and uploaded, so a failed fetch never leaves the listing blank."""
    resolved = resolve_place_image(p)
    if resolved is None:
        stats.images_skipped_no_license += 1
        return None
    object_key = _imagekit_upload(resolved, folder=f"catalogue/{p['governorate']}")
    provider = "imagekit"
    if object_key is None:
        # ImageKit not configured or upload failed → keep the listing imageless
        # rather than attach anything unverified.
        stats.images_skipped_no_imagekit += 1
        return None
    if replace:
        removed = conn.execute(
            "DELETE FROM app.media WHERE experience_id = %s AND source = 'wikimedia-commons'", (exp_id,)
        )
        stats.images_replaced += removed.rowcount or 0
    alt = p.get("name_en", "")
    conn.execute(
        "INSERT INTO app.media (id, experience_id, provider, object_key, alt_text, sort_order, moderation, "
        "source, source_url, license, license_url, attribution, captured_at) "
        "VALUES (%s, %s, %s, %s, %s, 0, 'approved', 'wikimedia-commons', %s, %s, %s, %s, now()) "
        "ON CONFLICT (provider, object_key) DO NOTHING",
        (
            uuid.uuid4(),
            exp_id,
            provider,
            object_key,
            alt,
            resolved.source_url,
            resolved.license,
            resolved.license_url,
            resolved.attribution,
        ),
    )
    stats.media_added += 1
    return (resolved.attribution, resolved.license)


def _representative_media(conn, exp_slug: str) -> tuple[str, str] | None:
    """Return (object_key, alt_text) of a published experience's primary approved
    image, or None if it has none yet. object_key is a full ImageKit URL."""
    row = conn.execute(
        "SELECT m.object_key, m.alt_text FROM app.media m "
        "JOIN app.experiences e ON e.id = m.experience_id "
        "WHERE e.slug = %s AND m.moderation = 'approved' "
        "ORDER BY m.sort_order LIMIT 1",
        (exp_slug,),
    ).fetchone()
    if not row or not row[0]:
        return None
    return (row[0], row[1] or "")


def _set_destination_covers(conn, stats: ImportStats) -> None:
    """Point each destination's image at a representative place photo already stored
    for one of its experiences. Only touches destinations that resolve to a photo,
    so it never blanks an existing image."""
    for dest_slug, exp_slug in DESTINATION_COVERS.items():
        media = _representative_media(conn, exp_slug)
        if media is None:
            continue
        object_key, alt = media
        res = conn.execute(
            "UPDATE app.destinations SET image_url = %s, image_alt = %s WHERE slug = %s",
            (object_key, alt, dest_slug),
        )
        stats.destination_covers += res.rowcount or 0


def _upsert_collections(conn, stats: ImportStats) -> None:
    """Create/refresh real curated collections and their ordered items. Idempotent
    on collection slug; a collection is published only if at least one of its
    experiences exists."""
    for c in COLLECTIONS:
        exp_ids: list[uuid.UUID] = []
        for slug in c["slugs"]:
            row = conn.execute(
                "SELECT id FROM app.experiences WHERE slug = %s AND status = 'published'", (slug,)
            ).fetchone()
            if row:
                exp_ids.append(row[0])
        if not exp_ids:
            continue

        cover = _representative_media(conn, c["cover"])
        image_url = cover[0] if cover else None
        image_alt = cover[1] if cover else None

        col_row = conn.execute(
            "INSERT INTO app.catalogue_collections (slug, title, description, kicker, image_url, image_alt, "
            "status) VALUES (%s, %s, %s, %s, %s, %s, 'published') "
            "ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, "
            "kicker = EXCLUDED.kicker, image_url = COALESCE(EXCLUDED.image_url, app.catalogue_collections.image_url), "
            "image_alt = COALESCE(EXCLUDED.image_alt, app.catalogue_collections.image_alt), "
            "status = 'published', updated_at = now() RETURNING id",
            (c["slug"], c["title"], c["description"], c["kicker"], image_url, image_alt),
        ).fetchone()
        collection_id = col_row[0]

        # Re-sync ordered items (idempotent): clear then insert current order.
        conn.execute("DELETE FROM app.catalogue_collection_items WHERE collection_id = %s", (collection_id,))
        for position, exp_id in enumerate(exp_ids, start=1):
            conn.execute(
                "INSERT INTO app.catalogue_collection_items (collection_id, experience_id, position) "
                "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (collection_id, exp_id, position),
            )
        stats.collections_upserted += 1


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
def build_report(cov: dict[str, Any], errors: list[str], stats: ImportStats | None) -> str:
    gov_names = {g["slug"]: g["name_en"] for g in GOVERNORATES}
    lines = ["# Mshwar catalogue — import report", ""]
    lines.append(f"_Generated {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}_")
    lines.append("")
    lines.append(f"**Total places:** {cov['total']}  ")
    lines.append(f"**With a Commons image candidate:** {cov['with_commons_image']}  ")
    lines.append(f"**Dataset validation:** {'clean' if not errors else str(len(errors)) + ' problems'}")
    lines.append("")
    lines.append("## Coverage by governorate")
    lines.append("")
    lines.append("| Governorate | Listings |")
    lines.append("| --- | ---: |")
    for slug, count in cov["by_governorate"].items():
        lines.append(f"| {gov_names.get(slug, slug)} | {count} |")
    lines.append("")
    lines.append("## Coverage by category")
    lines.append("")
    lines.append("| Category | Listings |")
    lines.append("| --- | ---: |")
    for cat, count in cov["by_category"].items():
        lines.append(f"| {cat} | {count} |")
    lines.append("")
    lines.append("## Coverage by listing kind")
    lines.append("")
    for kind, count in cov["by_listing_kind"].items():
        lines.append(f"- {kind}: {count}")
    lines.append("")
    lines.append("## Type tags")
    lines.append("")
    lines.append(", ".join(f"{t} ({n})" for t, n in cov["by_tag"].items()))
    lines.append("")
    if errors:
        lines.append("## Validation problems")
        lines.append("")
        lines.extend(f"- {e}" for e in errors)
        lines.append("")
    if stats is not None:
        lines.append("## Import result")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(stats.as_dict(), indent=2, ensure_ascii=False))
        lines.append("```")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import the real Lebanese catalogue (idempotent).")
    parser.add_argument("--database-url", default=None, help="Overrides DATABASE_URL.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and plan only; no DB, no network.")
    parser.add_argument("--yes", action="store_true", help="Confirm the write to the resolved database.")
    parser.add_argument("--no-images", action="store_true", help="Skip image resolution/upload.")
    parser.add_argument(
        "--archive-samples", action="store_true", help="Archive migration-013 sample listings (never deletes)."
    )
    parser.add_argument(
        "--refresh-images",
        action="store_true",
        help="Re-fetch and replace existing catalogue photos (e.g. to pick up newer images).",
    )
    parser.add_argument("--report", metavar="PATH", default=None, help="Write a Markdown report to PATH.")
    args = parser.parse_args(argv)

    errors = validate_dataset()
    cov = coverage(PLACES)

    print(f"Dataset: {cov['total']} places across {len(cov['by_governorate'])} governorates.")
    for slug, count in cov["by_governorate"].items():
        print(f"  {slug:16s} {count}")
    if errors:
        print(f"\nVALIDATION FAILED ({len(errors)} problems):", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        # A dirty dataset must never be imported.
        if not args.dry_run:
            return 2

    if args.dry_run:
        if args.report:
            with open(args.report, "w", encoding="utf-8") as fh:
                fh.write(build_report(cov, errors, None))
            print(f"\nReport written to {args.report}")
        print("\nDry run only — nothing was written." if not errors else "\nDry run: dataset has problems (above).")
        return 0 if not errors else 2

    stats = ImportStats()
    conn = _connect(args.database_url)
    target = _sanitize_dsn(conn)
    conn.close()
    if not args.yes:
        print(f"\nRefusing to write without --yes. Target database: {target}", file=sys.stderr)
        return 3
    print(f"\nImporting into: {target}")

    run_import(
        db_url=args.database_url,
        do_images=not args.no_images,
        archive_samples=args.archive_samples,
        stats=stats,
        refresh_images=args.refresh_images,
    )
    print("\nImport complete:")
    print(json.dumps(stats.as_dict(), indent=2, ensure_ascii=False))
    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            fh.write(build_report(cov, errors, stats))
        print(f"\nReport written to {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
