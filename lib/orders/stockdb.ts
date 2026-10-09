/**
 * Delivery and demo reset against Neon, each as ONE transaction (Neon HTTP
 * transaction). Delivery: status + stock_batches + stock_movements commit
 * together; every stock statement is guarded by the order row this
 * transaction just stamped, so a lost race changes nothing. Reset reverses
 * every movement exactly, then clears orders and the activity log.
 */
import { neon } from '@neondatabase/serverless';

import { planStockMove, type SenderBatch } from './stock';
import { getOrder } from './store';
import type { Order } from './types';

function client() {
  return neon(process.env.DATABASE_URL as string);
}

export type DeliverResult =
  | { kind: 'ok'; order: Order; changed: boolean }
  | { kind: 'not_found' }
  | { kind: 'invalid'; reason: string };

export async function deliverWithStock(id: string, nowIso: string, asOf: string): Promise<DeliverResult> {
  const order = await getOrder(id);
  if (!order) return { kind: 'not_found' };
  if (order.status === 'delivered') return { kind: 'ok', order, changed: false };
  if (order.status !== 'in_transit') return { kind: 'invalid', reason: `Cannot deliver a ${order.status.replace('_', ' ')} transfer` };

  const sql = client();
  const meds = order.lines.map((l) => l.medicineId);
  const batches = (await sql`
    select id, hospital_id as "hospitalId", medicine_id as "medicineId", qty, expiry_date::text as "expiryDate", archived, buffer_days as "bufferDays"
    from stock_batches
    where (hospital_id = ${order.fromHospital} or hospital_id = ${order.toHospital}) and medicine_id = any(${meds})
  `) as (SenderBatch & { bufferDays: number })[];
  const buffer = (m: string) => batches.find((b) => b.hospitalId === order.toHospital && b.medicineId === m)?.bufferDays ?? 7;
  const planned = planStockMove(order, batches, asOf, buffer);
  if (!planned.ok) return { kind: 'invalid', reason: planned.error };
  const { take, create } = planned.plan;

  const stamped = sql`exists (select 1 from orders where id = ${id} and stock_applied_at = ${nowIso}::timestamptz)`;
  const mv = (n: number) => `mv-${id}-${n}`;
  let k = 0;
  const queries = [
    sql`update orders set status = 'delivered', delivered_at = ${nowIso}::timestamptz, stock_applied_at = ${nowIso}::timestamptz
        where id = ${id} and status = 'in_transit'`,
    ...take.map((t) => sql`update stock_batches set qty = qty - ${t.units} where id = ${t.batchId} and ${stamped}`),
    ...create.map(
      (c) => sql`insert into stock_batches (id, hospital_id, medicine_id, qty, expiry_date, archived, buffer_days)
        select ${c.batchId}, ${c.hospitalId}, ${c.medicineId}, ${c.units}, ${c.expiryDate}::date, false, ${c.bufferDays} where ${stamped}`,
    ),
    ...take.map(
      (t) => sql`insert into stock_movements (id, order_id, batch_id, hospital_id, medicine_id, delta, created)
        select ${mv(++k)}, ${id}, ${t.batchId}, ${t.hospitalId}, ${t.medicineId}, ${-t.units}, false where ${stamped}`,
    ),
    ...create.map(
      (c) => sql`insert into stock_movements (id, order_id, batch_id, hospital_id, medicine_id, delta, created)
        select ${mv(++k)}, ${id}, ${c.batchId}, ${c.hospitalId}, ${c.medicineId}, ${c.units}, true where ${stamped}`,
    ),
  ];
  await sql.transaction(queries);

  const fresh = await getOrder(id);
  if (!fresh) return { kind: 'not_found' };
  if (fresh.status !== 'delivered') return { kind: 'invalid', reason: 'Status changed concurrently, reload and retry' };
  return { kind: 'ok', order: fresh, changed: fresh.stockAppliedAt === new Date(nowIso).toISOString() };
}

export interface StockSummary {
  hospitalId: string;
  medicineId: string;
  delta: number;
}

/** Net stock change per hospital for one order (for the tracking sheet). */
export async function movementsFor(orderId: string): Promise<StockSummary[]> {
  const rows = (await client()`
    select hospital_id as "hospitalId", medicine_id as "medicineId", sum(delta)::int as delta
    from stock_movements where order_id = ${orderId} group by hospital_id, medicine_id order by delta
  `) as StockSummary[];
  return rows;
}

export interface ResetCounts {
  orders: number;
  movements: number;
  logs: number;
}

/** Undo every delivery's stock change, then clear orders, movements and logs. */
export async function resetDemo(): Promise<ResetCounts> {
  const sql = client();
  const [c] = (await sql`
    select (select count(*)::int from orders) as orders,
           (select count(*)::int from stock_movements) as movements,
           (select count(*)::int from activity_log) as logs
  `) as ResetCounts[];
  await sql.transaction([
    sql`update stock_batches b set qty = b.qty - m.d
        from (select batch_id, sum(delta) as d from stock_movements where not created group by batch_id) m
        where b.id = m.batch_id`,
    sql`delete from stock_batches where id in (select batch_id from stock_movements where created)`,
    sql`delete from stock_movements`,
    sql`delete from order_lines`,
    sql`delete from orders`,
    sql`delete from activity_log`,
  ]);
  return c;
}
