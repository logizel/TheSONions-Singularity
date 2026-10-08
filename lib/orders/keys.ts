/**
 * Deterministic idempotency keys (Phase 6, D-08). The same engine suggestion
 * always maps to the same key, so double-clicks and re-accepts hit the
 * UNIQUE index instead of creating a second shipment. A suggestion whose
 * earlier order was cancelled can be accepted again: the attempt number is
 * the count of cancelled lines already on that base key, which every
 * concurrent request computes identically.
 */
import type { TransferSuggestion } from '../contracts';
import type { Order, OrderLine } from './types';

/** One engine transfer suggestion on one snapshot day. */
export function transferBaseKey(asOf: string, t: Pick<TransferSuggestion, 'fromHospital' | 'toHospital' | 'medicineId'>): string {
  return `xfer:${asOf}:${t.fromHospital}:${t.toHospital}:${t.medicineId}`;
}

export function lineIdempotencyKey(baseKey: string, attempt: number): string {
  return attempt === 0 ? baseKey : `${baseKey}#${attempt}`;
}

export function baseOfLineKey(lineKey: string): string {
  const hash = lineKey.indexOf('#');
  return hash === -1 ? lineKey : lineKey.slice(0, hash);
}

/** Order key = its sorted line keys; one lane's lines accepted together form one order. */
export function orderIdempotencyKey(lineKeys: readonly string[]): string {
  return [...lineKeys].sort().join('|');
}

/** 64-bit FNV-1a, hex. Pure JS so client and server derive identical ids. */
export function fnv1a64(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

export function orderIdFor(orderKey: string): string {
  return `ord-${fnv1a64(orderKey).slice(0, 12)}`;
}

export function lineIdFor(lineKey: string): string {
  return `ol-${fnv1a64(lineKey).slice(0, 12)}`;
}

export interface TransferOrderMatch {
  order: Order;
  line: OrderLine;
}

/**
 * The order shown for an engine transfer line: an open order on the same
 * lane + medicine (from any snapshot day) wins, else the latest order made
 * from today's suggestion (which may be delivered or cancelled), else null.
 */
export function orderForTransfer(
  orders: readonly Order[],
  t: Pick<TransferSuggestion, 'fromHospital' | 'toHospital' | 'medicineId'>,
  asOf: string,
): TransferOrderMatch | null {
  const base = transferBaseKey(asOf, t);
  let today: TransferOrderMatch | null = null;
  for (const order of orders) {
    if (order.fromHospital !== t.fromHospital || order.toHospital !== t.toHospital) continue;
    for (const line of order.lines) {
      if (line.medicineId !== t.medicineId) continue;
      if (order.status !== 'delivered' && order.status !== 'cancelled') return { order, line };
      if (baseOfLineKey(line.idempotencyKey) === base) {
        if (!today || order.acceptedAt > today.order.acceptedAt) today = { order, line };
      }
    }
  }
  return today;
}

/** Number of cancelled lines on a base key = the next attempt number. */
export function nextAttempt(orders: readonly Order[], baseKey: string): number {
  let n = 0;
  for (const o of orders) {
    if (o.status !== 'cancelled') continue;
    for (const l of o.lines) if (baseOfLineKey(l.idempotencyKey) === baseKey) n += 1;
  }
  return n;
}
