#!/usr/bin/env node
/**
 * Generate ResultsJSON blob from Phase 2 engine.
 * Run with: npx tsx scripts/generate-results.ts
 * Outputs to RESULTS_BLOB_PATH or /tmp/results.json
 */
import { readFile, writeFile } from "node:fs/promises";

import { runEngine, buildResultsJson } from "../lib/services/results-engine";
import type { EngineInput } from "../lib/contracts";
import { seeds } from "../lib/engine/seeds";

async function main() {
  const blobPath = process.env.RESULTS_BLOB_PATH ?? "/tmp/results.json";

  // Use the normal seed as the default input
  const seed = seeds.normal;
  const engineInput: EngineInput = {
    history: seed.history,
    stock: seed.stock,
    leadTimeDays: seed.leadTimeDays,
    daysToExpiry: seed.daysToExpiry,
    transportDays: 1,
  };

  console.log("Generating ResultsJSON from engine...");
  console.log(`Input: ${seed.name} seed, stock=${seed.stock}, leadTime=${seed.leadTimeDays}d`);

  const engineOutput = runEngine(engineInput);
  const resultsJson = buildResultsJson(engineOutput);

  await writeFile(blobPath, JSON.stringify(resultsJson, null, 2));
  console.log(`ResultsJSON written to ${blobPath}`);
  console.log(`MAPE: ${resultsJson.mape.toFixed(1)}%`);
  console.log(`Hospitals: ${resultsJson.hospitals.length}`);
  console.log(`Outbreak markers: ${resultsJson.outbreakMarkers.join(", ") || "none"}`);
}

main().catch((err) => {
  console.error("Failed to generate results:", err);
  process.exit(1);
});