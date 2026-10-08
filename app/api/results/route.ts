import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

import type { ResultsJSON } from "@/lib/contracts";

// GET /api/results — serves the precomputed ResultsJSON blob verbatim.
// Auth enforced by middleware.ts (D-05); no session logic here.
// D-02: read the blob the engine job wrote; D-03: rich envelope fields
// (generatedAt, mape, advisoryFlags, outbreakMarkers) ride inside the blob;
// D-04: shape comes from the frozen lib/contracts.ts type.
export async function GET(): Promise<NextResponse> {
  const blobPath = process.env.RESULTS_BLOB_PATH ?? "/tmp/results.json";
  let resultsJson: ResultsJSON;
  try {
    resultsJson = JSON.parse(await readFile(blobPath, "utf8")) as ResultsJSON;
  } catch {
    return NextResponse.json({ error: "Results not available" }, { status: 503 });
  }

  return NextResponse.json(resultsJson, {
    headers: { "Content-Type": "application/json" },
  });
}
