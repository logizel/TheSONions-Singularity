/**
 * Forecast tests on deterministic seeds (D-21) — tracer slice.
 */
import { describe, expect, it } from 'vitest';
import { forecast, mape, networkMean } from './forecast.js';
import { EngineInputError } from './errors.js';
import { allSeedHistories, seeds } from './seeds.js';
import { ADVISORY_FROM_DAY, FORECAST_DAYS, HISTORY_DAYS } from './types.js';

describe('forecast (D-01: daily 30-day array)', () => {
  it('produces a 30-day daily ForecastDay array on the normal seed', () => {
    const out = forecast(seeds.normal.history);
    expect(out).toHaveLength(FORECAST_DAYS);
    for (const day of out) {
      expect(typeof day.value).toBe('number');
      expect(Number.isFinite(day.value)).toBe(true);
      expect(day.value).toBeGreaterThanOrEqual(0);
      expect(typeof day.advisory).toBe('boolean');
    }
  });

  it('flags days 15-30 advisory and days 1-14 non-advisory (D-03)', () => {
    const out = forecast(seeds.normal.history);
    expect(out.slice(0, ADVISORY_FROM_DAY - 1).every((d) => d.advisory === false)).toBe(true);
    expect(out.slice(ADVISORY_FROM_DAY - 1).every((d) => d.advisory === true)).toBe(true);
  });

  it('emits 1-decimal floats with no integer rounding (D-02)', () => {
    const out = forecast(seeds.normal.history);
    for (const day of out) {
      expect(Math.round(day.value * 10) / 10).toBe(day.value);
    }
    // Values are averages, not all integers — the engine does not round to whole units.
    expect(out.some((d) => !Number.isInteger(d.value))).toBe(true);
  });

  it('uses a weekday-average baseline (forecast day matches its historical weekday mean)', () => {
    const out = forecast(seeds.normal.history);
    // Forecast day 0 continues the sequence at weekday (60+0)%7 = 4.
    const expected = seeds.normal.history
      .filter((_, j) => j % 7 === 4)
      .reduce((a, b) => a + b, 0) / seeds.normal.history.filter((_, j) => j % 7 === 4).length;
    expect(out[0].value).toBeCloseTo(Math.round(expected * 10) / 10, 10);
  });
});

describe('mape + networkMean (D-04, FCAST-02)', () => {
  it('MAPE on the deterministic normal seed sits in the 3-11% band', () => {
    const predicted = forecast(seeds.normal.history).map((d) => d.value);
    const err = mape(seeds.normal.holdout, predicted);
    expect(err).toBeGreaterThanOrEqual(0.03);
    expect(err).toBeLessThanOrEqual(0.11);
  });

  it('ignores zero-demand days', () => {
    expect(mape([0, 0, 100], [999, 999, 100])).toBe(0);
    expect(mape([0, 50, 100], [999, 50, 110])).toBeCloseTo((0 + 0.1) / 2, 10);
  });

  it('returns 0 when every actual day is zero demand', () => {
    expect(mape([0, 0], [5, 10])).toBe(0);
  });

  it('networkMean averages per-series errors', () => {
    expect(networkMean([0.05, 0.09])).toBeCloseTo(0.07, 10);
    expect(() => networkMean([])).toThrow(EngineInputError);
  });

  it('throws EngineInputError on mismatched or empty inputs', () => {
    expect(() => mape([1, 2], [1])).toThrow(EngineInputError);
    expect(() => mape([], [])).toThrow(EngineInputError);
  });
});

describe('input validation (D-20: typed errors, never warning accumulation)', () => {
  it('throws EngineInputError on wrong history length', () => {
    expect(() => forecast([1, 2, 3] as never)).toThrow(EngineInputError);
    expect(() => forecast([] as never)).toThrow(EngineInputError);
  });

  it('throws EngineInputError on gaps in history', () => {
    const gapped = [...seeds.normal.history];
    gapped[10] = NaN;
    expect(() => forecast(gapped)).toThrow(EngineInputError);
  });

  it('throws EngineInputError on negative demand in history', () => {
    const neg = [...seeds.normal.history];
    neg[20] = -5;
    expect(() => forecast(neg)).toThrow(EngineInputError);
  });
});

describe('seed completeness (D-22: all four scenarios, D-21: deterministic)', () => {
  it('every scenario history has 60 points with no negatives and no gaps', () => {
    const all = allSeedHistories();
    expect(all.map((s) => s.label).sort()).toEqual(
      ['multiSender.receiver', 'multiSender.sender-a', 'multiSender.sender-b', 'normal', 'outbreak', 'waste'].sort(),
    );
    for (const { label, history } of all) {
      expect(history, label).toHaveLength(HISTORY_DAYS);
      for (let i = 0; i < history.length; i++) {
        expect(Number.isFinite(history[i]), `${label}[${i}] finite`).toBe(true);
        expect(history[i], `${label}[${i}] non-negative`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('scenarios have distinct documented shapes', () => {
    // Outbreak tail spikes above the normal tail.
    expect(seeds.outbreak.history[58]).toBeGreaterThan(seeds.normal.history[58]);
    expect(seeds.outbreak.history[59]).toBeGreaterThan(seeds.normal.history[59]);
    // Outbreak spikes are two consecutive +2σ days over the 60-day baseline (OUTBK-01 shape).
    const h = seeds.outbreak.history;
    const mean = h.reduce((a, b) => a + b, 0) / h.length;
    const sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) ** 2, 0) / h.length);
    expect(h[58]).toBeGreaterThan(mean + 2 * sd);
    expect(h[59]).toBeGreaterThan(mean + 2 * sd);
    // Waste stock dwarfs its demand-to-expiry.
    expect(seeds.waste.stock).toBeGreaterThan(0);
    // Multi-sender senders differ in waste-relevant terms and transport days.
    const [a, b] = seeds.multiSender.senders;
    expect(a.transportDays).not.toBe(b.transportDays);
    expect(a.stock).not.toBe(b.stock);
  });
});
