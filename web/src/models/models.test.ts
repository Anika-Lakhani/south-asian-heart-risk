import { describe, expect, it } from "vitest";

import qrisk3ReferenceCsv from "../../../tests/data/qrisk3_2017_reference.csv?raw";
import { pce10yrAscvd } from "./pce";
import parityCases from "./parity.fixture.json";
import { prevent10yr } from "./prevent";
import { ETHNICITIES, SMOKING, type Profile } from "./profile";
import { qrisk3_10yr } from "./qrisk3";
import { score } from "./scoring";
import { simulate, summarize } from "./uncertainty";

describe("Pooled Cohort Equations", () => {
  // Goff et al. 2013, Table A worked example. The guideline rounds intermediate
  // logs, moving white male from 5.38% to the printed 5.3%; allow 0.1 points.
  it.each([
    [true, false, 2.1],
    [true, true, 3.0],
    [false, false, 5.3],
    [false, true, 6.1],
  ])("female=%s black=%s gives %s%%", (female, black, expected) => {
    const risk = pce10yrAscvd({
      age: 55, female, black, totalCholesterol: 213, hdlCholesterol: 50, systolicBp: 120,
      onBpMeds: false, smoker: false, diabetic: false,
    });
    expect(Math.abs(risk * 100 - expected)).toBeLessThanOrEqual(0.1);
  });
});

describe("PREVENT", () => {
  // Table S25 of the PREVENT supplement, plus the supplement's Excel calculator.
  const tableS25 = {
    age: 50, female: true, totalCholesterol: 200, hdlCholesterol: 45, systolicBp: 160,
    onBpMeds: true, onStatin: false, diabetic: true, smoker: false, egfr: 90, bmi: 35,
  };
  it.each([
    ["totalCvd", 0.147],
    ["ascvd", 0.092],
    ["heartFailure", 0.081],
  ] as const)("%s matches Table S25", (outcome, expected) => {
    expect(Math.abs(prevent10yr(tableS25, outcome) - expected)).toBeLessThanOrEqual(0.0005);
  });
});

describe("QRISK3", () => {
  const [header, ...rows] = qrisk3ReferenceCsv.trim().split("\n");
  const columns = (header ?? "").split(",").map((c) => c.replaceAll('"', ""));
  const cases = rows.map((line) =>
    Object.fromEntries(line.split(",").map((v, i) => [columns[i], Number(v)])),
  );

  it.each(cases.map((c, i) => [i + 1, c] as const))(
    "matches ClinRisk's C implementation, case %i",
    (_, r) => {
      const n = (key: string) => r[key] ?? NaN;
      const flag = (key: string) => n(key) === 1;
      const risk = qrisk3_10yr({
        age: n("age"),
        female: n("gender") === 1,
        ethnicity: ETHNICITIES[n("ethrisk") - 1] ?? "white",
        smoking: SMOKING[n("smoke_cat") - 1] ?? "never",
        cholesterolRatio: n("rati"),
        systolicBp: n("sbp"),
        systolicBpSd: n("sbps5"),
        bmi: n("weight") / (n("height") / 100) ** 2,
        townsend: n("town"),
        onBpMeds: flag("b_treatedhyp"),
        type1Diabetes: flag("b_type1"),
        type2Diabetes: flag("b_type2"),
        familyHistoryCvd: flag("fh_cvd"),
        atrialFibrillation: flag("b_AF"),
        atypicalAntipsychotics: flag("b_atypicalantipsy"),
        corticosteroids: flag("b_corticosteroids"),
        erectileDysfunction: flag("b_impotence2"),
        migraine: flag("b_migraine"),
        rheumatoidArthritis: flag("b_ra"),
        chronicKidneyDisease: flag("b_renal"),
        severeMentalIllness: flag("b_semi"),
        lupus: flag("b_sle"),
      });
      expect(Math.round(risk * 1000) / 10).toBeCloseTo(n("QRISK_C_algorithm_score"), 5);
    },
  );
});

describe("parity with the Python reference implementation", () => {
  it.each(parityCases.map((c, i) => [i, c] as const))("profile %i", (_, c) => {
    const results = score(c.profile as Profile);
    for (const result of results) {
      const expected = c.risk[result.model.key];
      expect(Math.abs(result.risk - expected)).toBeLessThan(1e-12);
    }
  });
});

describe("simulation", () => {
  const profile = parityCases[0]!.profile as Profile;

  it("is reproducible with a seed", () => {
    expect(simulate(profile, { seed: 7 }).qrisk3).toEqual(simulate(profile, { seed: 7 }).qrisk3);
  });

  it("brackets the point estimate and narrows when readings are averaged", () => {
    const point = score(profile);
    const single = simulate(profile, { seed: 1 });
    const averaged = simulate(profile, { seed: 1, bpReadings: 4, lipidTests: 4 });
    for (const { model, risk } of point) {
      const [low, high] = summarize(single[model.key]).interval(0.9);
      const [aLow, aHigh] = summarize(averaged[model.key]).interval(0.9);
      expect(low).toBeLessThan(risk);
      expect(high).toBeGreaterThan(risk);
      expect(aHigh - aLow).toBeLessThan(high - low);
    }
  });
});
