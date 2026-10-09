import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { logActivity } from "@/lib/logs";
import { resetResultsCache } from "@/lib/network";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { addBatch, adjustStockDown, recordUsage } from "@/scripts/entry";

const NO_STORE = { "Cache-Control": "private, no-store" };

type Body = {
  action?: unknown;
  hospitalId?: unknown;
  medicineId?: unknown;
  qty?: unknown;
  expiryDate?: unknown;
  usageDate?: unknown;
  usedQty?: unknown;
  patientLoad?: unknown;
  emergencyPct?: unknown;
  /** Display-only text for the activity-log summary; never used for writes. */
  hospitalName?: unknown;
  medicineName?: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
/** Display text is capped and falls back to the id, so the summary always names the pair. */
const nameOrId = (v: unknown, id: string) => str(v).slice(0, 120) || id;

// POST /api/inventory  manual stock entry for one hospital + medicine.
//   { action: "add", hospitalId, medicineId, qty, expiryDate }       new batch
//   { action: "remove", hospitalId, medicineId, qty }                used/damaged, earliest expiry first
//   { action: "usage", hospitalId, medicineId, usageDate, usedQty, patientLoad, emergencyPct }
// A hospital admin may write only to its own hospital; the network admin to any.
// `hospitalName` / `medicineName` are client-supplied display text used only in
// the activity-log summary (capped, id fallback); ids stay the write values.
// D-18: a blank/absent usedQty in "usage" is a NULL missing day, not an error.
// The sheet builds its body with lib/stock/form buildStockBody, which normalises
// these two rules; the route re-checks them because it is the trust boundary.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => undefined)) as Body | undefined;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const action = str(body.action);
  const hospitalId = str(body.hospitalId);
  const medicineId = str(body.medicineId);
  if (!hospitalId || !medicineId) return NextResponse.json({ error: "Pick a hospital and a medicine" }, { status: 400 });
  if (session.role !== "network_admin" && session.hospitalId !== hospitalId) {
    return NextResponse.json({ error: "You can only enter stock for your own hospital" }, { status: 403 });
  }
  const hospName = nameOrId(body.hospitalName, hospitalId);
  const medName = nameOrId(body.medicineName, medicineId);

  let summary: string;
  let logAction: "stock_added" | "stock_removed" | "usage_recorded";
  try {
    if (action === "add") {
      const qty = int(body.qty);
      const expiryDate = str(body.expiryDate);
      await addBatch(hospitalId, medicineId, qty, expiryDate);
      logAction = "stock_added";
      summary = `Added ${qty} units of ${medName} at ${hospName}, expiry ${expiryDate}`;
    } else if (action === "remove") {
      const qty = int(body.qty);
      await adjustStockDown(hospitalId, medicineId, qty);
      logAction = "stock_removed";
      summary = `Removed ${qty} units of ${medName} at ${hospName}`;
    } else if (action === "usage") {
      const usageDate = str(body.usageDate);
      // D-18: blank/absent used qty is a NULL missing day; a non-numeric one still 400s.
      const usedRaw = body.usedQty;
      const usedQty =
        usedRaw === null || usedRaw === undefined || (typeof usedRaw === "string" && usedRaw.trim() === "") ? null : int(usedRaw);
      await recordUsage(usageDate, hospitalId, medicineId, usedQty, int(body.patientLoad), int(body.emergencyPct));
      logAction = "usage_recorded";
      summary = `Recorded ${usedQty === null ? "a missing day" : `${usedQty} units`} of ${medName} at ${hospName} on ${usageDate}`;
    } else {
      return NextResponse.json({ error: 'action must be "add", "remove" or "usage"' }, { status: 400 });
    }
  } catch (e) {
    // entry.ts throws plain Errors for bad input (unknown ids, bad numbers/dates, short stock).
    const msg = e instanceof Error ? e.message : "";
    if (/^(bad |unknown |insufficient )/.test(msg)) return NextResponse.json({ error: msg }, { status: 400 });
    return NextResponse.json({ error: "Stock store unavailable" }, { status: 503, headers: NO_STORE });
  }

  resetResultsCache();
  await logActivity(
    { role: session.role, hospitalId: session.hospitalId ?? null },
    logAction,
    summary,
    { hospitals: [hospitalId] },
  );
  return NextResponse.json({ ok: true }, { status: 201, headers: NO_STORE });
}
