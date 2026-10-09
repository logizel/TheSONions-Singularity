import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import type { LocalEventRow } from "@/lib/contracts";
import { EVENT_LABEL } from "@/lib/engine/events";
import { parseEventInput } from "@/lib/events";
import { createEvent, listEvents } from "@/lib/events/store";
import { logActivity } from "@/lib/logs";
import { resetResultsCache } from "@/lib/network";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const NO_STORE = { "Cache-Control": "private, no-store" };

// GET /api/events: every local event (any signed-in admin; aggregates only).
export async function GET(req: NextRequest): Promise<NextResponse<{ events: LocalEventRow[] } | { error: string }>> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ events: await listEvents() }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Event store unavailable" }, { status: 503, headers: NO_STORE });
  }
}

// POST /api/events  { type, latitude, longitude, radiusKm, startsOn, endsOn, severity, note? }
// network_admin only (middleware blocks others too; checked again here).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "network_admin") return NextResponse.json({ error: "Network admin only" }, { status: 403 });
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  const parsed = parseEventInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const event = await createEvent(parsed.value);
    resetResultsCache();
    await logActivity(
      { role: "network_admin" },
      "event_added",
      `Added ${EVENT_LABEL[event.type]} (severity ${event.severity}), ${event.radiusKm} km radius, ${event.startsOn} to ${event.endsOn}`,
    );
    return NextResponse.json({ event }, { status: 201, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Event store unavailable" }, { status: 503, headers: NO_STORE });
  }
}
