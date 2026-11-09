"""Build an anonymized public release of the donated data.

Reads every stored donation (this needs the project's SECRET key, which only the
maintainer has), drops test entries, merges each donor's sections into one row,
and makes sure no one can be singled out: every combination of age band, sex,
ancestry, and region must describe at least K donors. Rare combinations are
generalized step by step (see GENERALIZATIONS); anyone still in a group
smaller than K is held back. Least valuable detail goes first: region, then age,
and South Asian subgroups only as a last resort.

Usage, from the repo root:

    export SUPABASE_URL=https://<project>.supabase.co
    export SUPABASE_SECRET_KEY=sb_secret_...     # never commit or share this
    python scripts/release_dataset.py            # writes data/releases/<YYYY-MM>/

    python scripts/release_dataset.py --input rows.json   # offline, from an export

The output folder holds the CSV and release notes. Review them before publishing;
nothing is uploaded or committed automatically.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import ssl
import urllib.error
import urllib.request
import uuid
from collections import Counter
from datetime import date
from pathlib import Path

K = 5
MIN_RELEASE_ROWS = 30
OUT = Path(__file__).parents[1] / "data" / "releases"

QUASI_IDENTIFIERS = ("age_band", "sex", "ancestry", "region")
SOUTH_ASIAN_NARROW = {"sri_lankan", "nepali", "bhutanese", "maldivian"}
NON_SOUTH_ASIAN = {"other_asian", "chinese", "white", "black_caribbean", "black_african"}

COLUMNS = [
    "donation_id",
    "received_month",
    "sections",
    # From the risk check
    "age_band",
    "sex",
    "ancestry",
    "heart_history",
    "systolic_bp",
    "total_cholesterol",
    "hdl_cholesterol",
    "bmi",
    "egfr",
    "smoking",
    "diabetes",
    "on_bp_meds",
    "on_statin",
    "family_history_cvd",
    "atrial_fibrillation",
    "chronic_kidney_disease",
    "rheumatoid_arthritis",
    "lupus",
    "migraine",
    "severe_mental_illness",
    "atypical_antipsychotics",
    "corticosteroids",
    "erectile_dysfunction",
    # Core research questions
    "heart_events",
    "age_first_event",
    "born_in_country",
    "years_in_country",
    "numbers_source",
    "numbers_recency",
    # Optional: South Asian risks
    "waist_cm",
    "other_tobacco",
    "diet",
    "ldl",
    "triglycerides",
    "hba1c",
    "lpa",
    "family_relatives",
    "family_earliest_age",
    # Optional: habits and background
    "active_days",
    "drinks_per_week",
    "sleep_hours",
    "education",
    "region",
]

# App field names (camelCase) -> release column names, per section.
INTAKE_FIELDS = {
    "ageBand": "age_band",
    "sex": "sex",
    "ancestry": "ancestry",
    "heartHistory": "heart_history",
    "systolicBp": "systolic_bp",
    "totalCholesterol": "total_cholesterol",
    "hdlCholesterol": "hdl_cholesterol",
    "bmi": "bmi",
    "egfr": "egfr",
    "smoking": "smoking",
    "diabetes": "diabetes",
    "onBpMeds": "on_bp_meds",
    "onStatin": "on_statin",
    "familyHistoryCvd": "family_history_cvd",
    "atrialFibrillation": "atrial_fibrillation",
    "chronicKidneyDisease": "chronic_kidney_disease",
    "rheumatoidArthritis": "rheumatoid_arthritis",
    "lupus": "lupus",
    "migraine": "migraine",
    "severeMentalIllness": "severe_mental_illness",
    "atypicalAntipsychotics": "atypical_antipsychotics",
    "corticosteroids": "corticosteroids",
    "erectileDysfunction": "erectile_dysfunction",
}
CORE_FIELDS = {
    "heartEvents": "heart_events",
    "ageAtFirstEvent": "age_first_event",
    "bornInUs": "born_in_country",
    "yearsInUs": "years_in_country",
    "numbersSource": "numbers_source",
    "numbersRecency": "numbers_recency",
}
SOUTH_ASIAN_FIELDS = {
    "otherTobacco": "other_tobacco",
    "diet": "diet",
    "ldl": "ldl",
    "triglycerides": "triglycerides",
    "hba1c": "hba1c",
    "lpa": "lpa",
    "familyRelatives": "family_relatives",
    "familyEarliestAge": "family_earliest_age",
}
CONTEXT_FIELDS = {
    "activeDays": "active_days",
    "drinksPerWeek": "drinks_per_week",
    "sleepHours": "sleep_hours",
    "education": "education",
    "residence": "region",
}


# ---------------------------------------------------------------- fetching


def fetch_rows(url: str, key: str, page: int = 1000) -> list[dict]:
    """All stored donations, read with the secret key (which bypasses the add-only rules)."""
    try:
        import certifi

        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    rows: list[dict] = []
    while True:
        request = urllib.request.Request(
            f"{url}/rest/v1/donations?select=*&order=id&limit={page}&offset={len(rows)}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(request, context=context) as response:
                batch = json.load(response)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:300]
            hints = {
                401: "The key was rejected. Check SUPABASE_SECRET_KEY is the sb_secret_ key.",
                403: "The key's role can't read the table. Run supabase/003_release_reader.sql.",
            }
            raise SystemExit(
                f"Supabase returned HTTP {error.code}. "
                f"{hints.get(error.code, '')}\nDetails: {detail}"
            ) from None
        rows.extend(batch)
        if len(batch) < page:
            return rows


# ---------------------------------------------------------------- transforming


def _value(v):
    """Release representation: lists become semicolon-separated, booleans lowercase."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, list):
        return ";".join(str(x) for x in v)
    return v


def merge_donations(rows: list[dict]) -> list[dict]:
    """One record per donation, combining its sections; test entries dropped."""
    by_id: dict[str, dict[str, dict]] = {}
    months: dict[str, str] = {}
    for row in rows:
        if str(row.get("app_version", "")).startswith("test"):
            continue
        donation = row["donation_id"]
        by_id.setdefault(donation, {})[row["module"]] = row["answers"]
        month = str(row["received_month"])[:10]
        months[donation] = min(months.get(donation, month), month)

    records = []
    for donation, sections in by_id.items():
        core = sections.get("core")
        if not core:  # Optional sections without a core section can't be interpreted.
            continue
        record = {column: "" for column in COLUMNS}
        record["received_month"] = months[donation]
        record["sections"] = ";".join(m for m in ("core", "southAsian", "context") if m in sections)
        for field, column in INTAKE_FIELDS.items():
            record[column] = _value(core.get("intake", {}).get(field))
        for field, column in CORE_FIELDS.items():
            record[column] = _value(core.get(field))

        south_asian = sections.get("southAsian", {})
        for field, column in SOUTH_ASIAN_FIELDS.items():
            record[column] = _value(south_asian.get(field))
        waist = south_asian.get("waist")
        if waist is not None:
            factor = 2.54 if south_asian.get("waistUnit") == "in" else 1.0
            record["waist_cm"] = round(waist * factor, 1)

        for field, column in CONTEXT_FIELDS.items():
            record[column] = _value(sections.get("context", {}).get(field))
        records.append(record)
    return records


# ---------------------------------------------------------------- anonymizing


def _key(record: dict) -> tuple:
    return tuple(record[q] or "unknown" for q in QUASI_IDENTIFIERS)


def _ten_year_band(band: str) -> str:
    low = int(band.split("-")[0]) // 10 * 10
    return f"{low}-{low + 9}"


def _broad_band(band: str) -> str:
    low = int(band.split("-")[0])
    return "30-49" if low < 50 else "50-64" if low < 65 else "65-84"


def _is_band(v: str) -> bool:
    return bool(v) and v.count("-") == 1 and v.split("-")[0].isdigit()


def _is_five_year_band(v: str) -> bool:
    if not _is_band(v):
        return False
    low, high = (int(x) for x in v.split("-"))
    return high - low == 4


# Ordered from least to most valuable detail, so ancestry, the dataset's reason for
# existing, is only coarsened after region and age have given up what they can.
GENERALIZATIONS = [
    ("region", lambda v: "us" if v.startswith("us_") else "non_us" if v else v),
    ("age_band", lambda v: _ten_year_band(v) if _is_five_year_band(v) else v),
    ("region", lambda v: "not_released"),
    (
        "ancestry",
        lambda v: (
            "south_asian_other"
            if v in SOUTH_ASIAN_NARROW
            else "other"
            if v in NON_SOUTH_ASIAN
            else v
        ),
    ),
    ("age_band", lambda v: _broad_band(v) if _is_band(v) else v),
]


def anonymize(records: list[dict], k: int = K) -> tuple[list[dict], dict]:
    """Generalize rare quasi-identifier combinations, then hold back what's still rare.

    Only records in groups smaller than k are generalized, one step at a time, so
    common combinations keep their full detail.
    """
    records = [dict(r) for r in records]
    stats = {"generalized": Counter(), "withheld": 0}
    for column, generalize in GENERALIZATIONS:
        sizes = Counter(_key(r) for r in records)
        for r in records:
            if sizes[_key(r)] < k:
                new = generalize(r[column])
                if new != r[column]:
                    r[column] = new
                    stats["generalized"][column] += 1
    sizes = Counter(_key(r) for r in records)
    kept = [r for r in records if sizes[_key(r)] >= k]
    stats["withheld"] = len(records) - len(kept)
    return kept, stats


def finalize(records: list[dict], seed: int | None = None) -> list[dict]:
    """Fresh random IDs and shuffled order, so rows can't be linked or ordered by time."""
    rng = random.Random(seed)
    out = [
        dict(r, donation_id=str(uuid.UUID(int=rng.getrandbits(128), version=4))) for r in records
    ]
    rng.shuffle(out)
    return out


# ---------------------------------------------------------------- writing


def write_release(records: list[dict], stats: dict, total_donations: int, folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    with open(folder / "heart-donations.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)
    ancestry = Counter(r["ancestry"] for r in records)
    generalized = ", ".join(f"{c}: {n}" for c, n in stats["generalized"].items()) or "none"
    notes = f"""# Release {folder.name}

- **Donations received** (test entries excluded): {total_donations}
- **Rows released:** {len(records)}
- **Withheld** to protect privacy (groups smaller than {K}): {stats["withheld"]}
- **Fields generalized:** {generalized}

## Rows by ancestry

{chr(10).join(f"- {a}: {n}" for a, n in ancestry.most_common())}

Every combination of age band, sex, ancestry, and region in this release describes at
least {K} donors. Field definitions: [data dictionary](../../../docs/DATA_DICTIONARY.md).
Licensed under CC BY 4.0.
"""
    (folder / "RELEASE_NOTES.md").write_text(notes)


def build(rows: list[dict], min_rows: int = MIN_RELEASE_ROWS, seed: int | None = None):
    merged = merge_donations(rows)
    kept, stats = anonymize(merged)
    if len(kept) < min_rows:
        raise SystemExit(
            f"Only {len(kept)} rows would be released (minimum {min_rows}). "
            "Wait for more donations before publishing."
        )
    return finalize(kept, seed), stats, len(merged)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--input", type=Path, help="JSON export of the donations table")
    parser.add_argument("--min-rows", type=int, default=MIN_RELEASE_ROWS)
    parser.add_argument("--name", default=date.today().strftime("%Y-%m"))
    args = parser.parse_args()

    if args.input:
        rows = json.loads(args.input.read_text())
    else:
        url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SECRET_KEY")
        if not url or not key:
            raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY, or pass --input.")
        rows = fetch_rows(url.rstrip("/"), key)

    records, stats, total = build(rows, args.min_rows)
    folder = OUT / args.name
    write_release(records, stats, total, folder)
    print(f"Released {len(records)} of {total} donations ({stats['withheld']} withheld).")
    print(f"Review {folder} before publishing.")


if __name__ == "__main__":
    main()
