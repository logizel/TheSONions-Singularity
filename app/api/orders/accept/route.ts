import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { getResults } from "@/lib/network";
import { isApiError, parseAcceptBody, resolveTransfer } from "@/lib/orders";
import { acceptLines } from "@/lib/orders/service";
import { logActivity } from "@/lib/logs";
import { actorOf, canActForSender, describeOrder, errorResponse, NO_STORE, notSender, ordersUnavailable, readJson, sessionOf } from "../_shared";

// POST /api/orders/accept  { fromHospital, toHospital, medicineId, qty? }
// Accepts one engine transfer line. Ids must exist, the engine must have
// suggested this lane + medicine in the live snapshot, and qty <= the engine
// qty. Idempotent: a repeat returns the existing order (200, created: 0).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await readJson(req);
  if (isApiError(body)) return errorResponse(body);
  const parsed = parseAcceptBody(body);
  if (isApiError(parsed)) return errorResponse(parsed);
  const session = sessionOf(req);
  const actor = actorOf(session);
  const envelope = await getResults();
  const hName = (id: string) => envelope?.results.hospitals.find((h) => h.hospitalId === id)?.hospitalName ?? id;
  if (!canActForSender(session, parsed.fromHospital)) {
    await logActivity(actor, "action_rejected", `Tried to accept a transfer from ${hName(parsed.fromHospital)} to ${hName(parsed.toHospital)} (not the sender)`, {
      hospitals: [parsed.fromHospital, parsed.toHospital],
    });
    return errorResponse(notSender);
  }

  if (envelope === null) return errorResponse({ status: 503, error: "Results not available" });
  const line = resolveTransfer(envelope.results, parsed);
  if (isApiError(line)) {
    if (line.status === 422) {
      await logActivity(actor, "action_rejected", `Accept refused: ${line.error}`, { hospitals: [parsed.fromHospital, parsed.toHospital] });
    }
    return errorResponse(line);
  }

  try {
    const outcome = await acceptLines(envelope.results, [line]);
    if (outcome.created > 0) {
      for (const o of outcome.orders) {
        await logActivity(actor, "order_accept", `Accepted ${describeOrder(o, envelope.results)}`, {
          orderId: o.id,
          hospitals: [o.fromHospital, o.toHospital],
        });
      }
    }
    return NextResponse.json(outcome, { status: outcome.created > 0 ? 201 : 200, headers: NO_STORE });
  } catch {
    return errorResponse(ordersUnavailable);
  }
}
