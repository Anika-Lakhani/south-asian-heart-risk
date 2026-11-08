/**
 * ACC/AHA Pooled Cohort Equations (2013), 10-year hard ASCVD risk.
 * Goff DC Jr, et al. Circulation. 2014;129(25 Suppl 2):S49-73, Table A.
 *
 * Derived only for white and African American adults; everyone else, South
 * Asians included, is scored with the white equations.
 */

interface Coefficients {
  lnAge: number;
  lnAgeSq?: number;
  lnTc: number;
  lnAgeLnTc?: number;
  lnHdl: number;
  lnAgeLnHdl?: number;
  lnSbpTreated: number;
  lnAgeLnSbpTreated?: number;
  lnSbpUntreated: number;
  lnAgeLnSbpUntreated?: number;
  smoker: number;
  lnAgeSmoker?: number;
  diabetes: number;
  mean: number;
  baselineSurvival: number;
}

const COEFFICIENTS: Record<"female" | "male", Record<"white" | "black", Coefficients>> = {
  female: {
    white: {
      lnAge: -29.799, lnAgeSq: 4.884, lnTc: 13.54, lnAgeLnTc: -3.114, lnHdl: -13.578,
      lnAgeLnHdl: 3.149, lnSbpTreated: 2.019, lnSbpUntreated: 1.957, smoker: 7.574,
      lnAgeSmoker: -1.665, diabetes: 0.661, mean: -29.1817, baselineSurvival: 0.9665,
    },
    black: {
      lnAge: 17.114, lnTc: 0.94, lnHdl: -18.92, lnAgeLnHdl: 4.475, lnSbpTreated: 29.291,
      lnAgeLnSbpTreated: -6.432, lnSbpUntreated: 27.82, lnAgeLnSbpUntreated: -6.087,
      smoker: 0.691, diabetes: 0.874, mean: 86.6081, baselineSurvival: 0.9533,
    },
  },
  male: {
    white: {
      lnAge: 12.344, lnTc: 11.853, lnAgeLnTc: -2.664, lnHdl: -7.99, lnAgeLnHdl: 1.769,
      lnSbpTreated: 1.797, lnSbpUntreated: 1.764, smoker: 7.837, lnAgeSmoker: -1.795,
      diabetes: 0.658, mean: 61.1816, baselineSurvival: 0.9144,
    },
    black: {
      lnAge: 2.469, lnTc: 0.302, lnHdl: -0.307, lnSbpTreated: 1.916, lnSbpUntreated: 1.809,
      smoker: 0.549, diabetes: 0.645, mean: 19.5425, baselineSurvival: 0.8954,
    },
  },
};

export const PCE_VALID_RANGES = {
  age: [40, 79],
  totalCholesterol: [130, 320],
  hdlCholesterol: [20, 100],
  systolicBp: [90, 200],
} as const;

export interface PceInputs {
  age: number;
  female: boolean;
  black: boolean;
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBp: number;
  onBpMeds: boolean;
  smoker: boolean;
  diabetic: boolean;
}

/** 10-year hard ASCVD risk as a fraction (0-1). */
export function pce10yrAscvd(x: PceInputs): number {
  const c = COEFFICIENTS[x.female ? "female" : "male"][x.black ? "black" : "white"];
  const lnAge = Math.log(x.age);
  const lnTc = Math.log(x.totalCholesterol);
  const lnHdl = Math.log(x.hdlCholesterol);
  const lnSbp = Math.log(x.systolicBp);
  const smoker = Number(x.smoker);
  const [sbp, ageSbp] = x.onBpMeds
    ? [c.lnSbpTreated, c.lnAgeLnSbpTreated ?? 0]
    : [c.lnSbpUntreated, c.lnAgeLnSbpUntreated ?? 0];

  const total =
    c.lnAge * lnAge +
    (c.lnAgeSq ?? 0) * lnAge ** 2 +
    c.lnTc * lnTc +
    (c.lnAgeLnTc ?? 0) * lnAge * lnTc +
    c.lnHdl * lnHdl +
    (c.lnAgeLnHdl ?? 0) * lnAge * lnHdl +
    sbp * lnSbp +
    ageSbp * lnAge * lnSbp +
    c.smoker * smoker +
    (c.lnAgeSmoker ?? 0) * lnAge * smoker +
    c.diabetes * Number(x.diabetic);
  return 1 - c.baselineSurvival ** Math.exp(total - c.mean);
}
