/**
 * Local-event input validation (EVT-04, threat T-bt7-02). Pure: no DB import,
 * so the route handler, the sheet and tests share one set of rules. The DB
 * CHECK constraints on local_events repeat them (defense in depth).
 */
import type { LocalEventRow, LocalEventType } from '../contracts';
import { LOCAL_EVENT_TYPES } from '../contracts';

/** Event ids: generated `ev-` + 12 hex, or demo `seed-ev-*`. */
export const EVENT_ID = /^(ev-[0-9a-f]{12}|seed-ev-[a-z0-9-]+)$/;

export const MAX_EVENT_RADIUS_KM = 200;
export const MAX_EVENT_NOTE = 200;

export type EventInput = Omit<LocalEventRow, 'id' | 'source'>;

export type ParseEventResult = { ok: true; value: EventInput } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

export function parseEventInput(body: unknown): ParseEventResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Expected a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  const type = b.type;
  if (typeof type !== 'string' || !(LOCAL_EVENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `Type must be one of: ${LOCAL_EVENT_TYPES.join(', ')}.` };
  }
  const latitude = num(b.latitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: 'Latitude must be between -90 and 90.' };
  }
  const longitude = num(b.longitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Longitude must be between -180 and 180.' };
  }
  const radiusKm = num(b.radiusKm);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_EVENT_RADIUS_KM) {
    return { ok: false, error: `Radius must be more than 0 and at most ${MAX_EVENT_RADIUS_KM} km.` };
  }
  if (!isIsoDate(b.startsOn) || !isIsoDate(b.endsOn)) {
    return { ok: false, error: 'Dates must be valid YYYY-MM-DD dates.' };
  }
  const startsOn = b.startsOn;
  const endsOn = b.endsOn;
  if (endsOn < startsOn) {
    return { ok: false, error: 'End date cannot be before the start date.' };
  }
  const severity = num(b.severity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 3) {
    return { ok: false, error: 'Severity must be 1, 2 or 3.' };
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== 'string') return { ok: false, error: 'Note must be text.' };
    const trimmed = b.note.trim();
    if (trimmed.length > MAX_EVENT_NOTE) {
      return { ok: false, error: `Note must be at most ${MAX_EVENT_NOTE} characters.` };
    }
    note = trimmed === '' ? null : trimmed;
  }
  return {
    ok: true,
    value: { type: type as LocalEventType, latitude, longitude, radiusKm, startsOn, endsOn, severity, note },
  };
}
