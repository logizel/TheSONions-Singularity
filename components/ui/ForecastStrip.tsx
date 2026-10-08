import { useId } from "react";

import type { ForecastPoint } from "@/lib/contracts";
import styles from "./ui.module.css";

/**
 * 30-bar forecast strip: actionable days solid ink-2, advisory days hatched
 * (SVG pattern, not a gradient) under an ADVISORY marker. aria-hidden; the
 * caller renders the sentence equivalent.
 */
export function ForecastStrip({
  points,
  fromDay,
  testId,
}: {
  points: readonly ForecastPoint[];
  fromDay: number;
  testId?: string;
}) {
  const pid = useId().replace(/:/g, "");
  const bar = 6;
  const gap = 2;
  const h = 32;
  const width = points.length * (bar + gap) - gap;
  const max = Math.max(1, ...points.map((p) => p.demand));
  const advStart = (fromDay - 1) * (bar + gap);
  return (
    <div className={styles.stripWrap}>
      <svg
        className={styles.strip}
        width={width}
        height={h + 18}
        viewBox={`0 0 ${width} ${h + 18}`}
        aria-hidden="true"
        focusable="false"
        data-testid={testId}
      >
        <defs>
          <pattern id={`hatch-${pid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="var(--color-sunk)" />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-ink-3)" strokeWidth="1" />
          </pattern>
        </defs>
        {points.some((p) => p.advisory) ? (
          <>
            <line x1={advStart} x2={width} y1={13} y2={13} stroke="var(--color-ink-3)" strokeWidth={1} />
            <text x={advStart} y={10} fontSize={12} fill="var(--color-ink-3)" fontFamily="var(--font-display)" fontWeight={600} letterSpacing="0.06em" dy={-0.5}>
              ADVISORY
            </text>
          </>
        ) : null}
        {points.map((p, i) => {
          const bh = Math.max(2, (p.demand / max) * (h - 4));
          return (
            <rect
              key={p.date}
              x={i * (bar + gap)}
              y={18 + h - bh}
              width={bar}
              height={bh}
              fill={p.advisory ? `url(#hatch-${pid})` : "var(--color-ink-2)"}
              stroke={p.advisory ? "var(--color-ink-3)" : "none"}
              strokeWidth={p.advisory ? 0.75 : 0}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function forecastSentence(points: readonly ForecastPoint[], unit: string, fromDay: number, toDay: number): string {
  if (points.length === 0) return "No forecast.";
  const mean = points.reduce((s, p) => s + p.demand, 0) / points.length;
  return `${points.length}-day forecast, mean ${Math.round(mean * 10) / 10} ${unit} a day. Days ${fromDay} to ${toDay} are advisory.`;
}
