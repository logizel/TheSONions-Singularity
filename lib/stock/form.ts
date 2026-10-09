/**
 * Request-body builder for the manual stock entry sheet (DATA-01/DATA-02).
 * The sheet builds its POST /api/inventory body here so the blank-used-qty
 * rule (D-18: an empty used qty is a NULL "missing day", not a validation
 * error) is tested once, and the route stays a thin auth + validation shell.
 * Pure: no I/O, no clock, no DB import — vitest runs it directly.
 *
 * Ids are the only values the write path trusts; the display names travel
 * alongside them purely so the activity-log summary can read well.
 */
export const STOCK_ACTIONS = ["add", "remove", "usage"] as const;
export type StockAction = (typeof STOCK_ACTIONS)[number];

/** Raw input strings, exactly as the sheet's controlled inputs hold them. */
export interface StockForm {
  action: StockAction;
  hospitalId: string;
  medicineId: string;
  qty: string;
  expiryDate: string;
  usageDate: string;
  usedQty: string;
  patientLoad: string;
  emergencyPct: string;
}

/** Client-supplied display text for the log summary; never used for writes. */
export interface StockDisplayNames {
  hospitalName: string;
  medicineName: string;
}

export function buildStockBody(form: StockForm, names: StockDisplayNames): Record<string, unknown> {
  const action = String(form.action);
  if (action !== "add" && action !== "remove" && action !== "usage") {
    throw new Error(`unknown stock action "${action}"`);
  }
  const body: Record<string, unknown> = {
    action,
    hospitalId: form.hospitalId.trim(),
    medicineId: form.medicineId.trim(),
    hospitalName: names.hospitalName.trim(),
    medicineName: names.medicineName.trim(),
  };
  if (action === "add") {
    body.qty = Number(form.qty.trim());
    body.expiryDate = form.expiryDate.trim();
  } else if (action === "remove") {
    body.qty = Number(form.qty.trim());
  } else {
    // D-18: blank used qty is a missing day, stored as NULL.
    const used = form.usedQty.trim();
    body.usageDate = form.usageDate.trim();
    body.usedQty = used === "" ? null : Number(used);
    body.patientLoad = Number(form.patientLoad.trim());
    body.emergencyPct = Number(form.emergencyPct.trim());
  }
  return body;
}
