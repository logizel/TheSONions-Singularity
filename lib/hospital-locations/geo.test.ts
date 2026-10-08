/**
 * Geometry helper tests: lat/lng validation, centroid, Leaflet bounds, and
 * sanitizing raw hospital entries (invalid values and duplicate ids dropped).
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_BOUNDS_PAD_DEG,
  computeBounds,
  computeCenter,
  isValidLatLng,
  sanitizeHospitals,
} from './geo';

describe('isValidLatLng', () => {
  it('accepts finite in-range numbers including the edges', () => {
    expect(isValidLatLng(12.87, 74.84)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
  });

  it('rejects NaN, Infinity, strings, null and undefined', () => {
    expect(isValidLatLng(NaN, 74)).toBe(false);
    expect(isValidLatLng(12, Infinity)).toBe(false);
    expect(isValidLatLng('12.87', 74.84)).toBe(false);
    expect(isValidLatLng(12.87, '74.84')).toBe(false);
    expect(isValidLatLng(null, 74)).toBe(false);
    expect(isValidLatLng(12, undefined)).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(isValidLatLng(90.0001, 0)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
    expect(isValidLatLng(0, 180.5)).toBe(false);
    expect(isValidLatLng(0, -181)).toBe(false);
  });
});

describe('computeCenter / computeBounds', () => {
  it('returns null for an empty list', () => {
    expect(computeCenter([])).toBeNull();
    expect(computeBounds([])).toBeNull();
  });

  it('pads a single point so Leaflet does not over-zoom', () => {
    const p = { lat: 12.87, lng: 74.84 };
    expect(computeCenter([p])).toEqual(p);
    const [[south, west], [north, east]] = computeBounds([p])!;
    expect(south).toBeCloseTo(12.87 - MIN_BOUNDS_PAD_DEG, 10);
    expect(north).toBeCloseTo(12.87 + MIN_BOUNDS_PAD_DEG, 10);
    expect(west).toBeCloseTo(74.84 - MIN_BOUNDS_PAD_DEG, 10);
    expect(east).toBeCloseTo(74.84 + MIN_BOUNDS_PAD_DEG, 10);
  });

  it('computes [[south, west], [north, east]] and the centroid for several points', () => {
    const pts = [
      { lat: 12.87, lng: 74.84 },
      { lat: 12.86, lng: 74.88 },
      { lat: 12.93, lng: 74.82 },
    ];
    expect(computeBounds(pts)).toEqual([
      [12.86, 74.82],
      [12.93, 74.88],
    ]);
    const c = computeCenter(pts)!;
    expect(c.lat).toBeCloseTo((12.87 + 12.86 + 12.93) / 3, 10);
    expect(c.lng).toBeCloseTo((74.84 + 74.88 + 74.82) / 3, 10);
  });

  it('pads only the zero-span axis', () => {
    const b = computeBounds([
      { lat: 10, lng: 70 },
      { lat: 11, lng: 70 },
    ])!;
    expect(b[0][0]).toBe(10);
    expect(b[1][0]).toBe(11);
    expect(b[0][1]).toBeCloseTo(70 - MIN_BOUNDS_PAD_DEG, 10);
    expect(b[1][1]).toBeCloseTo(70 + MIN_BOUNDS_PAD_DEG, 10);
  });
});

describe('sanitizeHospitals', () => {
  it('drops entries with invalid coordinates, ids or names', () => {
    const out = sanitizeHospitals([
      { id: 'ok', name: 'Ok', lat: 12, lng: 74 },
      { id: 'nan', name: 'NaN', lat: NaN, lng: 74 },
      { id: 'str', name: 'Str', lat: '12', lng: 74 },
      { id: 'range', name: 'Range', lat: 95, lng: 74 },
      { id: '', name: 'Empty id', lat: 12, lng: 74 },
      { id: 'noname', lat: 12, lng: 74 },
      null,
      'junk',
    ]);
    expect(out.map((h) => h.id)).toEqual(['ok']);
  });

  it('keeps the first of duplicate ids', () => {
    const out = sanitizeHospitals([
      { id: 'h-a', name: 'First', lat: 12, lng: 74 },
      { id: 'h-a', name: 'Second', lat: 13, lng: 75 },
      { id: 'h-b', name: 'Other', lat: 14, lng: 76 },
    ]);
    expect(out).toEqual([
      { id: 'h-a', name: 'First', lat: 12, lng: 74 },
      { id: 'h-b', name: 'Other', lat: 14, lng: 76 },
    ]);
  });

  it('keeps string addresses and drops other address types', () => {
    const out = sanitizeHospitals([
      { id: 'a', name: 'A', lat: 1, lng: 1, address: 'Somewhere' },
      { id: 'b', name: 'B', lat: 2, lng: 2, address: 42 },
    ]);
    expect(out[0].address).toBe('Somewhere');
    expect('address' in out[1]).toBe(false);
  });

  it('returns an empty list for non-array input', () => {
    expect(sanitizeHospitals(undefined)).toEqual([]);
    expect(sanitizeHospitals({ id: 'x' })).toEqual([]);
  });
});
