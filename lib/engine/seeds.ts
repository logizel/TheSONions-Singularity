/**
 * Deterministic committed seeds covering all four D-22 scenarios (D-21, D-22).
 *
 * Hard-coded arrays only: no Math.random, no Date.now, no time-dependence.
 * Later plans READ these fixtures (never rewrite them).
 *
 * Shapes (verified numerically at authoring time):
 * - normal: weekly pattern (weekday base [42,38,45,40,48,25,20] + deterministic
 *   period-9 noise in [-4,4]); holdout continues the same generator for days
 *   60-89 so forecast MAPE sits at ~7.3% (inside the 3-11% band, FCAST-02).
 * - outbreak: normal history with days 58-59 spiked to 72/75 — both above
 *   mean+2σ of the full 60-day baseline (~61.6), i.e. the OUTBK-01 enter shape
 *   (two consecutive +2σ days). Consumed by plan 02 (detectOutbreak).
 * - waste: low-demand history (mean ~11.3/day) with stock 3500 and 45 days to
 *   expiry — demand-to-expiry ≈ 510 vs stock 3500, i.e. the WASTE-01 shape.
 *   Consumed by plan 02 (wasteRisk).
 * - multiSender: one short receiver (demand ~48.9/day, stock 120 ≈ 2.5 days
 *   cover, 14-day lead time) plus two surplus senders with differing waste
 *   quantities (A ≈ 206u/3 transport days, B ≈ 228u/1 transport day) for the
 *   D-11 waste-first ordering. Consumed by plan 03 (suggestMoves).
 */
import type { DemandHistory } from './types.js';

export interface SeedScenario {
  name: string;
  description: string;
  history: DemandHistory;
  stock: number;
  leadTimeDays: number;
  daysToExpiry?: number;
}

export interface SeedSender extends SeedScenario {
  transportDays: number;
}

export interface MultiSenderScenario {
  name: string;
  description: string;
  receiver: SeedScenario;
  senders: SeedSender[];
}

const NORMAL_HISTORY: DemandHistory = [
  43, 34, 45, 44, 47, 28, 18, 44, 35, 46,
  36, 48, 29, 19, 45, 36, 47, 37, 49, 21,
  20, 46, 37, 48, 38, 50, 22, 21, 38, 38,
  49, 39, 51, 23, 22, 39, 39, 41, 40, 52,
  24, 23, 40, 40, 42, 41, 44, 25, 24, 41,
  41, 43, 42, 45, 26, 16, 42, 42, 44, 43,
];

/** Actual demand for days 60-89 (same generator as NORMAL_HISTORY), for MAPE. */
const NORMAL_HOLDOUT: number[] = [
  46, 27, 17, 43, 34, 45, 44, 47, 28, 18,
  44, 35, 46, 36, 48, 29, 19, 45, 36, 47,
  37, 49, 21, 20, 46, 37, 48, 38, 50, 22,
];

const OUTBREAK_HISTORY: DemandHistory = [
  43, 34, 45, 44, 47, 28, 18, 44, 35, 46,
  36, 48, 29, 19, 45, 36, 47, 37, 49, 21,
  20, 46, 37, 48, 38, 50, 22, 21, 38, 38,
  49, 39, 51, 23, 22, 39, 39, 41, 40, 52,
  24, 23, 40, 40, 42, 41, 44, 25, 24, 41,
  41, 43, 42, 45, 26, 16, 42, 42, 72, 75,
];

const WASTE_HISTORY: DemandHistory = [
  12, 12, 17, 8, 13, 8, 8, 17, 8, 13,
  13, 18, 4, 4, 13, 13, 18, 9, 14, 9,
  9, 9, 9, 14, 14, 19, 5, 5, 14, 14,
  10, 10, 15, 10, 10, 10, 10, 15, 15, 11,
  6, 6, 15, 15, 11, 11, 16, 11, 2, 11,
  11, 16, 16, 12, 7, 7, 16, 7, 12, 12,
];

const RECEIVER_HISTORY: DemandHistory = [
  53, 47, 54, 56, 63, 37, 31, 55, 49, 56,
  49, 56, 39, 33, 57, 51, 58, 51, 58, 32,
  26, 59, 53, 60, 53, 60, 34, 28, 52, 46,
  62, 55, 62, 36, 30, 54, 48, 55, 48, 64,
  38, 32, 56, 50, 57, 50, 57, 31, 34, 58,
  52, 59, 52, 59, 33, 27, 51, 54, 61, 54,
];

export const seeds = {
  normal: {
    name: 'normal',
    description: 'Steady weekly demand (weekday/weekend pattern) for the MAPE 3-11% band assertion.',
    history: NORMAL_HISTORY,
    holdout: NORMAL_HOLDOUT,
    stock: 400,
    leadTimeDays: 14,
  } as SeedScenario & { holdout: number[] },
  outbreak: {
    name: 'outbreak',
    description: 'Normal demand with two consecutive +2σ spike days (58-59) at the tail — OUTBK-01 enter shape.',
    history: OUTBREAK_HISTORY,
    stock: 400,
    leadTimeDays: 14,
  } as SeedScenario,
  waste: {
    name: 'waste',
    description: 'Low demand with stock (3500u) far above demand-to-expiry (45d) — WASTE-01 shape.',
    history: WASTE_HISTORY,
    stock: 3500,
    leadTimeDays: 14,
    daysToExpiry: 45,
  } as SeedScenario,
  multiSender: {
    name: 'multiSender',
    description:
      'One short receiver (2.5d cover, 14d lead time) plus two surplus senders with differing waste and transport days — D-11 ordering shape.',
    receiver: {
      name: 'receiver',
      description: 'High demand, stock 120 ≈ 2.5 days cover with a 14-day lead time.',
      history: RECEIVER_HISTORY,
      stock: 120,
      leadTimeDays: 14,
    } as SeedScenario,
    senders: [
      {
        name: 'sender-a',
        description: 'Surplus sender: stock 950, 20d to expiry (≈206u waste), 3 transport days.',
        history: NORMAL_HISTORY,
        stock: 950,
        leadTimeDays: 14,
        daysToExpiry: 20,
        transportDays: 3,
      } as SeedSender,
      {
        name: 'sender-b',
        description: 'Surplus sender: stock 600, 10d to expiry (≈228u waste), 1 transport day.',
        history: NORMAL_HISTORY,
        stock: 600,
        leadTimeDays: 14,
        daysToExpiry: 10,
        transportDays: 1,
      } as SeedSender,
    ],
  } as MultiSenderScenario,
};

/** Every 60-point history in the seed bank (for the seed-shape smoke test). */
export function allSeedHistories(): { label: string; history: DemandHistory }[] {
  return [
    { label: 'normal', history: seeds.normal.history },
    { label: 'outbreak', history: seeds.outbreak.history },
    { label: 'waste', history: seeds.waste.history },
    { label: 'multiSender.receiver', history: seeds.multiSender.receiver.history },
    ...seeds.multiSender.senders.map((s) => ({ label: `multiSender.${s.name}`, history: s.history })),
  ];
}
