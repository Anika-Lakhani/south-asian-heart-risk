"""The patient profile shared by every risk model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, get_args

Sex = Literal["female", "male"]

# QRISK3's ethnicity categories. It is the only model here that distinguishes
# South Asian groups; the others map these onto their own coarser categories.
Ethnicity = Literal[
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

# QRISK3 grades current smokers by cigarettes per day:
# light < 10, moderate 10-19, heavy >= 20.
Smoking = Literal["never", "former", "light", "moderate", "heavy"]

Diabetes = Literal["none", "type1", "type2"]

SOUTH_ASIAN: frozenset[str] = frozenset({"indian", "pakistani", "bangladeshi"})


@dataclass(frozen=True)
class Profile:
    """One person's risk factors.

    Cholesterol is in mg/dL and blood pressure in mmHg. Fields after
    ``family_history_cvd`` are used only by QRISK3.
    """

    age: float
    sex: Sex
    total_cholesterol: float
    hdl_cholesterol: float
    systolic_bp: float
    ethnicity: Ethnicity = "white"
    on_bp_meds: bool = False
    smoking: Smoking = "never"
    diabetes: Diabetes = "none"
    bmi: float = 25.0
    egfr: float = 90.0
    on_statin: bool = False
    family_history_cvd: bool = False

    # QRISK3-only inputs
    systolic_bp_sd: float | None = None
    townsend: float = 0.0
    atrial_fibrillation: bool = False
    atypical_antipsychotics: bool = False
    corticosteroids: bool = False
    erectile_dysfunction: bool = False
    migraine: bool = False
    rheumatoid_arthritis: bool = False
    chronic_kidney_disease: bool = False
    severe_mental_illness: bool = False
    lupus: bool = False

    def __post_init__(self) -> None:
        for name, kind in [
            ("sex", Sex),
            ("ethnicity", Ethnicity),
            ("smoking", Smoking),
            ("diabetes", Diabetes),
        ]:
            value = getattr(self, name)
            if value not in get_args(kind):
                raise ValueError(f"{name} must be one of {get_args(kind)}, got {value!r}")
        for name in ["age", "total_cholesterol", "hdl_cholesterol", "systolic_bp", "bmi", "egfr"]:
            if getattr(self, name) <= 0:
                raise ValueError(f"{name} must be positive")
        if self.hdl_cholesterol >= self.total_cholesterol:
            raise ValueError("hdl_cholesterol must be less than total_cholesterol")

    @property
    def female(self) -> bool:
        return self.sex == "female"

    @property
    def current_smoker(self) -> bool:
        return self.smoking in ("light", "moderate", "heavy")

    @property
    def diabetic(self) -> bool:
        return self.diabetes != "none"

    @property
    def south_asian(self) -> bool:
        return self.ethnicity in SOUTH_ASIAN
