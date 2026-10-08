/**
 * Expiry-waste risk: stock minus realistic demand before expiry (WASTE-01/02, D-18).
 *
 * Pure function, no I/O (D-19). Per hospital/medicine — quantities stay exact
 * and quotable for dashboard and chat consumption; rounding happens at
 * consumption (D-02).
 */
import { EngineInputError } from './errors.js';
import type { ForecastDay } from './types.js';
import { FORECAST_DAYS } from './types.js';

export interface WasteRisk {
  /** Units of stock that will expire unused (D-18, WASTE-01). */
  wasteUnits: number;
  /** True exactly when wasteUnits is greater than zero (WASTE-02). */
  warns: boolean;
}

/** Demand window never extends past 90 days (D-18). */
const MAX_WASTE_WINDOW_DAYS = 90;

/**
 * Compute expiring-unused stock (D-18, WASTE-01): sum forecast demand over
 * min(daysToExpiry, 90) — the 30-day forecast array when expiry is near,
 * extended at the array's daily rate only up to the 90-day cap otherwise
 * (never an unbounded or infinite window).
 */
export function wasteRisk(
  stock: number,
  forecast: ForecastDay[],
  daysToExpiry: number,
): WasteRisk {
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
  if (!Number.isFinite(daysToExpiry) || daysToExpiry < 0) {
    throw new EngineInputError(`daysToExpiry must be a finite value >= 0, got ${daysToExpiry}`);
  }

  const windowDays = Math.min(Math.floor(daysToExpiry), MAX_WASTE_WINDOW_DAYS);
  const total30 = forecast.reduce((s, d) => s + d.value, 0);
  const demand =
    windowDays <= forecast.length
      ? forecast.slice(0, windowDays).reduce((s, d) => s + d.value, 0)
      : total30 + (windowDays - forecast.length) * (total30 / forecast.length);

  const wasteUnits = Math.max(0, stock - demand);
  return { wasteUnits, warns: wasteUnits > 0 };
}
