/**
 * Transfer order records (Phase 6, D-08). An order is one accepted shipment
 * on a lane (from -> to); its lines are the medicines on it. Orders start at
 * `accepted`; `suggested` exists only as the engine snapshot the order came
 * from (its timestamp is the snapshot's generatedAt).
 */

export type OrderStatus = 'accepted' | 'packed' | 'in_transit' | 'delivered' | 'cancelled';

/** Stepper steps, in order. `cancelled` is a terminal state outside this list. */
export type OrderStep = 'suggested' | 'accepted' | 'packed' | 'in_transit' | 'delivered';

export interface OrderLine {
  id: string;
  orderId: string;
  medicineId: string;
  /** Accepted quantity, base units, one decimal (<= suggestedQty). */
  qty: number;
  /** Engine quantity at accept time. */
  suggestedQty: number;
  /** Deterministic: same suggestion + same attempt -> same key (never duplicates). */
  idempotencyKey: string;
  checksPassed: string[];
}

export interface Order {
  id: string;
  fromHospital: string;
  toHospital: string;
  status: OrderStatus;
  /** Engine delivery window at accept time, whole days. */
  transportDays: number;
  /** Snapshot date the suggestion came from (YYYY-MM-DD). */
  asOf: string;
  /** ISO timestamps; null until the step is reached. */
  suggestedAt: string;
  acceptedAt: string;
  packedAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  lines: OrderLine[];
}
