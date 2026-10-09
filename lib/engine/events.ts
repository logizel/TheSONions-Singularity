/**
 * Local-event demand uplift (EVT-02): a deterministic, explainable rulebook.
 *
 * An event (flood, heat wave, cyclone, ...) within its radius of a hospital
 * multiplies that hospital's forecast for the affected medicine categories,
 * but only on the forecast days the event covers. Overlapping events take the
 * largest multiplier for a day and never stack. No AI/ML: every uplift traces
 * back to one row of EVENT_UPLIFT and one event, and comes with a plain
 * reason string the UI and chat quote verbatim.
 *
 * Pure functions, no I/O, no clock (D-19, D-21): `asOf` and `forecastStart`
 * are always passed in.
 */
import type { HospitalRow, LocalEventRow, LocalEventType } from '../contracts';
import { LOCAL_EVENT_TYPES } from '../contracts';
import { haversineM } from '../geo';
import { dayNumber } from '../network/history';
import { EngineInputError } from './errors';
import type { ForecastDay } from './types';
import { FORECAST_DAYS } from './types';

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Severity 1-3 scales the extra demand (base - 1): minor half, severe 1.5x. */
export const SEVERITY_SCALE: Readonly<Record<number, number>> = { 1: 0.5, 2: 1, 3: 1.5 };

/**
 * Severity-2 demand multipliers per event type and medicine category.
 * A category that is absent stays at x1. Hormone (insulin) never appears:
 * chronic demand does not jump with local events.
 */
export const EVENT_UPLIFT: Readonly<Record<LocalEventType, Readonly<Partial<Record<string, number>>>>> = {
  flood: { rehydration: 1.8, antibiotic: 1.4, analgesic: 1.2 },
  heatwave: { rehydration: 1.6, analgesic: 1.1 },
  cyclone: { analgesic: 1.5, antibiotic: 1.4, rehydration: 1.5 },
  earthquake: { analgesic: 1.7, antibiotic: 1.3 },
  epidemic: { analgesic: 1.5, rehydration: 1.5 },
  festival: { analgesic: 1.2 },
  other: {},
};

export const EVENT_LABEL: Readonly<Record<LocalEventType, string>> = {
  flood: 'Flood',
  heatwave: 'Heat wave',
  cyclone: 'Cyclone',
  earthquake: 'Earthquake',
  epidemic: 'Epidemic',
  festival: 'Festival',
  other: 'Other',
};

/** Multiplier for one event type x category x severity (1 when no rule applies). */
export function upliftFor(type: LocalEventType, category: string, severity: number): number {
  const rules = EVENT_UPLIFT[type];
  const base = rules ? rules[category] : undefined;
  const scale = SEVERITY_SCALE[severity];
  if (base === undefined || scale === undefined) return 1;
  return round2(1 + (base - 1) * scale);
}

/** An event that reaches a hospital, with its distance from the hospital. */
export interface AffectingEvent extends LocalEventRow {
  /** Hospital-to-event-centre distance, km (1 decimal). */
  distanceKm: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Guard clause (T-bt7-03): malformed rows throw instead of skewing forecasts. */
function validateEvent(e: LocalEventRow): void {
  if (!(LOCAL_EVENT_TYPES as readonly string[]).includes(e.type)) {
    throw new EngineInputError(`event ${e.id}: unknown type "${e.type}"`);
  }
  if (
    !Number.isFinite(e.latitude) ||
    !Number.isFinite(e.longitude) ||
    e.latitude < -90 ||
    e.latitude > 90 ||
    e.longitude < -180 ||
    e.longitude > 180
  ) {
    throw new EngineInputError(`event ${e.id}: bad coordinates`);
  }
  if (!Number.isFinite(e.radiusKm) || e.radiusKm <= 0) {
    throw new EngineInputError(`event ${e.id}: radius must be > 0 km`);
  }
  if (!Number.isInteger(e.severity) || e.severity < 1 || e.severity > 3) {
    throw new EngineInputError(`event ${e.id}: severity must be 1-3, got ${e.severity}`);
  }
  if (!ISO_DATE.test(e.startsOn) || !ISO_DATE.test(e.endsOn)) {
    throw new EngineInputError(`event ${e.id}: dates must be YYYY-MM-DD`);
  }
  if (dayNumber(e.endsOn) < dayNumber(e.startsOn)) {
    throw new EngineInputError(`event ${e.id}: endsOn is before startsOn`);
  }
}

/**
 * Events that reach `hospital`: centre within radiusKm (haversine), not yet
 * ended at asOf, and starting inside the 30-day forecast window. A hospital
 * without coordinates is never affected. Sorted by id (deterministic).
 */
export function eventsAffecting(
  hospital: HospitalRow,
  events: readonly LocalEventRow[],
  asOf: string,
): AffectingEvent[] {
  for (const e of events) validateEvent(e);
  const lat = hospital.latitude;
  const lng = hospital.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return [];
  }
  const today = dayNumber(asOf);
  const lastDay = today + FORECAST_DAYS - 1;
  const out: AffectingEvent[] = [];
  for (const e of events) {
    if (dayNumber(e.endsOn) < today) continue; // ended
    if (dayNumber(e.startsOn) > lastDay) continue; // beyond the forecast window
    const km = haversineM({ lat, lng }, { lat: e.latitude, lng: e.longitude }) / 1000;
    if (km > e.radiusKm) continue;
    out.push({ ...e, distanceKm: round1(km) });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Multiplies the forecast days each event covers (EVT-02).
 *
 * `forecastStart` is the ISO date of fc[0], NOT asOf: forecast day 0 is the
 * day after the last usage row, which can precede asOf when usage lags.
 * eventsAffecting has already dropped ended events (by asOf), so they never
 * reach this function.
 *
 * Per day: multiplier = max(1, upliftFor of every covering event) — overlap
 * takes the max and never stacks. Values stay 1-decimal, advisory flags are
 * kept, and the input array is not mutated. One reason per event that raised
 * at least one day, e.g.
 * "+80% rehydration demand: Flood, 1.2 km away, until 2026-10-23".
 */
export function applyEventUplift(
  fc: readonly ForecastDay[],
  category: string,
  events: readonly AffectingEvent[],
  forecastStart: string,
): { fc: ForecastDay[]; reasons: string[] } {
  const start = dayNumber(forecastStart);
  const raised = new Set<string>();
  const out = fc.map((d, i): ForecastDay => {
    const day = start + i;
    let mult = 1;
    let winner: AffectingEvent | null = null;
    for (const e of events) {
      if (day < dayNumber(e.startsOn) || day > dayNumber(e.endsOn)) continue;
      const m = upliftFor(e.type, category, e.severity);
      if (m > 1) raised.add(e.id);
      if (m > mult) {
        mult = m;
        winner = e;
      }
    }
    return winner ? { value: round1(d.value * mult), advisory: d.advisory } : { ...d };
  });
  const reasons: string[] = [];
  for (const e of events) {
    if (!raised.has(e.id)) continue;
    const pct = Math.round((upliftFor(e.type, category, e.severity) - 1) * 100);
    const from = dayNumber(e.startsOn) > start ? `from ${e.startsOn} ` : '';
    reasons.push(
      `+${pct}% ${category} demand: ${EVENT_LABEL[e.type]}, ${e.distanceKm} km away, ${from}until ${e.endsOn}`,
    );
  }
  return { fc: out, reasons };
}

