from __future__ import annotations

import uuid
from typing import Any

from app.seed.validation import CATEGORIES, validate_coordinate

# ── Taxonomy Terms ──────────────────────────────────────────────────────────
TAXONOMY_TERMS: list[dict[str, Any]] = [
    # Hiking
    {"kind": "interest", "slug": "hiking", "label": "Hiking"},
    {"kind": "interest", "slug": "trekking", "label": "Trekking"},
    {"kind": "interest", "slug": "mountain-climbing", "label": "Mountain Climbing"},
    # Cultural
    {"kind": "interest", "slug": "museums", "label": "Museums"},
    {"kind": "interest", "slug": "art-gallery", "label": "Art Galleries"},
    {"kind": "interest", "slug": "theater", "label": "Theater & Performance"},
    # Dining
    {"kind": "interest", "slug": "restaurants", "label": "Restaurants"},
    {"kind": "interest", "slug": "food-tours", "label": "Food Tours"},
    {"kind": "interest", "slug": "wine-tasting", "label": "Wine Tasting"},
    # Adventure
    {"kind": "interest", "slug": "caving", "label": "Caving"},
    {"kind": "interest", "slug": "kayaking", "label": "Kayaking"},
    {"kind": "interest", "slug": "paragliding", "label": "Paragliding"},
    # Wellness
    {"kind": "interest", "slug": "spa", "label": "Spa & Wellness"},
    {"kind": "interest", "slug": "yoga", "label": "Yoga & Meditation"},
    {"kind": "interest", "slug": "thermal-baths", "label": "Thermal Baths"},
    # Historical
    {"kind": "interest", "slug": "archaeology", "label": "Archaeology"},
    {"kind": "interest", "slug": "heritage-sites", "label": "Heritage Sites"},
    {"kind": "interest", "slug": "historical-tours", "label": "Historical Tours"},
    # Outdoor
    {"kind": "interest", "slug": "nature-reserves", "label": "Nature Reserves"},
    {"kind": "interest", "slug": "waterfalls", "label": "Waterfalls"},
    {"kind": "interest", "slug": "forests", "label": "Forests & Woodlands"},
    # Nightlife
    {"kind": "interest", "slug": "bars", "label": "Bars & Lounges"},
    {"kind": "interest", "slug": "clubs", "label": "Clubs & Music"},
    # Beach
    {"kind": "interest", "slug": "beaches", "label": "Beaches"},
    {"kind": "interest", "slug": "water-sports", "label": "Water Sports"},
    # Family
    {"kind": "interest", "slug": "theme-parks", "label": "Theme Parks"},
    {"kind": "interest", "slug": "zoos", "label": "Zoos & Animal Parks"},
]

# ── Venues ──────────────────────────────────────────────────────────────────
ORGANIZATIONS_DATA: list[dict[str, Any]] = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "Beirut Heritage Co.",
        "slug": "beirut-heritage",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000102"),
        "name": "Mount Lebanon Adventures",
        "slug": "mount-lebanon-adventures",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000103"),
        "name": "Tripoli Cultural Tours",
        "slug": "tripoli-cultural-tours",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000104"),
        "name": "Sidon Food & Culture",
        "slug": "sidon-food-culture",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000105"),
        "name": "Nabatieh Experiences",
        "slug": "nabatieh-experiences",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000106"),
        "name": "Bekaa Wine Trails",
        "slug": "bekaa-wine-trails",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000107"),
        "name": "Baalbek Heritage Foundation",
        "slug": "baalbek-heritage",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000108"),
        "name": "Jezzine Mountain Resort",
        "slug": "jezzine-mountain",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000109"),
        "name": "Lebanon Coastal Tours",
        "slug": "lebanon-coastal",
        "verification": "verified",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000110"),
        "name": "Lebanese Culinary House",
        "slug": "lebanese-culinary",
        "verification": "verified",
    },
]

VENUES_DATA: list[dict[str, Any]] = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000201"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "Beirut Souks",
        "address": "Beirut Central District",
        "destination_slug": "beirut",
        "lat": 33.8907,
        "lng": 35.4997,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000202"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "National Museum of Beirut",
        "address": "Mohammad Al-Amin St, Beirut",
        "destination_slug": "beirut",
        "lat": 33.8908,
        "lng": 35.4987,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000203"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "Raouche Rock",
        "address": "Raouche, Beirut",
        "destination_slug": "beirut",
        "lat": 33.8803,
        "lng": 35.5115,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000204"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000102"),
        "name": "Jeita Grotto",
        "address": "Jeita, Mount Lebanon",
        "destination_slug": "mount-lebanon",
        "lat": 33.9073,
        "lng": 35.6078,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000205"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "Corniche Beirut",
        "address": "Ramdan Street, Beirut",
        "destination_slug": "beirut",
        "lat": 33.8885,
        "lng": 35.5078,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000206"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000103"),
        "name": "Qadisha Valley Lodge",
        "address": "Wadi Qadisha, North Lebanon",
        "destination_slug": "north-lebanon",
        "lat": 34.2233,
        "lng": 36.0578,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000207"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000102"),
        "name": "Horsh Ehden Reserve",
        "address": "Ehden, North Lebanon",
        "destination_slug": "north-lebanon",
        "lat": 34.4367,
        "lng": 36.0333,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000208"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000103"),
        "name": "Tripoli Old City Tours",
        "address": "Tripoli, North Lebanon",
        "destination_slug": "north-lebanon",
        "lat": 34.4456,
        "lng": 35.8514,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000209"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000104"),
        "name": "Sidon Sea Castle",
        "address": "Sidon, South Lebanon",
        "destination_slug": "south-lebanon",
        "lat": 33.5584,
        "lng": 35.3767,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000210"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000104"),
        "name": "Jezzine Falls Tours",
        "address": "Jezzine, South Lebanon",
        "destination_slug": "jezzine",
        "lat": 33.6228,
        "lng": 35.5844,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000211"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000105"),
        "name": "Nabatieh Heritage Walks",
        "address": "Nabatieh, Nabatieh Governorate",
        "destination_slug": "nabatieh",
        "lat": 33.1735,
        "lng": 35.4674,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000212"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000106"),
        "name": "Chateau Ksara Winery",
        "address": "Western Bekaa, Bekaa Valley",
        "destination_slug": "bekaa-valley",
        "lat": 33.8183,
        "lng": 36.0183,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000213"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000106"),
        "name": "Ksar el Laban Winery",
        "address": "Zahle, Bekaa Valley",
        "destination_slug": "bekaa-valley",
        "lat": 33.8333,
        "lng": 36.0333,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000214"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000107"),
        "name": "Baalbek Ruins Tours",
        "address": "Baalbek, Bekaa Valley",
        "destination_slug": "baalbek",
        "lat": 34.0118,
        "lng": 36.2014,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000215"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000107"),
        "name": "Temple of Bacchus Tours",
        "address": "Baalbek, Bekaa Valley",
        "destination_slug": "baalbek",
        "lat": 34.0118,
        "lng": 36.2014,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000216"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000108"),
        "name": "Jezzine Cedar Resort",
        "address": "Jezzine, South Lebanon",
        "destination_slug": "jezzine",
        "lat": 33.6228,
        "lng": 35.5844,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000217"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000102"),
        "name": "Jounieh Cable Car",
        "address": "Jounieh, Mount Lebanon",
        "destination_slug": "mount-lebanon",
        "lat": 34.1308,
        "lng": 35.6633,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000218"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000102"),
        "name": "Byblos Beach Tours",
        "address": "Byblos, Mount Lebanon",
        "destination_slug": "mount-lebanon",
        "lat": 34.1261,
        "lng": 35.8183,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000219"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "Beirut Culinary Academy",
        "address": "Gemmayzeh, Beirut",
        "destination_slug": "beirut",
        "lat": 33.8944,
        "lng": 35.5011,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000220"),
        "org_id": uuid.UUID("00000000-0000-0000-0000-000000000101"),
        "name": "Tripoli Food Market",
        "address": "Tripoli, North Lebanon",
        "destination_slug": "north-lebanon",
        "lat": 34.4456,
        "lng": 35.8514,
    },
]

# ── Experiences (60+) ───────────────────────────────────────────────────────
EXPERIENCES_DATA: list[dict[str, Any]] = []


def _build_experiences() -> list[dict[str, Any]]:
    experiences: list[dict[str, Any]] = []
    counter = 0

    def exp(
        slug: str,
        title: str,
        desc: str,
        org_id: uuid.UUID,
        venue_id: uuid.UUID,
        category: str,
        duration: int,
        min_party: int = 1,
        max_party: int = 8,
        setting: str = "outdoor",
        intensity: int = 3,
        booking_mode: str = "instant",
        min_age: int = 0,
    ) -> dict[str, Any]:
        nonlocal counter
        counter += 1
        return {
            "id": uuid.uuid4(),
            "slug": slug,
            "title": title,
            "description": desc,
            "organization_id": org_id,
            "venue_id": venue_id,
            "category": category,
            "duration_minutes": duration,
            "min_party": min_party,
            "max_party": max_party,
            "setting": setting,
            "intensity": intensity,
            "booking_mode": booking_mode,
            "min_age": min_age,
            "index": counter,
        }

    # ── BEIRUT (12 experiences) ──
    b_org = uuid.UUID("00000000-0000-0000-0000-000000000101")
    v_souks = uuid.UUID("00000000-0000-0000-0000-000000000201")
    v_museum = uuid.UUID("00000000-0000-0000-0000-000000000202")
    v_raouche = uuid.UUID("00000000-0000-0000-0000-000000000203")
    v_corniche = uuid.UUID("00000000-0000-0000-0000-000000000205")
    v_culinary = uuid.UUID("00000000-0000-0000-0000-000000000219")

    experiences.append(
        exp(
            "beirut-food-tour",
            "Beirut Food & Culture Tour",
            "Walk through Beirut's culinary hotspots with tastings at hidden gems",
            b_org,
            v_culinary,
            "dining",
            180,
            2,
            10,
            "mixed",
            2,
            "instant",
            18,
        )
    )
    experiences.append(
        exp(
            "beirut-museum",
            "National Museum Deep Dive",
            "Private guided tour of the National Museum of Beirut with archaeology focus",
            b_org,
            v_museum,
            "historical",
            120,
            1,
            6,
            "indoor",
            1,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "beirut-raouche-hike",
            "Raouche Rock Sunset Trek",
            "Hike to the iconic Pigeons' Rock for sunset views over the Mediterranean",
            b_org,
            v_raouche,
            "hiking",
            90,
            1,
            6,
            "outdoor",
            3,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "beirut-corniche-ride",
            "Corniche Cycling Tour",
            "Cycle along Beirut's iconic corniche with stops at landmarks",
            b_org,
            v_corniche,
            "outdoor",
            120,
            1,
            4,
            "outdoor",
            2,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "beirut-art-walk",
            "Gemmayzeh Art Gallery Walk",
            "Explore Beirut's alternative art scene through galleries and studios",
            b_org,
            v_souks,
            "cultural",
            150,
            1,
            8,
            "mixed",
            1,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "beirut-nightlife",
            "Beirut Rooftop Lounge Crawl",
            "Experience Beirut's legendary nightlife through curated rooftop bars",
            b_org,
            v_souks,
            "nightlife",
            240,
            2,
            10,
            "mixed",
            4,
            "instant",
            21,
        )
    )
    experiences.append(
        exp(
            "beirut-spa-day",
            "Traditional Hammam Experience",
            "Relax at a centuries-old hammam with traditional scrubbing and massage",
            b_org,
            v_souks,
            "wellness",
            180,
            1,
            2,
            "indoor",
            1,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "beirut-yoga-sunset",
            "Sunset Yoga on the Beach",
            "Guided yoga session with ocean views at Beirut's waterfront",
            b_org,
            v_corniche,
            "wellness",
            90,
            1,
            10,
            "outdoor",
            1,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "beirut-kayaking",
            "Mediterranean Kayak Adventure",
            "Kayak along Beirut's coastline with guided coastal exploration",
            b_org,
            v_corniche,
            "adventure",
            120,
            1,
            6,
            "outdoor",
            3,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "beirut-wine-cellar",
            "Lebanese Wine Tasting Evening",
            "Taste premium Lebanese wines with sommelier pairing guide",
            b_org,
            v_souks,
            "dining",
            150,
            2,
            8,
            "indoor",
            2,
            "instant",
            18,
        )
    )
    experiences.append(
        exp(
            "beirut-paragliding",
            "Lebanon Paragliding Flight",
            "Soar over Beirut and the coast with tandem paragliding",
            b_org,
            v_raouche,
            "adventure",
            60,
            1,
            1,
            "outdoor",
            5,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "beirut-food-market",
            "Souk El Tayeb Morning Market",
            "Explore Beirut's oldest organic market with cooking demonstration",
            b_org,
            v_culinary,
            "cultural",
            120,
            1,
            12,
            "mixed",
            1,
            "instant",
            12,
        )
    )

    # ── MOUNT LEBANON (10 experiences) ──
    ml_org = uuid.UUID("00000000-0000-0000-0000-000000000102")
    v_jeita = uuid.UUID("00000000-0000-0000-0000-000000000204")
    v_qadisha = uuid.UUID("00000000-0000-0000-0000-000000000206")
    v_horsh = uuid.UUID("00000000-0000-0000-0000-000000000207")
    v_jounieh = uuid.UUID("00000000-0000-0000-0000-000000000217")
    v_byblos = uuid.UUID("00000000-0000-0000-0000-000000000218")

    experiences.append(
        exp(
            "jeita-grotto-tour",
            "Jeita Grotto Wonder Tour",
            "Explore the stunning upper and lower grottoes of Jeita with LED light show",
            ml_org,
            v_jeita,
            "historical",
            90,
            1,
            8,
            "indoor",
            1,
            "instant",
            6,
        )
    )
    experiences.append(
        exp(
            "qadisha-hiking",
            "Qadisha Valley Monastery Trek",
            "Hike through the Cedars of God to ancient monasteries in the holy valley",
            ml_org,
            v_qadisha,
            "hiking",
            240,
            1,
            6,
            "outdoor",
            4,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "horsh-ehden-hike",
            "Horsh Ehden Nature Reserve",
            "Guided forest hike through Lebanon's largest nature reserve with ancient cedars",
            ml_org,
            v_horsh,
            "hiking",
            180,
            1,
            8,
            "outdoor",
            3,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "jounieh-cablecar",
            "Jounieh Cable Car & Bay Views",
            "Take the Téléférique for panoramic views of Jounieh Bay and the coast",
            ml_org,
            v_jounieh,
            "cultural",
            60,
            1,
            6,
            "outdoor",
            1,
            "instant",
            8,
        )
    )
    experiences.append(
        exp(
            "byblos-archaeology",
            "Byblos Archaeological Site Walk",
            "Walk through 7000 years of history at one of the oldest continuously inhabited cities",
            ml_org,
            v_byblos,
            "historical",
            180,
            1,
            6,
            "outdoor",
            2,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "byblos-seafood",
            "Byblos Seafood Lunch by the Port",
            "Fresh seafood lunch at a waterfront restaurant overlooking the ancient harbor",
            ml_org,
            v_byblos,
            "dining",
            120,
            2,
            8,
            "outdoor",
            2,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "cedar-forest-wellness",
            "Cedars Forest Forest Bathing",
            "Immersive forest bathing experience among ancient cedar groves",
            ml_org,
            v_horsh,
            "wellness",
            120,
            1,
            10,
            "outdoor",
            1,
            "instant",
            8,
        )
    )
    experiences.append(
        exp(
            "mount-lebanon-ziplining",
            "Mountain Zipline Adventure",
            "Zipline through the forests of Mount Lebanon with valley views",
            ml_org,
            v_qadisha,
            "adventure",
            60,
            1,
            4,
            "outdoor",
            4,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "lebanon-vineyard-walk",
            "Cedars Wine Vineyard Walk",
            "Guided vineyard tour with wine tasting at a Mount Lebanon estate",
            ml_org,
            v_horsh,
            "dining",
            150,
            2,
            8,
            "outdoor",
            2,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "jounieh-night-market",
            "Jounieh Night Market",
            "Explore Jounieh's vibrant night market with local crafts and street food",
            ml_org,
            v_jounieh,
            "cultural",
            180,
            1,
            10,
            "mixed",
            1,
            "instant",
            12,
        )
    )

    # ── NORTH LEBANON (8 experiences) ──
    n_org = uuid.UUID("00000000-0000-0000-0000-000000000103")
    v_tripoli = uuid.UUID("00000000-0000-0000-0000-000000000208")
    v_qadisha_n = uuid.UUID("00000000-0000-0000-0000-000000000206")

    experiences.append(
        exp(
            "tripoli-old-city",
            "Tripoli Old City Heritage Walk",
            "Guided walk through Tripoli's medieval mosques, madrasas, and souks",
            n_org,
            v_tripoli,
            "historical",
            180,
            1,
            8,
            "mixed",
            2,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "tripoli-mosaic",
            "Tripoli Roman Mosaic Museum",
            "View the largest Roman mosaic floor in the Levant at the Karantina Museum",
            n_org,
            v_tripoli,
            "cultural",
            90,
            1,
            6,
            "indoor",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "qadisha-cedars",
            "Qadisha Cedars of God Expedition",
            "Multi-day hiking expedition to the ancient Cedars of God reserve",
            n_org,
            v_qadisha_n,
            "hiking",
            480,
            1,
            4,
            "outdoor",
            5,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "tripoli-caving",
            "Ras Shekka Caving Adventure",
            "Guided caving expedition in Lebanon's most extensive cave system",
            n_org,
            v_qadisha_n,
            "adventure",
            180,
            1,
            4,
            "outdoor",
            4,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "tripoli-seafood",
            "Tripoli Harbor Seafood Feast",
            "Fresh seafood feast at the Tripoli harbor with traditional preparation",
            n_org,
            v_tripoli,
            "dining",
            150,
            2,
            8,
            "outdoor",
            2,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "nahr-ibn-omar",
            "Nahr Ibrahim River Walk",
            "Scenic riverside walk through the sacred Nahr Ibrahim valley",
            n_org,
            v_qadisha_n,
            "outdoor",
            120,
            1,
            6,
            "outdoor",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "tripoli-soap",
            "Tripoli Traditional Soap Making",
            "Learn the centuries-old tradition of Tripoli's Aleppo soap making",
            n_org,
            v_tripoli,
            "cultural",
            90,
            1,
            4,
            "indoor",
            1,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "northern-beach",
            "Batroun Beach Day Trip",
            "Relax at Batroun's pristine beaches with fresh seafood lunch",
            n_org,
            v_tripoli,
            "beach",
            240,
            2,
            10,
            "outdoor",
            1,
            "instant",
            12,
        )
    )

    # ── SOUTH LEBANON (8 experiences) ──
    s_org = uuid.UUID("00000000-0000-0000-0000-000000000104")
    v_sidon = uuid.UUID("00000000-0000-0000-0000-000000000209")
    v_jezzine = uuid.UUID("00000000-0000-0000-0000-000000000210")

    experiences.append(
        exp(
            "sidon-sea-castle",
            "Sidon Sea Castle History Tour",
            "Guided tour of the Crusader-era Sea Castle overlooking the Mediterranean",
            s_org,
            v_sidon,
            "historical",
            90,
            1,
            6,
            "outdoor",
            2,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "sidon-falafel",
            "Sidon Falafel & Street Food Walk",
            "Taste the legendary Sidon falafel at the original Al-Ajami stall",
            s_org,
            v_sidon,
            "dining",
            120,
            1,
            8,
            "mixed",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "jezzine-waterfalls",
            "Jezzine Waterfall Trek",
            "Hike to the stunning waterfalls of Jezzine through cedar forests",
            s_org,
            v_jezzine,
            "hiking",
            150,
            1,
            6,
            "outdoor",
            3,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "sidon-soap",
            "Sidon Traditional Soap Workshop",
            "Hands-on workshop making Sidon's famous olive oil soap",
            s_org,
            v_sidon,
            "cultural",
            120,
            1,
            4,
            "indoor",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "jezzine-cedar-resort",
            "Jezzine Cedar Resort Spa Day",
            "Full-day spa experience at the mountain resort with cedar-infused treatments",
            s_org,
            v_jezzine,
            "wellness",
            480,
            1,
            2,
            "indoor",
            1,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "south-lebanon-beach",
            "Tyre Beach & Sourday",
            "Relax at Tyre's pristine beaches and explore the ancient port city",
            s_org,
            v_sidon,
            "beach",
            300,
            2,
            8,
            "outdoor",
            1,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "jezzine-hiking",
            "Jezzine Mountain Hiking Circuit",
            "Full-day hiking circuit through Jezzine's pine and cedar forests",
            s_org,
            v_jezzine,
            "hiking",
            300,
            1,
            6,
            "outdoor",
            3,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "sidon-archaeology",
            "Sidon Archaeology Museum Tour",
            "Explore one of Lebanon's finest archaeological museums with Phoenician artifacts",
            s_org,
            v_sidon,
            "historical",
            120,
            1,
            6,
            "indoor",
            1,
            "instant",
            10,
        )
    )

    # ── NABATIEH (5 experiences) ──
    n_org2 = uuid.UUID("00000000-0000-0000-0000-000000000105")
    v_nabatieh = uuid.UUID("00000000-0000-0000-0000-000000000211")

    experiences.append(
        exp(
            "nabatieh-heritage",
            "Nabatieh Heritage Walk",
            "Guided tour through Nabatieh's old souks and historical landmarks",
            n_org2,
            v_nabatieh,
            "historical",
            120,
            1,
            6,
            "mixed",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "nabatieh-agriculture",
            "Bekaa Valley Farm Tour",
            "Explore Nabatieh's agricultural heartland with olive and wheat tastings",
            n_org2,
            v_nabatieh,
            "cultural",
            180,
            2,
            8,
            "outdoor",
            1,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "nabatieh-hiking",
            "Nabatieh Canyon Trek",
            "Hike through the rugged canyons and valleys south of Nabatieh",
            n_org2,
            v_nabatieh,
            "hiking",
            240,
            1,
            6,
            "outdoor",
            3,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "nabatieh-food",
            "Nabatieh Culinary Heritage",
            "Traditional Lebanese cooking class with local ingredients",
            n_org2,
            v_nabatieh,
            "dining",
            180,
            2,
            8,
            "indoor",
            1,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "nabatieh-stargazing",
            "Nabatieh Night Sky Stargazing",
            "Stargazing session away from city lights with telescope guidance",
            n_org2,
            v_nabatieh,
            "outdoor",
            120,
            1,
            6,
            "outdoor",
            1,
            "instant",
            12,
        )
    )

    # ── BEKAA VALLEY (7 experiences) ──
    bk_org = uuid.UUID("00000000-0000-0000-0000-000000000106")
    v_ksara = uuid.UUID("00000000-0000-0000-0000-000000000212")
    v_ksar_laban = uuid.UUID("00000000-0000-0000-0000-000000000213")

    experiences.append(
        exp(
            "ksara-winery-tour",
            "Chateau Ksara Winery Tour",
            "Tour Lebanon's oldest winery with barrel tasting and vineyard walk",
            bk_org,
            v_ksara,
            "dining",
            180,
            2,
            10,
            "outdoor",
            2,
            "instant",
            18,
        )
    )
    experiences.append(
        exp(
            "ksar-laban-wine",
            "Ksar el Laban Wine Experience",
            "Premium wine tasting at Lebanon's highest-altitude vineyard",
            bk_org,
            v_ksar_laban,
            "dining",
            150,
            2,
            8,
            "outdoor",
            2,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "bekaa-hiking",
            "Bekaa Valley Ridge Hiking",
            "Hike along the Bekaa Valley ridge with panoramic mountain views",
            bk_org,
            v_ksara,
            "hiking",
            240,
            1,
            6,
            "outdoor",
            3,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "bekaa-cycling",
            "Bekaa Valley Wine Cycling",
            "Cycle between Bekaa wineries with guided wine tastings",
            bk_org,
            v_ksara,
            "adventure",
            180,
            2,
            8,
            "outdoor",
            3,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "bekaa-olive-oil",
            "Bekaa Olive Oil Tasting",
            "Traditional olive oil production tour with cold-pressed tasting",
            bk_org,
            v_ksar_laban,
            "cultural",
            120,
            1,
            6,
            "outdoor",
            1,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "bekaa-thermal",
            "Bekaa Valley Thermal Springs",
            "Soak in natural thermal springs with mountain backdrop",
            bk_org,
            v_ksara,
            "wellness",
            180,
            1,
            4,
            "outdoor",
            1,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "bekaa-stargazing",
            "Bekaa Valley Stargazing",
            "Exceptional stargazing in the dark skies of the Bekaa Valley",
            bk_org,
            v_ksara,
            "outdoor",
            150,
            1,
            6,
            "outdoor",
            1,
            "instant",
            12,
        )
    )

    # ── BAALBEK (4 experiences) ──
    bl_org = uuid.UUID("00000000-0000-0000-0000-000000000107")
    v_baalbek = uuid.UUID("00000000-0000-0000-0000-000000000214")
    v_bacchus = uuid.UUID("00000000-0000-0000-0000-000000000215")

    experiences.append(
        exp(
            "baalbek-ruins",
            "Baalbek UNESCO Ruins Tour",
            "Guided tour of the UNESCO World Heritage Temple of Bacchus and Jupiter",
            bl_org,
            v_baalbek,
            "historical",
            180,
            1,
            8,
            "outdoor",
            2,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "baalbek-bacchus",
            "Temple of Bacchus Architecture Walk",
            "Detailed architectural analysis of the Temple of Bacchus and its Roman engineering",
            bl_org,
            v_bacchus,
            "historical",
            120,
            1,
            6,
            "outdoor",
            1,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "baalbek-photography",
            "Baalbek Sunrise Photography Tour",
            "Capture the ancient ruins at sunrise with professional photography guidance",
            bl_org,
            v_baalbek,
            "cultural",
            120,
            1,
            4,
            "outdoor",
            2,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "baalbek-night-tour",
            "Baalbek Night Illumination Tour",
            "Experience the illuminated ruins after dark with storytelling",
            bl_org,
            v_baalbek,
            "cultural",
            90,
            1,
            6,
            "outdoor",
            2,
            "instant",
            12,
        )
    )

    # ── JEZZINE (4 experiences) ──
    j_org = uuid.UUID("00000000-0000-0000-0000-000000000108")
    v_jezzine_resort = uuid.UUID("00000000-0000-0000-0000-000000000216")

    experiences.append(
        exp(
            "jezzine-cedar-hike",
            "Jezzine Cedar Forest Hike",
            "Hike through the legendary Cedar Forests of Jezzine",
            j_org,
            v_jezzine_resort,
            "hiking",
            150,
            1,
            6,
            "outdoor",
            3,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "jezzine-waterfall-eco",
            "Jezzine Eco-Waterfall Trail",
            "Eco-friendly trail to Jezzine's multiple waterfalls with swimming holes",
            j_org,
            v_jezzine_resort,
            "outdoor",
            180,
            1,
            6,
            "outdoor",
            2,
            "instant",
            12,
        )
    )
    experiences.append(
        exp(
            "jezzine-resort-spa",
            "Jezzine Mountain Spa Retreat",
            "Weekend spa retreat with cedar-infused treatments and mountain views",
            j_org,
            v_jezzine_resort,
            "wellness",
            480,
            1,
            2,
            "indoor",
            1,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "jezzine-local-food",
            "Jezzine Local Food Trail",
            "Taste Jezzine's famous produce including knafeh, apples, and olive oil",
            j_org,
            v_jezzine_resort,
            "dining",
            150,
            2,
            8,
            "mixed",
            1,
            "instant",
            14,
        )
    )

    # ── COASTAL (3 experiences) ──
    c_org = uuid.UUID("00000000-0000-0000-0000-000000000109")

    experiences.append(
        exp(
            "coastal-boat-tour",
            "Lebanon Coastal Boat Tour",
            "Full-day boat tour along the Lebanese coast with swimming stops",
            c_org,
            v_byblos,
            "beach",
            360,
            2,
            12,
            "outdoor",
            2,
            "instant",
            14,
        )
    )
    experiences.append(
        exp(
            "jbeil-diving",
            "Jbeil Scuba Diving Adventure",
            "Scuba dive in the Mediterranean off Jbeil's historic coast",
            c_org,
            v_byblos,
            "adventure",
            120,
            1,
            4,
            "outdoor",
            4,
            "instant",
            16,
        )
    )
    experiences.append(
        exp(
            "byblos-night-dining",
            "Byblos Sunset Seafood Dinner",
            "Open-air seafood dinner overlooking the ancient port of Byblos",
            c_org,
            v_byblos,
            "dining",
            180,
            2,
            8,
            "outdoor",
            2,
            "instant",
            18,
        )
    )

    # ── CULINARY HOUSE (4 experiences) ──
    ch_org = uuid.UUID("00000000-0000-0000-0000-000000000110")
    v_lebanese = uuid.UUID("00000000-0000-0000-0000-000000000220")

    experiences.append(
        exp(
            "beirut-kibbeh-class",
            "Kibbeh Making Class",
            "Hands-on Lebanese cooking class mastering kibbeh nayyeh and fried kibbeh",
            ch_org,
            v_lebanese,
            "cultural",
            150,
            2,
            8,
            "indoor",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "lebanon-food-tasting",
            "Lebanese Mezze Tasting Tour",
            "Taste 12 traditional mezze dishes across Beirut's best restaurants",
            ch_org,
            v_culinary,
            "dining",
            240,
            2,
            10,
            "mixed",
            1,
            "instant",
            18,
        )
    )
    experiences.append(
        exp(
            "lebanon-baklava",
            "Baklava & Sweets Workshop",
            "Learn to make traditional Lebanese pastries, baklava, and knafeh",
            ch_org,
            v_lebanese,
            "cultural",
            120,
            1,
            6,
            "indoor",
            1,
            "instant",
            10,
        )
    )
    experiences.append(
        exp(
            "lebanon-arrack",
            "Lebanese Arak Distillery Tour",
            "Tour a traditional arak distillery with tasting of Lebanon's national spirit",
            ch_org,
            v_lebanese,
            "cultural",
            120,
            2,
            8,
            "indoor",
            1,
            "instant",
            18,
        )
    )

    return experiences


ALL_EXPERIENCES: list[dict[str, Any]] = _build_experiences()


def get_experiences_count() -> int:
    return len(ALL_EXPERIENCES)


def get_experiences_by_category(category: str) -> list[dict[str, Any]]:
    return [e for e in ALL_EXPERIENCES if e["category"] == category]


def get_experiences_by_region(region_slug: str) -> list[dict[str, Any]]:
    return [
        e
        for e in ALL_EXPERIENCES
        if e["venue_id"] in {v["id"] for v in VENUES_DATA if v["destination_slug"] == region_slug}
    ]


def get_experience_slugs() -> list[str]:
    return [e["slug"] for e in ALL_EXPERIENCES]


def validate_experiences() -> list[str]:
    """Validate all experiences have valid coordinates and categories."""
    errors: list[str] = []
    slugs = set()
    for exp_data in ALL_EXPERIENCES:
        if exp_data["slug"] in slugs:
            errors.append(f"Duplicate slug: {exp_data['slug']}")
        slugs.add(exp_data["slug"])
        if exp_data["category"] not in CATEGORIES:
            errors.append(f"Invalid category '{exp_data['category']}' for experience: {exp_data['slug']}")
        # Find the venue for this experience
        venue = next((v for v in VENUES_DATA if v["id"] == exp_data["venue_id"]), None)
        if venue and not validate_coordinate(venue["lat"], venue["lng"]):
            errors.append(f"Invalid coordinates for venue {venue['name']}: ({venue['lat']}, {venue['lng']})")
    return errors


def validate_venue_coordinates() -> list[str]:
    """Validate all venue coordinates are inside Lebanon."""
    errors: list[str] = []
    for venue in VENUES_DATA:
        if not validate_coordinate(venue["lat"], venue["lng"]):
            errors.append(f"Invalid coordinates for venue {venue['name']}: ({venue['lat']}, {venue['lng']})")
    return errors
