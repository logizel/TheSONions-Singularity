/**
 * Shared ResultsJSON mock types (P1-owned app/ space).
 * Mirrors the Phase 1 frozen contracts shape at demo scale:
 * ~3 hospitals x 5 medicines, envelope with generatedAt / MAPE /
 * advisory flags / outbreak markers, per-medicine buffer_days,
 * substitute_ids, transport legs and lead_days.
 * Aggregates only — never patient-level fields (no PHI).
 */

export interface Hospital {
  id: string;
  name: string;
  patientLoad: number;
  emergencyPct: number;
  outbreak: boolean;
}

export interface Medicine {
  id: string;
  name: string;
  isCritical: boolean;
  bufferDays: number;
  substituteIds: string[];
}

export interface LeadTime {
  hospitalId: string;
  medicineId: string;
  days: number;
}

export interface TransportLeg {
  fromId: string;
  toId: string;
  days: number;
}

export interface InventoryRow {
  hospitalId: string;
  medicineId: string;
  stock: number;
  daysToStockout: number;
  trend: number[];
}

export interface ForecastRow {
  hospitalId: string;
  medicineId: string;
  mode: "base" | "trend";
  next7: number[];
  avgDaily: number;
}

export type Severity = "critical" | "warning";

export interface ShortageRow {
  hospitalId: string;
  medicineId: string;
  daysToStockout: number;
  severity: Severity;
}

export interface ExpiryRow {
  hospitalId: string;
  medicineId: string;
  qty: number;
  expiryDate: string;
  severity: Severity;
}

export interface MoveRow {
  fromId: string;
  toId: string;
  medicineId: string;
  qty: number;
  arrivesInDays: number;
}

export interface EmergencyOrderRow {
  hospitalId: string;
  medicineId: string;
  qty: number;
  leadDays: number;
}

export interface PriorityRow {
  rank: number;
  hospitalId: string;
  score: number;
  reasons: string[];
}

export interface ResultsFixture {
  generatedAt: string;
  mape: number;
  advisory: { startDay: number; endDay: number; label: string };
  hospitals: Hospital[];
  medicines: Medicine[];
  leadDays: LeadTime[];
  transport: TransportLeg[];
  inventory: InventoryRow[];
  forecast: ForecastRow[];
  shortages: ShortageRow[];
  expiries: ExpiryRow[];
  moves: MoveRow[];
  emergencyOrders: EmergencyOrderRow[];
  priorities: PriorityRow[];
}

/** Validate a ?hospital=id value against the fixture hospital list (T-4-01). */
export function isKnownHospitalId(
  fixture: ResultsFixture,
  id: string | null,
): id is string {
  if (!id) return false;
  return fixture.hospitals.some((h) => h.id === id);
}
