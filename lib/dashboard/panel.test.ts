import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ResultsJSON } from '../contracts';
import { fmtDate, isTabKey, scopeResults, shortName, signed, tabFigures, unitLabel } from './panel';

const results = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'data', 'results.json'), 'utf8')) as ResultsJSON;

describe('scopeResults', () => {
  it('keeps everything unfiltered, sorted Critical -> Low -> OK then cover', () => {
    const s = scopeResults(results, null);
    expect(s.inventory).toHaveLength(results.inventory.length);
    const order = { critical: 0, warning: 1, ok: 2 } as const;
    for (let i = 1; i < s.inventory.length; i++) {
      const a = s.inventory[i - 1];
      const b = s.inventory[i];
      expect(order[a.severity] < order[b.severity] || (a.severity === b.severity && a.daysUntilStockout <= b.daysUntilStockout)).toBe(true);
    }
    expect(s.priorities.map((p) => p.rank)).toEqual([...s.priorities.map((p) => p.rank)].sort((a, b) => a - b));
  });

  it('filters every section to one hospital; transfers match sender or receiver', () => {
    const s = scopeResults(results, 'h-north');
    expect(s.inventory.every((e) => e.hospitalId === 'h-north')).toBe(true);
    expect(s.priorities.every((p) => p.hospitalId === 'h-north')).toBe(true);
    expect(s.supplierOrders.every((o) => o.hospitalId === 'h-north')).toBe(true);
    expect(s.transfers.every((t) => t.fromHospital === 'h-north' || t.toHospital === 'h-north')).toBe(true);
    expect(scopeResults(results, 'h-civil').transfers.length).toBeGreaterThan(0);
  });
});

describe('tabFigures', () => {
  it('counts only scoped items and labels every tab for screen readers', () => {
    const all = tabFigures(results, scopeResults(results, null));
    const north = tabFigures(results, scopeResults(results, 'h-north'));
    expect(all.map((t) => t.key)).toEqual(['stock', 'forecast', 'shortage', 'waste', 'moves', 'priority']);
    expect(Number(north.find((t) => t.key === 'shortage')!.figure)).toBeLessThanOrEqual(Number(all.find((t) => t.key === 'shortage')!.figure));
    expect(all.find((t) => t.key === 'forecast')!.figure).toBe(`${results.mapePct}%`);
    for (const t of all) expect(t.ariaLabel.length).toBeGreaterThan(5);
  });
});

describe('display helpers', () => {
  it('formats', () => {
    expect(unitLabel('tablet', 1)).toBe('tablet');
    expect(unitLabel('tablet', 521.4)).toBe('tablets');
    expect(unitLabel('box', 2)).toBe('boxes');
    expect(fmtDate('2026-10-08')).toBe('08 Oct 2026');
    expect(fmtDate('2026-10-08T21:40:34.664Z')).toBe('08 Oct 2026');
    expect(fmtDate(null)).toBe('—');
    expect(signed(4.5)).toBe('+4.5');
    expect(signed(-10)).toBe('−10');
    expect(shortName('St Mary Clinic')).toBe('St Mary');
    expect(shortName('Northgate General')).toBe('Northgate');
    expect(isTabKey('moves')).toBe(true);
    expect(isTabKey('nope')).toBe(false);
  });
});
