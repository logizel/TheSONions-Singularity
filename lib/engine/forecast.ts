/**
 * Demand forecasting: weekday-average baseline over the 60-day history.
 *
 * Pure functions, no I/O, no randomness, no time-dependence (D-19, D-21).
 */
import { EngineInputError } from './errors.js';
import type { DemandHistory, ForecastDay } from './types.js';
import { ADVISORY_FROM_DAY, FORECAST_DAYS, HISTORY_DAYS } from './types.js';

/** Engine keeps 1-decimal floats; rounding to integers happens at consumption (D-02). */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Guard-clause shared by forecast entry points (D-20, threat T-02-01). */
export function validateHistory(history: DemandHistory): void {
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
 * Daily 30-day forecast per hospital/medicine (D-01).
 *
 * Baseline: for each forecast day, the mean of the historical same-weekday
 * values (history day 0 is treated as weekday 0; forecast day `i` continues
 * the sequence at weekday `(60 + i) % 7`). Days 15-30 carry `advisory: true`
 * inside the single array (D-03).
 */
export function forecast(history: DemandHistory): ForecastDay[] {
  validateHistory(history);
  const out: ForecastDay[] = [];
  for (let i = 0; i < FORECAST_DAYS; i++) {
    const weekday = (HISTORY_DAYS + i) % 7;
    let sum = 0;
    let count = 0;
    for (let j = weekday; j < HISTORY_DAYS; j += 7) {
      sum += history[j];
      count++;
    }
    out.push({ value: round1(sum / count), advisory: i + 1 >= ADVISORY_FROM_DAY });
  }
  return out;
}

/**
 * Mean absolute percentage error as a fraction (D-04).
 * Zero-demand actual days are ignored; returns 0 when every actual day is zero.
 */
export function mape(actual: number[], predicted: number[]): number {
  if (!Array.isArray(actual) || !Array.isArray(predicted) || actual.length === 0) {
    throw new EngineInputError('mape requires non-empty actual and predicted arrays');
  }
  if (actual.length !== predicted.length) {
    throw new EngineInputError(
      `mape requires equal-length arrays, got ${actual.length} vs ${predicted.length}`,
    );
  }
  let sum = 0;
  let n = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const p = predicted[i];
    if (!Number.isFinite(a) || !Number.isFinite(p)) {
      throw new EngineInputError(`mape input[${i}] is a gap (non-finite value)`);
    }
    if (a < 0 || p < 0) {
      throw new EngineInputError(`mape input[${i}] is negative`);
    }
    if (a === 0) continue; // D-04: ignore zero-demand days
    sum += Math.abs(a - p) / a;
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

/** Network mean across per-series values (D-04: MAPE band checked per series + mean). */
export function networkMean(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) {
    throw new EngineInputError('networkMean requires a non-empty array');
  }
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      throw new EngineInputError(`networkMean input[${i}] is a gap (non-finite value)`);
    }
    sum += v;
  }
  return sum / values.length;
}
