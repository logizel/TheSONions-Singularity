/**
 * Network panel view model (Phase 6, 06-02): the six sections scoped by the
 * ?hospital= cross-filter, ordered per the UI spec, plus the counter-board
 * figures. Pure picks and sorts over ResultsJSON; no new numbers except
 * counts and sums of displayed rows.
 */
import type {
  EmergencyOrderSuggestion,
  HospitalMedicineForecast,
  InventoryEntry,
  PriorityEntry,
  ResultsJSON,
  Severity,
  StockoutWarning,
  TransferSuggestion,
  WasteWarning,
} from '../contracts';

export const TAB_KEYS = ['stock', 'forecast', 'shortage', 'waste', 'moves', 'priority'] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export function isTabKey(v: string | null): v is TabKey {
  return v !== null && (TAB_KEYS as readonly string[]).includes(v);
}

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };

export function bySeverityThenCover(a: InventoryEntry, b: InventoryEntry): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.daysUntilStockout - b.daysUntilStockout;
}

export interface ScopedResults {
  inventory: InventoryEntry[];
  forecasts: HospitalMedicineForecast[];
  shortages: StockoutWarning[];
  waste: WasteWarning[];
  transfers: TransferSuggestion[];
  supplierOrders: EmergencyOrderSuggestion[];
  priorities: PriorityEntry[];
}

/** Every section filtered to one hospital (transfers: as sender or receiver), sorted per spec. */
export function scopeResults(r: ResultsJSON, hospitalId: string | null): ScopedResults {
  const inScope = (id: string) => hospitalId === null || id === hospitalId;
  const severityOf = new Map(r.inventory.map((e) => [`${e.hospitalId}|${e.medicineId}`, e] as const));
  const forecastRank = (f: HospitalMedicineForecast) => {
    const e = severityOf.get(`${f.hospitalId}|${f.medicineId}`);
    return e ? SEVERITY_ORDER[e.severity] * 10_000 + e.daysUntilStockout : 99_999;
  };
  return {
    inventory: r.inventory.filter((e) => inScope(e.hospitalId)).sort(bySeverityThenCover),
    forecasts: r.forecasts.filter((f) => inScope(f.hospitalId)).sort((a, b) => forecastRank(a) - forecastRank(b)),
    shortages: r.stockoutWarnings.filter((s) => inScope(s.hospitalId)).sort((a, b) => a.daysUntilStockout - b.daysUntilStockout),
    waste: r.wasteWarnings.filter((w) => inScope(w.hospitalId)).sort((a, b) => a.expiryDays - b.expiryDays),
    transfers: r.transfers.filter((t) => hospitalId === null || t.fromHospital === hospitalId || t.toHospital === hospitalId),
    supplierOrders: r.emergencyOrders.filter((o) => inScope(o.hospitalId)).sort((a, b) => b.leadDays - a.leadDays),
    priorities: r.priorities.filter((p) => inScope(p.hospitalId)).sort((a, b) => a.rank - b.rank),
  };
}

export interface TabFigure {
  key: TabKey;
  label: string;
  figure: string;
  zero: boolean;
  /** The section holds at least one Critical item. */
  critical: boolean;
  ariaLabel: string;
}

export function tabFigures(r: ResultsJSON, s: ScopedResults): TabFigure[] {
  const flagged = s.inventory.filter((e) => e.severity !== 'ok').length;
  const anyCritical = s.inventory.some((e) => e.severity === 'critical');
  const top = s.priorities[0]?.score;
  return [
    {
      key: 'stock',
      label: 'Stock',
      figure: String(flagged),
      zero: flagged === 0,
      critical: anyCritical,
      ariaLabel: `Stock, ${flagged} positions below lead time plus buffer`,
    },
    {
      key: 'forecast',
      label: 'Forecast',
      figure: `${r.mapePct}%`,
      zero: false,
      critical: false,
      ariaLabel: `Forecast, network error ${r.mapePct} percent`,
    },
    {
      key: 'shortage',
      label: 'Shortage',
      figure: String(s.shortages.length),
      zero: s.shortages.length === 0,
      critical: s.shortages.length > 0,
      ariaLabel: `Shortage, ${s.shortages.length} warnings`,
    },
    {
      key: 'waste',
      label: 'Waste',
      figure: String(s.waste.length),
      zero: s.waste.length === 0,
      critical: s.waste.some((w) => w.severity === 'critical'),
      ariaLabel: `Waste, ${s.waste.length} warnings`,
    },
    {
      key: 'moves',
      label: 'Moves',
      figure: String(s.transfers.length + s.supplierOrders.length),
      zero: s.transfers.length + s.supplierOrders.length === 0,
      critical: false,
      ariaLabel: `Moves, ${s.transfers.length} transfers and ${s.supplierOrders.length} supplier orders`,
    },
    {
      key: 'priority',
      label: 'Priority',
      figure: top === undefined ? '—' : String(top),
      zero: top === undefined,
      critical: false,
      ariaLabel: top === undefined ? 'Priority, no ranked positions' : `Priority, top score ${top}`,
    },
  ];
}

// ---- display helpers ----------------------------------------------------------

/** "tablet" -> "tablets"; singular only for exactly 1. */
export function unitLabel(baseUnit: string, qty: number): string {
  if (qty === 1) return baseUnit;
  if (/(s|x|ch|sh)$/.test(baseUnit)) return `${baseUnit}es`;
  return `${baseUnit}s`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO date (YYYY-MM-DD...) -> "08 Oct 2026" without timezone shifts. */
export function fmtDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Days as "1 d" in dense rows. */
export function dShort(n: number): string {
  return `${n} d`;
}

/** Signed factor with a real minus sign: "+4", "−10". */
export function signed(n: number): string {
  if (n < 0) return `−${Math.abs(n)}`;
  return `+${n}`;
}

/** Name shortener for tight switchers: drops trailing Hospital/Clinic/General words. */
export function shortName(name: string): string {
  const s = name.replace(/\s+(Hospital|Clinic|General|Medical Centre|Medical Center)$/i, '');
  return s.length > 0 ? s : name;
}
