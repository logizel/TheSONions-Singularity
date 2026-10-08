import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { LOG_ACTIONS, listLogs, type LogAction, type LogEntry } from "@/lib/logs";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// GET /api/logs?hospital=<id>&action=<action>&limit=<n>
// Activity log for both roles, scoped in lib/logs: network_admin sees every
// row; hospital_admin sees its own actions and anything involving its hospital.
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function GET(req: NextRequest): Promise<NextResponse<{ logs: LogEntry[] } | { error: string }>> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const hospital = q.get("hospital");
  const action = q.get("action");
  const limit = Number(q.get("limit") ?? 100);
  if (hospital !== null && !ID.test(hospital)) return NextResponse.json({ error: "Bad hospital id" }, { status: 400 });
  if (action !== null && !(LOG_ACTIONS as readonly string[]).includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!Number.isFinite(limit)) return NextResponse.json({ error: "Bad limit" }, { status: 400 });
  try {
    const logs = await listLogs(
      { role: session.role, hospitalId: session.hospitalId ?? null },
      { hospitalId: hospital ?? undefined, action: (action as LogAction) ?? undefined, limit },
    );
    return NextResponse.json({ logs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Activity log unavailable" }, { status: 503 });
  }
}
