"""BRFSS recoding: codes from the CDC's 2025 codebook map to the right values."""

import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

pytest.importorskip("pandas")
spec = importlib.util.spec_from_file_location(
    "prepare", Path(__file__).parents[1] / "ml" / "prepare.py"
)
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def raw(**overrides):
    row = {
        "_MICHD": 2,
        "_AGE80": 50,
        "_SEX": 1,
        "_IMPRACE": 3,
        "_BMI5": 2650,
        "_SMOKER3": 4,
        "DIABETE4": 3,
        "BPHIGH6": 3,
        "TOLDHI3": 2,
        "CHCKDNY2": 2,
        "_TOTINDA": 1,
        "_LLCPWT": 100.0,
    }
    row.update(overrides)
    return pd.DataFrame([row])


def test_recodes_a_typical_row():
    out = prepare.recode(raw()).iloc[0]
    assert out["heart_disease"] == 0
    assert out["female"] == 0
    assert out["race"] == "asian"
    assert out["bmi"] == pytest.approx(26.5)
    assert out["smoking"] == "never"
    assert out["diabetes"] == "no"
    assert out["high_bp"] == "no"
    assert out["high_cholesterol"] == "no"


@pytest.mark.parametrize(
    ("code", "expected"), [(1, "yes"), (2, "no"), (3, "no"), (4, "prediabetes")]
)
def test_pregnancy_only_diabetes_counts_as_no(code, expected):
    assert prepare.recode(raw(DIABETE4=code)).iloc[0]["diabetes"] == expected


@pytest.mark.parametrize(
    ("code", "expected"), [(1, "current"), (2, "current"), (3, "former"), (9, "unknown")]
)
def test_smoking_keeps_unknown_as_a_category(code, expected):
    assert prepare.recode(raw(_SMOKER3=code)).iloc[0]["smoking"] == expected


def test_unknown_cholesterol_is_a_category_not_dropped():
    assert prepare.recode(raw(TOLDHI3=7)).iloc[0]["high_cholesterol"] == "unknown"


def test_dont_know_heart_disease_is_missing():
    assert np.isnan(prepare.recode(raw(_MICHD=np.nan)).iloc[0]["heart_disease"])


def test_implausible_bmi_becomes_missing():
    assert np.isnan(prepare.recode(raw(_BMI5=9999)).iloc[0]["bmi"])


@pytest.mark.parametrize(("age", "kept"), [(29, False), (30, True), (79, True), (80, False)])
def test_keeps_ages_30_to_79(age, kept):
    assert len(prepare.recode(raw(_AGE80=age))) == int(kept)
