"use client";

/**
 * Insights charts (dataviz skill rules): one hue per chart, 2px lines, bars
 * <= 24px with a 4px rounded data end, recessive 1px solid gridlines, labels
 * in text tokens, status colours only with glyph + label, hover tooltip on
 * every plot, and a visually-hidden sentence plus a table view per chart.
 */
import { useId, useState } from "react";

import type { Severity } from "@/lib/contracts";
import type { HistoryPoint, RunDownPoint } from "@/lib/insights/view";
import { addDays, niceDate } from "@/lib/insights/explain";
import { riskLabel } from "@/theme/tokens";
import { RiskGlyph } from "../icons/Glyph";
import styles from "./insights.module.css";
import { niceMax, ticks, useWidth } from "./useWidth";

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-IN") : (Math.round(n * 10) / 10).toLocaleString("en-IN"));
const SEV_FILL: Record<Severity, string> = { critical: "var(--risk-critical)", warning: "var(--risk-low)", ok: "var(--risk-ok)" };

/** Horizontal bar with a 4px rounded end, square at the baseline. */
function barPath(x0: number, y: number, len: number, h: number): string {
  const r = Math.min(4, len, h / 2);
  if (len <= 0) return "";
  return `M${x0} ${y} H${x0 + len - r} Q${x0 + len} ${y} ${x0 + len} ${y + r} V${y + h - r} Q${x0 + len} ${y + h} ${x0 + len - r} ${y + h} H${x0} Z`;
}

function Tip({ x, y, width, children }: { x: number; y: number; width: number; children: React.ReactNode }) {
  const left = Math.min(Math.max(8, x + 12), width - 200);
  return (
    <div className={styles.tip} style={{ "--tx": `${left}px`, "--ty": `${Math.max(0, y - 10)}px` } as React.CSSProperties} role="presentation">
      {children}
    </div>
  );
}

export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.tableWrap}>
      <button type="button" className={styles.tableToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide data table" : "Show data table"}
      </button>
      {open ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{typeof c === "number" ? fmt(c) : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

// ---- 1. Days of cover vs supplier lead time -----------------------------------------

export interface CoverRow {
  id: string;
  name: string;
  days: number;
  leadDays: number;
  bufferDays: number;
  severity: Severity;
}

export function CoverChart({ rows, selected, onSelect }: { rows: CoverRow[]; selected?: string; onSelect?: (id: string) => void }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const narrow = width < 520;
  const labelW = narrow ? 0 : 150;
  const rowH = narrow ? 52 : 40;
  const barH = 16;
  const padR = 56;
  const axisMax = niceMax(Math.min(90, Math.max(...rows.map((r) => Math.max(r.days, r.leadDays + r.bufferDays)), 10)));
  const plotW = width - labelW - padR;
  const x = (d: number) => labelW + (Math.min(d, axisMax) / axisMax) * plotW;
  const h = rows.length * rowH + 28;
  return (
    <div ref={ref} className={styles.chart}>
      <svg width={width} height={h} role="img" aria-label="Days of stock for each medicine compared with the supplier lead time">
        <defs>
          <pattern id="cv-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--color-sunk)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-ink-3)" strokeWidth="0.75" />
          </pattern>
        </defs>
        {ticks(axisMax).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={rows.length * rowH} className={styles.grid} />
            <text x={x(t)} y={rows.length * rowH + 18} className={styles.axis} textAnchor="middle">
              {t} d
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y0 = i * rowH;
          const by = y0 + (narrow ? 26 : (rowH - barH) / 2);
          const active = hover === i || selected === r.id;
          return (
            <g
              key={r.id}
              className={onSelect ? styles.clickRow : undefined}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(r.id)}
            >
              <rect x={0} y={y0} width={width} height={rowH} className={active ? styles.rowHot : styles.rowHit} />
              {narrow ? (
                <text x={0} y={y0 + 16} className={styles.rowLabel}>
                  {r.name}
                </text>
              ) : (
                <text x={0} y={y0 + rowH / 2 + 5} className={styles.rowLabel}>
                  {r.name}
                </text>
              )}
              <rect x={x(0)} y={by} width={plotW} height={barH} className={styles.track} />
              <rect x={x(r.leadDays)} y={by - 3} width={Math.max(0, x(r.leadDays + r.bufferDays) - x(r.leadDays))} height={barH + 6} fill="url(#cv-hatch)" />
              <path d={barPath(x(0), by + 2, x(r.days) - x(0), barH - 4)} fill={SEV_FILL[r.severity]} />
              <line x1={x(r.leadDays)} x2={x(r.leadDays)} y1={by - 5} y2={by + barH + 5} className={styles.leadTick} />
              <text x={x(r.days) + 6} y={by + barH - 3} className={styles.value}>
                {r.days >= axisMax ? `${axisMax}+ d` : `${r.days} d`}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <Tip x={x(rows[hover].days)} y={hover * rowH} width={width}>
          <span className={styles.tipHead}>
            <RiskGlyph severity={rows[hover].severity} /> {rows[hover].name} · {riskLabel[rows[hover].severity]}
          </span>
          <span>Stock lasts {rows[hover].days} days</span>
          <span>Supplier lead time {rows[hover].leadDays} days + {rows[hover].bufferDays} day buffer</span>
        </Tip>
      ) : null}
      <ul className={styles.legend}>
        <li>
          <span className={styles.swBar} /> Days of stock (colour and symbol show risk)
        </li>
        <li>
          <span className={styles.swTick} /> Supplier lead time
        </li>
        <li>
          <span className={styles.swHatch} /> Safety buffer
        </li>
      </ul>
      <DataTable
        caption="Days of cover by medicine"
        head={["Medicine", "Status", "Days of stock", "Supplier lead (d)", "Buffer (d)"]}
        rows={rows.map((r) => [r.name, riskLabel[r.severity], r.days, r.leadDays, r.bufferDays])}
      />
    </div>
  );
}

// ---- 2. Usage: last 60 days + next 30 ----------------------------------------------------

export function DemandChart({
  history,
  forecast,
  asOf,
  advisoryFromDay,
  unit,
  pastLabel = "Last 60 days",
  height = 240,
}: {
  history: HistoryPoint[];
  forecast: { date: string; demand: number; advisory: boolean }[];
  asOf: string;
  advisoryFromDay: number;
  unit: string;
  /** Axis text over the history part. */
  pastLabel?: string;
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hatchId = `dm-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const H = height;
  const pad = { l: 44, r: 12, t: 16, b: 30 };
  const nH = history.length;
  const pts = [
    ...history.map((p, i) => ({ i, date: p.date, v: p.value, kind: p.filled ? ("filled" as const) : ("actual" as const) })),
    ...forecast.map((p, k) => ({ i: nH + k, date: p.date, v: p.demand, kind: p.advisory ? ("advisory" as const) : ("forecast" as const) })),
  ];
  const n = pts.length;
  const yMax = niceMax(Math.max(1, ...pts.map((p) => p.v)) * 1.08);
  const X = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (width - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const line = (sel: typeof pts) => sel.map((p, k) => `${k ? "L" : "M"}${X(p.i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const hist = pts.slice(0, nH);
  const fc = pts.slice(Math.max(0, nH - 1));
  const advStart = nH + advisoryFromDay - 1;
  const todayX = nH > 0 ? X(nH - 1) : X(0);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.l) / (width - pad.l - pad.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const hp = hover !== null ? pts[hover] : null;
  return (
    <div ref={ref} className={styles.chart}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Daily use over the last ${nH} days and the 30-day forecast`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-rule-strong)" strokeWidth="1" />
          </pattern>
        </defs>
        {forecast.length ? (
          <rect x={X(advStart)} y={pad.t} width={X(n - 1) - X(advStart)} height={H - pad.t - pad.b} fill={`url(#${hatchId})`} />
        ) : null}
        {ticks(yMax).map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={Y(t)} y2={Y(t)} className={styles.grid} />
            <text x={pad.l - 6} y={Y(t) + 4} className={styles.axis} textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        <line x1={todayX} x2={todayX} y1={pad.t - 6} y2={H - pad.b} className={styles.today} />
        <text x={todayX - 4} y={pad.t - 4} className={styles.axis} textAnchor="end">
          {pastLabel}
        </text>
        <text x={todayX + 4} y={pad.t - 4} className={styles.axis}>
          Next 30 days
        </text>
        {forecast.length ? (
          <text x={X(n - 1)} y={pad.t + 14} className={styles.advisory} textAnchor="end">
            Less certain
          </text>
        ) : null}
        {hist.length > 1 ? <path d={line(hist)} className={styles.lineActual} /> : null}
        {fc.length > 1 ? <path d={line(fc)} className={styles.lineForecast} /> : null}
        {hist
          .filter((p) => p.kind === "filled")
          .map((p) => (
            <circle key={p.i} cx={X(p.i)} cy={Y(p.v)} r={4} className={styles.filledDot} />
          ))}
        {[0, nH - 1, n - 1]
          .filter((i, k, a) => i >= 0 && a.indexOf(i) === k && pts[i])
          .map((i) => (
            <text key={i} x={X(i)} y={H - 10} className={styles.axis} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {niceDate(pts[i].date)}
            </text>
          ))}
        {hp ? (
          <g>
            <line x1={X(hp.i)} x2={X(hp.i)} y1={pad.t} y2={H - pad.b} className={styles.crosshair} />
            <circle cx={X(hp.i)} cy={Y(hp.v)} r={5} className={hp.i >= nH ? styles.dotForecast : styles.dotActual} />
          </g>
        ) : null}
      </svg>
      {hp ? (
        <Tip x={X(hp.i)} y={Y(hp.v)} width={width}>
          <span className={styles.tipHead}>{niceDate(hp.date)}</span>
          <span>
            {fmt(hp.v)} {unit} {hp.kind === "actual" ? "used" : hp.kind === "filled" ? "(no record, filled in)" : "forecast"}
          </span>
          {hp.kind === "advisory" ? <span>Less certain (days 15–30)</span> : null}
        </Tip>
      ) : null}
      <ul className={styles.legend}>
        <li>
          <span className={styles.swLineActual} /> Actual use
        </li>
        <li>
          <span className={styles.swLineForecast} /> Forecast
        </li>
        <li>
          <span className={styles.swHatch} /> Less certain (days 15–30)
        </li>
        {history.some((p) => p.filled) ? (
          <li>
            <span className={styles.swDot} /> Day with no record, filled in
          </li>
        ) : null}
      </ul>
      <DataTable
        caption="Daily use and forecast"
        head={["Date", `Use (${unit})`, "Kind"]}
        rows={pts.map((p) => [niceDate(p.date), p.v, p.kind === "actual" ? "Recorded" : p.kind === "filled" ? "Filled in" : p.kind === "advisory" ? "Forecast, less certain" : "Forecast"])}
      />
      <span className="sr-only">{`Use over the last ${nH} days and forecast for the next ${forecast.length} days, from ${asOf}.`}</span>
    </div>
  );
}

// ---- 3. Stock run-down ---------------------------------------------------------------

export function RunDownChart({
  points,
  asOf,
  stockoutDay,
  leadDays,
  transferDays,
  unit,
}: {
  points: RunDownPoint[];
  asOf: string;
  stockoutDay: number;
  leadDays: number;
  transferDays: number | null;
  unit: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 220;
  const pad = { l: 52, r: 16, t: 26, b: 30 };
  const horizon = Math.max(points[points.length - 1]?.day ?? 30, leadDays + 2, 30);
  const yMax = niceMax(Math.max(1, points[0]?.stock ?? 1));
  const X = (d: number) => pad.l + (d / horizon) * (width - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const path = points.map((p, k) => `${k ? "L" : "M"}${X(p.day).toFixed(1)} ${Y(p.stock).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const area = `${path} L${X(last.day).toFixed(1)} ${Y(0)} L${X(0)} ${Y(0)} Z`;
  // Mark the engine's stock-out day (last full day of cover) on the line itself.
  const outPt = points.some((p) => p.stock === 0) ? (points.find((p) => p.day === stockoutDay) ?? null) : null;
  const zeroAt = outPt ? outPt.day : null;
  const zeroY = outPt ? Y(outPt.stock) : Y(0);
  const markers: { d: number; label: string; cls: string }[] = [{ d: leadDays, label: `Supplier delivery · day ${leadDays}`, cls: styles.markSupplier }];
  if (transferDays !== null) markers.push({ d: transferDays, label: `Transfer arrives · day ${transferDays}`, cls: styles.markTransfer });
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const d = Math.round(((e.clientX - rect.left - pad.l) / (width - pad.l - pad.r)) * horizon);
    setHover(Math.max(0, Math.min(horizon, d)));
  };
  const hp = hover !== null ? (points.find((p) => p.day === hover) ?? (hover > last.day ? { day: hover, stock: 0 } : null)) : null;
  return (
    <div ref={ref} className={styles.chart}>
      <svg width={width} height={H} role="img" aria-label="Projected stock, day by day" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks(yMax).map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={Y(t)} y2={Y(t)} className={styles.grid} />
            <text x={pad.l - 6} y={Y(t) + 4} className={styles.axis} textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        <path d={area} className={styles.area} />
        <path d={path} className={styles.lineStock} />
        {markers.map((m, k) => (
          <g key={m.label}>
            <line x1={X(m.d)} x2={X(m.d)} y1={pad.t - 2} y2={H - pad.b} className={m.cls} />
            <text x={X(m.d) + (X(m.d) > width - 160 ? -4 : 4)} y={pad.t - 8 + k * 0} className={styles.axis} textAnchor={X(m.d) > width - 160 ? "end" : "start"} dy={k * 13}>
              {m.label}
            </text>
          </g>
        ))}
        {zeroAt !== null ? (
          <g>
            <path
              d={`M${X(zeroAt)} ${zeroY - 9} L${X(zeroAt) + 9} ${zeroY} L${X(zeroAt)} ${zeroY + 9} L${X(zeroAt) - 9} ${zeroY} Z`}
              fill="var(--risk-critical)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
            <text x={X(zeroAt)} y={zeroY - 14} className={styles.valueStrong} textAnchor={X(zeroAt) > width - 90 ? "end" : "middle"}>
              Runs out · day {stockoutDay}
            </text>
          </g>
        ) : null}
        <text x={pad.l} y={H - 10} className={styles.axis}>
          Today
        </text>
        <text x={width - pad.r} y={H - 10} className={styles.axis} textAnchor="end">
          Day {horizon}
        </text>
        {hp ? (
          <g>
            <line x1={X(hp.day)} x2={X(hp.day)} y1={pad.t} y2={H - pad.b} className={styles.crosshair} />
            <circle cx={X(hp.day)} cy={Y(hp.stock)} r={5} className={styles.dotActual} />
          </g>
        ) : null}
      </svg>
      {hp ? (
        <Tip x={X(hp.day)} y={Y(hp.stock)} width={width}>
          <span className={styles.tipHead}>
            Day {hp.day} · {niceDate(addDays(asOf, hp.day))}
          </span>
          <span>
            {fmt(hp.stock)} {unit} left
          </span>
        </Tip>
      ) : null}
      <DataTable caption="Projected stock by day" head={["Day", "Date", `Stock (${unit})`]} rows={points.map((p) => [p.day, niceDate(addDays(asOf, p.day)), p.stock])} />
    </div>
  );
}

// ---- 4. Why this priority --------------------------------------------------------------

const FACTOR_LABEL: Record<string, string> = {
  soonness: "Runs out soon",
  emergencyShare: "Emergency patients",
  patientLoad: "Patient load",
  substitute: "Substitute available",
};

export function FactorBars({ factors }: { factors: Record<string, number> }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const entries = Object.entries(factors);
  const labelW = width < 480 ? 150 : 180;
  const max = niceMax(Math.max(...entries.map(([, v]) => Math.abs(v)), 1));
  const neg = entries.some(([, v]) => v < 0);
  const plot = width - labelW - 48;
  const zero = labelW + (neg ? plot * 0.2 : 0);
  const scale = (neg ? plot * 0.8 : plot) / max;
  const rowH = 34;
  return (
    <div ref={ref} className={styles.chart}>
      <svg width={width} height={entries.length * rowH + 4} role="img" aria-label="What adds to the priority score">
        <line x1={zero} x2={zero} y1={0} y2={entries.length * rowH} className={styles.baseline} />
        {entries.map(([k, v], i) => {
          const y = i * rowH + 9;
          const len = Math.abs(v) * scale;
          return (
            <g key={k}>
              <text x={0} y={y + 12} className={styles.rowLabel}>
                {FACTOR_LABEL[k] ?? k}
              </text>
              {v >= 0 ? (
                <path d={barPath(zero, y, len, 16)} className={styles.factorPos} />
              ) : (
                <path d={barPath(zero, y, len, 16)} className={styles.factorNeg} transform={`translate(${2 * zero} 0) scale(-1 1)`} />
              )}
              <text x={v >= 0 ? zero + len + 6 : zero + 6} y={y + 12} className={styles.value}>
                {v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(Math.abs(v))}` : "0"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- mini chart for network cards -------------------------------------------------------

export function MiniCover({ rows }: { rows: { name: string; days: number; leadDays: number; severity: Severity }[] }) {
  const W = 240;
  const rowH = 12;
  const max = niceMax(Math.min(90, Math.max(...rows.map((r) => Math.max(r.days, r.leadDays)), 10)));
  const x = (d: number) => (Math.min(d, max) / max) * W;
  return (
    <svg className={styles.mini} viewBox={`0 0 ${W} ${rows.length * rowH}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {rows.map((r, i) => (
        <g key={r.name}>
          <rect x={0} y={i * rowH + 3} width={W} height={6} className={styles.track} />
          <rect x={0} y={i * rowH + 3} width={Math.max(2, x(r.days))} height={6} fill={SEV_FILL[r.severity]} />
          <rect x={x(r.leadDays) - 1} y={i * rowH + 1} width={2} height={10} fill="var(--color-ink)" />
        </g>
      ))}
    </svg>
  );
}
