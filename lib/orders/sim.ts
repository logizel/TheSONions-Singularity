/**
 * Demo clock for the simulated vehicle (Phase 6, D-10). The simulated trip
 * lasts the engine delivery window (transportDays) and plays back faster
 * than real time; the default speed runs a 2-day transfer in about 1 min.
 * Nothing here is a real vehicle position. The road drive time is a separate
 * fact and is never merged into this clock (except as the duration of a
 * same-day, 0-day window).
 */
import type { OrderStatus } from './types';

export const DAY_MS = 86_400_000;

export interface DemoSpeed {
  factor: number;
  caption: string;
}

export const DEMO_SPEEDS: readonly DemoSpeed[] = [
  { factor: 1440, caption: '1 day / min' },
  { factor: 2880, caption: '2 days / min' },
  { factor: 8640, caption: '6 days / min' },
];

export const DEFAULT_SPEED = 2880;

/** Fallback trip length for a 0-day window with no road time: 1 h. */
export const SAME_DAY_FALLBACK_MS = 3_600_000;

/** Simulated trip length: the engine window, or the road time for a 0-day window. */
export function tripDurationMs(transportDays: number, roadDurationS: number | null): number {
  if (Number.isFinite(transportDays) && transportDays > 0) return transportDays * DAY_MS;
  if (roadDurationS !== null && Number.isFinite(roadDurationS) && roadDurationS > 0) return roadDurationS * 1000;
  return SAME_DAY_FALLBACK_MS;
}

/** A demo-clock reading pinned to a real instant; re-anchor on speed change or pause. */
export interface ClockAnchor {
  /** Real epoch ms of the anchor. */
  realMs: number;
  /** Simulated ms elapsed since dispatch at the anchor. */
  simMs: number;
}

/** Simulated ms since dispatch, assuming the clock ran at `speed` since dispatch. */
export function anchorFromDispatch(inTransitAtMs: number, realNowMs: number, speed: number): ClockAnchor {
  return { realMs: realNowMs, simMs: Math.max(0, realNowMs - inTransitAtMs) * speed };
}

export function simElapsedMs(anchor: ClockAnchor, realNowMs: number, speed: number, paused: boolean): number {
  if (paused) return anchor.simMs;
  return anchor.simMs + Math.max(0, realNowMs - anchor.realMs) * speed;
}

/** Keeps the current position when speed or pause changes. */
export function reanchor(anchor: ClockAnchor, realNowMs: number, oldSpeed: number, paused: boolean): ClockAnchor {
  return { realMs: realNowMs, simMs: simElapsedMs(anchor, realNowMs, oldSpeed, paused) };
}

/**
 * Fraction of the route covered, 0..1. Before dispatch the vehicle waits at
 * the sender; delivered pins it to the receiver; cancelled freezes at 0
 * unless it was already moving (then the caller hides the vehicle).
 */
export function tripProgress(status: OrderStatus, simMs: number, durationMs: number): number {
  if (status === 'delivered') return 1;
  if (status !== 'in_transit') return 0;
  if (!(durationMs > 0)) return 1;
  return Math.min(1, Math.max(0, simMs / durationMs));
}

export function remainingMs(progress: number, durationMs: number): number {
  return Math.max(0, (1 - Math.min(1, Math.max(0, progress))) * durationMs);
}

export function remainingDistanceM(progress: number, totalM: number): number {
  return Math.max(0, (1 - Math.min(1, Math.max(0, progress))) * totalM);
}

/** "1 d 04 h", "3 h 20 min", "12 min", "0 min". Rounds up to the minute. */
export function fmtSimDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalMin = Math.ceil(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} d ${String(h).padStart(2, '0')} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}
