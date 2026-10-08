/**
 * Global priority ranking with justifications (PRIOR-01/02, D-13..D-16).
 *
 * Inline competing-signal fixtures assert weight order, global sort, and the
 * breakdown-plus-sentence shape consumable by the dashboard and the
 * quote-only chat. rankPriorities() takes precomputed risk signals only —
 * no cross-imports of other engine modules (parallel-safe with 02-02).
 */
import { describe, expect, it } from 'vitest';
import { EngineInputError } from './errors.js';
import {
  rankPriorities,
  type PrioritySignal,
} from './priorities.js';

const sig = (over: Partial<PrioritySignal>): PrioritySignal => ({
  hospitalId: 'h1',
  medicine: 'DrugX',
  daysUntilStockout: 10,
  emergencySharePct: 20,
  patientLoad: 200,
  hasSubstitute: false,
  ...over,
});

describe('rankPriorities', () => {
  it('returns scores 0-100 sorted descending globally across all hospitals/medicines (D-14, D-15, PRIOR-02)', () => {
    // D-15: one global list across hospitals AND medicines, worst first —
    // not per-medicine lists. D-14: 0-100 scores, sortable and quotable.
    const ranked = rankPriorities([
      sig({ hospitalId: 'safe', medicine: 'DrugA', daysUntilStockout: 60 }),
      sig({ hospitalId: 'mid', medicine: 'DrugB', daysUntilStockout: 12 }),
      sig({ hospitalId: 'dire', medicine: 'DrugC', daysUntilStockout: 2 }),
    ]);
    expect(ranked).toHaveLength(3);
    const scores = ranked.map((r) => r.score);
    for (const s of scores) {
      expect(Number.isInteger(s)).toBe(true); // D-14: integer scores
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
    expect(scores).toEqual([...scores].sort((a, b) => b - a)); // D-15: global descending
    expect(ranked[0]?.hospitalId).toBe('dire'); // worst first
    expect(ranked[2]?.hospitalId).toBe('safe');
  });

  it('soonness dominates: a sooner stock-out outranks a higher-load but safer hospital (D-13)', () => {
    // D-13: soonness-first weights — soonness dominates, not load-first.
    const ranked = rankPriorities([
      sig({
        hospitalId: 'big-safe',
        daysUntilStockout: 25,
        patientLoad: 950,
        emergencySharePct: 10,
      }),
      sig({
        hospitalId: 'small-urgent',
        daysUntilStockout: 2,
        patientLoad: 80,
        emergencySharePct: 10,
      }),
    ]);
    expect(ranked[0]?.hospitalId).toBe('small-urgent'); // D-13: sooner wins despite 12x load gap
  });

  it('emergency share outranks patient load when soonness is tied, and a substitute lowers the score (D-13)', () => {
    // D-13: after soonness comes emergency share, then patient load, then substitute existence.
    const ranked = rankPriorities([
      sig({
        hospitalId: 'busy-calm',
        daysUntilStockout: 8,
        emergencySharePct: 10,
        patientLoad: 900,
      }),
      sig({
        hospitalId: 'quiet-acute',
        daysUntilStockout: 8,
        emergencySharePct: 60,
        patientLoad: 100,
      }),
    ]);
    expect(ranked[0]?.hospitalId).toBe('quiet-acute'); // D-13: emergency beats load on tied soonness

    const withSub = rankPriorities([
      sig({ hospitalId: 'no-sub', hasSubstitute: false }),
      sig({ hospitalId: 'has-sub', hasSubstitute: true }),
    ]);
    const noSub = withSub.find((r) => r.hospitalId === 'no-sub')!;
    const hasSub = withSub.find((r) => r.hospitalId === 'has-sub')!;
    expect(hasSub.score).toBeLessThan(noSub.score); // D-13: substitute existence lowers urgency
  });

  it('carries a factor breakdown plus one human sentence mentioning stockout days and emergency share (D-16, PRIOR-01)', () => {
    // D-16: machine-readable breakdown + one quotable sentence for dashboard/chat —
    // not score-only, not long text. PRIOR-01: scored from load, emergency
    // share, soonness, and substitute existence.
    const [top] = rankPriorities([
      sig({
        hospitalId: 'h1',
        medicine: 'DrugX',
        daysUntilStockout: 6,
        emergencySharePct: 40,
        patientLoad: 300,
        hasSubstitute: false,
      }),
    ]);
    expect(top).toBeDefined();
    expect(top?.factors).toBeDefined();
    for (const k of ['soonness', 'emergencyShare', 'patientLoad', 'substitute'] as const) {
      expect(typeof top?.factors[k]).toBe('number'); // D-16: machine-readable breakdown
    }
    expect(typeof top?.reason).toBe('string');
    expect(top?.reason).toMatch(/6d/); // stockout days quoted
    expect(top?.reason).toMatch(/40%/); // emergency share quoted
  });

  it('scores are deterministic on identical input and bad input throws (D-20)', () => {
    const input: PrioritySignal[] = [
      sig({ hospitalId: 'a', daysUntilStockout: 3 }),
      sig({ hospitalId: 'b', daysUntilStockout: 9, emergencySharePct: 70 }),
    ];
    const first = rankPriorities(input);
    const second = rankPriorities(input);
    expect(second).toEqual(first); // deterministic
    expect(input).toHaveLength(2); // input not mutated

    // D-20 + T-02-01: guard-clauses throw typed errors on malformed input.
    expect(() =>
      rankPriorities([sig({ daysUntilStockout: -1 })]),
    ).toThrow(EngineInputError);
    expect(() =>
      rankPriorities([sig({ emergencySharePct: 120 })]),
    ).toThrow(EngineInputError);
    expect(() => rankPriorities([sig({ patientLoad: -10 })])).toThrow(
      EngineInputError,
    );
    expect(() => rankPriorities([sig({ hospitalId: '' })])).toThrow(
      EngineInputError,
    );
    expect(() => rankPriorities('nope' as unknown as PrioritySignal[])).toThrow(
      EngineInputError,
    );
  });
});
