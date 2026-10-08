import { NextResponse } from "next/server";

export const runtime = "nodejs";

import {
  getHospitalLocations,
  type HospitalLocationsResponse,
} from "@/lib/hospital-locations";

// GET /api/hospital-locations — hospital markers + center/bounds for the
// react-leaflet map, read from Neon `hospitals` (Phase 6, D-04). Auth
// enforced by middleware.ts (D-05); no session logic here. Lives outside
// /api/hospitals/ so middleware write-scoping never applies. Only GET is
// exported, so Next answers other methods with 405.
export async function GET(): Promise<
  NextResponse<HospitalLocationsResponse | { error: string }>
> {
  let locations: HospitalLocationsResponse | null;
  try {
    locations = await getHospitalLocations();
  } catch {
    return NextResponse.json(
      { error: "Hospital locations unavailable" },
      { status: 503 },
    );
  }
  if (locations === null) {
    return NextResponse.json(
      { error: "Hospital locations unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json(locations, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
