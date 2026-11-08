/**
 * AHA PREVENT equations (2023), base 10-year model.
 * Khan SS, et al. Circulation. 2024;149(6):430-449. Coefficients from the
 * article's supplement, as tabulated in the preventr R package (MIT).
 *
 * PREVENT does not use race or ethnicity at all.
 */

export type PreventOutcome = "totalCvd" | "ascvd" | "heartFailure";

const MG_DL_TO_MMOL_L = 0.02586;

// Term order matches `terms` in prevent10yr below.
const COEFFICIENTS: Record<PreventOutcome, Record<"female" | "male", readonly number[]>> = {
  totalCvd: {
    female: [
      0.7939329, 0.0305239, -0.1606857, -0.2394003, 0.3600781, 0.8667604, 0.5360739, 0.0, 0.0,
      0.6045917, 0.0433769, 0.3151672, -0.1477655, -0.0663612, 0.1197879, -0.0819715, 0.0306769,
      -0.0946348, -0.27057, -0.078715, 0.0, -0.1637806, -3.307728,
    ],
    male: [
      0.7688528, 0.0736174, -0.0954431, -0.4347345, 0.3362658, 0.7692857, 0.4386871, 0.0, 0.0,
      0.5378979, 0.0164827, 0.288879, -0.1337349, -0.0475924, 0.150273, -0.0517874, 0.0191169,
      -0.1049477, -0.2251948, -0.0895067, 0.0, -0.1543702, -3.031168,
    ],
  },
  ascvd: {
    female: [
      0.719883, 0.1176967, -0.151185, -0.0835358, 0.3592852, 0.8348585, 0.4831078, 0.0, 0.0,
      0.4864619, 0.0397779, 0.2265309, -0.0592374, -0.0395762, 0.0844423, -0.0567839, 0.0325692,
      -0.1035985, -0.2417542, -0.0791142, 0.0, -0.1671492, -3.819975,
    ],
    male: [
      0.7099847, 0.1658663, -0.1144285, -0.2837212, 0.3239977, 0.7189597, 0.3956973, 0.0, 0.0,
      0.3690075, 0.0203619, 0.2036522, -0.0865581, -0.0322916, 0.114563, -0.0300005, 0.0232747,
      -0.0927024, -0.2018525, -0.0970527, 0.0, -0.1217081, -3.500655,
    ],
  },
  heartFailure: {
    female: [
      0.8998235, 0.0, 0.0, -0.4559771, 0.3576505, 1.038346, 0.583916, -0.0072294, 0.2997706,
      0.7451638, 0.0557087, 0.3534442, 0.0, -0.0981511, 0.0, 0.0, 0.0, -0.0946663, -0.3581041,
      -0.1159453, -0.003878, -0.1884289, -4.310409,
    ],
    male: [
      0.8972642, 0.0, 0.0, -0.6811466, 0.3634461, 0.923776, 0.5023736, -0.0485841, 0.3726929,
      0.6926917, 0.0251827, 0.2980922, 0.0, -0.0497731, 0.0, 0.0, 0.0, -0.1289201, -0.3040924,
      -0.1401688, 0.0068126, -0.1797778, -3.946391,
    ],
  },
};

export const PREVENT_VALID_RANGES = {
  age: [30, 79],
  totalCholesterol: [130, 320],
  hdlCholesterol: [20, 100],
  systolicBp: [90, 180],
  bmi: [18.5, 39.9],
  egfr: [15, 140],
} as const;

export interface PreventInputs {
  age: number;
  female: boolean;
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBp: number;
  onBpMeds: boolean;
  onStatin: boolean;
  diabetic: boolean;
  smoker: boolean;
  egfr: number;
  bmi: number;
}

/** 10-year risk of `outcome` as a fraction (0-1). Cholesterol in mg/dL. */
export function prevent10yr(x: PreventInputs, outcome: PreventOutcome = "ascvd"): number {
  const age = (x.age - 55) / 10;
  const nonHdl = (x.totalCholesterol - x.hdlCholesterol) * MG_DL_TO_MMOL_L - 3.5;
  const hdl = (x.hdlCholesterol * MG_DL_TO_MMOL_L - 1.3) / 0.3;
  const sbpLt110 = (Math.min(x.systolicBp, 110) - 110) / 20;
  const sbpGte110 = (Math.max(x.systolicBp, 110) - 130) / 20;
  const bmiLt30 = (Math.min(x.bmi, 30) - 25) / 5;
  const bmiGte30 = (Math.max(x.bmi, 30) - 30) / 5;
  const egfrLt60 = (Math.min(x.egfr, 60) - 60) / -15;
  const egfrGte60 = (Math.max(x.egfr, 60) - 90) / -15;
  const [bpMeds, statin, dm, smoke] = [x.onBpMeds, x.onStatin, x.diabetic, x.smoker].map(Number) as [
    number,
    number,
    number,
    number,
  ];

  const terms = [
    age, nonHdl, hdl, sbpLt110, sbpGte110, dm, smoke, bmiLt30, bmiGte30, egfrLt60, egfrGte60,
    bpMeds, statin, bpMeds * sbpGte110, statin * nonHdl, age * nonHdl, age * hdl,
    age * sbpGte110, age * dm, age * smoke, age * bmiGte30, age * egfrLt60, 1,
  ];
  const beta = COEFFICIENTS[outcome][x.female ? "female" : "male"];
  const logOdds = terms.reduce((sum, value, i) => sum + value * (beta[i] ?? 0), 0);
  return 1 / (1 + Math.exp(-logOdds));
}
