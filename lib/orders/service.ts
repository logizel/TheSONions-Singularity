/**
 * Accept flow shared by /api/orders/accept and /api/orders/accept-all.
 * Plan against current orders, insert in one batch; if a concurrent request
 * won the unique index, re-read and re-plan once (its order is returned).
 */
import type { ResultsJSON } from '../contracts';
import { planAccept, type ResolvedLine } from './accept';
import { insertPlanned, isUniqueViolation, listOrders } from './store';
import type { Order } from './types';

export interface AcceptOutcome {
  /** Orders covering every requested line (new and pre-existing). */
  orders: Order[];
  /** Number of new orders created by this call. */
  created: number;
}

export async function acceptLines(results: ResultsJSON, lines: readonly ResolvedLine[], now: Date = new Date()): Promise<AcceptOutcome> {
  for (let attempt = 0; ; attempt++) {
    const current = await listOrders();
    const plan = planAccept(results, current, lines, now.toISOString());
    try {
      await insertPlanned(plan.create);
    } catch (err) {
      if (attempt === 0 && isUniqueViolation(err)) continue;
      throw err;
    }
    const ids = new Set([...plan.existing.map((o) => o.id), ...plan.create.map((p) => p.order.id)]);
    const fresh = plan.create.length > 0 ? await listOrders() : current;
    return { orders: fresh.filter((o) => ids.has(o.id)), created: plan.create.length };
  }
}
