/**
 * Global priority ranking with justifications (PRIOR-01/02, D-13..D-16).
 *
 * One pure function per concern (D-19): rankPriorities() scores each
 * hospital/medicine from patient load, emergency demand share, soonness of
 * stock-out, and substitute existence (PRIOR-01). Signals are precomputed
 * inputs — this module never imports other engine modules, so it stays
 * independently unit-testable and parallel-safe.
 */
import { EngineInputError } from './errors';

/** Precomputed risk signal for one hospital/medicine (quotable numbers only). */
export interface PrioritySignal {
  hospitalId: string;
  medicine: string;
  /** Whole days until stock-out (lower = more urgent). */
  daysUntilStockout: number;
  /** Share of demand that is emergency, 0-100. */
  emergencySharePct: number;
  /** Patients served per day (higher = more urgent). */
  patientLoad: number;
  /** A therapeutic substitute exists (lowers urgency). */
  hasSubstitute: boolean;
}

/** Machine-readable factor breakdown behind one score (D-16). */
export interface PriorityFactors {
  soonness: number;
  emergencyShare: number;
  patientLoad: number;
  substitute: number;
}

/** One globally ranked entry: score plus one human sentence (D-14, D-16). */
export interface Priority {
  hospitalId: string;
  medicine: string;
  /** Integer 0-100, sortable and quotable in chat (D-14). */
  score: number;
  factors: PriorityFactors;
  /** One human sentence quoting stockout days and emergency share (D-16). */
  reason: string;
}

/**
 * Soonness-first weights (D-13): soonness dominates, then emergency share,
 * then patient load, then substitute existence — not equal weights, not
 * load-first. Component maxima sum to exactly 100 so the full band is
 * reachable; a substitute subtracts, and the total clamps to [0, 100].
 */
const W_SOONNESS = 60;
const W_EMERGENCY = 25;
const W_LOAD = 15;
const SUBSTITUTE_PENALTY = 10;
/** Soonness decays linearly to zero at this cover horizon (days). */
const SOONNESS_HORIZON_DAYS = 30;
/** Load saturates at this daily-patient count (monotonic, bounded). */
const LOAD_SATURATION = 1000;

function fail(msg: string): never {
  throw new EngineInputError(msg);
}

/** Guard-clauses on every entry point (D-20, threat T-02-01). */
function validateSignals(signals: PrioritySignal[]): void {
  if (!Array.isArray(signals)) fail('signals must be an array');
  for (let i = 0; i < signals.length; i++) {
    const s = signals[i] as PrioritySignal;
    if (!s || typeof s !== 'object') fail(`signals[${i}] must be an object`);
    if (!s.hospitalId || typeof s.hospitalId !== 'string')
      fail(`signals[${i}].hospitalId must be a non-empty string`);
    if (!s.medicine || typeof s.medicine !== 'string')
      fail(`signals[${i}].medicine must be a non-empty string`);
    if (!Number.isFinite(s.daysUntilStockout) || s.daysUntilStockout < 0)
      fail(
        `signals[${i}].daysUntilStockout must be a finite value >= 0, got ${s.daysUntilStockout}`,
      );
    if (
      !Number.isFinite(s.emergencySharePct) ||
      s.emergencySharePct < 0 ||
      s.emergencySharePct > 100
    )
      fail(
        `signals[${i}].emergencySharePct must be within 0-100, got ${s.emergencySharePct}`,
      );
    if (!Number.isFinite(s.patientLoad) || s.patientLoad < 0)
      fail(
        `signals[${i}].patientLoad must be a finite value >= 0, got ${s.patientLoad}`,
      );
    if (typeof s.hasSubstitute !== 'boolean')
      fail(`signals[${i}].hasSubstitute must be a boolean`);
  }
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Rank competing hospital/medicine needs globally, worst first (PRIOR-02,
 * D-15: one cross-network list sorted descending, not per-medicine lists).
 * Deterministic: ties break by soonness, then hospital/medicine identity.
 */
export function rankPriorities(signals: PrioritySignal[]): Priority[] {
  validateSignals(signals);

  const entries: Priority[] = signals.map((s) => {
    const soonness = round1(
      W_SOONNESS *
        Math.max(0, (SOONNESS_HORIZON_DAYS - s.daysUntilStockout) / SOONNESS_HORIZON_DAYS),
    );
    const emergencyShare = round1((W_EMERGENCY * s.emergencySharePct) / 100);
    const patientLoad = round1(
      W_LOAD * Math.min(1, s.patientLoad / LOAD_SATURATION),
    );
    const substitute = s.hasSubstitute ? -SUBSTITUTE_PENALTY : 0;
    const score = Math.max(
      0,
      Math.min(100, Math.round(soonness + emergencyShare + patientLoad + substitute)),
    );
    return {
      hospitalId: s.hospitalId,
      medicine: s.medicine,
      score,
      factors: { soonness, emergencyShare, patientLoad, substitute },
      reason:
        `${s.hospitalId} / ${s.medicine}: stockout in ${s.daysUntilStockout}d, ` +
        `emergency ${s.emergencySharePct}% — score ${score}.`,
    };
  });

  entries.sort(
    (a, b) =>
      b.score - a.score ||
      b.factors.soonness - a.factors.soonness ||
      a.hospitalId.localeCompare(b.hospitalId) ||
      a.medicine.localeCompare(b.medicine),
  );
  return entries;
}
