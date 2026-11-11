import { useEffect, useId, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Candle, Range } from "../lib/api";
import { axisLabel, money, tipLabel } from "../lib/format";

const W = 1000;
const H = 320;
const PAD_X = 2;
const PAD_Y = 26;

type Props = {
  candles: Candle[];
  range: Range;
  baseline?: number | null;
  changePct?: number | null;
};

export function PriceChart({ candles, range, baseline, changePct }: Props) {
  const gradientId = useId().replace(/[:]/g, "");
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => setHover(null), [candles, range]);

  const geometry = useMemo(() => {
    if (candles.length < 2) return null;

    const values = candles.map((point) => point.c);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (typeof baseline === "number" && Number.isFinite(baseline)) {
      min = Math.min(min, baseline);
      max = Math.max(max, baseline);
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }

    const padding = (max - min) * 0.08;
    min -= padding;
    max += padding;

    const n = candles.length;
    const x = (index: number) => PAD_X + (index / (n - 1)) * (W - PAD_X * 2);
    const y = (value: number) => PAD_Y + (1 - (value - min) / (max - min)) * (H - PAD_Y * 2);

    let line = "";
    candles.forEach((point, index) => {
      line += `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(point.c).toFixed(2)} `;
    });

    const area = `${line}L${x(n - 1).toFixed(2)} ${H} L${x(0).toFixed(2)} ${H} Z`;
    const grid = [0.25, 0.5, 0.75].map((ratio) => PAD_Y + ratio * (H - PAD_Y * 2));

    return { n, x, y, line, area, grid, min, max };
  }, [candles, baseline]);

  if (!geometry) {
    return <div className="chart-empty">No price history for this range.</div>;
  }

  const positive = changePct === null || changePct === undefined ? null : changePct >= 0;
  const stroke =
    positive === null ? "var(--muted-2)" : positive ? "var(--positive)" : "var(--negative)";
  const activeIndex = hover === null ? null : Math.max(0, Math.min(geometry.n - 1, hover));
  const activePoint = activeIndex === null ? null : candles[activeIndex];
  const lastIndex = candles.length - 1;
  const midIndex = Math.floor(lastIndex / 2);

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (geometry!.n - 1)));
  }

  const tooltipLeft =
    activeIndex === null
      ? 0
      : Math.min(92, Math.max(8, (geometry.x(activeIndex) / W) * 100));
  const tooltipTop =
    activePoint === null ? 0 : Math.min(94, Math.max(6, (geometry.y(activePoint.c) / H) * 100));

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`${range} price chart`}
        onPointerMove={movePointer}
        onPointerDown={movePointer}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: stroke }} stopOpacity="0.2" />
            <stop offset="100%" style={{ stopColor: stroke }} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geometry.grid.map((y, index) => (
          <line
            key={index}
            x1={0}
            x2={W}
            y1={y}
            y2={y}
            className="chart-grid"
          />
        ))}

        {typeof baseline === "number" && Number.isFinite(baseline) ? (
          <line
            x1={0}
            x2={W}
            y1={geometry.y(baseline)}
            y2={geometry.y(baseline)}
            className="chart-baseline"
          />
        ) : null}

        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path
          d={geometry.line}
          fill="none"
          style={{ stroke }}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {activeIndex !== null && activePoint ? (
          <g>
            <line
              x1={geometry.x(activeIndex)}
              x2={geometry.x(activeIndex)}
              y1={0}
              y2={H}
              className="chart-crosshair"
            />
            <circle
              cx={geometry.x(activeIndex)}
              cy={geometry.y(activePoint.c)}
              r={4.5}
              style={{ fill: stroke, stroke: "var(--panel)" }}
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {activePoint ? (
        <div
          className="chart-tip"
          style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
        >
          <span>{tipLabel(activePoint.t, range)}</span>
          <strong>{money(activePoint.c)}</strong>
        </div>
      ) : null}

      <div className="axis" aria-hidden="true">
        <span>{axisLabel(candles[0].t, range)}</span>
        <span>{axisLabel(candles[midIndex].t, range)}</span>
        <span>{axisLabel(candles[lastIndex].t, range)}</span>
      </div>
    </div>
  );
}
