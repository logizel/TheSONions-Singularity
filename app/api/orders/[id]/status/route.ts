import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { isApiError, isOrderStatus, parseStatusBody } from "@/lib/orders";
import { getOrder, updateStatus } from "@/lib/orders/store";
import { canActForSender, errorResponse, NO_STORE, notSender, ORDER_ID, ordersUnavailable, readJson, sessionOf } from "../../_shared";

// POST /api/orders/<id>/status  { status: packed | in_transit | delivered | cancelled }
// One step at a time (409 on a skip or a final state); repeating the current
// status is a no-op (200, changed: false). Never touches stock_batches.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  if (!ORDER_ID.test(id)) return errorResponse({ status: 404, error: "Order not found" });
  const body = await readJson(req);
  if (isApiError(body)) return errorResponse(body);
  const parsed = parseStatusBody(body);
  if (isApiError(parsed)) return errorResponse(parsed);
  if (!isOrderStatus(parsed.status) || parsed.status === "accepted") {
    return errorResponse({ status: 400, error: "status must be packed, in_transit, delivered or cancelled" });
  }

  try {
    const existing = await getOrder(id);
    if (!existing) return errorResponse({ status: 404, error: "Order not found" });
    if (!canActForSender(sessionOf(req), existing.fromHospital)) return errorResponse(notSender);
    const result = await updateStatus(id, parsed.status, new Date().toISOString());
    if (result.kind === "not_found") return errorResponse({ status: 404, error: "Order not found" });
    if (result.kind === "invalid") return errorResponse({ status: 409, error: result.reason });
    return NextResponse.json({ order: result.order, changed: result.changed }, { headers: NO_STORE });
  } catch {
    return errorResponse(ordersUnavailable);
  }
}
