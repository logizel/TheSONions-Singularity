// Raw data export (D-19): one sheet per table, headers only, no computed
// risk/moves columns (Phase 2 outputs are out of scope).
import * as XLSX from "xlsx";

import { db } from "../db/client";
import {
  dailyUsage,
  hospitals,
  medicines,
  stockBatches,
  supplierLeads,
  transportDays,
} from "../db/schema";

async function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: tsx scripts/excel-export.ts <out.xlsx>");
    process.exit(2);
  }
  const wb = XLSX.utils.book_new();
  const sheets: Array<[string, unknown[]]> = [
    ["hospitals", await db.select().from(hospitals)],
    ["medicines", await db.select().from(medicines)],
    ["stock_batches", await db.select().from(stockBatches)],
    ["daily_usage", await db.select().from(dailyUsage)],
    ["transport_days", await db.select().from(transportDays)],
    ["supplier_leads", await db.select().from(supplierLeads)],
  ];
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  XLSX.writeFile(wb, out);

  // Self-verify: re-read and compare row counts.
  const back = XLSX.readFile(out);
  let ok = true;
  for (const [name, rows] of sheets) {
    const sheet = back.Sheets[name];
    if (!sheet) {
      console.error(`missing sheet: ${name}`);
      ok = false;
      continue;
    }
    const n = XLSX.utils.sheet_to_json(sheet).length;
    console.log(`${name}: db=${rows.length} xlsx=${n}`);
    if (n !== rows.length) ok = false;
  }
  if (!ok) process.exit(1);
  console.log(`wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
