#!/usr/bin/env node
/**
 * Generate ResultsJSON blob from Phase 2 engine.
 * Run with: npx tsx scripts/generate-results.ts
 * Outputs to RESULTS_BLOB_PATH or /tmp/results.json
 */
import { writeFile } from "node:fs/promises";

import { forecast, mape } from "../lib/engine/forecast";
import { stockoutRisk } from "../lib/engine/stockout";
import { detectOutbreak, trendForecast } from "../lib/engine/outbreak";
import { wasteRisk } from "../lib/engine/waste";
import { seeds } from "../lib/engine/seeds";
import type { ResultsJSON, HospitalMedicineForecast, StockoutWarning, WasteWarning, ForecastPoint } from "../lib/contracts";

interface EngineOutput {
  forecasts: HospitalMedicineForecast[];
  stockoutWarnings: StockoutWarning[];
  wasteWarnings: WasteWarning[];
  mape: number;
  outbreakMarkers: string[];
}

// Hardcoded for normal seed: hospital "h1", medicine "m1"
const HOSPITAL_ID = "h1";
const MEDICINE_ID = "m1";

function runEngine(
  history: number[],
  stock: number,
  leadTimeDays: number,
  daysToExpiry: number
): EngineOutput {
  // 1. Forecast
  const forecastDays = forecast(history);
  const mapeValue = mape(history.slice(-30), forecastDays.map((d) => d.value));

  // 2. Outbreak detection
  const outbreakFlag = detectOutbreak(history);
  const finalForecast = outbreakFlag.active ? trendForecast(history) : forecastDays;
  const outbreakMarkers = outbreakFlag.active ? [HOSPITAL_ID] : [];

  // 3. Stockout risk
  const stockout = stockoutRisk(stock, finalForecast, leadTimeDays);

  // 4. Waste risk
  const waste = wasteRisk(stock, finalForecast, daysToExpiry ?? 90);

  // Convert engine types to ResultsJSON types
  const stockoutWarnings = stockout.warns
    ? [{
        hospitalId: HOSPITAL_ID,
        medicineId: MEDICINE_ID,
        daysUntilStockout: stockout.daysUntilStockout,
        leadDays: leadTimeDays,
      }]
    : [];

  const wasteWarnings = waste.warns
    ? [{
        hospitalId: HOSPITAL_ID,
        medicineId: MEDICINE_ID,
        wasteUnits: waste.wasteUnits,
        expiryDays: waste.expiryDays,
      }]
    : [];

  // Build per-hospital forecast
  const forecasts: HospitalMedicineForecast[] = [
    {
      hospitalId: HOSPITAL_ID,
      medicineId: MEDICINE_ID,
      forecast: finalForecast.map((d, i) => ({
        date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
        demand: d.value,
      })),
      mape: mapeValue,
      outbreak: outbreakFlag.active,
    },
  ];

  return {
    forecasts,
    stockoutWarnings,
    wasteWarnings,
    mape: mapeValue,
    outbreakMarkers,
  };
}

function buildResultsJson(output: EngineOutput, generatedAt: string = new Date().toISOString()): ResultsJSON {
  return {
    generatedAt,
    mape: output.mape,
    advisoryFlags: ["15-30d advisory"],
    outbreakMarkers: output.outbreakMarkers,
    hospitals: output.forecasts.map((f) => ({
      hospitalId: f.hospitalId,
      hospitalName: f.hospitalId,
      riskScore: calculateRiskScore(output.stockoutWarnings.find((s) => s.hospitalId === f.hospitalId)),
      daysUntilStockout: output.stockoutWarnings.find((s) => s.hospitalId === f.hospitalId)?.daysUntilStockout ?? 999,
    })),
    // Include the formal ResultsJSON fields too for compatibility
    forecasts: output.forecasts,
    stockoutWarnings: output.stockoutWarnings,
    wasteWarnings: output.wasteWarnings,
    transfers: [],
    emergencyOrders: [],
    priorities: [],
  };
}

function calculateRiskScore(warning?: StockoutWarning): number {
  if (!warning) return 0;
  const ratio = warning.daysUntilStockout / warning.leadDays;
  return Math.round((1 - ratio) * 100);
}

async function main() {
  const blobPath = process.env.RESULTS_BLOB_PATH ?? "data/results.json";

  // Use the normal seed as the default input
  const seed = seeds.normal;
  const engineInput = {
    history: seed.history,
    stock: seed.stock,
    leadTimeDays: seed.leadTimeDays,
    daysToExpiry: seed.daysToExpiry,
  };

  console.log("Generating ResultsJSON from engine...");
  console.log(`Input: ${seed.name} seed, stock=${seed.stock}, leadTime=${seed.leadTimeDays}d`);

  const engineOutput = runEngine(engineInput.history, engineInput.stock, engineInput.leadTimeDays, engineInput.daysToExpiry);
  
  // Debug: log engine output
  console.log("Engine output stockoutWarnings:", JSON.stringify(engineOutput.stockoutWarnings));
  console.log("Engine output forecasts:", JSON.stringify(engineOutput.forecasts));
  
  const resultsJson = buildResultsJson(engineOutput);
  
  // Debug: log resultsJson
  console.log("ResultsJSON hospitals:", JSON.stringify(resultsJson.hospitals));

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