/**
 * Usage-history assembly for the engine (Phase 6, D-02): one 60-day series
 * per hospital x medicine, calendar-aligned, with NULL / missing days filled
 * by linear interpolation (D-10: NULL = missing, the engine never sees gaps).
 */
import { HISTORY_DAYS } from '../engine/types';

const DAY_MS = 86_400_000;

/** Parse YYYY-MM-DD as a UTC day number (days since epoch). */
export function dayNumber(isoDate: string): number {
  const t = Date.parse(`${isoDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || Number.isNaN(t)) {
    throw new RangeError(`bad ISO date "${isoDate}"`);
  }
  return Math.round(t / DAY_MS);
}

export function isoFromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a); negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Inclusive 60-day window ending at the latest usage date. */
export function historyWindow(latestIsoDate: string): { from: string; to: string; dates: string[] } {
  const end = dayNumber(latestIsoDate);
  const dates: string[] = [];
  for (let d = end - HISTORY_DAYS + 1; d <= end; d++) dates.push(isoFromDayNumber(d));
  return { from: dates[0], to: dates[dates.length - 1], dates };
}

/**
 * Fill gaps (null / non-finite) by linear interpolation between the nearest
 * known neighbours; leading/trailing gaps copy the nearest known value; an
 * all-gap series becomes zeros. Values are kept at 1 decimal (D-02).
 */
export function interpolateGaps(values: readonly (number | null | undefined)[]): number[] {
  const known: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v === 'number' && Number.isFinite(v)) known.push(i);
  }
  if (known.length === 0) return values.map(() => 0);
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[i] = v;
      continue;
    }
    // nearest known neighbours (known is sorted)
    let lo = -1;
    let hi = -1;
    for (const k of known) {
      if (k < i) lo = k;
      else {
        hi = k;
        break;
      }
    }
    if (lo === -1) out[i] = values[hi] as number;
    else if (hi === -1) out[i] = values[lo] as number;
    else {
      const a = values[lo] as number;
      const b = values[hi] as number;
      out[i] = Math.round((a + ((b - a) * (i - lo)) / (hi - lo)) * 10) / 10;
    }
  }
  return out;
}
