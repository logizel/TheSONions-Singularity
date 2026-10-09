/**
 * Neon persistence for transfer orders (Phase 6, D-08). Only `orders` and
 * `order_lines` are ever written here; stock_batches is never touched,
 * including on delivery. db/client is imported lazily so importing this
 * module (tests, build) never opens a connection.
 */
import type { PlannedOrder } from './accept';
import { checkTransition, STATUS_TIMESTAMP } from './state';
import type { Order, OrderLine, OrderStatus } from './types';

async function dbAndSchema() {
  const [{ db }, schema, orm] = await Promise.all([
    import('../../db/client'),
    import('../../db/schema'),
    import('drizzle-orm'),
  ]);
  return { db, s: schema, orm };
}

/** Postgres timestamptz strings -> ISO 8601 (UTC). */
function iso(v: string | null): string | null {
  if (v === null) return null;
  const t = Date.parse(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
  return Number.isNaN(t) ? v : new Date(t).toISOString();
}

type OrderRow = {
  id: string;
  fromHospital: string;
  toHospital: string;
  status: string;
  transportDays: number;
  asOf: string;
  suggestedAt: string;
  acceptedAt: string;
  packedAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  stockAppliedAt: string | null;
};

function toOrder(row: OrderRow, lines: OrderLine[]): Order {
  return {
    id: row.id,
    fromHospital: row.fromHospital,
    toHospital: row.toHospital,
    status: row.status as OrderStatus,
    transportDays: row.transportDays,
    asOf: row.asOf,
    suggestedAt: iso(row.suggestedAt) as string,
    acceptedAt: iso(row.acceptedAt) as string,
    packedAt: iso(row.packedAt),
    inTransitAt: iso(row.inTransitAt),
    deliveredAt: iso(row.deliveredAt),
    cancelledAt: iso(row.cancelledAt),
    stockAppliedAt: iso(row.stockAppliedAt),
    lines,
  };
}

const orderColumns = (s: Awaited<ReturnType<typeof dbAndSchema>>['s']) => ({
  id: s.orders.id,
  fromHospital: s.orders.fromHospital,
  toHospital: s.orders.toHospital,
  status: s.orders.status,
  transportDays: s.orders.transportDays,
  asOf: s.orders.asOf,
  suggestedAt: s.orders.suggestedAt,
  acceptedAt: s.orders.acceptedAt,
  packedAt: s.orders.packedAt,
  inTransitAt: s.orders.inTransitAt,
  deliveredAt: s.orders.deliveredAt,
  cancelledAt: s.orders.cancelledAt,
  stockAppliedAt: s.orders.stockAppliedAt,
});

/** All orders, newest first, with their lines. Throws on DB failure. */
export async function listOrders(): Promise<Order[]> {
  const { db, s, orm } = await dbAndSchema();
  const rows = await db.select(orderColumns(s)).from(s.orders).orderBy(orm.desc(s.orders.acceptedAt));
  if (rows.length === 0) return [];
  const lineRows = await db
    .select()
    .from(s.orderLines)
    .where(orm.inArray(s.orderLines.orderId, rows.map((r) => r.id)));
  const byOrder = new Map<string, OrderLine[]>();
  for (const l of lineRows) {
    const list = byOrder.get(l.orderId) ?? [];
    list.push({
      id: l.id,
      orderId: l.orderId,
      medicineId: l.medicineId,
      qty: l.qty,
      suggestedQty: l.suggestedQty,
      idempotencyKey: l.idempotencyKey,
      checksPassed: l.checksPassed,
    });
    byOrder.set(l.orderId, list);
  }
  return rows.map((r) => toOrder(r, byOrder.get(r.id) ?? []));
}

export async function getOrder(id: string): Promise<Order | null> {
  return (await listOrders()).find((o) => o.id === id) ?? null;
}

/** Postgres unique_violation, as surfaced by the Neon HTTP driver (possibly wrapped). */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 4; depth++) {
    if (typeof e === 'object' && (e as { code?: unknown }).code === '23505') return true;
    e = typeof e === 'object' ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}

/** Inserts every planned order + its lines in one transaction (Neon HTTP batch). */
export async function insertPlanned(plans: readonly PlannedOrder[]): Promise<void> {
  if (plans.length === 0) return;
  const { db, s } = await dbAndSchema();
  const orderValues = plans.map(({ order }) => ({
    id: order.id,
    idempotencyKey: order.idempotencyKey,
    fromHospital: order.fromHospital,
    toHospital: order.toHospital,
    status: order.status,
    transportDays: order.transportDays,
    asOf: order.asOf,
    suggestedAt: order.suggestedAt,
    acceptedAt: order.acceptedAt,
  }));
  const lineValues = plans.flatMap(({ lines }) =>
    lines.map((l) => ({
      id: l.id,
      orderId: l.orderId,
      medicineId: l.medicineId,
      qty: l.qty,
      suggestedQty: l.suggestedQty,
      idempotencyKey: l.idempotencyKey,
      checksPassed: l.checksPassed,
    })),
  );
  await db.batch([db.insert(s.orders).values(orderValues), db.insert(s.orderLines).values(lineValues)]);
}

export type StatusUpdate =
  | { kind: 'ok'; order: Order; changed: boolean }
  | { kind: 'not_found' }
  | { kind: 'invalid'; reason: string; order: Order };

/**
 * Moves one order to `to`, stamping that step's timestamp. Compare-and-set
 * on the current status, so two admins racing cannot skip a step; a repeat
 * of the current status is an idempotent no-op.
 */
export async function updateStatus(id: string, to: OrderStatus, nowIso: string): Promise<StatusUpdate> {
  const { db, s, orm } = await dbAndSchema();
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await getOrder(id);
    if (!current) return { kind: 'not_found' };
    const check = checkTransition(current.status, to);
    if (check.kind === 'noop') return { kind: 'ok', order: current, changed: false };
    if (check.kind === 'invalid') return { kind: 'invalid', reason: check.reason, order: current };
    const col = STATUS_TIMESTAMP[to];
    const updated = await db
      .update(s.orders)
      .set({ status: to, [col]: nowIso })
      .where(orm.and(orm.eq(s.orders.id, id), orm.eq(s.orders.status, current.status)))
      .returning({ id: s.orders.id });
    if (updated.length === 1) {
      const fresh = await getOrder(id);
      return fresh ? { kind: 'ok', order: fresh, changed: true } : { kind: 'not_found' };
    }
    // Lost a race: re-read and re-check once.
  }
  const latest = await getOrder(id);
  if (!latest) return { kind: 'not_found' };
  return latest.status === to
    ? { kind: 'ok', order: latest, changed: false }
    : { kind: 'invalid', reason: 'Status changed concurrently, reload and retry', order: latest };
}
