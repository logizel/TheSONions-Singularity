#!/usr/bin/env node
/**
 * Write the ResultsJSON v2 snapshot from the live DB (Phase 6, D-02).
 *
 * Reads Neon read-only (no writes), runs the engine through lib/network and
 * writes the blob /api/results falls back to when the DB is unreachable.
 *
 * Run: node --env-file=.env --import tsx scripts/generate-results.ts [--stdout]
 * Output: RESULTS_BLOB_PATH or data/results.json
 */
import { writeFile } from "node:fs/promises";

import { buildResults, loadEngineInput, todayIso } from "../lib/network";

async function main() {
  const now = new Date();
  const input = await loadEngineInput();
  const results = buildResults(input, { asOf: todayIso(now), generatedAt: now.toISOString() });
  const json = JSON.stringify(results, null, 2) + "\n";

  if (process.argv.includes("--stdout")) {
    process.stdout.write(json);
    return;
  }
  const blobPath = process.env.RESULTS_BLOB_PATH ?? "data/results.json";
  await writeFile(blobPath, json);
  console.log(
    JSON.stringify({
      written: blobPath,
      generatedAt: results.generatedAt,
      historyWindow: results.historyWindow,
      hospitals: results.hospitals.length,
      medicines: results.medicines.length,
      mapePct: results.mapePct,
      stockoutWarnings: results.stockoutWarnings.length,
      wasteWarnings: results.wasteWarnings.length,
      transfers: results.transfers.length,
      emergencyOrders: results.emergencyOrders.length,
      outbreaks: results.hospitals.filter((h) => h.outbreak).map((h) => h.hospitalId),
    }),
  );
}

main().catch((err) => {
  console.error("Failed to generate results:", err instanceof Error ? err.message : err);
  process.exit(1);
});
