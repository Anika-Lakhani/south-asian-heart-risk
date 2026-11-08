/** A clean upper bound for the risk axis that fits every interval and the threshold. */
export function riskDomainMax(highs: number[], threshold: number): number {
  const top = Math.max(...highs, threshold) * 1.15;
  const step = top > 0.4 ? 0.1 : top > 0.2 ? 0.05 : top > 0.06 ? 0.02 : 0.01;
  return Math.min(1, Math.ceil(top / step) * step);
}

/** Tick values at the finest step that keeps labels at least `minGapPx` apart. */
export function ticks(max: number, widthPx: number, minGapPx = 44): number[] {
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25];
  const step = steps.find((s) => (s / max) * widthPx >= minGapPx) ?? 0.25;
  const out: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) out.push(+t.toFixed(4));
  return out;
}
