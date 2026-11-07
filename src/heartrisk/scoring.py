"""Score one profile with every model."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike

from heartrisk.models import pce, prevent, qrisk3
from heartrisk.profile import Profile

BLACK = frozenset({"black_caribbean", "black_african"})

# Population means of SBP variability in QRISK3's derivation cohort. Using them
# when a patient's own value is unknown makes that term contribute nothing.
QRISK3_DEFAULT_SBP_SD = {True: 9.002537727355957, False: 8.756621360778809}

# Every model is called with the profile plus the three measured values that
# the uncertainty simulation varies, so scalars and sample arrays share a path.
ModelFn = Callable[[Profile, ArrayLike, ArrayLike, ArrayLike], np.ndarray]


@dataclass(frozen=True)
class Model:
    key: str
    name: str
    outcome: str
    fn: ModelFn
    valid_ranges: dict[str, tuple[float, float]]


@dataclass(frozen=True)
class ModelResult:
    model: Model
    risk: float
    out_of_range: tuple[str, ...]
    """Inputs outside the range the model was validated on. The risk is still
    computed, but it is an extrapolation."""


def _pce(p: Profile, sbp: ArrayLike, tc: ArrayLike, hdl: ArrayLike) -> np.ndarray:
    return pce.pce_10yr_ascvd(
        age=p.age,
        female=p.female,
        black=p.ethnicity in BLACK,
        total_cholesterol=tc,
        hdl_cholesterol=hdl,
        systolic_bp=sbp,
        on_bp_meds=p.on_bp_meds,
        smoker=p.current_smoker,
        diabetic=p.diabetic,
    )


def _prevent(p: Profile, sbp: ArrayLike, tc: ArrayLike, hdl: ArrayLike) -> np.ndarray:
    return prevent.prevent_10yr(
        age=p.age,
        female=p.female,
        total_cholesterol=tc,
        hdl_cholesterol=hdl,
        systolic_bp=sbp,
        on_bp_meds=p.on_bp_meds,
        on_statin=p.on_statin,
        diabetic=p.diabetic,
        smoker=p.current_smoker,
        egfr=p.egfr,
        bmi=p.bmi,
        outcome="ascvd",
    )


def _qrisk3(p: Profile, sbp: ArrayLike, tc: ArrayLike, hdl: ArrayLike) -> np.ndarray:
    sbp_sd = p.systolic_bp_sd if p.systolic_bp_sd is not None else QRISK3_DEFAULT_SBP_SD[p.female]
    return qrisk3.qrisk3_10yr(
        age=p.age,
        female=p.female,
        ethnicity=p.ethnicity,
        smoking=p.smoking,
        cholesterol_ratio=np.asarray(tc, dtype=float) / np.asarray(hdl, dtype=float),
        systolic_bp=sbp,
        systolic_bp_sd=sbp_sd,
        bmi=p.bmi,
        townsend=p.townsend,
        on_bp_meds=p.on_bp_meds,
        type1_diabetes=p.diabetes == "type1",
        type2_diabetes=p.diabetes == "type2",
        family_history_cvd=p.family_history_cvd,
        atrial_fibrillation=p.atrial_fibrillation,
        atypical_antipsychotics=p.atypical_antipsychotics,
        corticosteroids=p.corticosteroids,
        erectile_dysfunction=p.erectile_dysfunction and not p.female,
        migraine=p.migraine,
        rheumatoid_arthritis=p.rheumatoid_arthritis,
        chronic_kidney_disease=p.chronic_kidney_disease,
        severe_mental_illness=p.severe_mental_illness,
        lupus=p.lupus,
    )


MODELS: dict[str, Model] = {
    m.key: m
    for m in [
        Model("pce", "Pooled Cohort Equations", "hard ASCVD", _pce, pce.VALID_RANGES),
        Model("prevent", "PREVENT", "ASCVD", _prevent, prevent.VALID_RANGES),
        Model("qrisk3", "QRISK3", "CVD (CHD, stroke, TIA)", _qrisk3, qrisk3.VALID_RANGES),
    ]
}


def _out_of_range(p: Profile, ranges: dict[str, tuple[float, float]]) -> tuple[str, ...]:
    values = {
        "age": p.age,
        "total_cholesterol": p.total_cholesterol,
        "hdl_cholesterol": p.hdl_cholesterol,
        "systolic_bp": p.systolic_bp,
        "bmi": p.bmi,
        "egfr": p.egfr,
        "cholesterol_ratio": p.total_cholesterol / p.hdl_cholesterol,
    }
    return tuple(name for name, (low, high) in ranges.items() if not low <= values[name] <= high)


def score(profile: Profile) -> dict[str, ModelResult]:
    """Return each model's 10-year risk (as a fraction) for ``profile``."""
    p = profile
    return {
        key: ModelResult(
            model=m,
            risk=float(m.fn(p, p.systolic_bp, p.total_cholesterol, p.hdl_cholesterol)),
            out_of_range=_out_of_range(p, m.valid_ranges),
        )
        for key, m in MODELS.items()
    }
