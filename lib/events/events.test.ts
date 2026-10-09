/** parseEventInput (EVT-04, T-bt7-02): accepts valid bodies, rejects every bad field. */
import { describe, expect, it } from 'vitest';
import { EVENT_ID, parseEventInput } from './index';

const valid = {
  type: 'flood',
  latitude: 12.94,
  longitude: 74.825,
  radiusKm: 4,
  startsOn: '2026-10-09',
  endsOn: '2026-10-23',
  severity: 2,
  note: '  river flooding  ',
};

describe('parseEventInput', () => {
  it('accepts a valid body, trims the note', () => {
    const r = parseEventInput(valid);
    expect(r).toEqual({
      ok: true,
      value: {
        type: 'flood',
        latitude: 12.94,
        longitude: 74.825,
        radiusKm: 4,
        startsOn: '2026-10-09',
        endsOn: '2026-10-23',
        severity: 2,
        note: 'river flooding',
      },
    });
  });

  it('stores an empty or missing note as null', () => {
    const a = parseEventInput({ ...valid, note: '   ' });
    const b = parseEventInput({ ...valid, note: undefined });
    expect(a.ok && a.value.note).toBeNull();
    expect(b.ok && b.value.note).toBeNull();
  });

  it.each([
    ['non-object', null],
    ['type outside allowlist', { ...valid, type: 'tsunami' }],
    ['lat > 90', { ...valid, latitude: 91 }],
    ['lat < -90', { ...valid, latitude: -91 }],
    ['lng > 180', { ...valid, longitude: 181 }],
    ['lng < -180', { ...valid, longitude: -181 }],
    ['radius 0', { ...valid, radiusKm: 0 }],
    ['radius > 200', { ...valid, radiusKm: 201 }],
    ['bad start date', { ...valid, startsOn: '09/10/2026' }],
    ['impossible date', { ...valid, endsOn: '2026-02-30' }],
    ['end before start', { ...valid, startsOn: '2026-10-10', endsOn: '2026-10-09' }],
    ['severity 0', { ...valid, severity: 0 }],
    ['severity 4', { ...valid, severity: 4 }],
    ['severity 1.5', { ...valid, severity: 1.5 }],
    ['note too long', { ...valid, note: 'x'.repeat(201) }],
  ])('rejects %s with a human message', (_label, body) => {
    const r = parseEventInput(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
  });

  it('accepts radius exactly 200', () => {
    expect(parseEventInput({ ...valid, radiusKm: 200 }).ok).toBe(true);
  });
});

describe('EVENT_ID', () => {
  it('matches generated and seed ids only', () => {
    expect(EVENT_ID.test('ev-0123456789ab')).toBe(true);
    expect(EVENT_ID.test('seed-ev-flood')).toBe(true);
    expect(EVENT_ID.test('ev-XYZ')).toBe(false);
    expect(EVENT_ID.test('../etc')).toBe(false);
  });
});
