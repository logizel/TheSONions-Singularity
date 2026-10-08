import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { getResults } from "@/lib/network";
import { isApiError, parseAcceptBody, resolveTransfer } from "@/lib/orders";
import { acceptLines } from "@/lib/orders/service";
import { errorResponse, NO_STORE, ordersUnavailable, readJson } from "../_shared";

// POST /api/orders/accept  { fromHospital, toHospital, medicineId, qty? }
// Accepts one engine transfer line. Ids must exist, the engine must have
// suggested this lane + medicine in the live snapshot, and qty <= the engine
// qty. Idempotent: a repeat returns the existing order (200, created: 0).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await readJson(req);
  if (isApiError(body)) return errorResponse(body);
  const parsed = parseAcceptBody(body);
  if (isApiError(parsed)) return errorResponse(parsed);

  const envelope = await getResults();
  if (envelope === null) return errorResponse({ status: 503, error: "Results not available" });
  const line = resolveTransfer(envelope.results, parsed);
  if (isApiError(line)) return errorResponse(line);

  try {
    const outcome = await acceptLines(envelope.results, [line]);
    return NextResponse.json(outcome, { status: outcome.created > 0 ? 201 : 200, headers: NO_STORE });
  } catch {
    return errorResponse(ordersUnavailable);
  }
}
