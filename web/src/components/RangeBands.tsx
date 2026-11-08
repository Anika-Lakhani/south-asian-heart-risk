import { pct, thresholdLabel } from "../lib/format";
import { useWidth } from "../lib/useWidth";
import { RiskAxis, ThresholdLine } from "./RiskAxis";

export interface RangeRow {
  key: string;
  name: string;
  risk: number;
  outer: [number, number];
  inner: [number, number];
}

const HEIGHT = 30;
const BAND = 10;

/** Interval bands: 90% of re-measurements (outer) and the middle 50% (inner). */
export function RangeBands({
  rows,
  threshold,
  xMax,
}: {
  rows: RangeRow[];
  threshold: number;
  xMax: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const x = (risk: number) => (Math.min(risk, xMax) / xMax) * width;
  const band = (range: [number, number], className: string) => (
    <rect
      className={className}
      x={x(range[0])}
      y={(HEIGHT - BAND) / 2}
      width={Math.max(BAND, x(range[1]) - x(range[0]))}
      height={BAND}
      rx={BAND / 2}
    />
  );

  return (
    <div className="ranges" ref={ref}>
      {rows.map((row) => (
        <figure key={row.key} className="range-row">
          <figcaption>
            <strong>{row.name}</strong>
            <span>
              90% of re-measurements fall between <b>{pct(row.outer[0])}</b> and{" "}
              <b>{pct(row.outer[1])}</b>
            </span>
          </figcaption>
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${row.name}: estimate ${pct(row.risk)}; 90% of re-measurements between ${pct(row.outer[0])} and ${pct(row.outer[1])}; threshold ${thresholdLabel(threshold)}.`}
          >
            <ThresholdLine x={x(threshold)} height={HEIGHT} />
            {band(row.outer, "band-outer")}
            {band(row.inner, "band-inner")}
            <g
              className="dot"
              style={{ transform: `translate(${x(row.risk)}px, ${HEIGHT / 2}px)` }}
            >
              <circle r={6} className="estimate">
                <title>{`Estimate from your entered values: ${pct(row.risk)}`}</title>
              </circle>
            </g>
          </svg>
        </figure>
      ))}
      <RiskAxis width={width} xMax={xMax} />
      <ul className="legend" aria-label="Legend">
        <li>
          <span className="swatch band-outer" /> 90% of re-measurements
        </li>
        <li>
          <span className="swatch band-inner" /> Middle 50%
        </li>
        <li>
          <span className="swatch estimate-swatch" /> Your entered values
        </li>
        <li>
          <span className="swatch threshold-swatch" /> {thresholdLabel(threshold)} line
        </li>
      </ul>
    </div>
  );
}
