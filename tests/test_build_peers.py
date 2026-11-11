"""The 'people like you' builder: how NHANES and donated rows become calculator inputs."""

import csv
import importlib.util
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("build_peers", ROOT / "scripts" / "build_peers.py")
bp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bp)


def test_egfr_matches_ckd_epi_2021_reference_values():
    # Hand-computed from the published equation.
    assert math.isclose(bp.egfr_ckd_epi_2021(0.7, 50, female=True), 105.3, abs_tol=0.2)
    assert math.isclose(bp.egfr_ckd_epi_2021(1.0, 60, female=False), 86.2, abs_tol=0.2)


def test_smoking_categories():
    assert bp.smoking_category(2, math.nan, math.nan) == "never"
    assert bp.smoking_category(1, 3, math.nan) == "former"
    assert bp.smoking_category(1, 1, 5) == "light"
    assert bp.smoking_category(1, 2, 15) == "moderate"
    assert bp.smoking_category(1, 1, 25) == "heavy"
    assert bp.smoking_category(1, 1, 999) == "light"  # "don't know" counts as a smoker
    assert bp.smoking_category(7, math.nan, math.nan) is None  # refused: excluded


def test_diabetes_categories():
    assert bp.diabetes_category(2, math.nan, math.nan) == "none"
    assert bp.diabetes_category(1, 12, 1) == "type1"
    assert bp.diabetes_category(1, 55, 1) == "type2"
    assert bp.diabetes_category(3, math.nan, math.nan) == "none"  # borderline


def test_heart_history_excludes_anyone_with_a_prior_event():
    assert bp.has_heart_history({"MCQ160E": 1})
    assert bp.has_heart_history({"MCQ160F": 1})
    assert not bp.has_heart_history({"MCQ160E": 2, "MCQ160A": 1})  # arthritis doesn't count


def _write_release(path: Path, rows: list[dict]) -> Path:
    fields = sorted({k for r in rows for k in r})
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return path


BASE = {
    "age_band": "45-49",
    "sex": "male",
    "ancestry": "pakistani",
    "heart_history": "no",
    "systolic_bp": "130",
    "total_cholesterol": "210",
    "hdl_cholesterol": "40",
    "bmi": "27",
    "egfr": "90",
    "smoking": "never",
    "diabetes": "none",
    "on_bp_meds": "true",
    "on_statin": "false",
}


def test_donated_rows_keep_only_people_the_calculators_apply_to(tmp_path):
    release = _write_release(
        tmp_path / "heart-donations.csv",
        [
            BASE,
            {**BASE, "heart_history": "yes"},  # had an event: calculators don't apply
            {**BASE, "systolic_bp": ""},  # missing a measurement
            {**BASE, "age_band": "30-49"},  # generalized band still works
        ],
    )
    rows = bp.donated_rows(release)
    assert [r["age"] for r in rows] == [47, 39]
    assert rows[0]["group"] == "pakistani" and rows[0]["bp_meds"] and not rows[0]["statin"]


def test_columns_are_compact_and_weights_average_one_per_source():
    rows = [
        {
            "src": "nhanes",
            "female": True,
            "age": 50,
            "group": "asian",
            "weight": 3000.0,
            "sbp": 120,
            "tc": 200,
            "hdl": 50,
            "smoking": "never",
            "diabetes": "none",
            "bp_meds": False,
            "statin": False,
            "bmi": 25.0,
            "egfr": 90,
        },
        {
            "src": "nhanes",
            "female": False,
            "age": 60,
            "group": "white",
            "weight": 1000.0,
            "sbp": 140,
            "tc": 220,
            "hdl": 45,
            "smoking": "heavy",
            "diabetes": "type2",
            "bp_meds": True,
            "statin": True,
            "bmi": 31.0,
            "egfr": 70,
        },
    ]
    out = bp.to_columns(rows)
    assert sorted(out["columns"]["weight"]) == [0.5, 1.5]
    assert out["groups"] == ["asian", "white"]
    assert set(out["columns"]) >= {"sbp", "tc", "hdl", "egfr"} and "SEQN" not in out["columns"]
