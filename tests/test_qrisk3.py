import csv
from pathlib import Path

import pytest

from heartrisk.models.qrisk3 import qrisk3_10yr

SMOKING = ["never", "former", "light", "moderate", "heavy"]
ETHNICITY = [
    "white",
    "indian",
    "pakistani",
    "bangladeshi",
    "other_asian",
    "black_caribbean",
    "black_african",
    "chinese",
    "other",
]

with open(Path(__file__).parent / "data" / "qrisk3_2017_reference.csv") as f:
    CASES = list(csv.DictReader(f))


@pytest.mark.parametrize("row", CASES, ids=[f"case{i + 1}" for i in range(len(CASES))])
def test_matches_clinrisk_c_implementation(row):
    r = {k: float(v) for k, v in row.items()}
    risk = qrisk3_10yr(
        age=r["age"],
        female=r["gender"] == 1,
        ethnicity=ETHNICITY[int(r["ethrisk"]) - 1],
        smoking=SMOKING[int(r["smoke_cat"]) - 1],
        cholesterol_ratio=r["rati"],
        systolic_bp=r["sbp"],
        systolic_bp_sd=r["sbps5"],
        bmi=r["weight"] / (r["height"] / 100) ** 2,
        townsend=r["town"],
        on_bp_meds=bool(r["b_treatedhyp"]),
        type1_diabetes=bool(r["b_type1"]),
        type2_diabetes=bool(r["b_type2"]),
        family_history_cvd=bool(r["fh_cvd"]),
        atrial_fibrillation=bool(r["b_AF"]),
        atypical_antipsychotics=bool(r["b_atypicalantipsy"]),
        corticosteroids=bool(r["b_corticosteroids"]),
        erectile_dysfunction=bool(r["b_impotence2"]),
        migraine=bool(r["b_migraine"]),
        rheumatoid_arthritis=bool(r["b_ra"]),
        chronic_kidney_disease=bool(r["b_renal"]),
        severe_mental_illness=bool(r["b_semi"]),
        lupus=bool(r["b_sle"]),
    )
    assert round(float(risk) * 100, 1) == pytest.approx(r["QRISK_C_algorithm_score"], abs=0.05)
