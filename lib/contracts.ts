// Minimal contract stub.
//
// DEVIATION (documented in 03-01-SUMMARY.md): Phase 1 (Track P2) is supposed to
// freeze this file. It does not exist yet, so the Phase 3 tracer cannot compile
// without it. This file defines the smallest ResultsJSON shape the chat tracer
// needs. P2 may replace the body wholesale when Phase 1 runs; consumers under
// lib/chat/ import only the types below, so the frozen contract can be dropped
// in without changing chat code (per D-04).

export interface HospitalRisk {
  hospitalId: string;
  hospitalName: string;
  riskScore: number;
  daysUntilStockout: number;
  outbreak?: boolean;
}

export interface ResultsJSON {
  generatedAt: string; // ISO 8601 timestamp
  mape: number; // forecast error (precomputed)
  advisoryFlags: string[]; // e.g. 15-30d advisory markers
  outbreakMarkers: string[];
  hospitals: HospitalRisk[];
}
