/**
 * How much each score could move given ordinary measurement noise. Mirrors
 * heartrisk.uncertainty: re-score a profile under many plausible re-measurements.
 */

import type { Profile } from "./profile";
import { MODELS, type ModelKey } from "./scoring";
import { mulberry32, normalSampler } from "./rng";

/**
 * Typical within-person variation for one measurement (approximate literature values):
 * SBP within-person SD across clinic visits ~10-14 mmHg (Muntner et al. 2011);
 * total and HDL cholesterol biological CV ~6% and ~7% (Ricos et al. database).
 */
export const DEFAULT_VARIABILITY = {
  systolicBpSd: 12,
  totalCholesterolCv: 0.06,
  hdlCholesterolCv: 0.07,
};

export interface SimulationOptions {
  n?: number;
  bpReadings?: number;
  lipidTests?: number;
  seed?: number;
}

export type Samples = Record<ModelKey, Float64Array>;

export function simulate(p: Profile, options: SimulationOptions = {}): Samples {
  const { n = 4000, bpReadings = 1, lipidTests = 1, seed = 0 } = options;
  const normal = normalSampler(mulberry32(seed));
  const v = DEFAULT_VARIABILITY;
  const sbpSd = v.systolicBpSd / Math.sqrt(bpReadings);
  const lipidScale = 1 / Math.sqrt(lipidTests);
  const lognormal = (mean: number, cv: number) => {
    const sigma = Math.sqrt(Math.log1p(cv ** 2));
    return Math.exp(Math.log(mean) - sigma ** 2 / 2 + sigma * normal());
  };

  const samples = Object.fromEntries(
    MODELS.map((m) => [m.key, new Float64Array(n)]),
  ) as Samples;
  for (let i = 0; i < n; i++) {
    const systolicBp = Math.min(Math.max(p.systolicBp + sbpSd * normal(), 70), 250);
    const totalCholesterol = lognormal(p.totalCholesterol, v.totalCholesterolCv * lipidScale);
    const hdl = lognormal(p.hdlCholesterol, v.hdlCholesterolCv * lipidScale);
    const m = { systolicBp, totalCholesterol, hdlCholesterol: Math.min(hdl, totalCholesterol - 1) };
    for (const model of MODELS) samples[model.key][i] = model.fn(p, m);
  }
  return samples;
}

/** Linear-interpolated quantile, matching numpy's default. */
export function quantile(sorted: Float64Array, q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const a = sorted[low] ?? NaN;
  const b = sorted[high] ?? NaN;
  return a + (b - a) * (position - low);
}

export interface Summary {
  sorted: Float64Array;
  interval: (level: number) => [number, number];
  probAbove: (threshold: number) => number;
  /** Evenly spaced quantiles for a quantile dotplot (Kay et al., CHI 2016). */
  quantileDots: (nDots: number) => number[];
}

export function summarize(samples: Float64Array): Summary {
  const sorted = Float64Array.from(samples).sort();
  return {
    sorted,
    interval: (level) => {
      const tail = (1 - level) / 2;
      return [quantile(sorted, tail), quantile(sorted, 1 - tail)];
    },
    probAbove: (threshold) => sorted.filter((r) => r >= threshold).length / sorted.length,
    quantileDots: (nDots) =>
      Array.from({ length: nDots }, (_, i) => quantile(sorted, (i + 0.5) / nDots)),
  };
}
