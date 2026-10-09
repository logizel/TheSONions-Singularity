/**
 * Delivery -> stock (pure planning). Units leave the sender's usable batches
 * earliest-expiry first (FEFO) and arrive at the receiver as new batches with
 * the same expiry, so shelf life travels with the stock. Engine quantities
 * are one-decimal; stock is whole units, so each line moves round(qty).
 */
import type { Order } from './types';

export interface SenderBatch {
  id: string;
  hospitalId: string;
  medicineId: string;
  qty: number;
  expiryDate: string;
  archived: boolean;
}

export interface StockMovePlan {
  /** Sender batch decrements. */
  take: { batchId: string; hospitalId: string; medicineId: string; units: number }[];
  /** New receiver batches. */
  create: { batchId: string; hospitalId: string; medicineId: string; units: number; expiryDate: string; bufferDays: number }[];
}

export type StockPlanResult = { ok: true; plan: StockMovePlan } | { ok: false; error: string };

export function planStockMove(
  order: Pick<Order, 'id' | 'fromHospital' | 'toHospital' | 'lines'>,
  batches: readonly SenderBatch[],
  asOf: string,
  receiverBuffer: (medicineId: string) => number = () => 7,
): StockPlanResult {
  const take: StockMovePlan['take'] = [];
  const create: StockMovePlan['create'] = [];
  let n = 0;
  for (const line of order.lines) {
    let need = Math.round(line.qty);
    if (need <= 0) continue;
    const pool = batches
      .filter((b) => b.hospitalId === order.fromHospital && b.medicineId === line.medicineId && !b.archived && b.qty > 0 && b.expiryDate >= asOf)
      .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : a.id < b.id ? -1 : 1));
    const available = pool.reduce((s, b) => s + b.qty, 0);
    if (available < need) {
      return { ok: false, error: `Sender has only ${available} usable units of ${line.medicineId}, needs ${need}` };
    }
    for (const b of pool) {
      if (need === 0) break;
      const units = Math.min(b.qty, need);
      need -= units;
      take.push({ batchId: b.id, hospitalId: b.hospitalId, medicineId: b.medicineId, units });
      create.push({
        batchId: `xfer-${order.id}-${++n}`,
        hospitalId: order.toHospital,
        medicineId: line.medicineId,
        units,
        expiryDate: b.expiryDate,
        bufferDays: receiverBuffer(line.medicineId),
      });
    }
  }
  return { ok: true, plan: { take, create } };
}
