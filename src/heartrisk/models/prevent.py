"""AHA PREVENT equations (2023), base 10-year model.

Source: Khan SS, et al. Development and Validation of the American Heart
Association's PREVENT Equations. Circulation. 2024;149(6):430-449.
Coefficients from the article's supplement, as tabulated in the preventr
R package (Mayer, MIT license).

PREVENT does not use race or ethnicity at all.
"""

from __future__ import annotations

from typing import Literal

import numpy as np
from numpy.typing import ArrayLike

Outcome = Literal["total_cvd", "ascvd", "heart_failure"]

MG_DL_TO_MMOL_L = 0.02586

# Order matches the terms built in prevent_10yr below.
_TERMS = [
    "age",
    "non_hdl",
    "hdl",
    "sbp_lt_110",
    "sbp_gte_110",
    "diabetes",
    "smoker",
    "bmi_lt_30",
    "bmi_gte_30",
    "egfr_lt_60",
    "egfr_gte_60",
    "bp_meds",
    "statin",
    "bp_meds_x_sbp_gte_110",
    "statin_x_non_hdl",
    "age_x_non_hdl",
    "age_x_hdl",
    "age_x_sbp_gte_110",
    "age_x_diabetes",
    "age_x_smoker",
    "age_x_bmi_gte_30",
    "age_x_egfr_lt_60",
    "constant",
]

# fmt: off
_COEFFICIENTS: dict[tuple[Outcome, bool], list[float]] = {
    ("total_cvd", True): [
        0.7939329, 0.0305239, -0.1606857, -0.2394003, 0.3600781, 0.8667604, 0.5360739,
        0.0, 0.0, 0.6045917, 0.0433769, 0.3151672, -0.1477655, -0.0663612, 0.1197879,
        -0.0819715, 0.0306769, -0.0946348, -0.27057, -0.078715, 0.0, -0.1637806, -3.307728,
    ],
    ("total_cvd", False): [
        0.7688528, 0.0736174, -0.0954431, -0.4347345, 0.3362658, 0.7692857, 0.4386871,
        0.0, 0.0, 0.5378979, 0.0164827, 0.288879, -0.1337349, -0.0475924, 0.150273,
        -0.0517874, 0.0191169, -0.1049477, -0.2251948, -0.0895067, 0.0, -0.1543702, -3.031168,
    ],
    ("ascvd", True): [
        0.719883, 0.1176967, -0.151185, -0.0835358, 0.3592852, 0.8348585, 0.4831078,
        0.0, 0.0, 0.4864619, 0.0397779, 0.2265309, -0.0592374, -0.0395762, 0.0844423,
        -0.0567839, 0.0325692, -0.1035985, -0.2417542, -0.0791142, 0.0, -0.1671492, -3.819975,
    ],
    ("ascvd", False): [
        0.7099847, 0.1658663, -0.1144285, -0.2837212, 0.3239977, 0.7189597, 0.3956973,
        0.0, 0.0, 0.3690075, 0.0203619, 0.2036522, -0.0865581, -0.0322916, 0.114563,
        -0.0300005, 0.0232747, -0.0927024, -0.2018525, -0.0970527, 0.0, -0.1217081, -3.500655,
    ],
    ("heart_failure", True): [
        0.8998235, 0.0, 0.0, -0.4559771, 0.3576505, 1.038346, 0.583916,
        -0.0072294, 0.2997706, 0.7451638, 0.0557087, 0.3534442, 0.0, -0.0981511, 0.0,
        0.0, 0.0, -0.0946663, -0.3581041, -0.1159453, -0.003878, -0.1884289, -4.310409,
    ],
    ("heart_failure", False): [
        0.8972642, 0.0, 0.0, -0.6811466, 0.3634461, 0.923776, 0.5023736,
        -0.0485841, 0.3726929, 0.6926917, 0.0251827, 0.2980922, 0.0, -0.0497731, 0.0,
        0.0, 0.0, -0.1289201, -0.3040924, -0.1401688, 0.0068126, -0.1797778, -3.946391,
    ],
}
# fmt: on

VALID_RANGES = {
    "age": (30, 79),
    "total_cholesterol": (130, 320),
    "hdl_cholesterol": (20, 100),
    "systolic_bp": (90, 180),
    "bmi": (18.5, 39.9),
    "egfr": (15, 140),
}


def prevent_10yr(
    *,
    age: ArrayLike,
    female: bool,
    total_cholesterol: ArrayLike,
    hdl_cholesterol: ArrayLike,
    systolic_bp: ArrayLike,
    on_bp_meds: bool,
    on_statin: bool,
    diabetic: bool,
    smoker: bool,
    egfr: ArrayLike,
    bmi: ArrayLike,
    outcome: Outcome = "ascvd",
) -> np.ndarray:
    """Return 10-year risk of ``outcome`` as a fraction (0-1).

    Cholesterol is in mg/dL. Continuous inputs broadcast.
    """
    age = (np.asarray(age, dtype=float) - 55) / 10
    total_mmol = np.asarray(total_cholesterol, dtype=float) * MG_DL_TO_MMOL_L
    hdl_mmol = np.asarray(hdl_cholesterol, dtype=float) * MG_DL_TO_MMOL_L
    non_hdl = total_mmol - hdl_mmol - 3.5
    hdl = (hdl_mmol - 1.3) / 0.3
    sbp = np.asarray(systolic_bp, dtype=float)
    sbp_lt_110 = (np.minimum(sbp, 110) - 110) / 20
    sbp_gte_110 = (np.maximum(sbp, 110) - 130) / 20
    bmi = np.asarray(bmi, dtype=float)
    bmi_lt_30 = (np.minimum(bmi, 30) - 25) / 5
    bmi_gte_30 = (np.maximum(bmi, 30) - 30) / 5
    egfr = np.asarray(egfr, dtype=float)
    egfr_lt_60 = (np.minimum(egfr, 60) - 60) / -15
    egfr_gte_60 = (np.maximum(egfr, 60) - 90) / -15
    bp_meds, statin, dm, smoke = float(on_bp_meds), float(on_statin), float(diabetic), float(smoker)

    values = [
        age,
        non_hdl,
        hdl,
        sbp_lt_110,
        sbp_gte_110,
        dm,
        smoke,
        bmi_lt_30,
        bmi_gte_30,
        egfr_lt_60,
        egfr_gte_60,
        bp_meds,
        statin,
        bp_meds * sbp_gte_110,
        statin * non_hdl,
        age * non_hdl,
        age * hdl,
        age * sbp_gte_110,
        age * dm,
        age * smoke,
        age * bmi_gte_30,
        age * egfr_lt_60,
        1.0,
    ]
    log_odds = sum(b * v for b, v in zip(_COEFFICIENTS[(outcome, female)], values, strict=True))
    return 1 / (1 + np.exp(-log_odds))
