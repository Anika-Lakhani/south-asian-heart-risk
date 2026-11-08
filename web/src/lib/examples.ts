import type { Profile } from "../models/profile";

export const BASE_PROFILE: Profile = {
  age: 48,
  sex: "male",
  ethnicity: "pakistani",
  totalCholesterol: 200,
  hdlCholesterol: 38,
  systolicBp: 132,
  onBpMeds: false,
  smoking: "never",
  diabetes: "none",
  bmi: 26,
  egfr: 90,
  onStatin: false,
  familyHistoryCvd: false,
  systolicBpSd: null,
  townsend: 0,
  atrialFibrillation: false,
  chronicKidneyDisease: false,
  rheumatoidArthritis: false,
  lupus: false,
  migraine: false,
  severeMentalIllness: false,
  atypicalAntipsychotics: false,
  corticosteroids: false,
  erectileDysfunction: false,
};

export const EXAMPLES: { label: string; profile: Profile }[] = [
  { label: "Pakistani man, 48", profile: BASE_PROFILE },
  {
    label: "Indian woman, 55",
    profile: {
      ...BASE_PROFILE,
      age: 55,
      sex: "female",
      ethnicity: "indian",
      totalCholesterol: 220,
      hdlCholesterol: 50,
      systolicBp: 142,
      onBpMeds: true,
      bmi: 27,
    },
  },
  {
    label: "Bangladeshi man, 60",
    profile: {
      ...BASE_PROFILE,
      age: 60,
      ethnicity: "bangladeshi",
      totalCholesterol: 190,
      hdlCholesterol: 36,
      systolicBp: 138,
      smoking: "moderate",
      diabetes: "type2",
      bmi: 25,
    },
  },
  {
    label: "White woman, 45",
    profile: {
      ...BASE_PROFILE,
      age: 45,
      sex: "female",
      ethnicity: "white",
      totalCholesterol: 200,
      hdlCholesterol: 60,
      systolicBp: 118,
      bmi: 24,
    },
  },
];

export const ETHNICITY_LABELS: Record<Profile["ethnicity"], string> = {
  indian: "Indian",
  pakistani: "Pakistani",
  bangladeshi: "Bangladeshi",
  other_asian: "Sri Lankan, Nepali, or other Asian",
  white: "White",
  black_caribbean: "Black Caribbean",
  black_african: "Black African or African American",
  chinese: "Chinese",
  other: "Other",
};

export const SMOKING_LABELS: Record<Profile["smoking"], string> = {
  never: "Never smoked",
  former: "Used to smoke",
  light: "Under 10 a day",
  moderate: "10–19 a day",
  heavy: "20+ a day",
};

export const CONDITION_LABELS: Record<string, string> = {
  atrialFibrillation: "Atrial fibrillation",
  chronicKidneyDisease: "Chronic kidney disease (stage 3–5)",
  rheumatoidArthritis: "Rheumatoid arthritis",
  lupus: "Lupus (SLE)",
  migraine: "Migraine",
  severeMentalIllness: "Severe mental illness",
  atypicalAntipsychotics: "Taking atypical antipsychotics",
  corticosteroids: "Taking regular steroid tablets",
  erectileDysfunction: "Erectile dysfunction",
};

export const THRESHOLDS = [
  { value: 0.05, label: "5%", note: "borderline risk (US)" },
  { value: 0.075, label: "7.5%", note: "consider a statin (US)" },
  { value: 0.1, label: "10%", note: "offer a statin (UK)" },
  { value: 0.2, label: "20%", note: "high risk (US)" },
];
