"""Turn the raw BRFSS 2025 file into a clean modeling table.

Value codes follow the CDC's 2025 BRFSS codebook. Only risk factors are kept
as features; variables that are often *consequences* of heart disease
(general health rating, stroke, blood pressure and cholesterol medication)
are left out so the model can't learn reverse causation.

Usage: python ml/prepare.py   (after python ml/download.py)
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).parent / "data"
OUT = DATA / "brfss2025.csv.gz"

COLUMNS = [
    "_MICHD",
    "_AGE80",
    "_SEX",
    "_IMPRACE",
    "_BMI5",
    "_SMOKER3",
    "DIABETE4",
    "BPHIGH6",
    "TOLDHI3",
    "CHCKDNY2",
    "_TOTINDA",
    "_LLCPWT",
]

RACE = {1: "white", 2: "black", 3: "asian", 4: "aian", 5: "hispanic", 6: "other"}
SMOKING = {1: "current", 2: "current", 3: "former", 4: "never"}
# "Yes, but only during pregnancy" counts as no for both diabetes and blood pressure.
DIABETES = {1: "yes", 2: "no", 3: "no", 4: "prediabetes"}
HIGH_BP = {1: "yes", 2: "no", 3: "no", 4: "borderline"}
YES_NO = {1: 1.0, 2: 0.0}

# Missing answers here are common and not random (not knowing your cholesterol
# usually means it was never checked), so "unknown" is kept as its own category
# instead of dropping those respondents, who skew non-white.
UNKNOWN_AS_CATEGORY = ["smoking", "high_bp", "high_cholesterol"]
# BMI is imputed at training time, with an indicator that it was missing.
IMPUTED_LATER = ["bmi"]

AGE_RANGE = (30, 79)


def recode(raw: pd.DataFrame) -> pd.DataFrame:
    """Map BRFSS codes to analysis values.

    Don't-know and refused answers become "unknown" for the categories listed
    in UNKNOWN_AS_CATEGORY and missing everywhere else.
    """
    df = pd.DataFrame(
        {
            "heart_disease": raw["_MICHD"].map(YES_NO),
            "age": raw["_AGE80"],
            "female": raw["_SEX"].map({1: 0.0, 2: 1.0}),
            "race": raw["_IMPRACE"].map(RACE),
            "bmi": raw["_BMI5"] / 100,
            "smoking": raw["_SMOKER3"].map(SMOKING),
            "diabetes": raw["DIABETE4"].map(DIABETES),
            "high_bp": raw["BPHIGH6"].map(HIGH_BP),
            "high_cholesterol": raw["TOLDHI3"].map({1: "yes", 2: "no"}),
            "kidney_disease": raw["CHCKDNY2"].map(YES_NO),
            "physically_active": raw["_TOTINDA"].map(YES_NO),
            "weight": raw["_LLCPWT"],
        }
    )
    df[UNKNOWN_AS_CATEGORY] = df[UNKNOWN_AS_CATEGORY].fillna("unknown")
    df.loc[~df["bmi"].between(12, 80), "bmi"] = np.nan
    return df[df["age"].between(*AGE_RANGE)]


def load_raw() -> pd.DataFrame:
    # The extracted file name carries a trailing space, so match it loosely.
    path = next((DATA / "raw").glob("LLCP2025.XPT*"))
    chunks = pd.read_sas(path, format="xport", chunksize=50_000, encoding="infer")
    return pd.concat([chunk[COLUMNS] for chunk in chunks], ignore_index=True)


def main() -> None:
    raw = load_raw()
    df = recode(raw)
    complete = df.dropna(subset=[c for c in df.columns if c not in IMPUTED_LATER])
    print(f"Respondents: {len(raw):,}")
    print(f"Aged {AGE_RANGE[0]}-{AGE_RANGE[1]}: {len(df):,}")
    print(f"Kept: {len(complete):,} ({len(complete) / len(df):.1%})")
    kept_by_race = complete["race"].value_counts() / df["race"].value_counts()
    print("Kept by race:", ", ".join(f"{k} {v:.1%}" for k, v in kept_by_race.items()))
    weighted = np.average(complete["heart_disease"], weights=complete["weight"])
    print(f"Weighted share reporting heart disease: {weighted:.1%}")
    complete.to_csv(OUT, index=False)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
