/**
 * Order lifecycle, idempotency keys and demo-clock ETA/progress (Phase 6, D-08/D-10).
 */
import { describe, expect, it } from 'vitest';

import { bearingAlongPath, pathLengthM, splitPathAt, type LatLngTuple } from '../geo';
import {
  baseOfLineKey,
  fnv1a64,
  lineIdFor,
  lineIdempotencyKey,
  nextAttempt,
  orderForTransfer,
  orderIdFor,
  orderIdempotencyKey,
  transferBaseKey,
} from './keys';
import {
  DAY_MS,
  DEFAULT_SPEED,
  anchorFromDispatch,
  fmtSimDuration,
  reanchor,
  remainingDistanceM,
  remainingMs,
  simElapsedMs,
  tripDurationMs,
  tripProgress,
} from './sim';
import { checkTransition, isOrderStatus, nextAction, stepperView } from './state';
import type { Order } from './types';

const T = { fromHospital: 'h-civil', toHospital: 'h-north', medicineId: 'm-para' };

function order(over: Partial<Order> & { key?: string } = {}): Order {
  const key = over.key ?? transferBaseKey('2026-10-08', T);
  return {
    id: 'ord-1',
    fromHospital: T.fromHospital,
    toHospital: T.toHospital,
    status: 'accepted',
    transportDays: 1,
    asOf: '2026-10-08',
    suggestedAt: '2026-10-08T21:40:00.000Z',
    acceptedAt: '2026-10-08T21:42:00.000Z',
    packedAt: null,
    inTransitAt: null,
    deliveredAt: null,
    cancelledAt: null,
    lines: [{ id: 'ol-1', orderId: 'ord-1', medicineId: T.medicineId, qty: 521.4, suggestedQty: 521.4, idempotencyKey: key, checksPassed: [] }],
    ...over,
  };
}

describe('order state machine', () => {
  it('walks the happy path one step at a time', () => {
    expect(checkTransition('accepted', 'packed')).toEqual({ kind: 'apply' });
    expect(checkTransition('packed', 'in_transit')).toEqual({ kind: 'apply' });
    expect(checkTransition('in_transit', 'delivered')).toEqual({ kind: 'apply' });
  });

  it('rejects skips, reversals and moves out of final states', () => {
    expect(checkTransition('accepted', 'in_transit').kind).toBe('invalid');
    expect(checkTransition('accepted', 'delivered').kind).toBe('invalid');
    expect(checkTransition('in_transit', 'packed').kind).toBe('invalid');
    expect(checkTransition('delivered', 'cancelled').kind).toBe('invalid');
    expect(checkTransition('cancelled', 'accepted').kind).toBe('invalid');
  });

  it('cancels from every open state', () => {
    for (const s of ['accepted', 'packed', 'in_transit'] as const) {
      expect(checkTransition(s, 'cancelled')).toEqual({ kind: 'apply' });
    }
  });

  it('treats a repeat of the current state as an idempotent no-op', () => {
    expect(checkTransition('packed', 'packed')).toEqual({ kind: 'noop' });
    expect(checkTransition('delivered', 'delivered')).toEqual({ kind: 'noop' });
  });

  it('offers exactly one forward action per open state', () => {
    expect(nextAction('accepted')).toEqual({ to: 'packed', label: 'Mark packed' });
    expect(nextAction('packed')).toEqual({ to: 'in_transit', label: 'Dispatch' });
    expect(nextAction('in_transit')).toEqual({ to: 'delivered', label: 'Mark delivered' });
    expect(nextAction('delivered')).toBeNull();
    expect(nextAction('cancelled')).toBeNull();
  });

  it('validates status strings', () => {
    expect(isOrderStatus('in_transit')).toBe(true);
    expect(isOrderStatus('suggested')).toBe(false);
    expect(isOrderStatus('shipped')).toBe(false);
    expect(isOrderStatus(3)).toBe(false);
  });

  it('builds the stepper with timestamps for reached steps only', () => {
    const v = stepperView(order({ status: 'packed', packedAt: '2026-10-08T22:00:00.000Z' }));
    expect(v.map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(v[0].at).toBe('2026-10-08T21:40:00.000Z');
    expect(v[2].at).toBe('2026-10-08T22:00:00.000Z');
    expect(v[3].at).toBeNull();
    const done = stepperView(order({ status: 'delivered', packedAt: 'a', inTransitAt: 'b', deliveredAt: 'c' }));
    expect(done.every((s) => s.state === 'done')).toBe(true);
  });

  it('marks unreached steps of a cancelled order', () => {
    const v = stepperView(order({ status: 'cancelled', packedAt: '2026-10-08T22:00:00.000Z', cancelledAt: 'x' }));
    expect(v.map((s) => s.state)).toEqual(['done', 'done', 'done', 'not-reached', 'not-reached']);
  });
});

describe('idempotency keys', () => {
  it('derives the same key for the same suggestion and day', () => {
    expect(transferBaseKey('2026-10-08', T)).toBe('xfer:2026-10-08:h-civil:h-north:m-para');
    expect(transferBaseKey('2026-10-08', { ...T })).toBe(transferBaseKey('2026-10-08', T));
    expect(transferBaseKey('2026-10-09', T)).not.toBe(transferBaseKey('2026-10-08', T));
  });

  it('numbers re-accepts after a cancel and strips the attempt back off', () => {
    const base = transferBaseKey('2026-10-08', T);
    expect(lineIdempotencyKey(base, 0)).toBe(base);
    expect(lineIdempotencyKey(base, 2)).toBe(`${base}#2`);
    expect(baseOfLineKey(`${base}#2`)).toBe(base);
    expect(nextAttempt([order({ status: 'cancelled' })], base)).toBe(1);
    expect(nextAttempt([order({ status: 'accepted' })], base)).toBe(0);
  });

  it('order key and ids are order-independent and stable', () => {
    expect(orderIdempotencyKey(['b', 'a'])).toBe(orderIdempotencyKey(['a', 'b']));
    expect(orderIdFor('a|b')).toBe(orderIdFor('a|b'));
    expect(orderIdFor('a|b')).toMatch(/^ord-[0-9a-f]{12}$/);
    expect(lineIdFor('x')).toMatch(/^ol-[0-9a-f]{12}$/);
    expect(orderIdFor('a|b')).not.toBe(orderIdFor('a|c'));
  });

  it('FNV-1a 64 matches the reference vectors', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
  });

  it('matches an open order on the lane first, else today’s latest', () => {
    const open = order({ id: 'ord-old', asOf: '2026-10-07', key: transferBaseKey('2026-10-07', T), status: 'in_transit' });
    const cancelledToday = order({ id: 'ord-c', status: 'cancelled' });
    expect(orderForTransfer([cancelledToday, open], T, '2026-10-08')?.order.id).toBe('ord-old');
    expect(orderForTransfer([cancelledToday], T, '2026-10-08')?.order.id).toBe('ord-c');
    const deliveredYesterday = order({ id: 'ord-y', status: 'delivered', key: transferBaseKey('2026-10-07', T) });
    expect(orderForTransfer([deliveredYesterday], T, '2026-10-08')).toBeNull();
    expect(orderForTransfer([open], { ...T, medicineId: 'm-ors' }, '2026-10-08')).toBeNull();
  });
});

describe('demo clock: ETA and progress', () => {
  it('runs a 2-day transfer in about a minute at the default speed', () => {
    const dur = tripDurationMs(2, 900);
    expect(dur).toBe(2 * DAY_MS);
    expect(dur / DEFAULT_SPEED).toBe(60_000);
  });

  it('uses road time only for a same-day window, else a 1 h fallback', () => {
    expect(tripDurationMs(0, 780)).toBe(780_000);
    expect(tripDurationMs(0, null)).toBe(3_600_000);
  });

  it('interpolates progress, remaining time and distance linearly', () => {
    const dur = DAY_MS;
    const anchor = anchorFromDispatch(1_000_000, 1_000_000 + 15_000, DEFAULT_SPEED);
    const sim = simElapsedMs(anchor, 1_000_000 + 15_000, DEFAULT_SPEED, false);
    const p = tripProgress('in_transit', sim, dur);
    expect(p).toBeCloseTo(0.5, 10);
    expect(remainingMs(p, dur)).toBeCloseTo(DAY_MS / 2, 3);
    expect(remainingDistanceM(p, 9960)).toBeCloseTo(4980, 6);
  });

  it('clamps at both ends and pins non-moving states', () => {
    expect(tripProgress('in_transit', -5, 100)).toBe(0);
    expect(tripProgress('in_transit', 500, 100)).toBe(1);
    expect(tripProgress('accepted', 500, 100)).toBe(0);
    expect(tripProgress('packed', 500, 100)).toBe(0);
    expect(tripProgress('delivered', 0, 100)).toBe(1);
    expect(remainingMs(1.2, 100)).toBe(0);
  });

  it('pauses and re-anchors without jumping', () => {
    const a = anchorFromDispatch(0, 10_000, 1440);
    const paused = simElapsedMs(a, 50_000, 1440, true);
    expect(paused).toBe(a.simMs);
    const before = simElapsedMs(a, 20_000, 1440, false);
    const b = reanchor(a, 20_000, 1440, false);
    expect(simElapsedMs(b, 20_000, 8640, false)).toBe(before);
    expect(simElapsedMs(b, 21_000, 8640, false)).toBe(before + 8_640_000);
  });

  it('formats simulated durations', () => {
    expect(fmtSimDuration(0)).toBe('0 min');
    expect(fmtSimDuration(11.2 * 60_000)).toBe('12 min');
    expect(fmtSimDuration(200 * 60_000)).toBe('3 h 20 min');
    expect(fmtSimDuration(DAY_MS + 4 * 3_600_000)).toBe('1 d 04 h');
  });
});

describe('path split and bearing', () => {
  const path: LatLngTuple[] = [
    [12.87, 74.84],
    [12.88, 74.84],
    [12.88, 74.86],
  ];

  it('splits into travelled + remaining that share the split point', () => {
    const { travelled, remaining } = splitPathAt(path, 0.5);
    expect(travelled[travelled.length - 1]).toEqual(remaining[0]);
    const total = pathLengthM(path);
    expect(pathLengthM(travelled) + pathLengthM(remaining)).toBeCloseTo(total, 3);
    expect(pathLengthM(travelled)).toBeCloseTo(total / 2, 3);
  });

  it('handles the ends', () => {
    expect(splitPathAt(path, 0).remaining).toHaveLength(3);
    expect(splitPathAt(path, 1).travelled).toHaveLength(3);
    expect(splitPathAt([], 0.5)).toEqual({ travelled: [], remaining: [] });
  });

  it('points north on the first leg and east on the second', () => {
    expect(bearingAlongPath(path, 0.1)).toBeCloseTo(0, 0);
    expect(bearingAlongPath(path, 0.9)).toBeCloseTo(90, 0);
  });
});
