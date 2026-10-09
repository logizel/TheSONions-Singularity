import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { EVENT_LABEL } from "@/lib/engine/events";
import { EVENT_ID } from "@/lib/events";
import { endEvent } from "@/lib/events/store";
import { logActivity } from "@/lib/logs";
import { resetResultsCache, todayIso } from "@/lib/network";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const NO_STORE = { "Cache-Control": "private, no-store" };

// POST /api/events/<id>/end: ends the event as of today (network_admin only).
// The row is kept; ends_on moves to yesterday so the engine ignores it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "network_admin") return NextResponse.json({ error: "Network admin only" }, { status: 403 });
  const { id } = await params;
  if (!EVENT_ID.test(id)) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  try {
    const event = await endEvent(id, todayIso());
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    resetResultsCache();
    await logActivity({ role: "network_admin" }, "event_ended", `Ended ${EVENT_LABEL[event.type]} (${event.id})`);
    return NextResponse.json({ event }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Event store unavailable" }, { status: 503, headers: NO_STORE });
  }
}
