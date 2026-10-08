/**
 * Hospital-location builder tests: DB rows -> markers + center + bounds.
 * Invalid positions and duplicate ids are dropped; 0 / 1 / many hospitals.
 */
import { describe, expect, it } from 'vitest';
import { MIN_BOUNDS_PAD_DEG, haversineM } from '../geo';
import { DEMO_COORDINATES } from '../../scripts/demo-coordinates';
import { buildHospitalLocations, toHospitalLocations } from './index';

const row = (id: string, latitude: unknown, longitude: unknown, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Name ${id}`,
  latitude,
  longitude,
  ...extra,
});

describe('toHospitalLocations', () => {
  it('drops rows without a valid position (null, NaN, strings, out of range)', () => {
    const out = toHospitalLocations([
      row('ok', 12.87, 74.84),
      row('null', null, null),
      row('nan', NaN, 74),
      row('str', '12.8', 74),
      row('range', 95, 74),
      row('lng', 12, 181),
      { id: '', name: 'No id', latitude: 1, longitude: 1 },
      { id: 'noname', latitude: 1, longitude: 1 },
      null,
      'junk',
    ]);
    expect(out.map((h) => h.id)).toEqual(['ok']);
  });

  it('keeps the first of duplicate ids and maps latitude/longitude to lat/lng', () => {
    const out = toHospitalLocations([
      row('h-a', 12, 74, { name: 'First' }),
      row('h-a', 13, 75, { name: 'Second' }),
    ]);
    expect(out).toEqual([{ id: 'h-a', name: 'First', lat: 12, lng: 74 }]);
  });

  it('keeps non-empty string addresses only', () => {
    const out = toHospitalLocations([
      row('a', 1, 1, { address: 'Somewhere' }),
      row('b', 2, 2, { address: null }),
      row('c', 3, 3, { address: '' }),
    ]);
    expect(out[0].address).toBe('Somewhere');
    expect('address' in out[1]).toBe(false);
    expect('address' in out[2]).toBe(false);
  });
});

describe('buildHospitalLocations', () => {
  it('returns null for zero hospitals or none with a position', () => {
    expect(buildHospitalLocations([])).toBeNull();
    expect(buildHospitalLocations([row('x', null, null)])).toBeNull();
  });

  it('pads bounds for a single hospital', () => {
    const res = buildHospitalLocations([row('solo', 12.87, 74.84)])!;
    expect(res.center).toEqual({ lat: 12.87, lng: 74.84 });
    expect(res.bounds[0][0]).toBeCloseTo(12.87 - MIN_BOUNDS_PAD_DEG, 10);
    expect(res.bounds[1][1]).toBeCloseTo(74.84 + MIN_BOUNDS_PAD_DEG, 10);
  });

  it('derives center and [[south, west], [north, east]] for many hospitals', () => {
    const res = buildHospitalLocations([row('a', 10, 70), row('b', 12, 72), row('gone', null, 1)])!;
    expect(res.center).toEqual({ lat: 11, lng: 71 });
    expect(res.bounds).toEqual([
      [10, 70],
      [12, 72],
    ]);
    expect(res.hospitals.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('accepts the demo seed coordinates for all three DB hospitals', () => {
    const rows = Object.entries(DEMO_COORDINATES).map(([id, c]) => ({ id, name: id, ...c }));
    const res = buildHospitalLocations(rows)!;
    expect(res.hospitals.map((h) => h.id).sort()).toEqual(['h-civil', 'h-north', 'h-stmary']);
  });

  it('keeps demo hospitals 3-15 km apart so markers stay distinguishable', () => {
    const pts = Object.values(DEMO_COORDINATES).map((c) => ({ lat: c.latitude, lng: c.longitude }));
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const km = haversineM(pts[i], pts[j]) / 1000;
        expect(km).toBeGreaterThanOrEqual(3);
        expect(km).toBeLessThanOrEqual(15);
      }
    }
  });
});
