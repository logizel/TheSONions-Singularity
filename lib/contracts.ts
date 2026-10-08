// FROZEN CONTRACT (D-20) — Phase 1 freeze, amended in Phase 6 (06-CONTEXT D-03:
// hospital coordinates + ResultsJSON v2 carrying everything the dashboard,
// chat and cart quote). Change only with an explicit contract decision.

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
  /** WGS84 decimal degrees; null/absent = location unknown (Phase 6). */
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
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

// ---- Engine output (ResultsJSON v2, Phase 6) ---------------------------------
// Every number below is either an engine output or a direct DB aggregate the
// engine consumed. The chatbot may ONLY quote numbers present in this shape
// (CHAT-02/CHAT-03), so the dashboard, chat and cart all read one snapshot.

export type Severity = "critical" | "warning" | "ok";

export interface ForecastPoint {
  /** ISO date. */
  date: string;
  demand: number;
  /** Days 15-30 of the forecast (growing error). */
  advisory: boolean;
}

export interface HospitalMedicineForecast {
  hospitalId: string;
  medicineId: string;
  /** base = weekday baseline; trend = outbreak last-7-day trend (OUTBK-02). */
  mode: "base" | "trend";
  /** 30-day ops forecast. Days 15-30 are advisory (growing error). */
  forecast: ForecastPoint[];
  /** In-sample MAPE over the last 30 history days, percent (1 decimal). */
  mapePct: number;
  outbreak: boolean;
}

/** Per-hospital header numbers. */
export interface HospitalSummary {
  hospitalId: string;
  hospitalName: string;
  /** Mean daily patients over the last 7 history days (integer). */
  patientLoad: number;
  /** Mean emergency share over the last 7 history days, 0-100 (integer). */
  emergencyPct: number;
  /** Any medicine series at this hospital is in outbreak. */
  outbreak: boolean;
  /** Highest priority score among this hospital's medicines (0-100). */
  riskScore: number;
  /** Lowest days-until-stockout among this hospital's medicines. */
  daysUntilStockout: number;
}

export interface MedicineSummary {
  medicineId: string;
  medicineName: string;
  isCritical: boolean;
  baseUnit: string;
  substituteIds: string[];
}

/** One hospital x medicine position (all pairs, not only warnings). */
export interface InventoryEntry {
  hospitalId: string;
  medicineId: string;
  /** Usable units: non-archived batches not yet expired at asOf. */
  stock: number;
  daysUntilStockout: number;
  leadDays: number;
  bufferDays: number;
  /** Mean of the 30-day forecast, units/day (1 decimal). */
  dailyDemand: number;
  /** Last 7 history days of usage, oldest first (gaps interpolated). */
  trend: number[];
  /** Earliest expiry among usable batches, ISO date; null when no stock. */
  nearestExpiry: string | null;
  /** critical: cover < lead time; warning: cover < lead + buffer; else ok. */
  severity: Severity;
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
  /** Expiry date of the batch tier that produces the waste. */
  expiryDate: string;
  /** Whole days from asOf to expiryDate. */
  expiryDays: number;
  severity: Severity;
}

export interface TransferSuggestion {
  fromHospital: string;
  toHospital: string;
  medicineId: string;
  /** Engine quantity (1-decimal math, D-02). */
  qty: number;
  /** Engine delivery window in whole days (transport_days). */
  transportDays: number;
  /** Which of the 5 checks each passed + waste-first / nearest rationale. */
  checksPassed: string[];
}

/** Emergency supplier order for the remainder transfers cannot cover (MOVE-02). */
export interface EmergencyOrderSuggestion {
  hospitalId: string;
  medicineId: string;
  qty: number;
  /** Supplier lead time in whole days. */
  leadDays: number;
  reason: string;
}

export interface PriorityFactors {
  soonness: number;
  emergencyShare: number;
  patientLoad: number;
  substitute: number;
}

export interface PriorityEntry {
  /** 1-based global rank, worst first (PRIOR-02). */
  rank: number;
  hospitalId: string;
  medicineId: string;
  /** Visible score with reasons (load, emergency, soonness, substitute). */
  score: number;
  factors: PriorityFactors;
  reasons: string[];
}

export interface ResultsJSON {
  generatedAt: string;
  /** ISO date the stock/expiry math is evaluated at. */
  asOf: string;
  /** Inclusive ISO date range of the 60-day usage history. */
  historyWindow: { from: string; to: string };
  /** Network mean of per-series in-sample MAPE, percent (1 decimal). */
  mapePct: number;
  /** 1-based forecast days that are advisory only. */
  advisory: { fromDay: number; toDay: number; label: string };
  hospitals: HospitalSummary[];
  medicines: MedicineSummary[];
  transport: TransportRow[];
  leads: SupplierLeadRow[];
  inventory: InventoryEntry[];
  forecasts: HospitalMedicineForecast[];
  stockoutWarnings: StockoutWarning[];
  wasteWarnings: WasteWarning[];
  transfers: TransferSuggestion[];
  emergencyOrders: EmergencyOrderSuggestion[];
  priorities: PriorityEntry[];
}
