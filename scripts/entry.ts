// Single write path for DATA-01..04 (D-11): add-batch, record-usage,
// adjust-down (FIFO), set-transport, set-leads. Pages (Phase 4, P1) and
// scripts share these helpers so the two paths can never diverge.
// Ownership columns always set (D-24); role enforcement hardens in Phase 3.
import { and, eq, lte } from "drizzle-orm";

import { db } from "../db/client";
import {
  dailyUsage,
  hospitals,
  medicines,
  stockBatches,
  supplierLeads,
  transportDays,
} from "../db/schema";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

async function assertHospital(id: string) {
  const rows = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, id));
  if (rows.length === 0) throw new Error(`unknown hospital "${id}"`);
}

async function assertMedicine(id: string) {
  const rows = await db.select({ id: medicines.id }).from(medicines).where(eq(medicines.id, id));
  if (rows.length === 0) throw new Error(`unknown medicine "${id}" (coded master only)`);
}

function assertInt(n: number, lo: number, hi: number, name: string) {
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`bad ${name} "${n}" (integer ${lo}-${hi})`);
  }
}

let idSeq = 0;
const nid = (p: string) => `${p}-${Date.now()}-${++idSeq}`;

// D-02: always a NEW batch row, never merge. Expiry mandatory (D-07).
export async function addBatch(hospitalId: string, medicineId: string, qty: number, expiryDate: string) {
  await assertHospital(hospitalId);
  await assertMedicine(medicineId);
  assertInt(qty, 1, 1_000_000_000, "qty");
  if (!isIsoDate(expiryDate)) throw new Error(`bad expiryDate "${expiryDate}" (want YYYY-MM-DD, mandatory)`);
  const [row] = await db
    .insert(stockBatches)
    .values({ id: nid("b"), hospitalId, medicineId, qty, expiryDate, archived: false, bufferDays: 7 })
    .returning({ id: stockBatches.id });
  return row.id;
}

// D-08/D-10/D-18: combined daily row; empty qty = NULL missing; upsert overwrites.
export async function recordUsage(
  usageDate: string, hospitalId: string, medicineId: string,
  usedQty: number | null, patientLoad: number, emergencyPct: number,
) {
  if (!isIsoDate(usageDate)) throw new Error(`bad date "${usageDate}" (want YYYY-MM-DD)`);
  await assertHospital(hospitalId);
  await assertMedicine(medicineId);
  if (usedQty !== null) assertInt(usedQty, 0, 1_000_000_000, "usedQty");
  assertInt(patientLoad, 0, 1_000_000_000, "patientLoad");
  assertInt(emergencyPct, 0, 100, "emergencyPct");
  await db
    .insert(dailyUsage)
    .values({ usageDate, hospitalId, medicineId, usedQty, patientLoad, emergencyPct })
    .onConflictDoUpdate({
      target: [dailyUsage.usageDate, dailyUsage.hospitalId, dailyUsage.medicineId],
      set: { usedQty, patientLoad, emergencyPct },
    });
}

// D-03: FIFO earliest-expiry first; exhausted/expired batches archive, never delete (D-04).
export async function adjustStockDown(hospitalId: string, medicineId: string, amount: number) {
  assertInt(amount, 1, 1_000_000_000, "amount");
  let remaining = amount;
  const batches = await db
    .select()
    .from(stockBatches)
    .where(
      and(
        eq(stockBatches.hospitalId, hospitalId),
        eq(stockBatches.medicineId, medicineId),
        eq(stockBatches.archived, false),
      ),
    )
    .orderBy(stockBatches.expiryDate);
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.qty, remaining);
    remaining -= take;
    const left = b.qty - take;
    await db
      .update(stockBatches)
      .set({ qty: left, archived: left === 0 ? true : b.archived })
      .where(eq(stockBatches.id, b.id));
  }
  if (remaining > 0) throw new Error(`insufficient stock: short by ${remaining}`);
}

// Archive batches past a reference date (default today). Never deletes (D-04).
export async function archiveExpired(asOf: string = new Date().toISOString().slice(0, 10)) {
  if (!isIsoDate(asOf)) throw new Error(`bad asOf "${asOf}"`);
  const stale = await db
    .select({ id: stockBatches.id })
    .from(stockBatches)
    .where(and(eq(stockBatches.archived, false), lte(stockBatches.expiryDate, asOf)));
  for (const s of stale) {
    await db.update(stockBatches).set({ archived: true }).where(eq(stockBatches.id, s.id));
  }
  return stale.length;
}

// D-12..D-14: network-admin config; role flag stored for Phase 3 enforcement.
export async function setTransport(from: string, to: string, days: number, _role: string = "network_admin") {
  await assertHospital(from);
  await assertHospital(to);
  assertInt(days, 0, 30, "days");
  if (from === to && days !== 0) throw new Error("self-pair transport must be 0");
  await db
    .insert(transportDays)
    .values({ fromHospital: from, toHospital: to, days })
    .onConflictDoUpdate({
      target: [transportDays.fromHospital, transportDays.toHospital],
      set: { days },
    });
}

export async function setLead(hospitalId: string, medicineId: string, leadDays: number, _role: string = "network_admin") {
  await assertHospital(hospitalId);
  await assertMedicine(medicineId);
  assertInt(leadDays, 0, 30, "leadDays");
  await db
    .insert(supplierLeads)
    .values({ hospitalId, medicineId, leadDays })
    .onConflictDoUpdate({
      target: [supplierLeads.hospitalId, supplierLeads.medicineId],
      set: { leadDays },
    });
}

// Runnable self-test: `npx tsx scripts/entry.ts --self-test`.
// Uses isolated __entry_* rows (created + removed here); seeded data untouched.
async function selfTest() {
  const H = "__entry_h";
  const M = "__entry_m";
  await db.insert(hospitals).values({ id: H, name: "Entry Test Hospital" });
  await db.insert(medicines).values({
    id: M, name: "EntryTestMed", category: "test", isCritical: false,
    baseUnit: "tablet", substituteIds: [],
  });
  const b1 = await addBatch(H, M, 30, "2028-01-01");
  const b2 = await addBatch(H, M, 20, "2027-06-01");
  if (b1 === b2) throw new Error("deliveries must create distinct batch rows");
  await adjustStockDown(H, M, 25); // FIFO: 20 from b2 (archived), 5 from b1
  const after = await db.select().from(stockBatches);
  const got = (id: string) => after.find((b) => b.id === id);
  if (got(b2)?.qty !== 0 || got(b2)?.archived !== true) throw new Error("FIFO batch not exhausted+archived");
  if (got(b1)?.qty !== 25) throw new Error("second batch wrong remainder");
  await recordUsage("2026-10-07", H, M, 10, 50, 15);
  await recordUsage("2026-10-07", H, M, 12, 55, 18); // overwrite
  const dup = await db.select().from(dailyUsage);
  const same = dup.filter((r) => r.usageDate === "2026-10-07" && r.hospitalId === H && r.medicineId === M);
  if (same.length !== 1 || same[0].usedQty !== 12) throw new Error("duplicate daily row must overwrite");
  let rejected = 0;
  for (const fn of [
    () => addBatch(H, M, 5, ""),
    () => recordUsage("2026-10-07", H, M, 1, 1, 101),
    () => setTransport(H, H, 3),
    () => addBatch("nope", M, 5, "2028-01-01"),
  ]) {
    try {
      await fn();
    } catch {
      rejected++;
    }
  }
  if (rejected !== 4) throw new Error(`expected 4 rejections, got ${rejected}`);
  // Roll back test rows (isolated hospital+medicine only; seed untouched).
  await db.delete(dailyUsage).where(eq(dailyUsage.hospitalId, H));
  await db.delete(stockBatches).where(eq(stockBatches.hospitalId, H));
  await db.delete(medicines).where(eq(medicines.id, M));
  await db.delete(hospitals).where(eq(hospitals.id, H));
  console.log("entry self-test: all assertions passed");
}

if (process.argv.includes("--self-test")) {
  selfTest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
