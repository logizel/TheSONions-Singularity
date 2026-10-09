import type { ResultsJSON } from "../contracts";

// Quote view (Phase 6, D-11): joins ResultsJSON v2 ids to display names so
// templates can quote rows directly. No arithmetic, rounding or unit
// conversion: every number is copied verbatim from ResultsJSON, and the
// validator still checks answers against the raw ResultsJSON.
export interface QuoteView {
  hospitals: Record<string, unknown>[];
  stockouts: Record<string, unknown>[];
  waste: Record<string, unknown>[];
  transfers: Record<string, unknown>[];
  /** EVT-05: one row per engine-emitted event reason, copied verbatim. */
  events: Record<string, unknown>[];
}

function comparison(a: number, b: number): string {
  if (a < b) return "shorter than";
  if (a > b) return "longer than";
  return "equal to";
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

export function quoteView(results: ResultsJSON): QuoteView {
  const hospitalName = new Map(results.hospitals.map((h) => [h.hospitalId, h.hospitalName]));
  const medicineName = new Map(results.medicines.map((m) => [m.medicineId, m.medicineName]));
  const hName = (id: string) => hospitalName.get(id) ?? id;
  const mName = (id: string) => medicineName.get(id) ?? id;

  return {
    hospitals: results.hospitals.map((h) => ({
      hospitalName: h.hospitalName,
      riskScore: h.riskScore,
      daysUntilStockout: h.daysUntilStockout,
    })),
    // Most urgent first, so an unscoped question quotes the worst position.
    stockouts: [...results.inventory]
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)
      .map((e) => ({
        hospitalName: hName(e.hospitalId),
        medicineName: mName(e.medicineId),
        daysUntilStockout: e.daysUntilStockout,
        supplierLeadTime: e.leadDays,
        leadTimeComparison: comparison(e.daysUntilStockout, e.leadDays),
      })),
    waste: results.wasteWarnings.map((w) => ({
      hospitalName: hName(w.hospitalId),
      medicineName: mName(w.medicineId),
      wasteUnits: w.wasteUnits,
      expiryDays: w.expiryDays,
    })),
    transfers: results.transfers.map((t) => ({
      transferUnits: t.qty,
      medicineName: mName(t.medicineId),
      senderHospital: hName(t.fromHospital),
      receiverHospital: hName(t.toHospital),
      reason: [t.checksPassed[0], t.checksPassed[4]]
        .filter((c): c is string => typeof c === "string")
        .map(lowerFirst)
        .join(", and "),
    })),
    events: results.forecasts.flatMap((f) =>
      (f.eventReasons ?? []).map((eventReason) => ({
        hospitalName: hName(f.hospitalId),
        medicineName: mName(f.medicineId),
        eventReason,
      })),
    ),
  };
}
