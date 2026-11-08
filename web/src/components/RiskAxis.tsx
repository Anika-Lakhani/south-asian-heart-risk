import { pct } from "../lib/format";
import { ticks } from "../lib/scale";

export function ThresholdLine({ x, height }: { x: number; height: number }) {
  return <line className="threshold" x1={x} x2={x} y1={0} y2={height} />;
}

/** Shared x axis for every risk chart: 0 to xMax, labelled in percent. */
export function RiskAxis({ width, xMax }: { width: number; xMax: number }) {
  const values = ticks(xMax, width);
  return (
    <svg className="axis" width={width} height={34} aria-hidden="true">
      <line className="axis-line" x1={0} x2={width} y1={0.5} y2={0.5} />
      {values.map((t, i) => {
        const x = (t / xMax) * width;
        const anchor = i === 0 ? "start" : i === values.length - 1 && x > width - 20 ? "end" : "middle";
        return (
          <g key={t} transform={`translate(${x},0)`}>
            <line className="tick" y1={0} y2={5} />
            <text y={19} textAnchor={anchor}>
              {pct(t, 0)}
            </text>
          </g>
        );
      })}
      <text className="axis-title" x={width} y={33} textAnchor="end">
        10-year risk
      </text>
    </svg>
  );
}
