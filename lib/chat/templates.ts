import type { QuoteView } from "./quotes";

export const REJECTION_SENTENCE =
  "I can only answer questions about hospital risk, stockouts, waste, and transfers using current system data.";

// --- Loose field accessors -------------------------------------------------
// lib/contracts.ts is a Phase 1 stub (replaced by the frozen contract later).
// Templates read the fields D-10 names via unknown-safe access so the file
// compiles against the stub today and against the frozen contract tomorrow.

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v !== null && typeof v === "object") return v as Record<string, unknown>;
  return null;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

function num(v: unknown): number | string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

// Candidate data rows: every top-level collection we might quote from, plus
// per-hospital medicine rows if the blob nests them.
function candidateRows(view: QuoteView): Record<string, unknown>[] {
  const r = asRecord(view);
  if (r === null) return [];
  const rows: Record<string, unknown>[] = [];
  for (const key of ["hospitals", "stockouts", "waste", "wastes", "expiry", "transfers", "moves", "orders", "events"]) {
    const v = r[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        const rec = asRecord(item);
        if (rec) {
          rows.push(rec);
          for (const nestedKey of ["medicines", "items", "stock"]) {
            const nested = rec[nestedKey];
            if (Array.isArray(nested)) {
              for (const n of nested) {
                const nrec = asRecord(n);
                if (nrec) rows.push({ ...nrec, hospitalName: nrec.hospitalName ?? rec.hospitalName });
              }
            }
          }
        }
      }
    }
  }
  return rows;
}

function matchesParam(row: Record<string, unknown>, param: unknown, fields: string[]): boolean {
  if (typeof param !== "string" || param.length === 0) return true;
  const p = param.toLowerCase();
  return fields.some((f) => {
    const v = row[f];
    return typeof v === "string" && v.toLowerCase().includes(p);
  });
}

// Quote-only: every value in the answer is interpolated straight from
// ResultsJSON. No arithmetic, rounding, or unit conversion (D-10, D-13).
export function fillTemplate(
  intent: string,
  params: object,
  view: QuoteView,
): string {
  if (view === null || typeof view !== "object") {
    return REJECTION_SENTENCE;
  }

  const rows = candidateRows(view);
  const p = asRecord(params) ?? {};

  if (intent === "most-at-risk") {
    const candidates = rows.filter(
      (r) =>
        typeof r.hospitalName === "string" &&
        num(r.riskScore) !== undefined &&
        num(r.daysUntilStockout) !== undefined &&
        matchesParam(r, p.hospitalName, ["hospitalName"]),
    );
    if (candidates.length === 0) return REJECTION_SENTENCE;
    let top = candidates[0];
    for (const r of candidates) {
      if (Number(r.riskScore) > Number(top.riskScore)) top = r;
    }
    return `Hospital ${top.hospitalName} is most at risk with a risk score of ${top.riskScore} and ${top.daysUntilStockout} days until stockout.`;
  }

  if (intent === "stockout-timing") {
    const hit = rows.find(
      (r) =>
        num(r.daysUntilStockout) !== undefined &&
        num(r.supplierLeadTime) !== undefined &&
        str(r.leadTimeComparison) !== undefined &&
        str(r.hospitalName) !== undefined &&
        str(r.medicineName) !== undefined &&
        matchesParam(r, p.hospitalName, ["hospitalName"]) &&
        matchesParam(r, p.medicineName, ["medicineName"]),
    );
    if (!hit) return REJECTION_SENTENCE;
    return `Hospital ${hit.hospitalName} will run out of ${hit.medicineName} in ${hit.daysUntilStockout} days, which is ${hit.leadTimeComparison} the supplier lead time of ${hit.supplierLeadTime} days.`;
  }

  if (intent === "waste-quantities") {
    const hit = rows.find(
      (r) =>
        num(r.wasteUnits) !== undefined &&
        num(r.expiryDays) !== undefined &&
        str(r.hospitalName) !== undefined &&
        str(r.medicineName) !== undefined &&
        matchesParam(r, p.hospitalName, ["hospitalName"]) &&
        matchesParam(r, p.medicineName, ["medicineName"]),
    );
    if (!hit) return REJECTION_SENTENCE;
    return `Hospital ${hit.hospitalName} has ${hit.wasteUnits} units of ${hit.medicineName} expiring unused within ${hit.expiryDays} days.`;
  }

  if (intent === "transfer-reasons") {
    const hit = rows.find(
      (r) =>
        num(r.transferUnits) !== undefined &&
        str(r.medicineName) !== undefined &&
        str(r.reason) !== undefined &&
        (str(r.senderHospital) !== undefined || str(r.sender) !== undefined) &&
        (str(r.receiverHospital) !== undefined || str(r.receiver) !== undefined) &&
        matchesParam(r, p.hospitalName, ["senderHospital", "receiverHospital", "sender", "receiver"]) &&
        matchesParam(r, p.medicineName, ["medicineName"]),
    );
    if (!hit) return REJECTION_SENTENCE;
    const sender = str(hit.senderHospital) ?? str(hit.sender);
    const receiver = str(hit.receiverHospital) ?? str(hit.receiver);
    return `Transfer ${hit.transferUnits} units of ${hit.medicineName} from ${sender} to ${receiver} because ${hit.reason}.`;
  }

  if (intent === "event-reasons") {
    const hit = rows.find(
      (r) =>
        str(r.eventReason) !== undefined &&
        str(r.hospitalName) !== undefined &&
        str(r.medicineName) !== undefined &&
        matchesParam(r, p.hospitalName, ["hospitalName"]) &&
        matchesParam(r, p.medicineName, ["medicineName"]),
    );
    if (!hit) return REJECTION_SENTENCE;
    return `Demand for ${hit.medicineName} at ${hit.hospitalName} is expected to rise: ${hit.eventReason}.`;
  }

  return REJECTION_SENTENCE;
}
