// Bulk history import (D-16/D-17/D-18): long rows, partial success with
// per-row error report, duplicate key overwrites (idempotent re-upload).
import { readFileSync } from "node:fs";

import { dailyUsage, hospitals, medicines } from "../db/schema";
import { db } from "../db/client";

const HEADER = "date,hospital,medicine,used_qty,patient_load,emergency_pct";

interface RowError {
  line: number;
  reason: string;
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// Minimal RFC-4180 field splitter (WR-02): handles quoted commas and escaped
// quotes (Excel exports quote fields containing commas). Unquoted path is
// identical to the old split(",") behavior.
function splitRow(line: string): string[] {
  if (!line.includes('"')) return line.split(",").map((p) => p.trim());
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/csv-import.ts <file.csv>");
    process.exit(2);
  }
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== HEADER) {
    console.error(`bad header: expected "${HEADER}"`);
    process.exit(2);
  }

  const knownHospitals = new Set(
    (await db.select({ id: hospitals.id }).from(hospitals)).map((r) => r.id),
  );
  const knownMedicines = new Set(
    (await db.select({ id: medicines.id }).from(medicines)).map((r) => r.id),
  );

  let imported = 0;
  const errors: RowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const line = i + 1;
    const parts = splitRow(raw);
    if (parts.length !== 6) {
      errors.push({ line, reason: `expected 6 columns, got ${parts.length}` });
      continue;
    }
    const [date, hospital, medicine, usedQtyRaw, loadRaw, pctRaw] = parts;
    if (!isIsoDate(date)) {
      errors.push({ line, reason: `bad date "${date}" (want YYYY-MM-DD)` });
      continue;
    }
    if (!knownHospitals.has(hospital)) {
      errors.push({ line, reason: `unknown hospital "${hospital}"` });
      continue;
    }
    if (!knownMedicines.has(medicine)) {
      errors.push({ line, reason: `unknown medicine "${medicine}" (coded master only, no free text)` });
      continue;
    }
    // Empty used_qty = NULL missing day (D-10).
    let usedQty: number | null = null;
    if (usedQtyRaw !== "") {
      const q = Number(usedQtyRaw);
      if (!Number.isInteger(q) || q < 0) {
        errors.push({ line, reason: `bad used_qty "${usedQtyRaw}" (integer >= 0 or empty)` });
        continue;
      }
      usedQty = q;
    }
    const load = Number(loadRaw);
    if (!Number.isInteger(load) || load < 0) {
      errors.push({ line, reason: `bad patient_load "${loadRaw}" (integer >= 0)` });
      continue;
    }
    const pct = Number(pctRaw);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      errors.push({ line, reason: `bad emergency_pct "${pctRaw}" (integer 0-100)` });
      continue;
    }

    // Duplicate key overwrites: re-upload is the correction path (D-18).
    await db
      .insert(dailyUsage)
      .values({
        usageDate: date, hospitalId: hospital, medicineId: medicine,
        usedQty: usedQty, patientLoad: load, emergencyPct: pct,
      })
      .onConflictDoUpdate({
        target: [dailyUsage.usageDate, dailyUsage.hospitalId, dailyUsage.medicineId],
        set: { usedQty: usedQty, patientLoad: load, emergencyPct: pct },
      });
    imported++;
  }

  console.log(`imported ${imported}, rejected ${errors.length}`);
  for (const e of errors) console.log(`line ${e.line}: ${e.reason}`);
  if (imported === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
