/**
 * Accept validation + planning against a ResultsJSON snapshot (Phase 6, D-08).
 */
import { describe, expect, it } from 'vitest';

import type { ResultsJSON, TransferSuggestion } from '../contracts';
import { isApiError, parseAcceptBody, parseStatusBody, planAccept, resolveTransfer, visibleOrders } from './accept';
import type { Order } from './types';

const xfer = (from: string, to: string, med: string, qty: number, days = 1): TransferSuggestion => ({
  fromHospital: from,
  toHospital: to,
  medicineId: med,
  qty,
  transportDays: days,
  checksPassed: ['check a', 'check b'],
});

const results = {
  generatedAt: '2026-10-08T21:40:34.664Z',
  asOf: '2026-10-08',
  hospitals: [{ hospitalId: 'h-civil' }, { hospitalId: 'h-north' }, { hospitalId: 'h-stmary' }],
  medicines: [{ medicineId: 'm-para' }, { medicineId: 'm-ors' }],
  transfers: [xfer('h-civil', 'h-north', 'm-para', 521.4), xfer('h-civil', 'h-north', 'm-ors', 40, 2), xfer('h-stmary', 'h-north', 'm-para', 10)],
} as unknown as ResultsJSON;

const NOW = '2026-10-09T03:00:00.000Z';

describe('parseAcceptBody', () => {
  it('accepts ids and an optional positive qty', () => {
    expect(parseAcceptBody({ fromHospital: 'h-civil', toHospital: 'h-north', medicineId: 'm-para' })).toEqual({
      fromHospital: 'h-civil',
      toHospital: 'h-north',
      medicineId: 'm-para',
    });
    expect(parseAcceptBody({ fromHospital: 'a', toHospital: 'b', medicineId: 'c', qty: 5 })).toMatchObject({ qty: 5 });
  });

  it('rejects malformed bodies with 400', () => {
    for (const bad of [null, [], 'x', { fromHospital: 'a b', toHospital: 'b', medicineId: 'c' }, { fromHospital: 'a', toHospital: 'b' }, { fromHospital: 'a', toHospital: 'b', medicineId: 'c', qty: 0 }, { fromHospital: 'a', toHospital: 'b', medicineId: 'c', qty: '5' }]) {
      const r = parseAcceptBody(bad);
      expect(isApiError(r) && r.status).toBe(400);
    }
  });

  it('status body needs a status string', () => {
    expect(parseStatusBody({ status: 'packed' })).toEqual({ status: 'packed' });
    expect(isApiError(parseStatusBody({}))).toBe(true);
  });
});

describe('resolveTransfer', () => {
  const req = { fromHospital: 'h-civil', toHospital: 'h-north', medicineId: 'm-para' };

  it('defaults to the engine qty', () => {
    const r = resolveTransfer(results, req);
    expect(!isApiError(r) && r.qty).toBe(521.4);
  });

  it('allows a partial qty and refuses more than the engine suggested (422)', () => {
    const ok = resolveTransfer(results, { ...req, qty: 200.04 });
    expect(!isApiError(ok) && ok.qty).toBe(200);
    const over = resolveTransfer(results, { ...req, qty: 521.5 });
    expect(isApiError(over) && over.status).toBe(422);
  });

  it('404s unknown hospitals, medicines and unsuggested lanes', () => {
    for (const bad of [
      { ...req, fromHospital: 'h-nope' },
      { ...req, toHospital: 'h-nope' },
      { ...req, medicineId: 'm-nope' },
      { ...req, fromHospital: 'h-north', toHospital: 'h-civil' },
    ]) {
      const r = resolveTransfer(results, bad);
      expect(isApiError(r) && r.status).toBe(404);
    }
  });
});

function asOrders(plan: ReturnType<typeof planAccept>): Order[] {
  return plan.create.map(({ order, lines }) => ({ ...order, lines }));
}

describe('planAccept', () => {
  const all = results.transfers.map((transfer) => ({ transfer, qty: transfer.qty }));

  it('groups new lines by lane: one order per lane, max engine window', () => {
    const plan = planAccept(results, [], all, NOW);
    expect(plan.existing).toEqual([]);
    expect(plan.create).toHaveLength(2);
    const civil = plan.create.find((p) => p.order.fromHospital === 'h-civil')!;
    expect(civil.lines.map((l) => l.medicineId).sort()).toEqual(['m-ors', 'm-para']);
    expect(civil.order.transportDays).toBe(2);
    expect(civil.order.suggestedAt).toBe(results.generatedAt);
    expect(civil.order.acceptedAt).toBe(NOW);
    expect(civil.lines[0].checksPassed).toEqual(['check a', 'check b']);
  });

  it('is deterministic: a double click plans identical ids', () => {
    const a = planAccept(results, [], all, NOW);
    const b = planAccept(results, [], all, '2026-10-09T03:00:01.000Z');
    expect(a.create.map((p) => p.order.id)).toEqual(b.create.map((p) => p.order.id));
    expect(a.create.flatMap((p) => p.lines.map((l) => l.idempotencyKey))).toEqual(
      b.create.flatMap((p) => p.lines.map((l) => l.idempotencyKey)),
    );
  });

  it('re-accept returns the existing order instead of creating one', () => {
    const first = asOrders(planAccept(results, [], all.slice(0, 1), NOW));
    const again = planAccept(results, first, all.slice(0, 1), NOW);
    expect(again.create).toEqual([]);
    expect(again.existing.map((o) => o.id)).toEqual([first[0].id]);
  });

  it('accept-all after one line only creates the rest', () => {
    const first = asOrders(planAccept(results, [], all.slice(0, 1), NOW));
    const rest = planAccept(results, first, all, NOW);
    expect(rest.existing).toHaveLength(1);
    expect(rest.create.flatMap((p) => p.lines.map((l) => l.medicineId)).sort()).toEqual(['m-ors', 'm-para']);
    expect(rest.create.flatMap((p) => p.lines).some((l) => l.idempotencyKey === first[0].lines[0].idempotencyKey)).toBe(false);
  });

  it('a cancelled order frees the suggestion with the next attempt key', () => {
    const first = asOrders(planAccept(results, [], all.slice(0, 1), NOW)).map((o) => ({ ...o, status: 'cancelled' as const }));
    const retry = planAccept(results, first, all.slice(0, 1), NOW);
    expect(retry.create).toHaveLength(1);
    expect(retry.create[0].lines[0].idempotencyKey).toBe(`${first[0].lines[0].idempotencyKey}#1`);
    expect(retry.create[0].order.id).not.toBe(first[0].id);
  });
});

describe('visibleOrders', () => {
  const orders = asOrders(planAccept(results, [], results.transfers.map((transfer) => ({ transfer, qty: transfer.qty })), NOW));

  it('network admin sees all; hospital admin only its lanes; no hospital sees none', () => {
    expect(visibleOrders(orders, 'network_admin')).toHaveLength(2);
    expect(visibleOrders(orders, 'hospital_admin', 'h-stmary')).toHaveLength(1);
    expect(visibleOrders(orders, 'hospital_admin', 'h-north')).toHaveLength(2);
    expect(visibleOrders(orders, 'hospital_admin')).toHaveLength(0);
  });
});
