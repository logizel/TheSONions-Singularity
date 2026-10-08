/**
 * Stock-out risk: days-until-stockout by day-by-day depletion (RISK-01, RISK-02).
 *
 * Pure function, no I/O (D-19).
 */
import { EngineInputError } from './errors.js';
import type { ForecastDay } from './types.js';
import { FORECAST_DAYS, ZERO_DEMAND_COVER_DAYS } from './types.js';

export interface StockoutRisk {
  /** Whole days of full cover; 90 when forecast demand is zero (D-17). */
  daysUntilStockout: number;
  /** True exactly when cover is shorter than the supplier lead time (RISK-02). */
  warns: boolean;
}

/** Tolerance so exact-cover arithmetic (1-decimal sums) lands on the right day. */
const EPS = 1e-9;

/**
 * Deplete `stock` day-by-day against the daily 30-day forecast array (D-01),
 * consuming the 1-decimal forecast values as-is with no rounding (D-02).
 * Zero forecast demand reports capped 90+ days cover, never Infinity/null (D-17).
 */
export function stockoutRisk(
  stock: number,
  forecast: ForecastDay[],
  leadTimeDays: number,
): StockoutRisk {
  if (!Number.isFinite(stock) || stock < 0) {
    throw new EngineInputError(`stock must be a finite value >= 0, got ${stock}`);
  }
  if (!Array.isArray(forecast) || forecast.length !== FORECAST_DAYS) {
    throw new EngineInputError(
      `forecast must contain exactly ${FORECAST_DAYS} daily points, got ${Array.isArray(forecast) ? forecast.length : typeof forecast}`,
    );
  }
  for (let i = 0; i < forecast.length; i++) {
    const v = forecast[i]?.value;
    if (!Number.isFinite(v)) {
      throw new EngineInputError(`forecast[${i}] is a gap (non-finite value)`);
    }
    if ((v as number) < 0) {
      throw new EngineInputError(`forecast[${i}] is negative (${v})`);
    }
  }
  if (!Number.isFinite(leadTimeDays) || leadTimeDays < 0) {
    throw new EngineInputError(`leadTimeDays must be a finite value >= 0, got ${leadTimeDays}`);
  }

  const totalDemand = forecast.reduce((s, d) => s + d.value, 0);
  if (totalDemand <= 0) {
    return { daysUntilStockout: ZERO_DEMAND_COVER_DAYS, warns: ZERO_DEMAND_COVER_DAYS < leadTimeDays };
  }

  let remaining = stock;
  let days = 0;
  for (const day of forecast) {
    if (remaining + EPS < day.value) break;
    remaining -= day.value;
    days++;
  }
  if (days === forecast.length && remaining > 0) {
    // Stock outlives the 30-day window: extend at the window's mean daily rate.
    days += Math.floor(remaining / (totalDemand / forecast.length));
  }
  return { daysUntilStockout: days, warns: days < leadTimeDays };
}
