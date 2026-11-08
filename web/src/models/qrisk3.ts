// SPDX-License-Identifier: LGPL-3.0-or-later
//
// TypeScript implementation of QRISK3-2017. Copyright 2017 ClinRisk Ltd.
// Ported from src/heartrisk/models/qrisk3.py, itself transcribed from ClinRisk's
// open-source C implementation (https://qrisk.org). LGPL-3.0-or-later.
/**
 * QRISK3-2017 10-year cardiovascular disease risk.
 * Hippisley-Cox J, Coupland C, Brindle P. BMJ. 2017;357:j2099.
 *
 * Derived on UK primary-care records, with separate terms for Indian,
 * Pakistani, and Bangladeshi patients. Its outcome (CHD, ischaemic stroke, or
 * TIA) is broader than the PCE's hard ASCVD.
 */

import type { Ethnicity, Smoking } from "./profile";
import { QRISK3_COEFFICIENTS } from "./qrisk3Coefficients";

/** ClinRisk requires this to be shown, or linked prominently, wherever a score is displayed. */
export const QRISK3_DISCLAIMER =
  "QRISK3-2017 was developed by ClinRisk Ltd., who released the code under the GNU Lesser " +
  "General Public License to enable others to implement the algorithm faithfully. ClinRisk " +
  "Ltd. stress that it is the responsibility of the end user to check that the source they " +
  "receive produces the same results as the original code found at https://qrisk.org. " +
  "Inaccurate implementations of risk scores can lead to wrong patients being given the " +
  "wrong treatment.";

const ETHNICITY_CODES: Record<Ethnicity, number> = {
  white: 1,
  indian: 2,
  pakistani: 3,
  bangladeshi: 4,
  other_asian: 5,
  black_caribbean: 6,
  black_african: 7,
  chinese: 8,
  other: 9,
};

const SMOKING_CODES: Record<Smoking, number> = { never: 0, former: 1, light: 2, moderate: 3, heavy: 4 };

export const QRISK3_VALID_RANGES = {
  age: [25, 84],
  bmi: [20, 40],
  systolicBp: [70, 210],
  cholesterolRatio: [1, 11],
} as const;

export interface Qrisk3Inputs {
  age: number;
  female: boolean;
  ethnicity: Ethnicity;
  smoking: Smoking;
  /** Total cholesterol / HDL. */
  cholesterolRatio: number;
  systolicBp: number;
  /** Standard deviation of recent SBP readings. */
  systolicBpSd: number;
  bmi: number;
  townsend: number;
  onBpMeds: boolean;
  type1Diabetes: boolean;
  type2Diabetes: boolean;
  familyHistoryCvd: boolean;
  atrialFibrillation: boolean;
  atypicalAntipsychotics: boolean;
  corticosteroids: boolean;
  erectileDysfunction: boolean;
  migraine: boolean;
  rheumatoidArthritis: boolean;
  chronicKidneyDisease: boolean;
  severeMentalIllness: boolean;
  lupus: boolean;
}

type Table = { readonly [name: string]: number };

const weighted = (table: Table, terms: Record<string, number>) =>
  Object.entries(table).reduce((sum, [name, coef]) => sum + coef * (terms[name] ?? 0), 0);

/** 10-year CVD risk as a fraction (0-1). */
export function qrisk3_10yr(x: Qrisk3Inputs): number {
  const c = QRISK3_COEFFICIENTS[x.female ? "female" : "male"];
  const smokeCat = SMOKING_CODES[x.smoking];
  const dage = x.age / 10;
  const dbmi = x.bmi / 10;

  const raw: Record<string, number> = {
    age_1: x.female ? dage ** -2 : dage ** -1,
    age_2: x.female ? dage : dage ** 3,
    bmi_1: dbmi ** -2,
    bmi_2: dbmi ** -2 * Math.log(dbmi),
    rati: x.cholesterolRatio,
    sbp: x.systolicBp,
    sbps5: x.systolicBpSd,
    town: x.townsend,
  };
  const centred: Record<string, number> = { ...raw };
  for (const [name, centre] of Object.entries(c.centre)) centred[name] = (raw[name] ?? 0) - centre;

  const terms: Record<string, number> = {
    ...centred,
    b_AF: Number(x.atrialFibrillation),
    b_atypicalantipsy: Number(x.atypicalAntipsychotics),
    b_corticosteroids: Number(x.corticosteroids),
    b_impotence2: Number(x.erectileDysfunction),
    b_migraine: Number(x.migraine),
    b_ra: Number(x.rheumatoidArthritis),
    b_renal: Number(x.chronicKidneyDisease),
    b_semi: Number(x.severeMentalIllness),
    b_sle: Number(x.lupus),
    b_treatedhyp: Number(x.onBpMeds),
    b_type1: Number(x.type1Diabetes),
    b_type2: Number(x.type2Diabetes),
    fh_cvd: Number(x.familyHistoryCvd),
  };
  for (let k = 1; k <= 4; k++) terms[`smoke_${k}`] = Number(smokeCat === k);

  const a =
    (c.ethnicity[ETHNICITY_CODES[x.ethnicity]] ?? 0) +
    (c.smoking[smokeCat] ?? 0) +
    weighted(c.main, terms) +
    (centred.age_1 ?? 0) * weighted(c.age1Interactions, terms) +
    (centred.age_2 ?? 0) * weighted(c.age2Interactions, terms);
  return 1 - c.survivor10Yr ** Math.exp(a);
}
