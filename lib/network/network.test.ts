/**
 * Pipeline tests: DB-shaped rows -> engine -> ResultsJSON v2. Expected
 * values come from calling the engine functions directly (never re-derived),
 * so these tests pin the wiring, not the engine maths.
 */
import { describe, expect, it } from 'vitest';
import type { EngineInput, LocalEventRow } from '../contracts';
import { forecast } from '../engine/forecast';
import { stockoutRisk } from '../engine/stockout';
import { trendForecast } from '../engine/outbreak';
import { buildResults, demandOver } from './build';
import { daysBetween, historyWindow, interpolateGaps } from './history';
import { isResultsV2 } from './index';
import { AS_OF, DATES, GENERATED, NEAR, baseInput, series } from './test-fixture';

const run = (input = baseInput()) => buildResults(input, { asOf: AS_OF, generatedAt: GENERATED });
const inv = (r: ReturnType<typeof run>, h: string, m: string) =>
  r.inventory.find((e) => e.hospitalId === h && e.medicineId === m)!;

describe('history helpers', () => {
  it('builds a 60-day inclusive window ending at the latest usage date', () => {
    const w = historyWindow('2026-10-07');
    expect(w.dates).toHaveLength(60);
    expect(w.from).toBe('2026-08-09');
    expect(w.to).toBe('2026-10-07');
    expect(daysBetween(w.from, w.to)).toBe(59);
  });

  it('interpolates interior gaps and copies edge gaps', () => {
    expect(interpolateGaps([null, 10, null, 20, null])).toEqual([10, 10, 15, 20, 20]);
    expect(interpolateGaps([1, null, null, 4])).toEqual([1, 2, 3, 4]);
    expect(interpolateGaps([null, null])).toEqual([0, 0]);
    expect(interpolateGaps([NaN, 5])).toEqual([5, 5]);
  });

  it('extends demand beyond 30 days at the 30-day mean', () => {
    const fc = Array.from({ length: 30 }, () => ({ value: 2, advisory: false }));
    expect(demandOver(fc, 10)).toBe(20);
    expect(demandOver(fc, 45)).toBe(90);
    expect(demandOver(fc, 0)).toBe(0);
  });
});

describe('buildResults', () => {
  const r = run();

  it('is a valid v2 envelope with DB ids and names', () => {
    expect(isResultsV2(r)).toBe(true);
    expect(r.asOf).toBe(AS_OF);
    expect(r.generatedAt).toBe(GENERATED);
    expect(r.historyWindow).toEqual({ from: '2026-08-09', to: '2026-10-07' });
    expect(r.hospitals.map((h) => [h.hospitalId, h.hospitalName])).toEqual([
      ['h-a', 'Alpha General'],
      ['h-b', 'Bravo Clinic'],
      ['h-c', 'Charlie Hospital'],
    ]);
    expect(r.inventory).toHaveLength(6);
    expect(r.forecasts).toHaveLength(6);
    expect(r.advisory).toEqual({ fromDay: 15, toDay: 30, label: 'advisory' });
  });

  it('counts only usable stock and uses engine stock-out numbers', () => {
    const a = inv(r, 'h-a', 'm-x');
    expect(a.stock).toBe(100); // expired + archived batches excluded
    expect(a.trend).toEqual([20, 20, 20, 20, 20, 20, 20]); // gaps interpolated
    const expected = stockoutRisk(100, forecast(new Array(60).fill(20)), 10);
    expect(a.daysUntilStockout).toBe(expected.daysUntilStockout);
    expect(a.severity).toBe('critical');
    expect(r.stockoutWarnings).toContainEqual({ hospitalId: 'h-a', medicineId: 'm-x', daysUntilStockout: 5, leadDays: 10 });
    // Charlie/Xamol: 5d cover >= 3d lead, but < lead + 7d buffer -> warning.
    expect(inv(r, 'h-c', 'm-x').severity).toBe('warning');
    expect(inv(r, 'h-b', 'm-x').severity).toBe('ok');
  });

  it('reports the worst waste tier with its expiry', () => {
    const w = r.wasteWarnings.find((x) => x.hospitalId === 'h-b' && x.medicineId === 'm-x')!;
    // 600 units expire in 20 days; 20 x 10/day are used first.
    expect(w).toMatchObject({ wasteUnits: 400, expiryDate: NEAR, expiryDays: 20, severity: 'critical' });
  });

  it('suggests a waste-first transfer that covers the exact need', () => {
    // need = demand over lead 10 + buffer 7 days (20/day) - stock 100 = 240.
    const t = r.transfers.find((x) => x.toHospital === 'h-a' && x.medicineId === 'm-x')!;
    expect(t).toMatchObject({ fromHospital: 'h-b', qty: 240, transportDays: 1 });
    expect(t.checksPassed).toHaveLength(5);
    expect(t.checksPassed[0]).toBe('Arrives in 1d, before Alpha General runs out in 5d');
    expect(t.checksPassed[3]).toBe("Within Alpha General's need of 240 units");
    expect(t.checksPassed[4]).toBe('Waste-first: 400 units would expire unused at Bravo Clinic');
  });

  it('orders from the supplier when no sender can arrive in time', () => {
    // Alpha/Yorin has no stock (0d cover): no transfer can arrive before stock-out.
    const o = r.emergencyOrders.find((x) => x.hospitalId === 'h-a' && x.medicineId === 'm-y')!;
    expect(o).toMatchObject({ qty: 60, leadDays: 5 }); // 5/day x (5 lead + 7 buffer)
    expect(r.transfers.some((x) => x.toHospital === 'h-a' && x.medicineId === 'm-y')).toBe(false);
  });

  it('switches outbreak series to the trend forecast', () => {
    const f = r.forecasts.find((x) => x.hospitalId === 'h-c' && x.medicineId === 'm-y')!;
    expect(f.outbreak).toBe(true);
    expect(f.mode).toBe('trend');
    const history = DATES.map((_, i) => (i >= 58 ? 50 : 5));
    expect(f.forecast.map((p) => p.demand)).toEqual(trendForecast(history).map((d) => d.value));
    expect(r.hospitals.find((h) => h.hospitalId === 'h-c')!.outbreak).toBe(true);
    expect(f.forecast[0].date).toBe('2026-10-08');
    expect(f.forecast[13].advisory).toBe(false);
    expect(f.forecast[14].advisory).toBe(true);
  });

  it('ranks priorities globally and rolls the top score up per hospital', () => {
    expect(r.priorities.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    const scores = r.priorities.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    for (const h of r.hospitals) {
      const top = Math.max(...r.priorities.filter((p) => p.hospitalId === h.hospitalId).map((p) => p.score));
      expect(h.riskScore).toBe(top);
    }
    // One patient load per hospital-day, not summed across medicine rows.
    expect(r.hospitals.find((h) => h.hospitalId === 'h-a')!.patientLoad).toBe(100);
  });

  it('never lets two receivers claim the same surplus', () => {
    const input = baseInput();
    // Alpha (40/day, lead 30d) needs 40 x 37 - 100 = 1380 units, more than
    // Bravo can spare; Charlie (lead 6d > 5d cover) also needs Xamol.
    input.usage = [
      ...input.usage.filter((u) => !(u.hospitalId === 'h-a' && u.medicineId === 'm-x')),
      ...series('h-a', 'm-x', () => 40),
    ];
    input.leads = input.leads.map((l) =>
      l.hospitalId === 'h-a' && l.medicineId === 'm-x'
        ? { ...l, leadDays: 30 }
        : l.hospitalId === 'h-c' && l.medicineId === 'm-x'
          ? { ...l, leadDays: 6 }
          : l,
    );
    const res = run(input);
    const fromBravo = res.transfers.filter((t) => t.fromHospital === 'h-b' && t.medicineId === 'm-x');
    // Bravo can spare stock 1000 - 7 x 10/day = 930 units in total; Alpha
    // (most urgent) takes all of it, so Charlie gets nothing from Bravo.
    expect(fromBravo.map((t) => [t.toHospital, t.qty])).toEqual([['h-a', 930]]);
    expect(res.emergencyOrders).toContainEqual(
      expect.objectContaining({ hospitalId: 'h-a', medicineId: 'm-x', qty: 450 }),
    );
    expect(res.emergencyOrders).toContainEqual(
      expect.objectContaining({ hospitalId: 'h-c', medicineId: 'm-x', qty: 80 }),
    );
  });

  it('is deterministic for the same input', () => {
    expect(run()).toEqual(run());
  });
});

describe('local-event uplift wiring (EVT-03)', () => {
  const COORDS: Record<string, { latitude: number; longitude: number }> = {
    'h-a': { latitude: 12.933, longitude: 74.818 }, // ~1 km from the flood
    'h-b': { latitude: 12.8703, longitude: 74.8436 }, // ~7.7 km: outside
    'h-c': { latitude: 12.8605, longitude: 74.8835 }, // outside
  };
  const flood: LocalEventRow = {
    id: 'ev-000000000001',
    type: 'flood',
    latitude: 12.94,
    longitude: 74.825,
    radiusKm: 4,
    startsOn: '2026-10-08', // forecast day 0 (day after the last usage row)
    endsOn: '2026-10-22', // forecast day 14
    severity: 2,
    source: 'manual',
    note: null,
  };
  const located = (events: LocalEventRow[] = []): EngineInput => {
    const base = baseInput();
    return {
      ...base,
      hospitals: base.hospitals.map((h) => ({ ...h, ...COORDS[h.id] })),
      medicines: base.medicines.map((m) => (m.id === 'm-x' ? { ...m, category: 'rehydration' } : m)),
      events,
    };
  };
  const fcOf = (r: ReturnType<typeof run>, h: string, m: string) =>
    r.forecasts.find((f) => f.hospitalId === h && f.medicineId === m)!;

  it('no events: identical output, with empty eventReasons and events', () => {
    const plain = run();
    expect(run({ ...baseInput(), events: [] })).toEqual(plain);
    expect(plain.forecasts.every((f) => Array.isArray(f.eventReasons) && f.eventReasons.length === 0)).toBe(true);
    expect(plain.hospitals.every((h) => Array.isArray(h.events) && h.events.length === 0)).toBe(true);
  });

  it('a nearby flood multiplies only the covered days and pulls the stock-out earlier', () => {
    const without = run(located());
    const withFlood = run(located([flood]));
    const a0 = fcOf(without, 'h-a', 'm-x');
    const a1 = fcOf(withFlood, 'h-a', 'm-x');
    a1.forecast.forEach((d, i) => {
      const expected = i <= 14 ? Math.round(a0.forecast[i].demand * 1.8 * 10) / 10 : a0.forecast[i].demand;
      expect(d.demand).toBe(expected);
      expect(d.advisory).toBe(a0.forecast[i].advisory);
    });
    expect(a1.eventReasons).toHaveLength(1);
    expect(a1.eventReasons![0]).toMatch(/^\+80% rehydration demand: Flood, \d+(\.\d)? km away, until 2026-10-22$/);
    expect(inv(withFlood, 'h-a', 'm-x').daysUntilStockout).toBeLessThan(inv(without, 'h-a', 'm-x').daysUntilStockout);
    const ha = withFlood.hospitals.find((h) => h.hospitalId === 'h-a')!;
    expect(ha.events).toHaveLength(1);
    expect(ha.events![0]).toMatchObject({ eventId: flood.id, type: 'flood', severity: 2 });
    // Outside the radius: unchanged.
    for (const h of ['h-b', 'h-c']) {
      expect(fcOf(withFlood, h, 'm-x')).toEqual(fcOf(without, h, 'm-x'));
      expect(withFlood.hospitals.find((x) => x.hospitalId === h)!.events).toEqual([]);
    }
    // Non-rehydration medicine at h-a: unchanged.
    expect(fcOf(withFlood, 'h-a', 'm-y')).toEqual(fcOf(without, 'h-a', 'm-y'));
  });

  it('an ended event changes nothing', () => {
    const ended = { ...flood, startsOn: '2026-09-20', endsOn: '2026-10-08' };
    expect(run(located([ended]))).toEqual(run(located()));
  });
});
