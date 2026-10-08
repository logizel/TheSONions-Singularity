/**
 * Outbreak tests: +2σ enter/exit on the full 60-day baseline with trend
 * switching (OUTBK-01/02, D-05..D-08) — asserted against committed seeds (D-21, D-22).
 */
import { describe, expect, it } from 'vitest';
import { detectOutbreak, trendForecast } from './outbreak';
import { EngineInputError } from './errors';
import { seeds } from './seeds';
import { ADVISORY_FROM_DAY, FORECAST_DAYS } from './types';

/** Independent baseline reimplementation so spike-shape assertions are meaningful. */
const baseline = (history: number[]) => {
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const sd = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
  return { mean, sd, threshold: mean + 2 * sd };
};

describe('detectOutbreak enter (OUTBK-01: +2σ for 2 consecutive days, D-05 full-60d baseline)', () => {
  it('flags the outbreak seed with entry day 58 (D-05, D-08, OUTBK-01)', () => {
    const h = seeds.outbreak.history;
    const { threshold } = baseline(h);
    // The seed tail really is two consecutive +2σ days — and day 57 is not.
    expect(h[58]).toBeGreaterThan(threshold);
    expect(h[59]).toBeGreaterThan(threshold);
    expect(h[57]).toBeLessThanOrEqual(threshold);
    const flag = detectOutbreak(h);
    expect(flag.flagged).toBe(true);
    expect(flag.enteredOnDay).toBe(58);
  });

  it('does not false-positive on the normal seed (ordinary weekly variation)', () => {
    const flag = detectOutbreak(seeds.normal.history);
    expect(flag.flagged).toBe(false);
    expect(flag.enteredOnDay).toBeNull();
  });

  it('needs 2 consecutive days — a single spike day does not flag (OUTBK-01)', () => {
    const single = [...seeds.normal.history];
    single[59] = 75;
    // The lone spike is genuinely above the band — one day is still not enough.
    expect(single[59]).toBeGreaterThan(baseline(single).threshold);
    const flag = detectOutbreak(single);
    expect(flag.flagged).toBe(false);
    expect(flag.enteredOnDay).toBeNull();
  });
});

describe('detectOutbreak exit (D-06: clears after 2 consecutive days back inside)', () => {
  it('clears after 2 consecutive days back inside the band (D-06)', () => {
    // Same spike multiset as the outbreak seed, moved earlier, normal tail.
    const exited = [...seeds.outbreak.history];
    exited[56] = 72;
    exited[57] = 75;
    exited[58] = seeds.normal.history[58];
    exited[59] = seeds.normal.history[59];
    const { threshold } = baseline(exited);
    expect(exited[56]).toBeGreaterThan(threshold);
    expect(exited[57]).toBeGreaterThan(threshold);
    expect(exited[58]).toBeLessThanOrEqual(threshold);
    expect(exited[59]).toBeLessThanOrEqual(threshold);
    const flag = detectOutbreak(exited);
    expect(flag.flagged).toBe(false);
    expect(flag.enteredOnDay).toBeNull();
  });

  it('one day back inside does not clear the flag (D-06)', () => {
    const wobble = [...seeds.outbreak.history];
    wobble[56] = 72;
    wobble[57] = 75;
    wobble[58] = seeds.normal.history[58];
    wobble[59] = 75;
    const { threshold } = baseline(wobble);
    expect(wobble[58]).toBeLessThanOrEqual(threshold);
    expect(wobble[59]).toBeGreaterThan(threshold);
    const flag = detectOutbreak(wobble);
    expect(flag.flagged).toBe(true);
    expect(flag.enteredOnDay).toBe(56);
  });
});

describe('trendForecast (OUTBK-02, D-07: flat last-7-day average)', () => {
  it('returns a flat 30-day array at the last-7-day average with advisory flags on days 15-30', () => {
    const last7 = seeds.outbreak.history.slice(-7);
    const expected = Math.round((last7.reduce((a, b) => a + b, 0) / last7.length) * 10) / 10;
    const tf = trendForecast(seeds.outbreak.history);
    expect(tf).toHaveLength(FORECAST_DAYS);
    // Flat projection (D-07): every day identical — not a slope, not weighted recent-3d.
    expect(tf.every((d) => d.value === expected)).toBe(true);
    // 1-decimal engine floats (D-02).
    for (const d of tf) {
      expect(Math.round(d.value * 10) / 10).toBe(d.value);
    }
    // Advisory flags on days 15-30 inside the single array (D-03).
    expect(tf.slice(0, ADVISORY_FROM_DAY - 1).every((d) => d.advisory === false)).toBe(true);
    expect(tf.slice(ADVISORY_FROM_DAY - 1).every((d) => d.advisory === true)).toBe(true);
  });
});

describe('input validation (D-20: typed errors, never warning accumulation)', () => {
  it('detectOutbreak throws EngineInputError on short history', () => {
    expect(() => detectOutbreak([1, 2, 3])).toThrow(EngineInputError);
  });

  it('detectOutbreak throws EngineInputError on negative values and gaps', () => {
    const neg = [...seeds.normal.history];
    neg[20] = -5;
    expect(() => detectOutbreak(neg)).toThrow(EngineInputError);
    const gapped = [...seeds.normal.history];
    gapped[10] = NaN;
    expect(() => detectOutbreak(gapped)).toThrow(EngineInputError);
  });

  it('trendForecast throws EngineInputError on bad input', () => {
    expect(() => trendForecast([1, 2, 3])).toThrow(EngineInputError);
    const neg = [...seeds.normal.history];
    neg[20] = -5;
    expect(() => trendForecast(neg)).toThrow(EngineInputError);
  });
});
