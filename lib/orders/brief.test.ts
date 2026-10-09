import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ResultsJSON } from '../contracts';
import { addDays } from '../insights/explain';
import { runDown } from '../insights/view';
import { BRIEF_HORIZON_DAYS, buildDecisionBrief, type BriefInput } from './brief';

const r = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'data', 'results.json'), 'utf8')) as ResultsJSON;
const round1 = (n: number) => Math.round(n * 10) / 10;
const flat = (v: number) => Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, demand: v, advisory: i >= 14 }));

const t0 = r.transfers[0];
const transferInput: BriefInput = {
  kind: 'transfer',
  fromHospital: t0.fromHospital,
  toHospital: t0.toHospital,
  medicineId: t0.medicineId,
  qty: t0.qty,
  arriveDays: t0.transportDays,
};

describe('runDown with an arrival', () => {
  it('is unchanged without an arrival', () => {
    expect(runDown(35, flat(10), 30).map((p) => p.stock)).toEqual([35, 25, 15, 5, 0]);
  });

  it('keeps going through the zero stretch until the arrival day, then stops at the next zero', () => {
    const rd = runDown(35, flat(10), 30, { day: 5, qty: 40 });
    expect(rd.map((p) => p.stock)).toEqual([35, 25, 15, 5, 0, 30, 20, 10, 0]);
    expect(rd[rd.length - 1].day).toBe(8);
  });

  it('day-0 arrival is already on the shelf at point 0', () => {
    const rd = runDown(35, flat(10), 30, { day: 0, qty: 40 });
    expect(rd[0].stock).toBe(75);
    expect(rd.findIndex((p) => p.stock === 0)).toBe(8);
  });
});

describe('buildDecisionBrief: transfer', () => {
  const b = buildDecisionBrief(r, transferInput);

  it('fixture sanity', () => {
    expect(t0.fromHospital).toBe('h-civil');
    expect(t0.toHospital).toBe('h-north');
    expect(t0.medicineId).toBe('m-para');
  });

  it('receiver numbers are the engine numbers verbatim', () => {
    const rc = b.receiver!;
    expect(rc).not.toBeNull();
    expect(rc.stock).toBe(399);
    expect(rc.dailyDemand).toBe(39.9);
    expect(rc.daysUntilStockout).toBe(10);
    expect(rc.leadDays).toBe(21);
    expect(rc.bufferDays).toBe(7);
    expect(rc.needDays).toBe(28);
    expect(rc.severity).toBe('critical');
    expect(rc.trend).toHaveLength(7);
    expect(rc.trend.map((p) => p.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
    expect(rc.trend.map((p) => p.value)).toEqual([41, 43, 23, 25, 32, 39, 49]);
    expect(rc.trend.every((p) => p.filled === false)).toBe(true);
    expect(rc.forecast).toHaveLength(30);
  });

  it('receiver priority matches the priorities entry', () => {
    const p = r.priorities.find((x) => x.hospitalId === 'h-north' && x.medicineId === 'm-para')!;
    expect(b.receiver!.priority).toEqual({ rank: p.rank, score: p.score, reasons: p.reasons, of: r.priorities.length });
  });

  it('sender: stock now (engine) and about stock after', () => {
    const inv = r.inventory.find((e) => e.hospitalId === 'h-civil' && e.medicineId === 'm-para')!;
    const s = b.sender!;
    expect(s).not.toBeNull();
    expect(s.hospitalId).toBe('h-civil');
    expect(s.stockNow).toBe(inv.stock);
    expect(s.stockAfter).toBe(round1(inv.stock - 521.4));
    expect(s.dailyDemand).toBe(inv.dailyDemand);
    expect(s.coverDaysAfter).toBe(Math.floor(s.stockAfter / inv.dailyDemand));
    expect(s.nearestExpiry).toBe(inv.nearestExpiry);
    expect(s.wasteUnits).toBe(0);
    expect(s.wasteExpiry).toBeNull();
    expect(s.wasteAfter).toBe(0);
  });

  it('without = engine day verbatim; with = later (or lasts past the horizon)', () => {
    expect(b.without.day).toBe(10);
    expect(b.without.date).toBe(addDays(r.asOf, 10));
    if (b.with.date === null) {
      expect(b.with.lastsPast).toBe(addDays(r.asOf, BRIEF_HORIZON_DAYS));
    } else {
      expect(b.with.day!).toBeGreaterThan(b.without.day!);
      expect(b.with.date).toBe(addDays(r.asOf, b.with.day!));
      expect(b.with.lastsPast).toBeNull();
    }
    expect(b.with.gapDays).toBe(0);
    expect(b.horizon).toBe(BRIEF_HORIZON_DAYS);
    expect(b.asOf).toBe(r.asOf);
    expect(b.advisoryFromDay).toBe(r.advisory.fromDay);
  });
});

describe('buildDecisionBrief: supplier order', () => {
  const o = r.emergencyOrders[0];
  const b = buildDecisionBrief(r, { kind: 'supplier', toHospital: o.hospitalId, medicineId: o.medicineId, qty: o.qty, arriveDays: o.leadDays });

  it('has no sender and arrives after the lead time', () => {
    expect(o.leadDays).toBe(21);
    expect(b.sender).toBeNull();
    expect(b.arriveDays).toBe(21);
    expect(b.receiver).not.toBeNull();
  });

  it('runs out before the order arrives, so there is a gap', () => {
    expect(b.without.day).toBe(10);
    expect(b.with.gapDays).toBeGreaterThan(0);
    if (b.with.day !== null) expect(b.with.day).toBeGreaterThanOrEqual(21);
  });

  it('a supplier input with a fromHospital still has no sender', () => {
    const b2 = buildDecisionBrief(r, { kind: 'supplier', fromHospital: 'h-civil', toHospital: o.hospitalId, medicineId: o.medicineId, qty: o.qty, arriveDays: o.leadDays });
    expect(b2.sender).toBeNull();
  });
});

describe('buildDecisionBrief: sender waste', () => {
  it('sums the pair waste warnings and reports the earliest expiry', () => {
    const clone = JSON.parse(JSON.stringify(r)) as ResultsJSON;
    clone.wasteWarnings.push({ hospitalId: 'h-civil', medicineId: 'm-para', wasteUnits: 100, expiryDate: '2026-10-25', expiryDays: 17, severity: 'warning' });
    const s = buildDecisionBrief(clone, transferInput).sender!;
    expect(s.wasteUnits).toBe(100);
    expect(s.wasteExpiry).toBe('2026-10-25');
    expect(s.wasteAfter).toBe(Math.max(0, round1(100 - 521.4)));
    expect(s.wasteAfter).toBe(0);
  });

  it('wasteAfter stays positive when the transfer is smaller than the waste', () => {
    const clone = JSON.parse(JSON.stringify(r)) as ResultsJSON;
    clone.wasteWarnings.push({ hospitalId: 'h-civil', medicineId: 'm-para', wasteUnits: 600, expiryDate: '2026-10-25', expiryDays: 17, severity: 'warning' });
    expect(buildDecisionBrief(clone, transferInput).sender!.wasteAfter).toBe(round1(600 - 521.4));
  });
});

describe('buildDecisionBrief: missing data', () => {
  it('unknown medicine gives a null receiver and does not throw', () => {
    const b = buildDecisionBrief(r, { ...transferInput, medicineId: 'm-nope' });
    expect(b.receiver).toBeNull();
    expect(b.sender).toBeNull();
    expect(b.without).toEqual({ day: null, date: null });
    expect(b.with).toEqual({ day: null, date: null, lastsPast: null, gapDays: 0 });
  });
});
