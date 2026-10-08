import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import {
  getHospitalLocations,
  type HospitalLocation,
} from "@/lib/hospital-locations";
import { createRouter, routingBaseUrl, type RouteResult } from "@/lib/routing";

// GET /api/route?from=<hospitalId>&to=<hospitalId> — road route between two
// hospitals for the map (Phase 6, D-06). Ids are resolved server-side from
// Neon; raw coordinates are never accepted from the client. OSRM failures
// degrade to a straight line ({ approximate: true }). Auth enforced by
// middleware.ts (D-05); no session logic here.

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// One router per server instance: its pair cache survives across requests.
const router = createRouter({ baseUrl: routingBaseUrl(process.env.ROUTING_BASE_URL) });

type RouteResponse = RouteResult & { from: string; to: string };

export async function GET(
  req: NextRequest,
): Promise<NextResponse<RouteResponse | { error: string }>> {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (from === null || to === null || !ID_PATTERN.test(from) || !ID_PATTERN.test(to)) {
    return NextResponse.json(
      { error: "from and to must be hospital ids" },
      { status: 400 },
    );
  }
  if (from === to) {
    return NextResponse.json({ error: "from and to must differ" }, { status: 400 });
  }

  let hospitals: HospitalLocation[];
  try {
    hospitals = (await getHospitalLocations())?.hospitals ?? [];
  } catch {
    return NextResponse.json({ error: "Routing unavailable" }, { status: 503 });
  }
  const a = hospitals.find((h) => h.id === from);
  const b = hospitals.find((h) => h.id === to);
  if (!a || !b) {
    return NextResponse.json(
      { error: "Hospital location not found" },
      { status: 404 },
    );
  }

  const route = await router.getRoute(a, b);
  return NextResponse.json(
    { from, to, ...route },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
