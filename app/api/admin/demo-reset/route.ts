import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { logActivity } from "@/lib/logs";
import { resetResultsCache } from "@/lib/network";
import { resetDemo } from "@/lib/orders/stockdb";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// POST /api/admin/demo-reset  { "confirm": "RESET" }  (network_admin only)
// Puts back every unit a delivery moved, then clears orders, stock movements
// and the activity log, so a demo can start clean. Leaves one log entry.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "network_admin") return NextResponse.json({ error: "Network admin only" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== "RESET") return NextResponse.json({ error: 'Body must be { "confirm": "RESET" }' }, { status: 400 });
  try {
    const counts = await resetDemo();
    resetResultsCache();
    await logActivity(
      { role: "network_admin" },
      "demo_reset",
      `Demo reset: removed ${counts.orders} orders, reversed ${counts.movements} stock movements, cleared ${counts.logs} log entries`,
    );
    return NextResponse.json({ ok: true, ...counts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reset failed; nothing was changed" }, { status: 503 });
  }
}
