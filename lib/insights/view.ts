/**
 * Insights view model (charts per hospital). Pure: shapes ResultsJSON v2 +
 * the 60-day usage history into chart-ready series. Every plotted value is
 * an engine output, a DB aggregate, or (run-down) the engine's own
 * day-by-day depletion rule applied to those outputs.
 */
import type {
  EmergencyOrderSuggestion,
  ForecastPoint,
  HospitalSummary,
  PriorityEntry,
  ResultsJSON,
  Severity,
  TransferSuggestion,
  WasteWarning,
} from '../contracts';

export interface HistoryPoint {
  date: string;
  value: number;
  /** True when the day had no record and was filled by interpolation. */
  filled: boolean;
}

export interface RunDownPoint {
  /** Days from today (0 = today). */
  day: number;
  stock: number;
}

export interface MedicineInsight {
  medicineId: string;
  name: string;
  baseUnit: string;
  isCritical: boolean;
  stock: number;
  dailyDemand: number;
  daysUntilStockout: number;
  leadDays: number;
  bufferDays: number;
  severity: Severity;
  nearestExpiry: string | null;
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  mapePct: number | null;
  mode: 'base' | 'trend' | null;
  outbreak: boolean;
  /** Engine-emitted local-event reasons, quoted verbatim (EVT-04). */
  eventReasons: string[];
  runDown: RunDownPoint[];
  transfersIn: TransferSuggestion[];
  transfersOut: TransferSuggestion[];
  supplierOrder: EmergencyOrderSuggestion | null;
  waste: WasteWarning[];
}

export interface HospitalInsight {
  hospitalId: string;
  name: string;
  summary: HospitalSummary | null;
  level: Severity;
  medicines: MedicineInsight[];
  priorities: PriorityEntry[];
  /** Total ranked positions in the network (for "#3 of 65"). */
  networkRanked: number;
  asOf: string;
  advisoryFromDay: number;
  historyAvailable: boolean;
}

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Stock left at the end of each day, depleting against the forecast exactly
 * like the engine (lib/engine/stockout.ts); past day 30 it continues at the
 * forecast's mean daily rate. Stops at zero or at `horizon` days.
 *
 * Optional `arrival`: `qty` units become available at the START of day
 * `arrival.day` (day 0 = already on the shelf today, so point 0 includes
 * them). Before the arrival day the series does not stop at zero, so the
 * empty stretch before help arrives is visible; after it, it stops at the
 * first zero as usual.
 */
export function runDown(
  stock: number,
  forecast: readonly ForecastPoint[],
  horizon: number,
  arrival?: { day: number; qty: number },
): RunDownPoint[] {
  const arriveDay = arrival ? arrival.day : -1;
  const arriveQty = arrival ? arrival.qty : 0;
  let left = arriveDay === 0 ? stock + arriveQty : stock;
  const out: RunDownPoint[] = [{ day: 0, stock: round1(left) }];
  const mean = forecast.length ? forecast.reduce((s, p) => s + p.demand, 0) / forecast.length : 0;
  for (let d = 1; d <= horizon; d++) {
    if (d === arriveDay) left += arriveQty;
    const use = d <= forecast.length ? forecast[d - 1].demand : mean;
    left = Math.max(0, left - use);
    out.push({ day: d, stock: round1(left) });
    if (left === 0 && d >= arriveDay) break;
  }
  return out;
}

/** Chart horizon: past the lead time + buffer and the stock-out day, 30-60 days. */
export function horizonFor(m: Pick<MedicineInsight, 'leadDays' | 'bufferDays' | 'daysUntilStockout'>): number {
  return Math.min(60, Math.max(30, m.leadDays + m.bufferDays + 4, m.daysUntilStockout + 4));
}

export function worstSeverity(list: readonly { severity: Severity }[]): Severity {
  return list.reduce<Severity>((w, m) => (ORDER[m.severity] < ORDER[w] ? m.severity : w), 'ok');
}

export function buildHospitalInsight(
  r: ResultsJSON,
  hospitalId: string,
  history: Record<string, HistoryPoint[]> | null,
): HospitalInsight | null {
  const summary = r.hospitals.find((h) => h.hospitalId === hospitalId) ?? null;
  if (!summary) return null;
  const medicines = r.inventory
    .filter((e) => e.hospitalId === hospitalId)
    .map((e): MedicineInsight => {
      const med = r.medicines.find((m) => m.medicineId === e.medicineId);
      const fc = r.forecasts.find((f) => f.hospitalId === hospitalId && f.medicineId === e.medicineId);
      const base: MedicineInsight = {
        medicineId: e.medicineId,
        name: med?.medicineName ?? e.medicineId,
        baseUnit: med?.baseUnit ?? 'unit',
        isCritical: med?.isCritical ?? false,
        stock: e.stock,
        dailyDemand: e.dailyDemand,
        daysUntilStockout: e.daysUntilStockout,
        leadDays: e.leadDays,
        bufferDays: e.bufferDays,
        severity: e.severity,
        nearestExpiry: e.nearestExpiry,
        history: history?.[e.medicineId] ?? [],
        forecast: fc?.forecast ?? [],
        mapePct: fc?.mapePct ?? null,
        mode: fc?.mode ?? null,
        outbreak: fc?.outbreak ?? false,
        eventReasons: fc?.eventReasons ?? [],
        runDown: [],
        transfersIn: r.transfers.filter((t) => t.toHospital === hospitalId && t.medicineId === e.medicineId),
        transfersOut: r.transfers.filter((t) => t.fromHospital === hospitalId && t.medicineId === e.medicineId),
        supplierOrder: r.emergencyOrders.find((o) => o.hospitalId === hospitalId && o.medicineId === e.medicineId) ?? null,
        waste: r.wasteWarnings.filter((w) => w.hospitalId === hospitalId && w.medicineId === e.medicineId),
      };
      base.runDown = runDown(e.stock, base.forecast, horizonFor(base));
      return base;
    })
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.daysUntilStockout - b.daysUntilStockout);
  return {
    hospitalId,
    name: summary.hospitalName,
    summary,
    level: worstSeverity(medicines),
    medicines,
    priorities: r.priorities.filter((p) => p.hospitalId === hospitalId).sort((a, b) => a.rank - b.rank),
    networkRanked: r.priorities.length,
    asOf: r.asOf,
    advisoryFromDay: r.advisory.fromDay,
    historyAvailable: history !== null,
  };
}

export interface HospitalCard {
  hospitalId: string;
  name: string;
  level: Severity;
  outbreak: boolean;
  critical: number;
  low: number;
  topRank: number | null;
  worst: { name: string; days: number; leadDays: number } | null;
  /** Cover vs lead per medicine, worst first (mini chart). */
  cover: { name: string; days: number; leadDays: number; bufferDays: number; severity: Severity }[];
  transfersIn: number;
  transfersOut: number;
}

export function buildHospitalCards(r: ResultsJSON): HospitalCard[] {
  return r.hospitals
    .map((h): HospitalCard => {
      const inv = r.inventory
        .filter((e) => e.hospitalId === h.hospitalId)
        .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.daysUntilStockout - b.daysUntilStockout);
      const name = (id: string) => r.medicines.find((m) => m.medicineId === id)?.medicineName ?? id;
      const w = inv[0];
      return {
        hospitalId: h.hospitalId,
        name: h.hospitalName,
        level: worstSeverity(inv),
        outbreak: h.outbreak,
        critical: inv.filter((e) => e.severity === 'critical').length,
        low: inv.filter((e) => e.severity === 'warning').length,
        topRank: r.priorities.filter((p) => p.hospitalId === h.hospitalId).sort((a, b) => a.rank - b.rank)[0]?.rank ?? null,
        worst: w ? { name: name(w.medicineId), days: w.daysUntilStockout, leadDays: w.leadDays } : null,
        cover: inv.map((e) => ({ name: name(e.medicineId), days: e.daysUntilStockout, leadDays: e.leadDays, bufferDays: e.bufferDays, severity: e.severity })),
        transfersIn: r.transfers.filter((t) => t.toHospital === h.hospitalId).length,
        transfersOut: r.transfers.filter((t) => t.fromHospital === h.hospitalId).length,
      };
    })
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || (a.topRank ?? 999) - (b.topRank ?? 999));
}
