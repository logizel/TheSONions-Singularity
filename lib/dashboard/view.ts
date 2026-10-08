/**
 * Dashboard view model (Phase 6, 06-02): pure joins and formatting over
 * ResultsJSON v2 + hospital locations. No fetching, no React, no maths
 * beyond picking/ordering engine numbers; formatting never changes a value
 * except for display rounding stated in each formatter.
 */
import type { HospitalSummary, InventoryEntry, ResultsJSON, Severity } from '../contracts';
import type { HospitalLocation } from '../hospital-locations/types';

/** Map/legend risk scale: critical (cover < lead), low (< lead + buffer), ok. */
export type RiskLevel = 'critical' | 'low' | 'ok';

export const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, low: 1, ok: 2 };

export function riskFromSeverity(s: Severity): RiskLevel {
  return s === 'critical' ? 'critical' : s === 'warning' ? 'low' : 'ok';
}

export interface HospitalRisk {
  level: RiskLevel;
  /** The position that sets the level (lowest cover among the worst severity); null when none. */
  worst: InventoryEntry | null;
}

export function hospitalRisk(results: ResultsJSON, hospitalId: string): HospitalRisk {
  let worst: InventoryEntry | null = null;
  for (const e of results.inventory) {
    if (e.hospitalId !== hospitalId) continue;
    if (
      worst === null ||
      RISK_ORDER[riskFromSeverity(e.severity)] < RISK_ORDER[riskFromSeverity(worst.severity)] ||
      (e.severity === worst.severity && e.daysUntilStockout < worst.daysUntilStockout)
    ) {
      worst = e;
    }
  }
  return { level: worst ? riskFromSeverity(worst.severity) : 'ok', worst: worst && worst.severity !== 'ok' ? worst : null };
}

export interface MapHospital extends HospitalLocation {
  summary: HospitalSummary | null;
  risk: RiskLevel;
  worst: InventoryEntry | null;
  outbreak: boolean;
  /** Screen-reader label, e.g. "City Civil Hospital, critical: Paracetamol 10 days cover". */
  label: string;
}

export function medicineName(results: ResultsJSON, id: string): string {
  return results.medicines.find((m) => m.medicineId === id)?.medicineName ?? id;
}

export function hospitalName(results: ResultsJSON, id: string): string {
  return results.hospitals.find((h) => h.hospitalId === id)?.hospitalName ?? id;
}

const RISK_WORD: Record<RiskLevel, string> = { critical: 'critical', low: 'low stock', ok: 'stock ok' };

/** Joins located hospitals with results by id; located hospitals missing from results show as ok. */
export function joinMapHospitals(locations: readonly HospitalLocation[], results: ResultsJSON): MapHospital[] {
  return locations.map((loc) => {
    const summary = results.hospitals.find((h) => h.hospitalId === loc.id) ?? null;
    const { level, worst } = hospitalRisk(results, loc.id);
    const outbreak = summary?.outbreak ?? false;
    const detail = worst ? `: ${medicineName(results, worst.medicineId)} ${fmtDays(worst.daysUntilStockout)} cover` : '';
    return {
      ...loc,
      summary,
      risk: level,
      worst,
      outbreak,
      label: `${loc.name}, ${RISK_WORD[level]}${detail}${outbreak ? ', outbreak' : ''}`,
    };
  });
}

// ---- formatters -------------------------------------------------------------

const intFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const oneDecFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Units: integers as-is, engine 1-decimal values keep their decimal (D-02). */
export function fmtUnits(n: number): string {
  return Number.isInteger(n) ? intFmt.format(n) : oneDecFmt.format(Math.round(n * 10) / 10);
}

/** Whole days, singular-aware: "1 day", "10 days". */
export function fmtDays(n: number): string {
  return `${intFmt.format(n)} ${n === 1 ? 'day' : 'days'}`;
}

/** Road/straight distance: "850 m" below 1 km, else "9.96 km" (2 decimals < 10 km, 1 above). */
export function fmtDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(2) : km.toFixed(1)} km`;
}

/** Drive time: "45 s", "13 min", "1 h 05 min"; null/invalid -> "—". */
export function fmtDuration(s: number | null): string {
  if (s === null || !Number.isFinite(s) || s < 0) return '—';
  if (s < 60) return `${Math.round(s)} s`;
  const totalMin = Math.round(s / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${h} h ${String(min).padStart(2, '0')} min`;
}

/** "just now", "4 min ago", "3 h ago", else the date. */
export function fmtUpdated(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diffS = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (diffS < 60) return 'just now';
  if (diffS < 3600) return `${Math.floor(diffS / 60)} min ago`;
  if (diffS < 86_400) return `${Math.floor(diffS / 3600)} h ago`;
  return new Date(t).toISOString().slice(0, 10);
}

/** Selected id must exist in results; anything else means "no filter". */
export function validHospitalId(results: ResultsJSON | null, id: string | null): string | null {
  if (!results || !id) return null;
  return results.hospitals.some((h) => h.hospitalId === id) ? id : null;
}
