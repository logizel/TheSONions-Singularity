import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ResultsJSON } from '../contracts';
import { cardSentence, coverSentence, demandSentences, hospitalSummary, networkSummary, prioritySentences, runDownSentences } from './explain';
import { buildHospitalCards, buildHospitalInsight, horizonFor, runDown } from './view';

const r = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'data', 'results.json'), 'utf8')) as ResultsJSON;

describe('runDown', () => {
  it('depletes day by day against the forecast and stops at zero', () => {
    const fc = Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, demand: 10, advisory: i >= 14 }));
    const rd = runDown(35, fc, 30);
    expect(rd.map((p) => p.stock)).toEqual([35, 25, 15, 5, 0]);
  });

  it('continues past day 30 at the mean daily rate', () => {
    const fc = Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, demand: 2, advisory: false }));
    const rd = runDown(100, fc, 60);
    expect(rd[30].stock).toBe(40);
    expect(rd[rd.length - 1].stock).toBe(0);
    expect(rd.length - 1).toBe(50);
  });

  it('agrees with the engine: reaches zero within a day of daysUntilStockout', () => {
    for (const e of r.inventory) {
      const fc = r.forecasts.find((f) => f.hospitalId === e.hospitalId && f.medicineId === e.medicineId)!.forecast;
      const rd = runDown(e.stock, fc, 200);
      const zero = rd.findIndex((p) => p.stock === 0);
      if (e.daysUntilStockout < 90 && zero > 0) expect(Math.abs(zero - 1 - e.daysUntilStockout)).toBeLessThanOrEqual(1);
    }
  });

  it('horizon covers lead + buffer and the stock-out day, 30..60', () => {
    expect(horizonFor({ leadDays: 21, bufferDays: 7, daysUntilStockout: 10 })).toBe(32);
    expect(horizonFor({ leadDays: 5, bufferDays: 7, daysUntilStockout: 300 })).toBe(60);
    expect(horizonFor({ leadDays: 5, bufferDays: 2, daysUntilStockout: 3 })).toBe(30);
  });
});

describe('hospital insight', () => {
  const h = buildHospitalInsight(r, 'h-north', null)!;

  it('builds every medicine, worst first, with transfers attached', () => {
    expect(h.medicines).toHaveLength(5);
    expect(h.medicines[0].severity).toBe('critical');
    expect(h.level).toBe('critical');
    expect(h.medicines[0].transfersIn.length).toBeGreaterThan(0);
    expect(h.historyAvailable).toBe(false);
    expect(buildHospitalInsight(r, 'nope', null)).toBeNull();
  });

  it('explains in plain words with the same numbers as the charts', () => {
    const m = h.medicines[0];
    const s = coverSentence(m);
    expect(s).toContain(`${m.daysUntilStockout} days`);
    expect(s).toContain(`${m.leadDays} days`);
    expect(s).toContain(`${m.leadDays - m.daysUntilStockout} days before`);
    expect(demandSentences(m, h.name).join(' ')).toContain(`${m.mapePct}%`);
    expect(runDownSentences(m, r.asOf, (id) => id).join(' ')).toContain('in stock today');
    expect(hospitalSummary(h)[0]).toMatch(/of 5 medicines/);
    expect(prioritySentences(h, (id) => id)[0]).toMatch(/#1 of/);
  });
});

describe('network cards', () => {
  const cards = buildHospitalCards(r);
  it('one card per hospital, worst first, with a sentence each', () => {
    expect(cards).toHaveLength(r.hospitals.length);
    expect(cards[0].level).toBe('critical');
    for (const c of cards) expect(cardSentence(c).length).toBeGreaterThan(10);
    expect(networkSummary(cards)).toMatch(/hospitals/);
  });
});

import { dateRange, seriesFromRows } from './history';

describe('history series', () => {
  it('aligns to the calendar and flags filled gaps', () => {
    const dates = dateRange('2026-10-01', '2026-10-04');
    expect(dates).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    const s = seriesFromRows(
      [
        { usageDate: '2026-10-01', medicineId: 'm', usedQty: 10 },
        { usageDate: '2026-10-02', medicineId: 'm', usedQty: null },
        { usageDate: '2026-10-04', medicineId: 'm', usedQty: 16 },
      ],
      dates,
      ['m'],
    ).m;
    expect(s.map((p) => p.value)).toEqual([10, 12, 14, 16]);
    expect(s.map((p) => p.filled)).toEqual([false, true, true, false]);
  });
});
