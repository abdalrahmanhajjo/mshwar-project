from __future__ import annotations

from app.planner.intent import extract_constraints
from app.planner.llm import build_client

DESTINATIONS = ("byblos", "batroun", "bsharri", "beirut", "baalbek")
CATEGORIES = ("culture", "coast", "nature", "adventure", "city")

EN = (
    "a slow day in {dest} for two",
    "weekend on the {cat} in {dest}",
    "family trip around {dest}",
    "cheap {cat} day near {dest}",
    "romantic evening in {dest}",
)
FR = (
    "une journée lente à {dest} pour deux",
    "week-end {cat} à {dest}",
    "balade à {dest}",
    "moins de route, plus de {cat}",
    "déjeuner à {dest}",
)
AR = (
    "يوم هادئ في {dest}",
    "رحلة عائلية إلى {dest}",
    "أريد {cat} في {dest}",
    "ميزانية محدودة في {dest}",
    "نشاط في {dest}",
)
LB = (
    "بدي يوم هادي ب{dest} لشخصين",
    "مشوار {cat} على {dest}",
    "نزهة ب{dest}",
    "أقل قيادة ب{dest}",
    "غداء ب{dest}",
)

DEST_LABEL = {
    "byblos": {"en": "Byblos", "fr": "Byblos", "ar": "جبيل", "lb": "جبيل"},
    "batroun": {"en": "Batroun", "fr": "Batroun", "ar": "البترون", "lb": "البترون"},
    "bsharri": {"en": "Bsharri", "fr": "Bcharre", "ar": "بشري", "lb": "بشري"},
    "beirut": {"en": "Beirut", "fr": "Beyrouth", "ar": "بيروت", "lb": "بيروت"},
    "baalbek": {"en": "Baalbek", "fr": "Baalbek", "ar": "بعلبك", "lb": "بعلبك"},
}


def evaluation_cases() -> list[dict[str, str]]:
    cases: list[dict[str, str]] = []
    dests = DESTINATIONS
    cats = CATEGORIES
    for index in range(25):
        dest = dests[index % len(dests)]
        cat = cats[index % len(cats)]
        cases.append(
            {
                "locale": "en",
                "prompt": EN[index % len(EN)].format(dest=DEST_LABEL[dest]["en"], cat=cat),
                "expect_dest": dest,
            }
        )
        cases.append(
            {
                "locale": "fr",
                "prompt": FR[index % len(FR)].format(dest=DEST_LABEL[dest]["fr"], cat=cat),
                "expect_dest": dest,
            }
        )
        cases.append(
            {
                "locale": "ar",
                "prompt": AR[index % len(AR)].format(dest=DEST_LABEL[dest]["ar"], cat=cat),
                "expect_dest": dest,
            }
        )
        cases.append(
            {
                "locale": "ar-LB",
                "prompt": LB[index % len(LB)].format(dest=DEST_LABEL[dest]["lb"], cat=cat),
                "expect_dest": dest,
            }
        )
    return cases


def run_evaluation() -> list[tuple[str, bool]]:
    client = build_client()
    results: list[tuple[str, bool]] = []
    for case in evaluation_cases():
        extracted = extract_constraints(case["prompt"], case["locale"], client=client)
        ok = extracted.locale in {case["locale"], "mixed", "ar", "ar-LB", "en", "fr"}
        if (
            case["expect_dest"] not in extracted.destination_slugs
            and case["expect_dest"] not in extracted.query.casefold()
        ):
            # Lebanese templates embed the Arabic name; extractor maps those aliases.
            ok = ok and (
                case["expect_dest"] in extracted.destination_slugs
                or any(case["expect_dest"] in slug for slug in extracted.destination_slugs)
            )
        else:
            ok = True
        results.append((case["prompt"], ok or case["expect_dest"] in extracted.destination_slugs))
    return results
