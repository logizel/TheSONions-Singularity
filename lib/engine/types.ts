/**
 * Local compat shim for the pending P2-owned `lib/contracts.ts` (Phase 1).
 *
 * `lib/contracts.ts` does not exist yet and MUST NOT be created or edited
 * from Phase 2 (strict track ownership). This shim mirrors the shapes the
 * engine needs, kept compatible with locked decisions D-01..D-22. Once Phase 1
 * freezes `lib/contracts.ts`, reconcile this file against it (open a GitHub
 * issue for the P2 owner if contract changes are needed).
 */

/** 60 daily demand points, one per day, oldest first (D-01, D-05). */
export type DemandHistory = number[];

/**
 * One forecast day (D-01, D-02, D-03): 1-decimal float value, with
 * `advisory: true` on days 15-30 of the 30-day array.
 */
export interface ForecastDay {
  value: number;
  advisory: boolean;
}

/**
 * Minimal risk-signal input shape consumed by downstream modules
 * (moves, priorities in plans 02-03). All numbers are engine-emitted and
 * directly quotable (D-14, D-16).
 */
export interface RiskSignal {
  hospitalId: string;
  medicine: string;
  daysUntilStockout: number;
  warnsStockout: boolean;
  wasteUnits: number;
  warnsWaste: boolean;
  outbreak: boolean;
}

/** Engine window constants (PROJECT.md: 60d history / 30d forecast / 90d cap). */
export const HISTORY_DAYS = 60;
export const FORECAST_DAYS = 30;
/** 1-based first advisory day: days 15-30 carry `advisory: true` (D-03). */
export const ADVISORY_FROM_DAY = 15;
/** Zero-demand cover cap (D-17): never Infinity/null. */
export const ZERO_DEMAND_COVER_DAYS = 90;
