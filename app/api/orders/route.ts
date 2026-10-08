import { NextResponse } from "next/server";

export const runtime = "nodejs";

import type { Order } from "@/lib/orders";
import { listOrders } from "@/lib/orders/store";
import { errorResponse, NO_STORE, ordersUnavailable } from "./_shared";

// GET /api/orders: every transfer order, newest first (network_admin only,
// enforced by middleware.ts). Hospital admins read /api/order-status.
export async function GET(): Promise<NextResponse<{ orders: Order[] } | { error: string }>> {
  try {
    return NextResponse.json({ orders: await listOrders() }, { headers: NO_STORE });
  } catch {
    return errorResponse(ordersUnavailable);
  }
}
