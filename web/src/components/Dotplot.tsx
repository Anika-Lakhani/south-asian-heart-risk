import { useState } from "react";

import { pct, thresholdLabel } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { RiskAxis, ThresholdLine } from "./RiskAxis";

export interface DotRow {
  key: string;
  name: string;
  /** Quantile dots, sorted ascending. */
  dots: number[];
}

interface Props {
  rows: DotRow[];
  threshold: number;
  xMax: number;
}

const GAP = 2;

/**
 * Wilkinson-style quantile dotplots (Kay et al., CHI 2016), one row per model on a
 * shared risk axis. Dots keep their identity across renders, so when inputs
 * change each one glides to its new position instead of the chart redrawing.
 */
export function QuantileDotplots({ rows, threshold, xMax }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ row: string; index: number } | null>(null);

  // About 24 bins on a phone, capped at 14px dots on wide screens.
  const diameter = Math.max(9, Math.min(14, width / 24));
  const nBins = Math.max(1, Math.floor(width / diameter));
  const binWidth = width / nBins;
  const x = (risk: number) => (risk / xMax) * width;

  const placed = rows.map((row) => {
    const counts = new Map<number, number>();
    const dots = row.dots.map((risk, index) => {
      const bin = Math.min(nBins - 1, Math.max(0, Math.floor(x(risk) / binWidth)));
      const stack = counts.get(bin) ?? 0;
      counts.set(bin, stack + 1);
      return { risk, index, cx: (bin + 0.5) * binWidth, stack };
    });
    return { ...row, dots };
  });
  const maxStack = Math.max(1, ...placed.flatMap((r) => r.dots.map((d) => d.stack + 1)));
  const step = diameter + GAP / 2;
  const height = maxStack * step + GAP * 2;
  const radius = diameter / 2 - GAP / 2;

  return (
    <div className="dotplots" ref={ref}>
      {placed.map((row) => {
        const above = row.dots.filter((d) => d.risk >= threshold).length;
        return (
          <figure key={row.key} className="dot-row">
            <figcaption>
              <strong>{row.name}</strong>
              <span>
                <b>{above}</b> of {row.dots.length} re-measurements at or above{" "}
                {thresholdLabel(threshold)}
              </span>
            </figcaption>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`${row.name}: ${above} of ${row.dots.length} equally likely re-measurements are at or above ${thresholdLabel(threshold)}. They range from ${pct(row.dots[0]?.risk ?? 0)} to ${pct(row.dots.at(-1)?.risk ?? 0)}.`}
            >
              <ThresholdLine x={x(threshold)} height={height} />
              {row.dots.map((d) => {
                const loud = d.risk >= threshold;
                const isHovered = hover?.row === row.key && hover.index === d.index;
                return (
                  <g
                    key={d.index}
                    className="dot"
                    style={{
                      transform: `translate(${d.cx}px, ${height - GAP - radius - d.stack * step}px)`,
                    }}
                    onPointerEnter={() => setHover({ row: row.key, index: d.index })}
                    onPointerLeave={() => setHover(null)}
                  >
                    {/* The inner circle carries the one-time drop-in animation. */}
                    <circle
                      r={radius}
                      className={loud ? "dot-loud" : "dot-quiet"}
                      style={{ animationDelay: `${d.index * 35}ms` }}
                      strokeWidth={isHovered ? 2.5 : GAP}
                    >
                      <title>{`One re-measurement: ${pct(d.risk)}`}</title>
                    </circle>
                    {/* Larger invisible hit target than the mark itself. */}
                    <circle r={Math.max(radius + 3, 10)} className="hit" />
                  </g>
                );
              })}
            </svg>
            {hover?.row === row.key && (
              <div
                className="tooltip"
                style={{
                  left: Math.min(
                    width - 120,
                    Math.max(0, (row.dots[hover.index]?.cx ?? 0) - 60),
                  ),
                }}
                role="status"
              >
                One re-measurement: <b>{pct(row.dots[hover.index]?.risk ?? 0)}</b>
              </div>
            )}
          </figure>
        );
      })}
      <RiskAxis width={width} xMax={xMax} />
    </div>
  );
}
