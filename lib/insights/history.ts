/**
 * 60-day usage history for one hospital (insights charts only; read-only).
 * Same window and gap filling as the engine (lib/network/history.ts), so the
 * chart shows exactly the series the forecast was built from.
 */
import { interpolateGaps } from '../network/history';
import type { HistoryPoint } from './view';

export interface UsageRow {
  usageDate: string;
  medicineId: string;
  usedQty: number | null;
}

/** Calendar-aligned series per medicine; missing days interpolated and flagged. */
export function seriesFromRows(rows: readonly UsageRow[], dates: readonly string[], medicineIds: readonly string[]): Record<string, HistoryPoint[]> {
  const out: Record<string, HistoryPoint[]> = {};
  for (const m of medicineIds) {
    const byDate = new Map(rows.filter((r) => r.medicineId === m).map((r) => [r.usageDate, r.usedQty] as const));
    const raw = dates.map((d) => byDate.get(d) ?? null);
    const filled = interpolateGaps(raw);
    out[m] = dates.map((date, i) => ({ date, value: filled[i], filled: raw[i] === null }));
  }
  return out;
}

/** Inclusive ISO dates from..to. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Reads one hospital's usage in the window. Throws on DB failure. */
export async function loadHospitalHistory(
  hospitalId: string,
  window: { from: string; to: string },
  medicineIds: readonly string[],
): Promise<Record<string, HistoryPoint[]>> {
  const [{ db }, { dailyUsage }, orm] = await Promise.all([import('../../db/client'), import('../../db/schema'), import('drizzle-orm')]);
  const rows = await db
    .select({ usageDate: dailyUsage.usageDate, medicineId: dailyUsage.medicineId, usedQty: dailyUsage.usedQty })
    .from(dailyUsage)
    .where(orm.and(orm.eq(dailyUsage.hospitalId, hospitalId), orm.between(dailyUsage.usageDate, window.from, window.to)));
  return seriesFromRows(rows, dateRange(window.from, window.to), medicineIds);
}
