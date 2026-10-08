/**
 * Transfer suggestions with emergency remainder orders (MOVE-01/02, D-09..D-12).
 *
 * One pure function per concern (D-19): suggestMoves() turns precomputed
 * risk signals into exactly which hospital sends how much to which one, plus
 * an emergency supplier order for whatever transfers cannot cover. All inputs
 * are precomputed (receiver need, per-sender surplus terms, waste quantities,
 * cover/transport/shelf-life days) — this module never imports stockout.ts or
 * waste.ts, so it stays independently unit-testable and parallel-safe.
 */
import { EngineInputError } from './errors.js';

/** Sender buffer: a sender must keep this many days of cover (D-09). */
export const SENDER_BUFFER_DAYS = 7;

/** One surplus hospital eligible to send (all values precomputed upstream). */
export interface MoveSender {
  hospitalId: string;
  /** Current on-hand units. */
  stock: number;
  /** Mean daily demand used to price the 7-day keep-back buffer. */
  dailyDemand: number;
  /** Expiring-unused units (wasteRisk output) — drives waste-first order. */
  wasteUnits: number;
  /** Whole transport days from this sender to the receiver. */
  transportDays: number;
  /** Days until this sender's stock expires (shelf-life check). */
  daysToExpiry: number;
}

/** Receiver need plus the candidate sender pool (all precomputed). */
export interface MoveRequest {
  receiverHospitalId: string;
  medicine: string;
  /** Exact units the receiver is short (D-12). */
  needUnits: number;
  /** Whole days until the receiver stocks out (arrival check). */
  receiverDaysUntilStockout: number;
  senders: MoveSender[];
}

/** One feasible hospital-to-hospital shipment. */
export interface Transfer {
  fromHospitalId: string;
  toHospitalId: string;
  medicine: string;
  /** Exact units, 1-decimal engine math (D-02, D-12). */
  quantity: number;
  transportDays: number;
}

/** Emergency supplier order for the remainder transfers cannot cover. */
export interface EmergencyOrder {
  toHospitalId: string;
  medicine: string;
  /** Exact uncovered remainder (MOVE-02, D-12). */
  quantity: number;
  reason: string;
}

/** Engine keeps 1-decimal floats; rounding to integers happens at consumption (D-02). */
const round1 = (n: number): number => Math.round(n * 10) / 10;

function fail(msg: string): never {
  throw new EngineInputError(msg);
}

function checkFinite(name: string, v: number): void {
  if (!Number.isFinite(v)) fail(`${name} must be a finite number, got ${v}`);
}

/** Guard-clauses on every entry point (D-20, threat T-02-01). */
function validateRequest(input: MoveRequest): void {
  if (!input || typeof input !== 'object') fail('input must be an object');
  if (!input.receiverHospitalId || typeof input.receiverHospitalId !== 'string')
    fail('receiverHospitalId must be a non-empty string');
  if (!input.medicine || typeof input.medicine !== 'string')
    fail('medicine must be a non-empty string');
  checkFinite('needUnits', input.needUnits);
  if (input.needUnits < 0) fail(`needUnits must be >= 0, got ${input.needUnits}`);
  checkFinite('receiverDaysUntilStockout', input.receiverDaysUntilStockout);
  if (input.receiverDaysUntilStockout < 0)
    fail(
      `receiverDaysUntilStockout must be >= 0, got ${input.receiverDaysUntilStockout}`,
    );
  if (!Array.isArray(input.senders) || input.senders.length === 0)
    fail('senders must be a non-empty array');
  for (let i = 0; i < input.senders.length; i++) {
    const s = input.senders[i] as MoveSender;
    if (!s || typeof s !== 'object') fail(`senders[${i}] must be an object`);
    if (!s.hospitalId || typeof s.hospitalId !== 'string')
      fail(`senders[${i}].hospitalId must be a non-empty string`);
    for (const [k, v] of [
      ['stock', s.stock],
      ['dailyDemand', s.dailyDemand],
      ['wasteUnits', s.wasteUnits],
      ['transportDays', s.transportDays],
      ['daysToExpiry', s.daysToExpiry],
    ] as const) {
      checkFinite(`senders[${i}].${k}`, v);
      if (v < 0) fail(`senders[${i}].${k} must be >= 0, got ${v}`);
    }
  }
}

/**
 * Suggest transfers plus emergency orders (MOVE-01/02).
 *
 * All 5 feasibility checks per candidate transfer (MOVE-01):
 * 1. arrives before the receiver runs out (transportDays < cover days);
 * 2. enough shelf life on arrival (daysToExpiry > transportDays);
 * 3. sender keeps its 7-day buffer (D-09: sendable = stock - 7 x dailyDemand);
 * 4. nothing beyond the receiver need (D-12: running min(need, sendable));
 * 5. waste-first plus nearest preference (D-11: most wasteUnits first,
 *    ties broken by fewest transportDays).
 * Split shipments across senders are allowed (D-10); whatever need remains
 * becomes one emergency supplier order for exactly that remainder (MOVE-02).
 */
export function suggestMoves(input: MoveRequest): {
  transfers: Transfer[];
  orders: EmergencyOrder[];
} {
  validateRequest(input);

  // Checks 1+2 filter the pool; check 5 orders it (D-11, not nearest-first).
  const qualifying = input.senders
    .filter(
      (s) =>
        s.transportDays < input.receiverDaysUntilStockout &&
        s.daysToExpiry > s.transportDays,
    )
    .sort((a, b) => {
      if (b.wasteUnits !== a.wasteUnits) return b.wasteUnits - a.wasteUnits;
      return a.transportDays - b.transportDays;
    });

  const transfers: Transfer[] = [];
  let remaining = round1(input.needUnits);
  for (const s of qualifying) {
    if (remaining <= 0) break;
    // Check 3 (D-09): the sender keeps exactly 7 days of cover after sending.
    const sendable = Math.max(0, round1(s.stock - SENDER_BUFFER_DAYS * s.dailyDemand));
    if (sendable <= 0) continue;
    // Check 4 (D-12): exact need — min(need, sendable), no margin, no rounding.
    const qty = round1(Math.min(remaining, sendable));
    if (qty <= 0) continue;
    transfers.push({
      fromHospitalId: s.hospitalId,
      toHospitalId: input.receiverHospitalId,
      medicine: input.medicine,
      quantity: qty,
      transportDays: s.transportDays,
    });
    remaining = round1(remaining - qty);
  }

  // MOVE-02 + D-12: the uncovered remainder becomes one exact supplier order.
  const orders: EmergencyOrder[] =
    remaining > 0
      ? [
          {
            toHospitalId: input.receiverHospitalId,
            medicine: input.medicine,
            quantity: remaining,
            reason: `Emergency supplier order for the ${remaining}u remainder transfers could not cover`,
          },
        ]
      : [];
  return { transfers, orders };
}
