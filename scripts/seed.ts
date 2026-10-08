// Demo network seed (D-21): ~3 hospitals x 5 medicines x 60 days.
// Re-runnable: clears Phase-1 tables first (FK order), then inserts.
// All rows built through lib/contracts.ts row types.
import {
  dailyUsage,
  hospitals,
  medicines,
  stockBatches,
  supplierLeads,
  transportDays,
  users,
} from "../db/schema";
import { db } from "../db/client";
import type {
  DailyUsageRow,
  HospitalRow,
  MedicineRow,
  StockBatchRow,
  SupplierLeadRow,
  TransportRow,
  UserRow,
} from "../lib/contracts";
import { DEMO_COORDINATES } from "./demo-coordinates";

// Deterministic PRNG (mulberry32) so re-runs produce identical data.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// DEMO DATA coordinates (fictional points in Mangaluru): see demo-coordinates.ts.
const HOSPITALS: HospitalRow[] = [
  { id: "h-civil", name: "City Civil Hospital", ...DEMO_COORDINATES["h-civil"] },
  { id: "h-stmary", name: "St Mary Clinic", ...DEMO_COORDINATES["h-stmary"] },
  { id: "h-north", name: "Northgate General", ...DEMO_COORDINATES["h-north"] },
];

const MEDICINES: MedicineRow[] = [
  { id: "m-para", name: "Paracetamol", category: "analgesic", isCritical: true, baseUnit: "tablet", substituteIds: ["m-ibu"] },
  { id: "m-ibu", name: "Ibuprofen", category: "analgesic", isCritical: false, baseUnit: "tablet", substituteIds: ["m-para"] },
  { id: "m-amox", name: "Amoxicillin", category: "antibiotic", isCritical: true, baseUnit: "capsule", substituteIds: [] },
  { id: "m-ors", name: "ORS", category: "rehydration", isCritical: false, baseUnit: "sachet", substituteIds: [] },
  { id: "m-ins", name: "Insulin", category: "hormone", isCritical: true, baseUnit: "vial", substituteIds: [] },
];

const USERS: UserRow[] = [
  { id: "u-admin", hospitalId: null, role: "network_admin" },
  { id: "u-civil", hospitalId: "h-civil", role: "hospital_admin" },
];

const END = new Date("2026-10-07T00:00:00Z");
const DAYS = 60;
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const rand = rng(42);
  const force = process.argv.includes("--force");

  // WR-04: never wipe real admin-entered data. Re-runs over our own seed rows
  // are safe to clear; anything else refuses unless --force is passed.
  if (!force) {
    const knownH = new Set(HOSPITALS.map((h) => h.id));
    const knownM = new Set(MEDICINES.map((m) => m.id));
    const knownU = new Set(USERS.map((u) => u.id));
    const hids = (await db.select({ id: hospitals.id }).from(hospitals)).map((r) => r.id);
    const mids = (await db.select({ id: medicines.id }).from(medicines)).map((r) => r.id);
    const uids = (await db.select({ id: users.id }).from(users)).map((r) => r.id);
    const bids = (await db.select({ id: stockBatches.id }).from(stockBatches)).map((r) => r.id);
    const foreign =
      hids.filter((id) => !knownH.has(id) && !id.startsWith("h-x-")).length > 0 ||
      mids.filter((id) => !knownM.has(id)).length > 0 ||
      uids.filter((id) => !knownU.has(id)).length > 0 ||
      bids.filter((id) => !id.startsWith("seed-b") && !id.startsWith("seedx-")).length > 0;
    if (foreign) {
      console.error("refusing: database holds non-seed rows (real admin data). Re-run with --force to wipe and reseed.");
      process.exit(3);
    }
  }

  // Clear first (FK order) for idempotency.
  await db.delete(dailyUsage);
  await db.delete(stockBatches);
  await db.delete(supplierLeads);
  await db.delete(transportDays);
  await db.delete(users);
  await db.delete(medicines);
  await db.delete(hospitals);

  await db.insert(hospitals).values(HOSPITALS);
  await db.insert(medicines).values(MEDICINES);
  await db.insert(users).values(USERS);

  // Batches: mixed expiries; one expiring within 30d, one archived/expired.
  const batches: StockBatchRow[] = [];
  let n = 0;
  for (const h of HOSPITALS) {
    for (const m of MEDICINES) {
      batches.push({
        id: `seed-b${++n}`, hospitalId: h.id, medicineId: m.id,
        qty: 200 + Math.floor(rand() * 800),
        expiryDate: "2027-06-30", archived: false, bufferDays: 7,
      });
    }
  }
  batches.push({
    id: "seed-b-near", hospitalId: "h-civil", medicineId: "m-para",
    qty: 120, expiryDate: "2026-10-25", archived: false, bufferDays: 7,
  });
  batches.push({
    id: "seed-b-old", hospitalId: "h-stmary", medicineId: "m-ibu",
    qty: 0, expiryDate: "2026-09-01", archived: true, bufferDays: 7,
  });
  await db.insert(stockBatches).values(batches);

  // 60 days of usage with a weekday pattern (weekend dip) + NULL gaps.
  const base: Record<string, number> = {
    "m-para": 45, "m-ibu": 25, "m-amox": 18, "m-ors": 30, "m-ins": 8,
  };
  const usage: DailyUsageRow[] = [];
  for (let d = DAYS - 1; d >= 0; d--) {
    const dt = new Date(END.getTime() - d * 86400000);
    const dow = dt.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    for (let hi = 0; hi < HOSPITALS.length; hi++) {
      const load = Math.round((weekend ? 45 : 90) * (0.8 + rand() * 0.4));
      for (let mi = 0; mi < MEDICINES.length; mi++) {
        const m = MEDICINES[mi];
        const gap = (d * 7 + hi * 13 + mi * 29) % 20 === 0; // ~5% NULL gaps
        const qty = gap
          ? null
          : Math.max(0, Math.round(base[m.id] * (weekend ? 0.55 : 1) * (0.85 + rand() * 0.3)));
        usage.push({
          usageDate: iso(dt), hospitalId: HOSPITALS[hi].id, medicineId: m.id,
          usedQty: qty, patientLoad: load,
          emergencyPct: 5 + Math.floor(rand() * 31),
        });
      }
    }
  }
  for (let i = 0; i < usage.length; i += 100) {
    await db.insert(dailyUsage).values(usage.slice(i, i + 100));
  }

  // Transport: directed pairs, asymmetric 1-2d, self = 0.
  const transport: TransportRow[] = [];
  const ids = HOSPITALS.map((h) => h.id);
  for (const a of ids) {
    for (const b of ids) {
      transport.push({ fromHospital: a, toHospital: b, days: a === b ? 0 : 1 + Math.floor(rand() * 2) });
    }
  }
  await db.insert(transportDays).values(transport);

  // Leads: per hospital+medicine, 7-21d.
  const leads: SupplierLeadRow[] = [];
  for (const h of HOSPITALS) {
    for (const m of MEDICINES) {
      leads.push({ hospitalId: h.id, medicineId: m.id, leadDays: 7 + Math.floor(rand() * 15) });
    }
  }
  await db.insert(supplierLeads).values(leads);

  console.log(JSON.stringify({
    hospitals: HOSPITALS.length, medicines: MEDICINES.length, users: USERS.length,
    batches: batches.length, usage: usage.length,
    transport: transport.length, leads: leads.length,
    nullGaps: usage.filter((u) => u.usedQty === null).length,
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
