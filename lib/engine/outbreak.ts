/**
 * Outbreak detection with trend-forecast switching (OUTBK-01/02, D-05..D-08).
 *
 * Pure functions, no I/O (D-19). One series = one hospital/medicine (D-08).
 */
import { EngineInputError } from './errors.js';
import type { DemandHistory, ForecastDay } from './types.js';
import { ADVISORY_FROM_DAY, FORECAST_DAYS, HISTORY_DAYS } from './types.js';

export interface OutbreakFlag {
  /** True while the series is in outbreak (entered, not yet cleared). */
  flagged: boolean;
  /** 0-based history index of the first day of the entering pair; null when not flagged. */
  enteredOnDay: number | null;
}

/** Engine keeps 1-decimal floats; rounding to integers happens at consumption (D-02). */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Guard-clause for history inputs (D-20, threat T-02-01). */
function validateHistory(history: DemandHistory): void {
  if (!Array.isArray(history) || history.length !== HISTORY_DAYS) {
    throw new EngineInputError(
      `history must contain exactly ${HISTORY_DAYS} daily points, got ${Array.isArray(history) ? history.length : typeof history}`,
    );
  }
  for (let i = 0; i < history.length; i++) {
    const v = history[i];
    if (!Number.isFinite(v)) {
      throw new EngineInputError(`history[${i}] is a gap (non-finite value)`);
    }
    if (v < 0) {
      throw new EngineInputError(`history[${i}] is negative (${v})`);
    }
  }
}

/**
 * Flag a series whose demand climbs far above normal (OUTBK-01).
 *
 * Baseline is the mean/σ over the full 60-day history (D-05). The flag enters
 * on 2 consecutive days above mean + 2σ and exits only after 2 consecutive
 * days back inside the band (D-06) — a single inside day does not clear it.
 */
export function detectOutbreak(history: DemandHistory): OutbreakFlag {
  validateHistory(history);
  const n = history.length;
  const mean = history.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const threshold = mean + 2 * sd;

  let flagged = false;
  let enteredOnDay: number | null = null;
  let aboveRun = 0;
  let insideRun = 0;

  for (let i = 0; i < n; i++) {
    const above = (history[i] as number) > threshold;
    if (!flagged) {
      aboveRun = above ? aboveRun + 1 : 0;
      if (aboveRun >= 2) {
        flagged = true;
        enteredOnDay = i - 1;
        aboveRun = 0;
        insideRun = 0;
      }
    } else if (above) {
      insideRun = 0;
    } else {
      insideRun += 1;
      if (insideRun >= 2) {
        flagged = false;
        enteredOnDay = null;
        insideRun = 0;
        aboveRun = 0;
      }
    }
  }
  return { flagged, enteredOnDay };
}

/**
 * Rising-trend forecast used while a series is flagged (OUTBK-02).
 *
 * Flat projection of the last-7-day average (D-07) — stable, no overshoot on
 * spikes. 1-decimal floats (D-02) with per-day advisory flags on days 15-30 (D-03).
 */
export function trendForecast(history: DemandHistory): ForecastDay[] {
  validateHistory(history);
  const last7 = history.slice(-7);
  const avg = round1(last7.reduce((a, b) => a + b, 0) / last7.length);
  return Array.from({ length: FORECAST_DAYS }, (_, i) => ({
    value: avg,
    advisory: i + 1 >= ADVISORY_FROM_DAY,
  }));
}
