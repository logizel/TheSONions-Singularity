// FROZEN CONTRACT (D-20) — Phase 1 freeze.
// P3 engine, P4 API/chat, and P1 UI build against these types.
// Changes need all-track agreement per docs/TEAM.md — do NOT edit casually.

// ---- DB row types (mirror db/schema.ts; single source of naming) -----------

export interface MedicineRow {
  id: string;
  name: string;
  category: string;
  isCritical: boolean;
  baseUnit: string;
  substituteIds: string[];
}

export interface HospitalRow {
  id: string;
  name: string;
}

export type UserRole = "hospital_admin" | "network_admin";

export interface UserRow {
  id: string;
  hospitalId: string | null;
  role: UserRole;
}

export interface StockBatchRow {
  id: string;
  hospitalId: string;
  medicineId: string;
  qty: number;
  /** ISO date (YYYY-MM-DD). Mandatory — no placeholder dates. */
  expiryDate: string;
  archived: boolean;
  bufferDays: number;
}

export interface DailyUsageRow {
  /** ISO date (YYYY-MM-DD). */
  usageDate: string;
  hospitalId: string;
  medicineId: string;
  /** null = missing day (engine interpolates); 0 = explicitly zero usage. */
  usedQty: number | null;
  patientLoad: number;
  /** 0-100. */
  emergencyPct: number;
}

export interface TransportRow {
  fromHospital: string;
  toHospital: string;
  /** Whole days, 0-30. */
  days: number;
}

export interface SupplierLeadRow {
  hospitalId: string;
  medicineId: string;
  /** Whole days, 0-30. */
  leadDays: number;
}

// ---- Engine input (what Phase 2 consumes) -----------------------------------

export interface EngineInput {
  hospitals: HospitalRow[];
  medicines: MedicineRow[];
  batches: StockBatchRow[];
  usage: DailyUsageRow[];
  transport: TransportRow[];
  leads: SupplierLeadRow[];
}

// ---- Engine output ----------------------------------------------------------

export interface ForecastPoint {
  /** ISO date. */
  date: string;
  demand: number;
}

export interface HospitalMedicineForecast {
  hospitalId: string;
  medicineId: string;
  /** 30-day ops forecast. Days 15-30 are advisory (growing error). */
  forecast: ForecastPoint[];
  /** MAPE against history, expected band 3-11%. */
  mape: number;
  outbreak: boolean;
}

export interface StockoutWarning {
  hospitalId: string;
  medicineId: string;
  daysUntilStockout: number;
  leadDays: number;
}

export interface WasteWarning {
  hospitalId: string;
  medicineId: string;
  /** Units that expire unused (stock minus realistic demand before expiry, 90d cap). */
  wasteUnits: number;
}

export interface TransferSuggestion {
  fromHospital: string;
  toHospital: string;
  medicineId: string;
  qty: number;
  /** Which of the 5 checks each passed + waste-first / nearest rationale. */
  checksPassed: string[];
}

export interface PriorityEntry {
  hospitalId: string;
  /** Visible score with reasons (load, emergency, soonness, substitute). */
  score: number;
  reasons: string[];
}

// ---- ResultsJSON (served by Phase 3 API, quoted by Phase 3 chat) ------------
// The chatbot may ONLY quote numbers present in this shape (CHAT-02/CHAT-03).

export interface ResultsJSON {
  generatedAt: string;
  forecasts: HospitalMedicineForecast[];
  stockoutWarnings: StockoutWarning[];
  wasteWarnings: WasteWarning[];
  transfers: TransferSuggestion[];
  emergencyOrders: TransferSuggestion[];
  priorities: PriorityEntry[];
}
