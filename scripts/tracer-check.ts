// Throwaway Wave-1 verification (kept in repo): proves a write-then-read
// round trip through lib/contracts.ts row types against Neon, then cleans up.
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { dailyUsage, hospitals, medicines, stockBatches, supplierLeads, transportDays } from "../db/schema";
import type {
  DailyUsageRow,
  HospitalRow,
  MedicineRow,
  StockBatchRow,
  SupplierLeadRow,
  TransportRow,
} from "../lib/contracts";

const H: HospitalRow = { id: "__tracer_h", name: "Tracer Hospital" };
const M1: MedicineRow = {
  id: "__tracer_m1", name: "TracerMed", category: "tracer",
  isCritical: true, baseUnit: "tablet", substituteIds: ["__tracer_m2"],
};
const M2: MedicineRow = {
  id: "__tracer_m2", name: "TracerMed-Sub", category: "tracer",
  isCritical: false, baseUnit: "tablet", substituteIds: [],
};
const B1: StockBatchRow = {
  id: "__tracer_b1", hospitalId: H.id, medicineId: M1.id, qty: 100,
  expiryDate: "2027-01-15", archived: false, bufferDays: 7,
};
const B2: StockBatchRow = {
  id: "__tracer_b2", hospitalId: H.id, medicineId: M1.id, qty: 50,
  expiryDate: "2026-11-01", archived: false, bufferDays: 7,
};
const U: DailyUsageRow = {
  usageDate: "2026-10-01", hospitalId: H.id, medicineId: M1.id,
  usedQty: null, patientLoad: 40, emergencyPct: 20,
};
const T: TransportRow = { fromHospital: H.id, toHospital: H.id, days: 0 };
const L: SupplierLeadRow = { hospitalId: H.id, medicineId: M1.id, leadDays: 14 };

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  await db.insert(hospitals).values(H);
  await db.insert(medicines).values([
    { ...M1, substituteIds: M1.substituteIds },
    { ...M2, substituteIds: M2.substituteIds },
  ]);
  await db.insert(stockBatches).values([B1, B2]);
  await db.insert(dailyUsage).values(U);
  await db.insert(transportDays).values(T);
  await db.insert(supplierLeads).values(L);

  const batches = await db.select().from(stockBatches);
  const live = batches.filter((b) => !b.archived);
  assert(live.length === 2, "expected 2 live batches");
  const fifo = [...live].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  assert(fifo[0].id === "__tracer_b2", "FIFO must pick earliest expiry first");
  assert(fifo[0].qty === 50, "FIFO batch qty mismatch");

  const usage = await db.select().from(dailyUsage);
  assert(usage.length === 1 && usage[0].usedQty === null, "NULL-missing day must round-trip as NULL");

  // Cleanup — leave the DB clean for the seed plan.
  await db.delete(supplierLeads).where(eq(supplierLeads.hospitalId, H.id));
  await db.delete(transportDays).where(eq(transportDays.fromHospital, H.id));
  await db.delete(dailyUsage).where(eq(dailyUsage.hospitalId, H.id));
  await db.delete(stockBatches).where(eq(stockBatches.hospitalId, H.id));
  await db.delete(medicines).where(eq(medicines.id, M1.id));
  await db.delete(medicines).where(eq(medicines.id, M2.id));
  await db.delete(hospitals).where(eq(hospitals.id, H.id));

  const leftovers = await db.select().from(stockBatches);
  assert(leftovers.length === 0, "tracer rows must be cleaned up");

  console.log("all assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
