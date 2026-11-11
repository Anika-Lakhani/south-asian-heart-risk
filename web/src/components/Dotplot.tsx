import { useState, type ReactNode } from "react";

import { pct, thresholdLabel } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { RiskAxis, ThresholdLine } from "./RiskAxis";

export interface DotRow {
  key: string;
  name: string;
  /** Quantile dots, sorted ascending. */
  dots: number[];
  /**
   * Other people like you, drawn on the same row: their dots hang below the
   * baseline while your re-measurements stack above it.
   */
  peer?: {
    dots: number[];
    caption: ReactNode;
    /** Screen-reader summary of the comparison. */
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
  const [hover, setHover] = useState<{ row: string; index: number; peer: boolean } | null>(null);

  // About 24 bins on a phone, capped at 14px dots on wide screens.
  const diameter = Math.max(9, Math.min(14, width / 24));
  const nBins = Math.max(1, Math.floor(width / diameter));
  const step = diameter + GAP / 2;
  const binWidth = width / nBins;
  const x = (risk: number) => (risk / xMax) * width;

  const stackUp = (values: number[]) => {
    const counts = new Map<number, number>();
    return values.map((risk, index) => {
      const bin = Math.min(nBins - 1, Math.max(0, Math.floor(x(risk) / binWidth)));
      const stack = counts.get(bin) ?? 0;
      counts.set(bin, stack + 1);
      return { risk, index, cx: (bin + 0.5) * binWidth, stack };
    });
  };
  const tallest = (dots: { stack: number }[]) => Math.max(0, ...dots.map((d) => d.stack + 1));

  const placed = rows.map((row) => {
    const dots = stackUp(row.dots);
    const peerDots = row.peer ? stackUp(row.peer.dots) : [];
    // Each row is as tall as its own stacks: yours above the baseline, peers below.
    const baseline = Math.max(1, tallest(dots)) * step + GAP;
    const height = baseline + (row.peer ? tallest(peerDots) * step + GAP * 2 : GAP);
    return { ...row, dots, peerDots, baseline, height };
  });
  const radius = diameter / 2 - GAP / 2;

  return (
    <div className="dotplots" ref={ref}>
      {placed.map((row) => {
        const { height, baseline } = row;
        const above = row.dots.filter((d) => d.risk >= threshold).length;
        const hovered = hover?.row === row.key ? (hover.peer ? row.peerDots : row.dots)[hover.index] : undefined;
        const ownLabel = `${row.name}: ${above} of ${row.dots.length} equally likely re-measurements are at or above ${thresholdLabel(threshold)}. They range from ${pct(row.dots[0]?.risk ?? 0)} to ${pct(row.dots.at(-1)?.risk ?? 0)}.`;
        return (
          <figure key={row.key} className={`dot-row ${row.peer ? "with-peers" : ""}`}>
            <figcaption>
              <strong>{row.name}</strong>
              <span>
                <b>{above}</b> of {row.dots.length} re-measurements at or above{" "}
                {thresholdLabel(threshold)}
                {row.peer && <span className="peer-caption">{row.peer.caption}</span>}
              </span>
            </figcaption>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={row.peer ? `${ownLabel} ${row.peer.label}` : ownLabel}
            >
              <ThresholdLine x={x(threshold)} height={height} />
              {row.peer && <line className="peer-baseline" x1={0} x2={width} y1={baseline} y2={baseline} />}
              {row.dots.map((d) => (
                <Dot
                  key={`own-${d.index}`}
                  cx={d.cx}
                  cy={baseline - GAP / 2 - radius - d.stack * step}
                  radius={radius}
                  loud={d.risk >= threshold}
                  peer={false}
                  delay={d.index * 35}
                  hovered={hover?.row === row.key && !hover.peer && hover.index === d.index}
                  title={`One re-measurement: ${pct(d.risk)}`}
                  onEnter={() => setHover({ row: row.key, index: d.index, peer: false })}
                  onLeave={() => setHover(null)}
                />
              ))}
              {row.peerDots.map((d) => (
                <Dot
                  key={`peer-${d.index}`}
                  cx={d.cx}
                  cy={baseline + GAP * 1.5 + radius + d.stack * step}
                  radius={radius}
                  loud={d.risk >= threshold}
                  peer
                  delay={d.index * 20}
                  hovered={hover?.row === row.key && hover.peer && hover.index === d.index}
                  title={`One in 20 people like you: ${pct(d.risk)}`}
                  onEnter={() => setHover({ row: row.key, index: d.index, peer: true })}
                  onLeave={() => setHover(null)}
                />
              ))}
            </svg>
            {hovered && (
              <div
                className="tooltip"
                style={{ left: Math.min(width - 150, Math.max(0, hovered.cx - 75)) }}
                role="status"
              >
                {hover?.peer ? "One in 20 people like you" : "One re-measurement"}:{" "}
                <b>{pct(hovered.risk)}</b>
              </div>
            )}
          </figure>
        );
      })}
      <RiskAxis width={width} xMax={xMax} />
    </div>
  );
}

function Dot(props: {
  cx: number;
  cy: number;
  radius: number;
  loud: boolean;
  peer: boolean;
  delay: number;
  hovered: boolean;
  title: string;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <g
      className="dot"
      style={{ transform: `translate(${props.cx}px, ${props.cy}px)` }}
      onPointerEnter={props.onEnter}
      onPointerLeave={props.onLeave}
    >
      {/* The inner circle carries the one-time drop-in animation. */}
      <circle
        r={props.radius}
        className={`${props.loud ? "dot-loud" : "dot-quiet"} ${props.peer ? "dot-peer" : ""}`}
        style={{ animationDelay: `${props.delay}ms` }}
        strokeWidth={props.hovered ? 2.5 : GAP}
      >
        <title>{props.title}</title>
      </circle>
      {/* Larger invisible hit target than the mark itself. */}
      <circle r={Math.max(props.radius + 3, 10)} className="hit" />
    </g>
  );
}
