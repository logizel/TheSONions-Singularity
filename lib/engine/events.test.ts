/**
 * Local-event uplift tests (EVT-02): rulebook, radius in/out, date window,
 * overlap takes the max (never stacks), untouched categories, reason format,
 * and guard clauses. Coordinates are the real demo seed hospitals.
 */
import { describe, expect, it } from 'vitest';
import type { HospitalRow, LocalEventRow } from '../contracts';
import { EngineInputError } from './errors';
import { applyEventUplift, eventsAffecting, upliftFor, type AffectingEvent } from './events';
import { ADVISORY_FROM_DAY, FORECAST_DAYS, type ForecastDay } from './types';
import { dayNumber, isoFromDayNumber } from '../network/history';

const ASOF = '2026-10-09';
const north: HospitalRow = { id: 'h-north', name: 'Northgate', latitude: 12.933, longitude: 74.818 };
const civil: HospitalRow = { id: 'h-civil', name: 'Civil', latitude: 12.8703, longitude: 74.8436 };

const plus = (iso: string, n: number) => isoFromDayNumber(dayNumber(iso) + n);

const ev = (over: Partial<LocalEventRow> = {}): LocalEventRow => ({
  id: 'ev-flood',
  type: 'flood',
  latitude: 12.94,
  longitude: 74.825,
  radiusKm: 4,
  startsOn: ASOF,
  endsOn: plus(ASOF, 14),
  severity: 2,
  source: 'manual',
  note: null,
  ...over,
});

const flat = (v = 10): ForecastDay[] =>
  Array.from({ length: FORECAST_DAYS }, (_, i) => ({ value: v, advisory: i + 1 >= ADVISORY_FROM_DAY }));

const affecting = (e: LocalEventRow, distanceKm = 1.2): AffectingEvent => ({ ...e, distanceKm });

describe('upliftFor (rulebook scaled by severity)', () => {
  it('flood x rehydration: 1.4 / 1.8 / 2.2 for severity 1 / 2 / 3', () => {
    expect(upliftFor('flood', 'rehydration', 1)).toBe(1.4);
    expect(upliftFor('flood', 'rehydration', 2)).toBe(1.8);
    expect(upliftFor('flood', 'rehydration', 3)).toBe(2.2);
  });

  it('hormone, "other" and unknown categories stay at x1', () => {
    for (const t of ['flood', 'heatwave', 'cyclone', 'earthquake', 'epidemic', 'festival', 'other'] as const) {
      expect(upliftFor(t, 'hormone', 3)).toBe(1);
    }
    expect(upliftFor('other', 'rehydration', 3)).toBe(1);
    expect(upliftFor('flood', 'no-such-category', 2)).toBe(1);
  });
});

describe('eventsAffecting (radius + date window)', () => {
  it('includes a hospital ~1 km from the centre with distance at 1 decimal', () => {
    const out = eventsAffecting(north, [ev()], ASOF);
    expect(out).toHaveLength(1);
    expect(out[0].distanceKm).toBeGreaterThan(0.5);
    expect(out[0].distanceKm).toBeLessThan(1.5);
    expect(Math.round(out[0].distanceKm * 10)).toBe(out[0].distanceKm * 10);
  });

  it('excludes a hospital outside the radius (h-civil is ~7.7 km away)', () => {
    expect(eventsAffecting(civil, [ev()], ASOF)).toEqual([]);
  });

  it('excludes a hospital without coordinates', () => {
    expect(eventsAffecting({ id: 'h-x', name: 'X' }, [ev()], ASOF)).toEqual([]);
    expect(eventsAffecting({ id: 'h-x', name: 'X', latitude: null, longitude: null }, [ev()], ASOF)).toEqual([]);
  });

  it('date window: ended excluded, asOf+29 included, asOf+30 excluded', () => {
    const ended = ev({ id: 'a-ended', startsOn: '2026-10-01', endsOn: '2026-10-08' });
    const lastIn = ev({ id: 'b-upcoming', startsOn: '2026-11-07', endsOn: '2026-11-20' });
    const tooLate = ev({ id: 'c-late', startsOn: '2026-11-08', endsOn: '2026-11-20' });
    const out = eventsAffecting(north, [tooLate, lastIn, ended], ASOF);
    expect(out.map((e) => e.id)).toEqual(['b-upcoming']);
  });

  it('sorts by id', () => {
    const out = eventsAffecting(north, [ev({ id: 'z' }), ev({ id: 'a' }), ev({ id: 'm' })], ASOF);
    expect(out.map((e) => e.id)).toEqual(['a', 'm', 'z']);
  });

  it('throws EngineInputError on invalid events', () => {
    expect(() => eventsAffecting(north, [ev({ severity: 4 })], ASOF)).toThrow(EngineInputError);
    expect(() => eventsAffecting(north, [ev({ startsOn: '2026-10-10', endsOn: '2026-10-09' })], ASOF)).toThrow(
      EngineInputError,
    );
    expect(() => eventsAffecting(north, [ev({ latitude: Number.NaN })], ASOF)).toThrow(EngineInputError);
    expect(() => eventsAffecting(north, [ev({ radiusKm: 0 })], ASOF)).toThrow(EngineInputError);
  });
});

describe('applyEventUplift (covered days only, overlap max)', () => {
  const start = ASOF;

  it('multiplies only the covered days; advisory kept; input not mutated', () => {
    const fc = flat();
    const before = JSON.stringify(fc);
    const e = affecting(ev({ startsOn: plus(start, 3), endsOn: plus(start, 9) }));
    const out = applyEventUplift(fc, 'rehydration', [e], start);
    out.fc.forEach((d, i) => {
      expect(d.value).toBe(i >= 3 && i <= 9 ? 18 : 10);
      expect(d.advisory).toBe(fc[i].advisory);
    });
    expect(JSON.stringify(fc)).toBe(before);
    expect(out.reasons).toHaveLength(1);
  });

  it('overlapping events take the max, never stack', () => {
    const flood = affecting(ev({ id: 'ev-a' }));
    const heat = affecting(ev({ id: 'ev-b', type: 'heatwave' }));
    const out = applyEventUplift(flat(), 'rehydration', [flood, heat], start);
    expect(out.fc[0].value).toBe(18);
    expect(out.fc[0].value).not.toBe(28.8);
    expect(out.reasons).toHaveLength(2);
    expect(out.reasons[0]).toContain('+80% rehydration demand: Flood');
    expect(out.reasons[1]).toContain('+60% rehydration demand: Heat wave');
  });

  it('a category with no rule (hormone) is unchanged with no reasons', () => {
    const fc = flat();
    const out = applyEventUplift(fc, 'hormone', [affecting(ev())], start);
    expect(out.fc).toEqual(fc);
    expect(out.reasons).toEqual([]);
  });

  it('reason format: active event and upcoming event', () => {
    const active = applyEventUplift(flat(), 'rehydration', [affecting(ev({ endsOn: '2026-10-23' }))], start);
    expect(active.reasons).toEqual(['+80% rehydration demand: Flood, 1.2 km away, until 2026-10-23']);
    const upcoming = applyEventUplift(
      flat(),
      'rehydration',
      [affecting(ev({ startsOn: '2026-10-12', endsOn: '2026-10-23' }))],
      start,
    );
    expect(upcoming.reasons).toEqual([
      '+80% rehydration demand: Flood, 1.2 km away, from 2026-10-12 until 2026-10-23',
    ]);
  });
});
