# SPDX-License-Identifier: LGPL-3.0-or-later
#
# Python implementation of QRISK3-2017. Copyright 2017 ClinRisk Ltd.
# Coefficients transcribed from ClinRisk's open-source C implementation
# (https://qrisk.org), released under the GNU Lesser General Public License
# v3 or later. This file is distributed under the same license; see LICENSES/.
"""QRISK3-2017 10-year cardiovascular disease risk.

Source: Hippisley-Cox J, Coupland C, Brindle P. Development and validation of
QRISK3 risk prediction algorithms to estimate future risk of cardiovascular
disease: prospective cohort study. BMJ. 2017;357:j2099.

QRISK3 was derived on UK primary-care records and has separate terms for
Indian, Pakistani, and Bangladeshi patients. Its outcome is CVD (coronary heart
disease, ischaemic stroke, or TIA), which is broader than the PCE's hard ASCVD.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike

# ClinRisk requires this disclaimer to be shown, or linked prominently,
# wherever a score from this code is displayed.
DISCLAIMER = (
    "QRISK3-2017 was developed by ClinRisk Ltd., who released the code under the GNU "
    "Lesser General Public License to enable others to implement the algorithm "
    "faithfully. ClinRisk Ltd. stress that it is the responsibility of the end user "
    "to check that the source they receive produces the same results as the "
    "original code found at https://qrisk.org. Inaccurate implementations of risk "
    "scores can lead to wrong patients being given the wrong treatment."
)

ETHNICITY_CODES = {
    "white": 1,
    "indian": 2,
    "pakistani": 3,
    "bangladeshi": 4,
    "other_asian": 5,
    "black_caribbean": 6,
    "black_african": 7,
    "chinese": 8,
    "other": 9,
}

SMOKING_CODES = {"never": 0, "former": 1, "light": 2, "moderate": 3, "heavy": 4}

VALID_RANGES = {
    "age": (25, 84),
    "bmi": (20, 40),
    "systolic_bp": (70, 210),
    "cholesterol_ratio": (1, 11),
}

# fmt: off
_COEFFICIENTS: dict[bool, dict] = {
    True: {
        "survivor_10yr": 0.988876402378082,
        # Indexed by ethnicity code 1-9 (index 0 unused).
        "ethnicity": [
            0.0,
            0.0,
            0.28040314332995425,
            0.562989941420754,
            0.29590000851116516,
            0.07278537987798255,
            -0.17072135508857317,
            -0.3937104331487497,
            -0.3263249528353027,
            -0.17127056883241784,
        ],
        # Indexed by smoking category 0-4.
        "smoking": [
            0.0,
            0.13386833786546262,
            0.5620085801243854,
            0.6674959337750255,
            0.8494817764483085,
        ],
        "centre": {
            'age_1': 0.053274843841791,
            'age_2': 4.332503318786621,
            'bmi_1': 0.154946178197861,
            'bmi_2': 0.144462317228317,
            'rati': 3.47632646560669,
            'sbp': 123.13001251220703,
            'sbps5': 9.002537727355957,
            'town': 0.392308831214905,
        },
        "main": {
            'age_1': -8.138810924772619,
            'age_2': 0.797333766896991,
            'bmi_1': 0.2923609227546005,
            'bmi_2': -4.1513300213837665,
            'rati': 0.15338035820802554,
            'sbp': 0.013131488407103424,
            'sbps5': 0.00788945410145861,
            'town': 0.07722379058859011,
            'b_AF': 1.5923354969269663,
            'b_atypicalantipsy': 0.25237642070115557,
            'b_corticosteroids': 0.5952072530460185,
            'b_migraine': 0.301267260870345,
            'b_ra': 0.21364803435181942,
            'b_renal': 0.6519456949384583,
            'b_semi': 0.12555308058820178,
            'b_sle': 0.7588093865426769,
            'b_treatedhyp': 0.50931593683423,
            'b_type1': 1.7267977510537347,
            'b_type2': 1.0688773244615468,
            'fh_cvd': 0.45445319020896213,
        },
        "age_1_interactions": {
            'smoke_1': -4.705716178585189,
            'smoke_2': -2.7430383403573337,
            'smoke_3': -0.8660808882939218,
            'smoke_4': 0.9024156236971065,
            'b_AF': 19.93803488954656,
            'b_corticosteroids': -0.9840804523593628,
            'b_migraine': 1.7634979587872999,
            'b_renal': -3.5874047731694114,
            'b_sle': 19.690303738638292,
            'b_treatedhyp': 11.872809733921812,
            'b_type1': -1.2444332714320747,
            'b_type2': 6.86523420000096,
            'bmi_1': 23.80262341214174,
            'bmi_2': -71.18494769208701,
            'fh_cvd': 0.9946780794043513,
            'sbp': 0.034131842338615485,
            'town': -1.0301180802035639,
        },
        "age_2_interactions": {
            'smoke_1': -0.07558924464319303,
            'smoke_2': -0.11951192874867074,
            'smoke_3': -0.10366306397571923,
            'smoke_4': -0.1399185359171839,
            'b_AF': -0.0761826510111625,
            'b_corticosteroids': -0.12005364946742472,
            'b_migraine': -0.06558691789869986,
            'b_renal': -0.22688873086442507,
            'b_sle': 0.07734794967901627,
            'b_treatedhyp': 0.0009685782358817444,
            'b_type1': -0.2872406462448895,
            'b_type2': -0.09711225259069549,
            'bmi_1': 0.5236995893366443,
            'bmi_2': 0.04574419012232376,
            'fh_cvd': -0.07688505169842304,
            'sbp': -0.0015082501423272358,
            'town': -0.03159341467496233,
        },
    },
    False: {
        "survivor_10yr": 0.977268040180206,
        # Indexed by ethnicity code 1-9 (index 0 unused).
        "ethnicity": [
            0.0,
            0.0,
            0.2771924876030828,
            0.4744636071493127,
            0.5296172991968937,
            0.03510015918629902,
            -0.3580789966932792,
            -0.4005648523216514,
            -0.41522792889830173,
            -0.26321348134749967,
        ],
        # Indexed by smoking category 0-4.
        "smoking": [
            0.0,
            0.19128222863388983,
            0.5524158819264555,
            0.6383505302750607,
            0.7898381988185802,
        ],
        "centre": {
            'age_1': 0.234766781330109,
            'age_2': 77.2840805053711,
            'bmi_1': 0.149176135659218,
            'bmi_2': 0.141913309693336,
            'rati': 4.300998687744141,
            'sbp': 128.5715789794922,
            'sbps5': 8.756621360778809,
            'town': 0.52630490064621,
        },
        "main": {
            'age_1': -17.839781666005575,
            'age_2': 0.002296488060576549,
            'bmi_1': 2.456277666053636,
            'bmi_2': -8.301112231471135,
            'rati': 0.1734019685632711,
            'sbp': 0.012910126542553305,
            'sbps5': 0.010251914291290456,
            'town': 0.033268201277287295,
            'b_AF': 0.8820923692805466,
            'b_atypicalantipsy': 0.13046879855173513,
            'b_corticosteroids': 0.45485399750445543,
            'b_impotence2': 0.22251859086705383,
            'b_migraine': 0.25584178074159913,
            'b_ra': 0.20970658013956567,
            'b_renal': 0.7185326128827438,
            'b_semi': 0.12133039882047164,
            'b_sle': 0.4401572174457522,
            'b_treatedhyp': 0.5165987108269547,
            'b_type1': 1.2343425521675175,
            'b_type2': 0.8594207143093222,
            'fh_cvd': 0.5405546900939016,
        },
        "age_1_interactions": {
            'smoke_1': -0.21011133933516346,
            'smoke_2': 0.7526867644750319,
            'smoke_3': 0.9931588755640579,
            'smoke_4': 2.1331163414389076,
            'b_AF': 3.4896675530623207,
            'b_corticosteroids': 1.1708133653489108,
            'b_impotence2': -1.506400985745431,
            'b_migraine': 2.349115987140244,
            'b_renal': -0.5065671632722369,
            'b_treatedhyp': 6.511458109853267,
            'b_type1': 5.337986487800653,
            'b_type2': 3.646181740622131,
            'bmi_1': 31.004952956033886,
            'bmi_2': -111.29157184391643,
            'fh_cvd': 2.7808628508531887,
            'sbp': 0.018858524469865853,
            'town': -0.1007554870063731,
        },
        "age_2_interactions": {
            'smoke_1': -0.0004985487027532612,
            'smoke_2': -0.0007987563331738541,
            'smoke_3': -0.000837061842662513,
            'smoke_4': -0.0007840031915563729,
            'b_AF': -0.0003499560834063605,
            'b_corticosteroids': -0.0002496045095297166,
            'b_impotence2': -0.0011058218441227373,
            'b_migraine': 0.0001989644604147863,
            'b_renal': -0.0018325930166498813,
            'b_treatedhyp': 0.0006383805310416501,
            'b_type1': 0.0006409780808752897,
            'b_type2': -0.00024695695588868315,
            'bmi_1': 0.005038010235632203,
            'bmi_2': -0.013074483002524319,
            'fh_cvd': -0.0002479180990739604,
            'sbp': -1.271874191588457e-05,
            'town': -9.329964232327289e-05,
        },
    },
}
# fmt: on


def qrisk3_10yr(
    *,
    age: ArrayLike,
    female: bool,
    ethnicity: str,
    smoking: str,
    cholesterol_ratio: ArrayLike,
    systolic_bp: ArrayLike,
    systolic_bp_sd: ArrayLike,
    bmi: ArrayLike,
    townsend: float = 0.0,
    on_bp_meds: bool = False,
    type1_diabetes: bool = False,
    type2_diabetes: bool = False,
    family_history_cvd: bool = False,
    atrial_fibrillation: bool = False,
    atypical_antipsychotics: bool = False,
    corticosteroids: bool = False,
    erectile_dysfunction: bool = False,
    migraine: bool = False,
    rheumatoid_arthritis: bool = False,
    chronic_kidney_disease: bool = False,
    severe_mental_illness: bool = False,
    lupus: bool = False,
) -> np.ndarray:
    """Return 10-year CVD risk as a fraction (0-1).

    ``cholesterol_ratio`` is total cholesterol / HDL. ``systolic_bp_sd`` is the
    standard deviation of the patient's recent SBP readings. Continuous inputs
    broadcast.
    """
    c = _COEFFICIENTS[female]
    smoke_cat = SMOKING_CODES[smoking]

    dage = np.asarray(age, dtype=float) / 10
    dbmi = np.asarray(bmi, dtype=float) / 10
    if female:
        age_1, age_2 = dage**-2, dage
    else:
        age_1, age_2 = dage**-1, dage**3
    x = {
        "age_1": age_1,
        "age_2": age_2,
        "bmi_1": dbmi**-2,
        "bmi_2": dbmi**-2 * np.log(dbmi),
        "rati": np.asarray(cholesterol_ratio, dtype=float),
        "sbp": np.asarray(systolic_bp, dtype=float),
        "sbps5": np.asarray(systolic_bp_sd, dtype=float),
        "town": np.asarray(townsend, dtype=float),
    }
    for name, centre in c["centre"].items():
        x[name] = x[name] - centre

    flags = {
        "b_AF": atrial_fibrillation,
        "b_atypicalantipsy": atypical_antipsychotics,
        "b_corticosteroids": corticosteroids,
        "b_impotence2": erectile_dysfunction,
        "b_migraine": migraine,
        "b_ra": rheumatoid_arthritis,
        "b_renal": chronic_kidney_disease,
        "b_semi": severe_mental_illness,
        "b_sle": lupus,
        "b_treatedhyp": on_bp_meds,
        "b_type1": type1_diabetes,
        "b_type2": type2_diabetes,
        "fh_cvd": family_history_cvd,
    }
    flags.update({f"smoke_{k}": smoke_cat == k for k in range(1, 5)})
    terms = {**x, **{k: float(v) for k, v in flags.items()}}

    a = c["ethnicity"][ETHNICITY_CODES[ethnicity]] + c["smoking"][smoke_cat]
    a = a + sum(coef * terms[name] for name, coef in c["main"].items())
    a = a + x["age_1"] * sum(coef * terms[n] for n, coef in c["age_1_interactions"].items())
    a = a + x["age_2"] * sum(coef * terms[n] for n, coef in c["age_2_interactions"].items())
    return 1 - c["survivor_10yr"] ** np.exp(a)
