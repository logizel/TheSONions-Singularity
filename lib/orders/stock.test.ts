import { describe, expect, it } from 'vitest';

import { planStockMove, type SenderBatch } from './stock';

const order = {
  id: 'ord-abc',
  fromHospital: 'h-a',
  toHospital: 'h-b',
  lines: [{ id: 'l', orderId: 'ord-abc', medicineId: 'm-para', qty: 521.4, suggestedQty: 521.4, idempotencyKey: 'k', checksPassed: [] }],
};
const b = (id: string, qty: number, expiryDate: string, extra: Partial<SenderBatch> = {}): SenderBatch => ({
  id, hospitalId: 'h-a', medicineId: 'm-para', qty, expiryDate, archived: false, ...extra,
});

describe('planStockMove', () => {
  it('takes earliest-expiry first and moves whole units with the same expiry', () => {
    const r = planStockMove(order, [b('late', 900, '2027-06-30'), b('soon', 100, '2026-12-01')], '2026-10-08');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.take).toEqual([
      { batchId: 'soon', hospitalId: 'h-a', medicineId: 'm-para', units: 100 },
      { batchId: 'late', hospitalId: 'h-a', medicineId: 'm-para', units: 421 },
    ]);
    expect(r.plan.create.map((c) => [c.hospitalId, c.units, c.expiryDate])).toEqual([
      ['h-b', 100, '2026-12-01'],
      ['h-b', 421, '2027-06-30'],
    ]);
    expect(r.plan.create.reduce((s, c) => s + c.units, 0)).toBe(521);
  });

  it('skips archived, expired, empty and other-hospital batches', () => {
    const r = planStockMove(
      order,
      [b('arch', 999, '2027-01-01', { archived: true }), b('exp', 999, '2026-01-01'), b('other', 999, '2027-01-01', { hospitalId: 'h-z' }), b('ok', 600, '2027-01-01')],
      '2026-10-08',
    );
    expect(r.ok && r.plan.take.map((t) => t.batchId)).toEqual(['ok']);
  });

  it('refuses when the sender no longer has enough', () => {
    const r = planStockMove(order, [b('x', 100, '2027-01-01')], '2026-10-08');
    expect(r.ok).toBe(false);
  });

  it('uses deterministic new batch ids per order', () => {
    const r = planStockMove(order, [b('x', 600, '2027-01-01')], '2026-10-08');
    expect(r.ok && r.plan.create[0].batchId).toBe('xfer-ord-abc-1');
  });
});
