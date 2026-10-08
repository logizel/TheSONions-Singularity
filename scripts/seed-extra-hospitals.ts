// DEMO DATA: adds 10 fictional hospitals around Mangaluru to the existing
// 3-hospital seed, with 60 days of usage, stock, leads and transport to every
// other hospital. Additive and re-runnable: it only deletes/inserts rows it
// owns (ids starting "h-x-" / "seedx-"), never the base seed or real data.
// Scenarios are built in so the engine has something to say: surplus senders,
// critical receivers, one ORS outbreak, one near-expiry batch that wastes.
//
//   npx tsx scripts/seed-extra-hospitals.ts
import { inArray, like, or } from "drizzle-orm";

import { db } from "../db/client";
import { dailyUsage, hospitals, medicines, stockBatches, supplierLeads, transportDays } from "../db/schema";
import { haversineM } from "../lib/geo";

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

interface Extra {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  area: string;
  /** Size relative to the base hospitals (usage + patient load). */
  scale: number;
  /** Days of stock cover per medicine (default 30-60). */
  cover?: Partial<Record<string, number>>;
}

// Fictional facilities at fictional points; not real hospitals.
const EXTRA: Extra[] = [
  { id: "h-x-surathkal", name: "Surathkal Coastal Hospital", latitude: 13.0085, longitude: 74.7965, area: "Surathkal", scale: 1.4, cover: { "m-para": 95, "m-ins": 90, "m-amox": 80 } },
  { id: "h-x-ullal", name: "Ullal Seaside Clinic", latitude: 12.8075, longitude: 74.8585, area: "Ullal", scale: 0.8, cover: { "m-ors": 9 } },
  { id: "h-x-kankanady", name: "Kankanady Medical Centre", latitude: 12.8735, longitude: 74.8620, area: "Kankanady", scale: 1.2, cover: { "m-ibu": 85, "m-ors": 90 } },
  { id: "h-x-bejai", name: "Bejai Community Hospital", latitude: 12.8895, longitude: 74.8445, area: "Bejai", scale: 0.9, cover: { "m-ins": 6 } },
  { id: "h-x-bondel", name: "Bondel Health Centre", latitude: 12.9195, longitude: 74.8705, area: "Bondel", scale: 0.6 },
  { id: "h-x-thokkottu", name: "Thokkottu General", latitude: 12.8225, longitude: 74.8670, area: "Thokkottu", scale: 1.1, cover: { "m-amox": 7 } },
  { id: "h-x-bajpe", name: "Bajpe Airport Road Hospital", latitude: 12.9785, longitude: 74.8845, area: "Bajpe", scale: 0.7, cover: { "m-para": 8, "m-ins": 75 } },
  { id: "h-x-vamanjoor", name: "Vamanjoor District Hospital", latitude: 12.9055, longitude: 74.9265, area: "Vamanjoor", scale: 1.0, cover: { "m-ors": 70 } },
  { id: "h-x-deralakatte", name: "Deralakatte Teaching Hospital", latitude: 12.8105, longitude: 74.8895, area: "Deralakatte", scale: 1.6, cover: { "m-amox": 85, "m-para": 70 } },
  { id: "h-x-kulshekar", name: "Kulshekar Mission Hospital", latitude: 12.8880, longitude: 74.8875, area: "Kulshekar", scale: 0.8, cover: { "m-ibu": 10 } },
];

const BASE_USE: Record<string, number> = { "m-para": 45, "m-ibu": 25, "m-amox": 18, "m-ors": 30, "m-ins": 8 };
const OUTBREAK = { hospitalId: "h-x-ullal", medicineId: "m-ors", days: 5, factor: 3.2 };
const WASTE = { hospitalId: "h-x-surathkal", medicineId: "m-ibu", qty: 1400, expiry: "2026-11-05" };

const END = new Date("2026-10-07T00:00:00Z");
const DAYS = 60;
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const rand = rng(1337);
  const medIds = (await db.select({ id: medicines.id }).from(medicines)).map((r) => r.id);
  const missing = Object.keys(BASE_USE).filter((m) => !medIds.includes(m));
  if (missing.length > 0) throw new Error(`base seed missing medicines: ${missing.join(", ")} (run scripts/seed.ts first)`);
  const base = await db.select({ id: hospitals.id, latitude: hospitals.latitude, longitude: hospitals.longitude }).from(hospitals);
  const baseHosp = base.filter((h) => !h.id.startsWith("h-x-"));
  const ids = EXTRA.map((h) => h.id);

  // Clear only our own rows (FK order).
  await db.delete(dailyUsage).where(inArray(dailyUsage.hospitalId, ids));
  await db.delete(stockBatches).where(like(stockBatches.id, "seedx-%"));
  await db.delete(supplierLeads).where(inArray(supplierLeads.hospitalId, ids));
  await db.delete(transportDays).where(or(inArray(transportDays.fromHospital, ids), inArray(transportDays.toHospital, ids)));
  await db.delete(hospitals).where(inArray(hospitals.id, ids));

  await db.insert(hospitals).values(
    EXTRA.map((h) => ({ id: h.id, name: h.name, latitude: h.latitude, longitude: h.longitude, address: `Demo location near ${h.area}, Mangaluru` })),
  );

  // Usage: weekday pattern, ~5% NULL gaps, outbreak spike on the last days.
  const usage: (typeof dailyUsage.$inferInsert)[] = [];
  for (let d = DAYS - 1; d >= 0; d--) {
    const dt = new Date(END.getTime() - d * 86_400_000);
    const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
    EXTRA.forEach((h, hi) => {
      const load = Math.round((weekend ? 45 : 90) * h.scale * (0.8 + rand() * 0.4));
      Object.keys(BASE_USE).forEach((m, mi) => {
        const gap = (d * 11 + hi * 17 + mi * 23) % 20 === 0;
        const spike = h.id === OUTBREAK.hospitalId && m === OUTBREAK.medicineId && d < OUTBREAK.days ? OUTBREAK.factor : 1;
        const qty = Math.max(0, Math.round(BASE_USE[m] * h.scale * (weekend ? 0.55 : 1) * (0.85 + rand() * 0.3) * spike));
        usage.push({
          usageDate: iso(dt),
          hospitalId: h.id,
          medicineId: m,
          usedQty: gap && spike === 1 ? null : qty,
          patientLoad: load,
          emergencyPct: 5 + Math.floor(rand() * 31) + (spike > 1 ? 15 : 0),
        });
      });
    });
  }
  for (let i = 0; i < usage.length; i += 200) await db.insert(dailyUsage).values(usage.slice(i, i + 200));

  // Stock: cover days x mean daily use (5/7 weekday + 2/7 weekend).
  const batches: (typeof stockBatches.$inferInsert)[] = [];
  let n = 0;
  for (const h of EXTRA) {
    for (const m of Object.keys(BASE_USE)) {
      const daily = BASE_USE[m] * h.scale * (5 + 2 * 0.55) / 7;
      const cover = h.cover?.[m] ?? 30 + Math.floor(rand() * 30);
      batches.push({ id: `seedx-b${++n}`, hospitalId: h.id, medicineId: m, qty: Math.round(daily * cover), expiryDate: "2027-06-30", archived: false, bufferDays: 7 });
    }
  }
  batches.push({ id: "seedx-waste", hospitalId: WASTE.hospitalId, medicineId: WASTE.medicineId, qty: WASTE.qty, expiryDate: WASTE.expiry, archived: false, bufferDays: 7 });
  await db.insert(stockBatches).values(batches);

  // Leads 10-21 d so low-cover positions are genuinely critical.
  const leads = EXTRA.flatMap((h) => Object.keys(BASE_USE).map((m) => ({ hospitalId: h.id, medicineId: m, leadDays: 10 + Math.floor(rand() * 12) })));
  await db.insert(supplierLeads).values(leads);

  // Transport between every pair touching a new hospital: 1 day under 10 km,
  // 2 under 20 km, else 3; self = 0.
  const all = [...baseHosp, ...EXTRA.map((h) => ({ id: h.id, latitude: h.latitude, longitude: h.longitude }))];
  const transport: (typeof transportDays.$inferInsert)[] = [];
  for (const a of all) {
    for (const b of all) {
      if (!ids.includes(a.id) && !ids.includes(b.id)) continue;
      let days = 0;
      if (a.id !== b.id) {
        const km = a.latitude != null && b.latitude != null && a.longitude != null && b.longitude != null
          ? haversineM({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }) / 1000
          : 15;
        days = km < 10 ? 1 : km < 20 ? 2 : 3;
      }
      transport.push({ fromHospital: a.id, toHospital: b.id, days });
    }
  }
  for (let i = 0; i < transport.length; i += 200) await db.insert(transportDays).values(transport.slice(i, i + 200));

  console.log(JSON.stringify({ hospitals: EXTRA.length, usage: usage.length, batches: batches.length, leads: leads.length, transport: transport.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
