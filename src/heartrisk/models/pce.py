"""ACC/AHA Pooled Cohort Equations (2013) for 10-year hard ASCVD risk.

Source: Goff DC Jr, et al. 2013 ACC/AHA Guideline on the Assessment of
Cardiovascular Risk. Circulation. 2014;129(25 Suppl 2):S49-73, Table A.

The equations were derived only for white and African American adults.
Everyone else, South Asians included, is scored with the white equations.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike

# Terms not listed for a group have a coefficient of zero.
_COEFFICIENTS: dict[tuple[bool, bool], dict[str, float]] = {
    # (female, black)
    (True, False): {
        "ln_age": -29.799,
        "ln_age_sq": 4.884,
        "ln_tc": 13.540,
        "ln_age_ln_tc": -3.114,
        "ln_hdl": -13.578,
        "ln_age_ln_hdl": 3.149,
        "ln_sbp_treated": 2.019,
        "ln_sbp_untreated": 1.957,
        "smoker": 7.574,
        "ln_age_smoker": -1.665,
        "diabetes": 0.661,
        "mean": -29.1817,
        "baseline_survival": 0.9665,
    },
    (True, True): {
        "ln_age": 17.114,
        "ln_tc": 0.940,
        "ln_hdl": -18.920,
        "ln_age_ln_hdl": 4.475,
        "ln_sbp_treated": 29.291,
        "ln_age_ln_sbp_treated": -6.432,
        "ln_sbp_untreated": 27.820,
        "ln_age_ln_sbp_untreated": -6.087,
        "smoker": 0.691,
        "diabetes": 0.874,
        "mean": 86.6081,
        "baseline_survival": 0.9533,
    },
    (False, False): {
        "ln_age": 12.344,
        "ln_tc": 11.853,
        "ln_age_ln_tc": -2.664,
        "ln_hdl": -7.990,
        "ln_age_ln_hdl": 1.769,
        "ln_sbp_treated": 1.797,
        "ln_sbp_untreated": 1.764,
        "smoker": 7.837,
        "ln_age_smoker": -1.795,
        "diabetes": 0.658,
        "mean": 61.1816,
        "baseline_survival": 0.9144,
    },
    (False, True): {
        "ln_age": 2.469,
        "ln_tc": 0.302,
        "ln_hdl": -0.307,
        "ln_sbp_treated": 1.916,
        "ln_sbp_untreated": 1.809,
        "smoker": 0.549,
        "diabetes": 0.645,
        "mean": 19.5425,
        "baseline_survival": 0.8954,
    },
}

VALID_RANGES = {
    "age": (40, 79),
    "total_cholesterol": (130, 320),
    "hdl_cholesterol": (20, 100),
    "systolic_bp": (90, 200),
}


def pce_10yr_ascvd(
    *,
    age: ArrayLike,
    female: bool,
    black: bool,
    total_cholesterol: ArrayLike,
    hdl_cholesterol: ArrayLike,
    systolic_bp: ArrayLike,
    on_bp_meds: bool,
    smoker: bool,
    diabetic: bool,
) -> np.ndarray:
    """Return 10-year hard ASCVD risk as a fraction (0-1).

    Continuous inputs broadcast, so arrays of samples can be scored at once.
    """
    c = _COEFFICIENTS[(female, black)]
    ln_age = np.log(age)
    ln_tc = np.log(total_cholesterol)
    ln_hdl = np.log(hdl_cholesterol)
    ln_sbp = np.log(systolic_bp)
    sbp_key = "treated" if on_bp_meds else "untreated"

    total = (
        c.get("ln_age", 0) * ln_age
        + c.get("ln_age_sq", 0) * ln_age**2
        + c.get("ln_tc", 0) * ln_tc
        + c.get("ln_age_ln_tc", 0) * ln_age * ln_tc
        + c.get("ln_hdl", 0) * ln_hdl
        + c.get("ln_age_ln_hdl", 0) * ln_age * ln_hdl
        + c.get(f"ln_sbp_{sbp_key}", 0) * ln_sbp
        + c.get(f"ln_age_ln_sbp_{sbp_key}", 0) * ln_age * ln_sbp
        + c.get("smoker", 0) * smoker
        + c.get("ln_age_smoker", 0) * ln_age * smoker
        + c.get("diabetes", 0) * diabetic
    )
    return 1 - c["baseline_survival"] ** np.exp(total - c["mean"])
