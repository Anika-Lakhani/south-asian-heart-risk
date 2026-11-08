import { pct, thresholdLabel } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { RiskAxis, ThresholdLine } from "./RiskAxis";

export interface WhatIfRow {
  key: string;
  name: string;
  now: number;
  after: number;
}

const HEIGHT = 28;

/** Dumbbell per model from today's estimate (ring) to the what-if estimate (dot). */
export function WhatIfChart({
  rows,
  threshold,
  xMax,
}: {
  rows: WhatIfRow[];
  threshold: number;
  xMax: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const x = (risk: number) => (Math.min(risk, xMax) / xMax) * width;

  return (
    <div className="whatif-chart" ref={ref}>
      {rows.map((row) => {
        const delta = (row.after - row.now) * 100;
        return (
          <figure key={row.key} className="range-row">
            <figcaption>
              <strong>{row.name}</strong>
              <span>
                {pct(row.now)} → <b>{pct(row.after)}</b>{" "}
                <span
                  className={delta < -0.05 ? "delta down" : delta > 0.05 ? "delta up" : "delta"}
                >
                  ({delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(1)} points)
                </span>
              </span>
            </figcaption>
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`${row.name}: now ${pct(row.now)}, what-if ${pct(row.after)}.`}
            >
              <ThresholdLine x={x(threshold)} height={HEIGHT} />
              <line
                className="connector"
                x1={x(row.now)}
                x2={x(row.after)}
                y1={HEIGHT / 2}
                y2={HEIGHT / 2}
              />
              <circle className="now" cx={x(row.now)} cy={HEIGHT / 2} r={6} />
              <g
                className="dot"
                style={{ transform: `translate(${x(row.after)}px, ${HEIGHT / 2}px)` }}
              >
                <circle className="after" r={6} />
              </g>
            </svg>
          </figure>
        );
      })}
      <RiskAxis width={width} xMax={xMax} />
      <ul className="legend" aria-label="Legend">
        <li>
          <span className="swatch now-swatch" /> Now
        </li>
        <li>
          <span className="swatch after-swatch" /> What-if
        </li>
        <li>
          <span className="swatch threshold-swatch" /> {thresholdLabel(threshold)} line
        </li>
      </ul>
    </div>
  );
}
