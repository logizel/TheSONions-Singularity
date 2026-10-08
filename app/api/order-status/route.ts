import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { visibleOrders, type Order } from "@/lib/orders";
import { listOrders } from "@/lib/orders/store";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// GET /api/order-status: read-only order tracking for both roles (Phase 6).
// Outside /api/orders so middleware's network_admin gate does not apply;
// scoped here instead: network_admin sees every order, hospital_admin only
// orders to or from its own hospital. Writes stay under /api/orders.
export async function GET(req: NextRequest): Promise<NextResponse<{ orders: Order[] } | { error: string }>> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (session === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orders = visibleOrders(await listOrders(), session.role, session.hospitalId);
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Order store unavailable" }, { status: 503 });
  }
}
