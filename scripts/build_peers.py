"""Build the "people like you" comparison data for the web app.

The app compares someone's risk with people of the same sex, within 10 years of
their age, and the same race or ancestry. That needs real people's *measured*
blood pressure and cholesterol, so the browser can score them with exactly the
same calculators. Two sources feed it:

1. NHANES (CDC, public domain): a nationally representative US survey that
   measures blood pressure and draws blood. It records Asian Americans as a
   single group, so it can't separate South Asians.
2. This project's own published donation releases (CC BY 4.0), which do record
   South Asian ancestry. Only already-public, k-anonymous release rows are used,
   never the private database.

Usage:
    python scripts/build_peers.py --download   # fetch NHANES once (~40 MB)
    python scripts/build_peers.py              # write web/src/data/peers.json

The output holds only the fields the calculators need, with no NHANES IDs, in
shuffled order.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NHANES_DIR = ROOT / "ml" / "data" / "nhanes"
RELEASES_DIR = ROOT / "data" / "releases"
OUTPUT = ROOT / "web" / "src" / "data" / "peers.json"
BASE_URL = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public"

# Two most recent cycles. Years covered weight each cycle's share of the pool.
CYCLES = {
    "2017-2020": {
        "folder": "2017",
        "suffix": ("P_", ""),
        "years": 3.2,
        "weight": "WTMECPRP",
        "bp_meds": "BPQ050A",
        "statin": "BPQ100D",
    },
    "2021-2023": {
        "folder": "2021",
        "suffix": ("", "_L"),
        "years": 2.0,
        # Cholesterol was measured in a subsample this cycle, with its own weight.
        "weight": "WTPH2YR",
        "bp_meds": "BPQ150",
        "statin": "BPQ101D",
    },
}
TABLES = ["DEMO", "BPXO", "TCHOL", "HDL", "BMX", "BPQ", "DIQ", "SMQ", "MCQ", "BIOPRO"]

# NHANES RIDRETH3 -> the app's comparison groups.
RACE_GROUPS = {1: "hispanic", 2: "hispanic", 3: "white", 4: "black", 6: "asian", 7: "other"}
SMOKING_CODES = {"never": 0, "former": 1, "light": 2, "moderate": 3, "heavy": 4}
DIABETES_CODES = {"none": 0, "type1": 1, "type2": 2}
MIN_AGE, MAX_AGE = 25, 80  # NHANES top-codes age at 80

YES, NO = 1, 2


def _file(cycle: str, table: str) -> str:
    prefix, suffix = CYCLES[cycle]["suffix"]
    return f"{prefix}{table}{suffix}.xpt"


def download(folder: Path = NHANES_DIR) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for cycle, info in CYCLES.items():
        for table in TABLES:
            name = _file(cycle, table)
            target = folder / name
            if target.exists():
                continue
            url = f"{BASE_URL}/{info['folder']}/DataFiles/{name}"
            print(f"Downloading {url}")
            urllib.request.urlretrieve(url, target)


def egfr_ckd_epi_2021(creatinine_mg_dl: float, age: float, female: bool) -> float:
    """Kidney function from serum creatinine (CKD-EPI 2021, race-free)."""
    kappa, alpha = (0.7, -0.241) if female else (0.9, -0.302)
    ratio = creatinine_mg_dl / kappa
    egfr = 142 * min(ratio, 1) ** alpha * max(ratio, 1) ** -1.2 * 0.9938**age
    return egfr * (1.012 if female else 1)


def smoking_category(ever_100: float, now: float, per_day: float) -> str | None:
    """SMQ020 (100+ cigarettes ever), SMQ040 (smoke now), SMD650 (cigarettes a day)."""
    if ever_100 == NO:
        return "never"
    if ever_100 != YES:
        return None
    if now == 3:  # "not at all"
        return "former"
    if now not in (1, 2):
        return None
    if not (per_day > 0) or per_day >= 777:
        return "light"
    return "light" if per_day < 10 else "moderate" if per_day < 20 else "heavy"


def diabetes_category(told: float, age_diagnosed: float, insulin: float) -> str:
    """DIQ010, DID040, DIQ050. Diagnosed young and on insulin suggests type 1."""
    if told != YES:
        return "none"
    if 0 < age_diagnosed < 30 and insulin == YES:
        return "type1"
    return "type2"


def has_heart_history(row: dict) -> bool:
    """Heart failure, coronary disease, angina, heart attack, or stroke (MCQ160B-F)."""
    return any(row.get(f"MCQ160{c}") == YES for c in "BCDEF")


def _num(v) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return math.nan
    return f


def nhanes_rows(folder: Path = NHANES_DIR) -> list[dict]:
    import pandas as pd

    rows: list[dict] = []
    total_years = sum(info["years"] for info in CYCLES.values())
    for cycle, info in CYCLES.items():
        merged = None
        for table in TABLES:
            df = pd.read_sas(folder / _file(cycle, table), format="xport", encoding="infer")
            if "WTPH2YR" in df.columns and table != "TCHOL":
                df = df.drop(columns="WTPH2YR")
            merged = df if merged is None else merged.merge(df, on="SEQN", how="left")
        for raw in merged.to_dict("records"):
            r = {k: _num(v) for k, v in raw.items()}
            age = r["RIDAGEYR"]
            if not (MIN_AGE <= age <= MAX_AGE) or has_heart_history(r):
                continue
            group = RACE_GROUPS.get(int(r["RIDRETH3"]))
            weight = r[info["weight"]]
            readings = [r[f"BPXOSY{i}"] for i in (1, 2, 3) if r[f"BPXOSY{i}"] > 0]
            needed = [r["LBXTC"], r["LBDHDD"], r["BMXBMI"], r["LBXSCR"], weight]
            if group is None or len(readings) < 2 or not all(v > 0 for v in needed):
                continue
            smoking = smoking_category(r["SMQ020"], r["SMQ040"], r["SMD650"])
            if smoking is None:
                continue
            female = r["RIAGENDR"] == 2
            rows.append(
                {
                    "src": "nhanes",
                    "female": female,
                    "age": int(age),
                    "group": group,
                    "weight": weight * info["years"] / total_years,
                    "sbp": round(sum(readings) / len(readings)),
                    "tc": round(r["LBXTC"]),
                    "hdl": round(r["LBDHDD"]),
                    "smoking": smoking,
                    "diabetes": diabetes_category(r["DIQ010"], r["DID040"], r["DIQ050"]),
                    "bp_meds": r[info["bp_meds"]] == YES,
                    "statin": r[info["statin"]] == YES,
                    "bmi": round(r["BMXBMI"], 1),
                    "egfr": round(egfr_ckd_epi_2021(r["LBXSCR"], age, female)),
                }
            )
    return rows


def _band_midpoint(band: str) -> int | None:
    try:
        low, high = (int(x) for x in band.split("-"))
    except ValueError:
        return None
    return (low + high) // 2


def latest_release(folder: Path = RELEASES_DIR) -> Path | None:
    files = sorted(folder.glob("*/heart-donations.csv"), key=lambda p: p.stat().st_mtime)
    return files[-1] if files else None


def donated_rows(release_csv: Path) -> list[dict]:
    """Published donors who haven't had a heart event, so the calculators apply."""
    out = []
    with open(release_csv, newline="") as f:
        for r in csv.DictReader(f):
            age = _band_midpoint(r.get("age_band", ""))
            try:
                values = [
                    int(r[k]) for k in ("systolic_bp", "total_cholesterol", "hdl_cholesterol")
                ]
                bmi, egfr = float(r["bmi"]), int(r["egfr"])
            except (KeyError, ValueError):
                continue
            if (
                r.get("heart_history") != "no"
                or age is None
                or r.get("sex") not in ("female", "male")
            ):
                continue
            if r.get("smoking") not in SMOKING_CODES or r.get("diabetes") not in DIABETES_CODES:
                continue
            out.append(
                {
                    "src": "donated",
                    "female": r["sex"] == "female",
                    "age": age,
                    "group": r.get("ancestry") or "other",
                    "weight": 1.0,
                    "sbp": values[0],
                    "tc": values[1],
                    "hdl": values[2],
                    "smoking": r["smoking"],
                    "diabetes": r["diabetes"],
                    "bp_meds": r.get("on_bp_meds") == "true",
                    "statin": r.get("on_statin") == "true",
                    "bmi": bmi,
                    "egfr": egfr,
                }
            )
    return out


def to_columns(rows: list[dict], seed: int = 0) -> dict:
    """Compact, column-oriented JSON in shuffled order. Weights average 1 per source."""
    rows = rows[:]
    random.Random(seed).shuffle(rows)
    mean_weight = {
        src: sum(r["weight"] for r in rows if r["src"] == src)
        / max(1, sum(r["src"] == src for r in rows))
        for src in {r["src"] for r in rows}
    }
    groups = sorted({r["group"] for r in rows})
    return {
        "groups": groups,
        "sources": ["nhanes", "donated"],
        "smoking": list(SMOKING_CODES),
        "diabetes": list(DIABETES_CODES),
        "columns": {
            "src": [0 if r["src"] == "nhanes" else 1 for r in rows],
            "female": [int(r["female"]) for r in rows],
            "age": [r["age"] for r in rows],
            "group": [groups.index(r["group"]) for r in rows],
            "weight": [round(r["weight"] / mean_weight[r["src"]], 3) for r in rows],
            "sbp": [r["sbp"] for r in rows],
            "tc": [r["tc"] for r in rows],
            "hdl": [r["hdl"] for r in rows],
            "smoking": [SMOKING_CODES[r["smoking"]] for r in rows],
            "diabetes": [DIABETES_CODES[r["diabetes"]] for r in rows],
            "bpMeds": [int(r["bp_meds"]) for r in rows],
            "statin": [int(r["statin"]) for r in rows],
            "bmi": [r["bmi"] for r in rows],
            "egfr": [r["egfr"] for r in rows],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--download", action="store_true", help="Download NHANES files first")
    parser.add_argument("--release", type=Path, help="Release CSV to add (default: the newest one)")
    args = parser.parse_args()

    if args.download:
        download()
    rows = nhanes_rows()
    release = args.release or latest_release()
    if release:
        donated = donated_rows(release)
        print(f"Adding {len(donated)} donated rows from {release.relative_to(ROOT)}")
        rows += donated
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(to_columns(rows), separators=(",", ":")) + "\n")
    by_group: dict[str, int] = {}
    for r in rows:
        by_group[r["group"]] = by_group.get(r["group"], 0) + 1
    print(f"Wrote {len(rows)} people to {OUTPUT.relative_to(ROOT)}: {by_group}")


if __name__ == "__main__":
    main()
