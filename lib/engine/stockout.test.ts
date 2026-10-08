/**
 * Stockout tests wired to the forecast output — the history-to-warning slice.
 */
import { describe, expect, it } from 'vitest';
import { forecast } from './forecast.js';
import { stockoutRisk } from './stockout.js';
import { EngineInputError } from './errors.js';
import { seeds } from './seeds.js';
import type { ForecastDay } from './types.js';
import { FORECAST_DAYS, ZERO_DEMAND_COVER_DAYS } from './types.js';

const flatForecast = (daily: number): ForecastDay[] =>
  Array.from({ length: FORECAST_DAYS }, (_, i) => ({ value: daily, advisory: i + 1 >= 15 }));

describe('stockoutRisk (RISK-01: days-until-stockout)', () => {
  it('depletes stock day-by-day (happy path: 95u at 10u/day lasts 9 full days)', () => {
    const risk = stockoutRisk(95, flatForecast(10), 14);
    expect(risk.daysUntilStockout).toBe(9);
  });

  it('wires end to end: normal history -> forecast() -> stockoutRisk()', () => {
    const fc = forecast(seeds.normal.history);
    const risk = stockoutRisk(seeds.normal.stock, fc, seeds.normal.leadTimeDays);
    expect(Number.isInteger(risk.daysUntilStockout)).toBe(true);
    expect(risk.daysUntilStockout).toBeGreaterThanOrEqual(0);
    expect(risk.daysUntilStockout).toBeLessThan(FORECAST_DAYS);
    // 400u at ~37u/day ≈ 10 days cover < 14-day lead time → warns (RISK-02).
    expect(risk.daysUntilStockout).toBeLessThan(seeds.normal.leadTimeDays);
    expect(risk.warns).toBe(true);
  });

  it('extends past the 30-day window at the mean rate when stock outlives it', () => {
    const risk = stockoutRisk(1000, flatForecast(10), 14);
    expect(risk.daysUntilStockout).toBe(100);
    expect(risk.warns).toBe(false);
  });
});

describe('lead-time warning boundary (RISK-02)', () => {
  it('warns exactly when cover is shorter than the supplier lead time', () => {
    // 10 days cover vs 14-day lead time warns; vs 10-day and 5-day lead times it does not.
    expect(stockoutRisk(100, flatForecast(10), 14).warns).toBe(true);
    expect(stockoutRisk(100, flatForecast(10), 10).warns).toBe(false);
    expect(stockoutRisk(100, flatForecast(10), 5).warns).toBe(false);
  });

  it('zero stock with positive demand covers 0 days and warns', () => {
    const risk = stockoutRisk(0, flatForecast(10), 14);
    expect(risk.daysUntilStockout).toBe(0);
    expect(risk.warns).toBe(true);
  });
});

describe('zero-demand edge (D-17)', () => {
  it('reports capped 90+ days cover, never Infinity or null', () => {
    const risk = stockoutRisk(50, flatForecast(0), 14);
    expect(risk.daysUntilStockout).toBe(ZERO_DEMAND_COVER_DAYS);
    expect(Number.isFinite(risk.daysUntilStockout)).toBe(true);
    expect(risk.daysUntilStockout).not.toBe(Infinity);
    expect(risk.warns).toBe(false);
  });
});

describe('input validation (D-20)', () => {
  it('throws EngineInputError on negative stock', () => {
    expect(() => stockoutRisk(-1, flatForecast(10), 14)).toThrow(EngineInputError);
  });

  it('throws EngineInputError on wrong forecast length', () => {
    expect(() => stockoutRisk(100, flatForecast(10).slice(0, 7), 14)).toThrow(EngineInputError);
  });

  it('throws EngineInputError on negative lead time', () => {
    expect(() => stockoutRisk(100, flatForecast(10), -3)).toThrow(EngineInputError);
  });
});
