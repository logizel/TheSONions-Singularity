/**
 * Waste tests: stock minus forecast demand to expiry with the 90-day cap
 * (WASTE-01/02, D-18) — consuming forecast() output, never reimplementing it.
 */
import { describe, expect, it } from 'vitest';
import { forecast } from './forecast';
import { wasteRisk } from './waste';
import { EngineInputError } from './errors';
import { seeds } from './seeds';
import type { ForecastDay } from './types';
import { FORECAST_DAYS } from './types';

const flatForecast = (daily: number): ForecastDay[] =>
  Array.from({ length: FORECAST_DAYS }, (_, i) => ({ value: daily, advisory: i + 1 >= 15 }));

describe('wasteRisk quantity (WASTE-01, D-18: stock minus demand to expiry, 90d cap)', () => {
  it('reports the exact expiring-unused quantity on the waste seed (WASTE-01, D-18)', () => {
    const fc = forecast(seeds.waste.history);
    const daysToExpiry = seeds.waste.daysToExpiry as number;
    // Independent expectation from the forecast output: 30d array plus
    // extension at the array's daily rate up to min(expiry, 90).
    const total30 = fc.reduce((s, d) => s + d.value, 0);
    const demand = total30 + (Math.min(daysToExpiry, 90) - 30) * (total30 / fc.length);
    const risk = wasteRisk(seeds.waste.stock, fc, daysToExpiry);
    // D-02: engine outputs are 1-decimal — expect the rounded quantity, not
    // the raw float difference (BL-01: the old precision-8 assertion pinned
    // the unrounded dust value, contradicting the D-02 contract).
    const expected = Math.round((seeds.waste.stock - demand) * 10) / 10;
    expect(risk.wasteUnits).toBeCloseTo(expected, 8);
    // Seed shape: 3500u stock dwarfs ~45d of low demand — thousands expire unused.
    expect(risk.wasteUnits).toBeGreaterThan(1000);
    expect(risk.warns).toBe(true); // WASTE-02: warns exactly when waste > 0
  });

  it('reports zero waste with no warning when stock depletes before expiry', () => {
    const risk = wasteRisk(10, flatForecast(10), 45);
    expect(risk.wasteUnits).toBe(0);
    expect(risk.warns).toBe(false);
  });

  it('caps the demand window at 90 days (D-18)', () => {
    const beyond = wasteRisk(2000, flatForecast(10), 120);
    const capped = wasteRisk(2000, flatForecast(10), 90);
    expect(beyond.wasteUnits).toBe(capped.wasteUnits);
    expect(beyond.wasteUnits).toBeCloseTo(2000 - 90 * 10, 8);
    expect(beyond.warns).toBe(true);
  });

  it('reports the entire stock as waste when forecast demand is zero', () => {
    // Consistent with the D-17 90+ cover convention: nothing ever depletes,
    // so all of it expires unused — still finite and quotable.
    const risk = wasteRisk(500, flatForecast(0), 30);
    expect(risk.wasteUnits).toBe(500);
    expect(risk.warns).toBe(true);
  });
});

describe('BL-01 regression: 1-decimal quotable waste, exact-zero boundary (WASTE-02, D-02)', () => {
  it('yields zero waste with no warning when stock exactly equals demand', () => {
    // Verifier reproduction: flat 30-day forecast at 0.7/day, stock 21 —
    // raw float demand sums to 20.99999999999999, dust must not warn.
    const risk = wasteRisk(21, flatForecast(0.7), 30);
    expect(risk.wasteUnits).toBe(0);
    expect(risk.warns).toBe(false); // WASTE-02: warns exactly when waste > 0
  });

  it('yields a clean 1-decimal wasteUnits value on the dust case (stock 1119, 37.3/day)', () => {
    // Verifier reproduction: stock 1119 vs flat 30-day forecast at 37.3/day
    // (exact arithmetic: zero waste) previously yielded 6.82e-13 + warns:true.
    const risk = wasteRisk(1119, flatForecast(37.3), 30);
    expect(Number.isInteger(risk.wasteUnits * 10)).toBe(true); // D-02: 1-decimal quotable
    expect(risk.wasteUnits).toBe(0);
    expect(risk.warns).toBe(false);
  });

  it('rounds non-zero dust to a clean 1-decimal value', () => {
    // 3500u stock vs ~45d of 37.3/day demand previously carried float dust
    // (1821.5000000000014 instead of the quotable 1821.5).
    const risk = wasteRisk(3500, flatForecast(37.3), 45);
    expect(Number.isInteger(risk.wasteUnits * 10)).toBe(true); // D-02: 1-decimal quotable
    expect(risk.wasteUnits).toBe(1821.5);
    expect(risk.warns).toBe(true);
  });
});

describe('input validation (D-20: typed errors, never warning accumulation)', () => {
  it('throws EngineInputError on negative stock', () => {
    expect(() => wasteRisk(-1, flatForecast(10), 30)).toThrow(EngineInputError);
  });

  it('throws EngineInputError on negative days-to-expiry', () => {
    expect(() => wasteRisk(100, flatForecast(10), -5)).toThrow(EngineInputError);
  });

  it('throws EngineInputError on malformed forecast input', () => {
    expect(() => wasteRisk(100, flatForecast(10).slice(0, 7), 30)).toThrow(EngineInputError);
    const neg = flatForecast(10);
    neg[3] = { value: -2, advisory: false };
    expect(() => wasteRisk(100, neg, 30)).toThrow(EngineInputError);
  });
});
