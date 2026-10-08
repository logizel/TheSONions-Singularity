import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { getOrder } from "@/lib/orders/store";
import { errorResponse, NO_STORE, ORDER_ID, ordersUnavailable } from "../_shared";

// GET /api/orders/<id>: one order with its lines (network_admin only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  if (!ORDER_ID.test(id)) return errorResponse({ status: 404, error: "Order not found" });
  try {
    const order = await getOrder(id);
    if (!order) return errorResponse({ status: 404, error: "Order not found" });
    return NextResponse.json({ order }, { headers: NO_STORE });
  } catch {
    return errorResponse(ordersUnavailable);
  }
}
