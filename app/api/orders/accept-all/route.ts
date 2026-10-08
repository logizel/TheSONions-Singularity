import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { getResults } from "@/lib/network";
import { isApiError } from "@/lib/orders";
import { acceptLines } from "@/lib/orders/service";
import { logActivity } from "@/lib/logs";
import { actorOf, describeOrder, errorResponse, NO_STORE, ordersUnavailable, readJson, sessionOf } from "../_shared";

// POST /api/orders/accept-all  (empty body or {})
// Accepts every engine transfer in the live snapshot at its engine qty.
// Lines already accepted are returned, not duplicated; new lines on one
// lane become one order.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await readJson(req, true);
  if (isApiError(body)) return errorResponse(body);
  if (typeof body !== "object" || body === null || Array.isArray(body) || Object.keys(body).length > 0) {
    return errorResponse({ status: 400, error: "accept-all takes no parameters" });
  }

  const envelope = await getResults();
  if (envelope === null) return errorResponse({ status: 503, error: "Results not available" });
  const lines = envelope.results.transfers.map((transfer) => ({ transfer, qty: transfer.qty }));

  try {
    const outcome = await acceptLines(envelope.results, lines);
    if (outcome.created > 0) {
      const actor = actorOf(sessionOf(req));
      // Orders created by this call share one accepted_at (the newest).
      const newest = outcome.orders.reduce((m, o) => (o.acceptedAt > m ? o.acceptedAt : m), "");
      for (const o of outcome.orders) {
        if (o.acceptedAt !== newest) continue;
        await logActivity(actor, "order_accept", `Accepted (accept all) ${describeOrder(o, envelope.results)}`, {
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
