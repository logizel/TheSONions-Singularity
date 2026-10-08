/**
 * Accepting engine transfers (Phase 6, D-07/D-08). Pure: validates a request
 * against the live ResultsJSON snapshot and plans which orders to create.
 * Quantities are never invented: a line may take at most the engine qty.
 */
import type { ResultsJSON, TransferSuggestion } from '../contracts';
import {
  lineIdFor,
  lineIdempotencyKey,
  nextAttempt,
  orderForTransfer,
  orderIdFor,
  orderIdempotencyKey,
  transferBaseKey,
} from './keys';
import type { Order, OrderLine } from './types';

export interface ApiError {
  status: 400 | 404 | 409 | 422;
  error: string;
}

export interface AcceptRequest {
  fromHospital: string;
  toHospital: string;
  medicineId: string;
  /** Optional partial quantity; defaults to the engine qty. */
  qty?: number;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isApiError(v: unknown): v is ApiError {
  return typeof v === 'object' && v !== null && 'error' in v && 'status' in v;
}

export function parseAcceptBody(body: unknown): AcceptRequest | ApiError {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { status: 400, error: 'Body must be a JSON object' };
  }
  const { fromHospital, toHospital, medicineId, qty } = body as Record<string, unknown>;
  for (const [name, v] of [['fromHospital', fromHospital], ['toHospital', toHospital], ['medicineId', medicineId]] as const) {
    if (typeof v !== 'string' || !ID.test(v)) return { status: 400, error: `${name} must be an id` };
  }
  if (qty !== undefined && (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0)) {
    return { status: 400, error: 'qty must be a positive number' };
  }
  return {
    fromHospital: fromHospital as string,
    toHospital: toHospital as string,
    medicineId: medicineId as string,
    ...(qty !== undefined ? { qty: qty as number } : {}),
  };
}

export interface ResolvedLine {
  transfer: TransferSuggestion;
  qty: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Checks ids exist, the engine suggested this exact lane + medicine, and qty <= engine qty. */
export function resolveTransfer(results: ResultsJSON, req: AcceptRequest): ResolvedLine | ApiError {
  const hospitals = new Set(results.hospitals.map((h) => h.hospitalId));
  if (!hospitals.has(req.fromHospital) || !hospitals.has(req.toHospital)) {
    return { status: 404, error: 'Unknown hospital' };
  }
  if (!results.medicines.some((m) => m.medicineId === req.medicineId)) {
    return { status: 404, error: 'Unknown medicine' };
  }
  const transfer = results.transfers.find(
    (t) => t.fromHospital === req.fromHospital && t.toHospital === req.toHospital && t.medicineId === req.medicineId,
  );
  if (!transfer) return { status: 404, error: 'No engine transfer suggested for this lane and medicine' };
  const qty = round1(req.qty ?? transfer.qty);
  if (qty <= 0) return { status: 400, error: 'qty must be a positive number' };
  if (qty > transfer.qty + 1e-9) {
    return { status: 422, error: `Quantity exceeds the engine suggestion of ${transfer.qty}` };
  }
  return { transfer, qty };
}

export interface PlannedOrder {
  order: Omit<Order, 'lines' | 'acceptedAt'> & { acceptedAt: string; idempotencyKey: string };
  lines: OrderLine[];
}

export interface AcceptPlan {
  /** Orders that already cover a requested line (idempotent hits). */
  existing: Order[];
  /** New orders, one per lane. */
  create: PlannedOrder[];
}

/**
 * Splits requested lines into already-accepted (returned as-is) and new.
 * A line counts as accepted while its order is open, or delivered from
 * today's suggestion; a cancelled order frees the suggestion for a re-accept
 * with the next attempt number. New lines on one lane form one order.
 */
export function planAccept(
  results: ResultsJSON,
  existingOrders: readonly Order[],
  lines: readonly ResolvedLine[],
  nowIso: string,
): AcceptPlan {
  const existing = new Map<string, Order>();
  const byLane = new Map<string, { transfer: TransferSuggestion; qty: number; key: string }[]>();
  for (const { transfer, qty } of lines) {
    const match = orderForTransfer(existingOrders, transfer, results.asOf);
    if (match && match.order.status !== 'cancelled') {
      existing.set(match.order.id, match.order);
      continue;
    }
    const base = transferBaseKey(results.asOf, transfer);
    const key = lineIdempotencyKey(base, nextAttempt(existingOrders, base));
    const lane = `${transfer.fromHospital}>${transfer.toHospital}`;
    const group = byLane.get(lane) ?? [];
    if (!group.some((g) => g.key === key)) group.push({ transfer, qty, key });
    byLane.set(lane, group);
  }

  const create: PlannedOrder[] = [];
  for (const group of byLane.values()) {
    const orderKey = orderIdempotencyKey(group.map((g) => g.key));
    const id = orderIdFor(orderKey);
    const first = group[0].transfer;
    create.push({
      order: {
        id,
        idempotencyKey: orderKey,
        fromHospital: first.fromHospital,
        toHospital: first.toHospital,
        status: 'accepted',
        transportDays: Math.max(...group.map((g) => g.transfer.transportDays)),
        asOf: results.asOf,
        suggestedAt: results.generatedAt,
        acceptedAt: nowIso,
        packedAt: null,
        inTransitAt: null,
        deliveredAt: null,
        cancelledAt: null,
      },
      lines: group.map((g) => ({
        id: lineIdFor(g.key),
        orderId: id,
        medicineId: g.transfer.medicineId,
        qty: g.qty,
        suggestedQty: g.transfer.qty,
        idempotencyKey: g.key,
        checksPassed: [...g.transfer.checksPassed],
      })),
    });
  }
  return { existing: [...existing.values()], create };
}

/** Status-change body: { status }. */
export function parseStatusBody(body: unknown): { status: string } | ApiError {
  if (typeof body !== 'object' || body === null || typeof (body as { status?: unknown }).status !== 'string') {
    return { status: 400, error: 'Body must be { "status": "<packed|in_transit|delivered|cancelled>" }' };
  }
  return { status: (body as { status: string }).status };
}

/** Orders a session may read: network_admin all, hospital_admin only its own lanes. */
export function visibleOrders(orders: readonly Order[], role: 'network_admin' | 'hospital_admin', hospitalId?: string): Order[] {
  if (role === 'network_admin') return [...orders];
  if (!hospitalId) return [];
  return orders.filter((o) => o.fromHospital === hospitalId || o.toHospital === hospitalId);
}
