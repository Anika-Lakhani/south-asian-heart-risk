import { useState, type ReactNode } from "react";

import { pct, thresholdLabel } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { RiskAxis, ThresholdLine } from "./RiskAxis";

export interface DotRow {
  key: string;
  name: string;
  /** Quantile dots, sorted ascending. */
  dots: number[];
  /** A comparison row of other people, rather than your own re-measurements. */
  peer?: {
    /** Your own estimate, marked on the row. */
    you: number;
    caption: ReactNode;
    /** Screen-reader summary. */
    label: string;
  };
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
  const step = diameter + GAP / 2;
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
    // Each row is as tall as its own tallest stack, plus room for the "You" label.
    const stacks = Math.max(1, ...dots.map((d) => d.stack + 1));
    const height = stacks * step + GAP * 2 + (row.peer ? 14 : 0);
    return { ...row, dots, height };
  });
  const radius = diameter / 2 - GAP / 2;

  return (
    <div className="dotplots" ref={ref}>
      {placed.map((row) => {
        const { height } = row;
        const above = row.dots.filter((d) => d.risk >= threshold).length;
        return (
          <figure key={row.key} className={`dot-row ${row.peer ? "peer-row" : ""}`}>
            <figcaption>
              <strong>{row.name}</strong>
              <span>
                {row.peer ? (
                  row.peer.caption
                ) : (
                  <>
                    <b>{above}</b> of {row.dots.length} re-measurements at or above{" "}
                    {thresholdLabel(threshold)}
                  </>
                )}
              </span>
            </figcaption>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={
                row.peer?.label ??
                `${row.name}: ${above} of ${row.dots.length} equally likely re-measurements are at or above ${thresholdLabel(threshold)}. They range from ${pct(row.dots[0]?.risk ?? 0)} to ${pct(row.dots.at(-1)?.risk ?? 0)}.`
              }
            >
              <ThresholdLine x={x(threshold)} height={height} />
              {row.peer && <YouMarker x={x(Math.min(row.peer.you, xMax))} height={height} />}
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
                      className={`${loud ? "dot-loud" : "dot-quiet"} ${row.peer ? "dot-peer" : ""}`}
                      style={{ animationDelay: `${d.index * 35}ms` }}
                      strokeWidth={isHovered ? 2.5 : GAP}
                    >
                      <title>{`${row.peer ? "One in 20 people like you" : "One re-measurement"}: ${pct(d.risk)}`}</title>
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
                  left: Math.min(width - 120, Math.max(0, (row.dots[hover.index]?.cx ?? 0) - 60)),
                }}
                role="status"
              >
                {row.peer ? "One in 20 people like you" : "One re-measurement"}:{" "}
                <b>{pct(row.dots[hover.index]?.risk ?? 0)}</b>
              </div>
            )}
          </figure>
        );
      })}
      <RiskAxis width={width} xMax={xMax} />
    </div>
  );
}

/** Where your own estimate sits on a row of other people. */
export function YouMarker({ x, height }: { x: number; height: number }) {
  return (
    <g className="you-marker" aria-hidden="true">
      <line x1={x} x2={x} y1={10} y2={height} />
      <text x={x} y={8} textAnchor="middle">
        You
      </text>
    </g>
  );
}
