/** Score one profile with every model. Mirrors heartrisk.scoring. */

import { PCE_VALID_RANGES, pce10yrAscvd } from "./pce";
import { PREVENT_VALID_RANGES, prevent10yr } from "./prevent";
import { isCurrentSmoker, type Profile } from "./profile";
import { QRISK3_VALID_RANGES, qrisk3_10yr } from "./qrisk3";

export type ModelKey = "pce" | "prevent" | "qrisk3";

/** The three measured values the uncertainty simulation varies. */
export interface Measurements {
  systolicBp: number;
  totalCholesterol: number;
  hdlCholesterol: number;
}

export interface Model {
  key: ModelKey;
  name: string;
  shortName: string;
  outcome: string;
  /** Plain-language version of the outcome, for sentences. */
  outcomePlain: string;
  origin: string;
  validRanges: Record<string, readonly [number, number]>;
  fn: (p: Profile, m: Measurements) => number;
}

/** QRISK3's derivation-cohort mean SBP variability: a neutral default when unknown. */
const QRISK3_DEFAULT_SBP_SD = { female: 9.002537727355957, male: 8.756621360778809 };

export const MODELS: readonly Model[] = [
  {
    key: "pce",
    name: "Pooled Cohort Equations",
    shortName: "PCE",
    outcome: "hard ASCVD",
    outcomePlain: "a heart attack, a stroke, or death from heart disease",
    origin: "US, 2013. Scores South Asians as white.",
    validRanges: PCE_VALID_RANGES,
    fn: (p, m) =>
      pce10yrAscvd({
        ...m,
        age: p.age,
        female: p.sex === "female",
        black: p.ethnicity === "black_caribbean" || p.ethnicity === "black_african",
        onBpMeds: p.onBpMeds,
        smoker: isCurrentSmoker(p),
        diabetic: p.diabetes !== "none",
      }),
  },
  {
    key: "prevent",
    name: "PREVENT",
    shortName: "PREVENT",
    outcome: "ASCVD",
    outcomePlain: "a heart attack or stroke",
    origin: "US, 2023. Doesn't use race at all.",
    validRanges: PREVENT_VALID_RANGES,
    fn: (p, m) =>
      prevent10yr({
        ...m,
        age: p.age,
        female: p.sex === "female",
        onBpMeds: p.onBpMeds,
        onStatin: p.onStatin,
        diabetic: p.diabetes !== "none",
        smoker: isCurrentSmoker(p),
        egfr: p.egfr,
        bmi: p.bmi,
      }),
  },
  {
    key: "qrisk3",
    name: "QRISK3",
    shortName: "QRISK3",
    outcome: "CVD (CHD, stroke, TIA)",
    outcomePlain: "a heart attack, a stroke, or a mini-stroke (TIA)",
    origin: "UK, 2017. Separate terms for Indian, Pakistani, Bangladeshi.",
    validRanges: QRISK3_VALID_RANGES,
    fn: (p, m) =>
      qrisk3_10yr({
        age: p.age,
        female: p.sex === "female",
        ethnicity: p.ethnicity,
        smoking: p.smoking,
        cholesterolRatio: m.totalCholesterol / m.hdlCholesterol,
        systolicBp: m.systolicBp,
        systolicBpSd: p.systolicBpSd ?? QRISK3_DEFAULT_SBP_SD[p.sex],
        bmi: p.bmi,
        townsend: p.townsend,
        onBpMeds: p.onBpMeds,
        type1Diabetes: p.diabetes === "type1",
        type2Diabetes: p.diabetes === "type2",
        familyHistoryCvd: p.familyHistoryCvd,
        atrialFibrillation: p.atrialFibrillation,
        atypicalAntipsychotics: p.atypicalAntipsychotics,
        corticosteroids: p.corticosteroids,
        erectileDysfunction: p.erectileDysfunction && p.sex === "male",
        migraine: p.migraine,
        rheumatoidArthritis: p.rheumatoidArthritis,
        chronicKidneyDisease: p.chronicKidneyDisease,
        severeMentalIllness: p.severeMentalIllness,
        lupus: p.lupus,
      }),
  },
];

export interface ModelResult {
  model: Model;
  risk: number;
  /** Inputs outside the range the model was validated on: an extrapolation. */
  outOfRange: string[];
}

function outOfRange(p: Profile, ranges: Model["validRanges"]): string[] {
  const values: Record<string, number> = {
    age: p.age,
    totalCholesterol: p.totalCholesterol,
    hdlCholesterol: p.hdlCholesterol,
    systolicBp: p.systolicBp,
    bmi: p.bmi,
    egfr: p.egfr,
    cholesterolRatio: p.totalCholesterol / p.hdlCholesterol,
  };
  return Object.entries(ranges)
    .filter(([name, [low, high]]) => {
      const value = values[name] ?? NaN;
      return !(low <= value && value <= high);
    })
    .map(([name]) => name);
}

export function measurementsOf(p: Profile): Measurements {
  return {
    systolicBp: p.systolicBp,
    totalCholesterol: p.totalCholesterol,
    hdlCholesterol: p.hdlCholesterol,
  };
}

export function score(p: Profile): ModelResult[] {
  return MODELS.map((model) => ({
    model,
    risk: model.fn(p, measurementsOf(p)),
    outOfRange: outOfRange(p, model.validRanges),
  }));
}
