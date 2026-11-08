/** The patient profile shared by every risk model. Mirrors heartrisk.profile. */

export type Sex = "female" | "male";

/** QRISK3's ethnicity categories; the only model that separates South Asian groups. */
export const ETHNICITIES = [
  "white",
  "indian",
  "pakistani",
  "bangladeshi",
  "other_asian",
  "black_caribbean",
  "black_african",
  "chinese",
  "other",
] as const;
export type Ethnicity = (typeof ETHNICITIES)[number];

/** QRISK3 grades current smokers by cigarettes per day: light < 10, moderate 10-19, heavy 20+. */
export const SMOKING = ["never", "former", "light", "moderate", "heavy"] as const;
export type Smoking = (typeof SMOKING)[number];

export type Diabetes = "none" | "type1" | "type2";

export const CONDITIONS = [
  "atrialFibrillation",
  "chronicKidneyDisease",
  "rheumatoidArthritis",
  "lupus",
  "migraine",
  "severeMentalIllness",
  "atypicalAntipsychotics",
  "corticosteroids",
  "erectileDysfunction",
] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Cholesterol in mg/dL, blood pressure in mmHg. Conditions are used only by QRISK3. */
export interface Profile extends Record<Condition, boolean> {
  age: number;
  sex: Sex;
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBp: number;
  ethnicity: Ethnicity;
  onBpMeds: boolean;
  smoking: Smoking;
  diabetes: Diabetes;
  bmi: number;
  egfr: number;
  onStatin: boolean;
  familyHistoryCvd: boolean;
  systolicBpSd: number | null;
  townsend: number;
}

export const SOUTH_ASIAN: ReadonlySet<Ethnicity> = new Set(["indian", "pakistani", "bangladeshi"]);

export const isCurrentSmoker = (p: Profile) =>
  p.smoking === "light" || p.smoking === "moderate" || p.smoking === "heavy";

/** Returns a problem description, or null if the profile is valid. */
export function validate(p: Profile): string | null {
  for (const key of ["age", "totalCholesterol", "hdlCholesterol", "systolicBp", "bmi", "egfr"] as const) {
    if (!Number.isFinite(p[key]) || p[key] <= 0) return `Enter a positive number for ${key}.`;
  }
  if (p.hdlCholesterol >= p.totalCholesterol) {
    return "HDL cholesterol must be lower than total cholesterol.";
  }
  return null;
}
