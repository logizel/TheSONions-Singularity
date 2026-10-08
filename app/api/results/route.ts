import { NextResponse } from "next/server";

export const runtime = "nodejs";

import type { ResultsJSON } from "@/lib/contracts";
import { getResults } from "@/lib/network";

// GET /api/results: the one ResultsJSON v2 snapshot the dashboard, chat and
// cart read (Phase 6, D-02). Live Neon -> engine, cached briefly; falls back
// to the last written blob (X-Results-Source: snapshot) when the DB is down.
// Auth enforced by middleware.ts (D-05); no session logic here.
export async function GET(): Promise<NextResponse<ResultsJSON | { error: string }>> {
  const envelope = await getResults();
  if (envelope === null) {
    return NextResponse.json({ error: "Results not available" }, { status: 503 });
  }
  return NextResponse.json(envelope.results, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Results-Source": envelope.source,
    },
  });
}
