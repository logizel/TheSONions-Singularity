/**
 * Order decision brief: everything an administrator needs to approve one
 * transfer line or supplier order, derived purely from ResultsJSON.
 *
 * Engine numbers (stock, daily use, days until stock-out, lead/buffer days,
 * severity, priority, waste units) are passed through verbatim. Derived
 * numbers (stock after sending, cover after, waste after, the "with the
 * order" stock-out day and the gap before arrival) are computed here with
 * the engine's own day-by-day depletion rule (runDown) and must be labelled
 * "about"/"≈" wherever they are shown.
 */
import type { ForecastPoint, ResultsJSON, Severity } from '../contracts';
import { addDays } from '../insights/explain';
import { runDown } from '../insights/view';

/** Days simulated for without/with (the engine's waste cap). */
export const BRIEF_HORIZON_DAYS = 90;

export interface BriefInput {
  kind: 'transfer' | 'supplier';
  fromHospital?: string | null;
  toHospital: string;
  medicineId: string;
  qty: number;
  /** Transfer: engine delivery window (transportDays). Supplier: leadDays. */
  arriveDays: number;
}

export interface ReceiverBrief {
  hospitalId: string;
  stock: number;
  dailyDemand: number;
  daysUntilStockout: number;
  leadDays: number;
  bufferDays: number;
  /** leadDays + bufferDays (plain sum of two engine numbers). */
  needDays: number;
  severity: Severity;
  priority: { rank: number; score: number; reasons: string[]; of: number } | null;
  eventReasons: string[];
  outbreak: boolean;
  /** Last 7 days of use, oldest first, ending on historyWindow.to. */
  trend: { date: string; value: number; filled: false }[];
  forecast: ForecastPoint[];
}

export interface SenderBrief {
  hospitalId: string;
  stockNow: number;
  /** Derived: about this much left after sending. */
  stockAfter: number;
  dailyDemand: number;
  /** Derived: about this many whole days of cover after sending. */
  coverDaysAfter: number | null;
  nearestExpiry: string | null;
  /** Engine: units forecast to expire unused. */
  wasteUnits: number;
  wasteExpiry: string | null;
  /** Derived: about this much would still expire after sending. */
  wasteAfter: number;
}

export interface DecisionBrief {
  kind: BriefInput['kind'];
  medicineId: string;
  qty: number;
  arriveDays: number;
  asOf: string;
  advisoryFromDay: number;
  horizon: number;
  receiver: ReceiverBrief | null;
  sender: SenderBrief | null;
  /** Engine stock-out day (verbatim) and its date; null past the horizon. */
  without: { day: number | null; date: string | null };
  /** Derived stock-out with the order arriving after arriveDays. */
  with: { day: number | null; date: string | null; lastsPast: string | null; gapDays: number };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function buildReceiver(r: ResultsJSON, hospitalId: string, medicineId: string): ReceiverBrief | null {
  const e = r.inventory.find((i) => i.hospitalId === hospitalId && i.medicineId === medicineId);
  if (!e) return null;
  const fc = r.forecasts.find((f) => f.hospitalId === hospitalId && f.medicineId === medicineId);
  const p = r.priorities.find((x) => x.hospitalId === hospitalId && x.medicineId === medicineId);
  const n = e.trend.length;
  return {
    hospitalId,
    stock: e.stock,
    dailyDemand: e.dailyDemand,
    daysUntilStockout: e.daysUntilStockout,
    leadDays: e.leadDays,
    bufferDays: e.bufferDays,
    needDays: e.leadDays + e.bufferDays,
    severity: e.severity,
    priority: p ? { rank: p.rank, score: p.score, reasons: p.reasons, of: r.priorities.length } : null,
    eventReasons: fc?.eventReasons ?? [],
    outbreak: fc?.outbreak ?? false,
    trend: e.trend.map((value, i) => ({ date: addDays(r.historyWindow.to, i - (n - 1)), value, filled: false as const })),
    forecast: fc?.forecast ?? [],
  };
}

function buildSender(r: ResultsJSON, hospitalId: string, medicineId: string, qty: number): SenderBrief | null {
  const e = r.inventory.find((i) => i.hospitalId === hospitalId && i.medicineId === medicineId);
  if (!e) return null;
  const waste = r.wasteWarnings.filter((w) => w.hospitalId === hospitalId && w.medicineId === medicineId);
  const wasteUnits = round1(waste.reduce((s, w) => s + w.wasteUnits, 0));
  const wasteExpiry = waste.reduce<string | null>((m, w) => (m === null || w.expiryDate < m ? w.expiryDate : m), null);
  const stockAfter = round1(Math.max(0, e.stock - qty));
  return {
    hospitalId,
    stockNow: e.stock,
    stockAfter,
    dailyDemand: e.dailyDemand,
    coverDaysAfter: e.dailyDemand > 0 ? Math.floor(stockAfter / e.dailyDemand) : null,
    nearestExpiry: e.nearestExpiry,
    wasteUnits,
    wasteExpiry,
    wasteAfter: round1(Math.max(0, wasteUnits - qty)),
  };
}

export function buildDecisionBrief(r: ResultsJSON, input: BriefInput): DecisionBrief {
  const horizon = BRIEF_HORIZON_DAYS;
  const receiver = buildReceiver(r, input.toHospital, input.medicineId);
  const sender =
    input.kind === 'transfer' && input.fromHospital ? buildSender(r, input.fromHospital, input.medicineId, input.qty) : null;
  const base = {
    kind: input.kind,
    medicineId: input.medicineId,
    qty: input.qty,
    arriveDays: input.arriveDays,
    asOf: r.asOf,
    advisoryFromDay: r.advisory.fromDay,
    horizon,
    receiver,
    sender,
  };
  if (!receiver) {
    return { ...base, without: { day: null, date: null }, with: { day: null, date: null, lastsPast: null, gapDays: 0 } };
  }

  const fc = receiver.forecast;
  const noSeries = runDown(receiver.stock, fc, horizon);
  const zNoIdx = noSeries.findIndex((p) => p.stock === 0);
  const zNo = zNoIdx >= 0 ? noSeries[zNoIdx].day : null;

  const withoutDay = receiver.daysUntilStockout <= horizon ? receiver.daysUntilStockout : null;
  const without = { day: withoutDay, date: withoutDay === null ? null : addDays(r.asOf, withoutDay) };

  // Arrival past the simulated horizon: within the horizon nothing changes.
  if (input.arriveDays > horizon) {
    return {
      ...base,
      without,
      with: {
        day: without.day,
        date: without.date,
        lastsPast: without.day === null ? addDays(r.asOf, horizon) : null,
        gapDays: zNo === null ? 0 : Math.max(0, horizon - Math.max(1, zNo) + 1),
      },
    };
  }

  const withSeries = runDown(receiver.stock, fc, horizon, { day: input.arriveDays, qty: input.qty });
  const zWithPt = withSeries.find((p) => p.day >= input.arriveDays && p.stock === 0);
  const zWith = zWithPt ? zWithPt.day : null;
  const gapDays = withSeries.filter((p) => p.day >= 1 && p.day < input.arriveDays && p.stock === 0).length;

  let withDay: number | null;
  if (zWith === null) withDay = null;
  else if (zNo !== null && without.day !== null) withDay = without.day + (zWith - zNo);
  // Fallback (engine and run-down disagree near the horizon): engine counts
  // fully covered days, i.e. one less than the first zero index.
  else withDay = Math.max(0, zWith - 1);

  return {
    ...base,
    without,
    with: {
      day: withDay,
      date: withDay === null ? null : addDays(r.asOf, withDay),
      lastsPast: withDay === null ? addDays(r.asOf, horizon) : null,
      gapDays,
    },
  };
}
