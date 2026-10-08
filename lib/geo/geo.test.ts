/**
 * Geometry helper tests: lat/lng validation, centroid, Leaflet bounds
 * (0 / 1 / many points), haversine distance and path interpolation.
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_BOUNDS_PAD_DEG,
  computeBounds,
  computeCenter,
  haversineM,
  isValidLatLng,
  pathLengthM,
  pointAlongPath,
  type LatLngTuple,
} from './index';

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

describe('haversineM', () => {
  it('is zero for the same point and symmetric', () => {
    const a = { lat: 12.8703, lng: 74.8436 };
    const b = { lat: 12.933, lng: 74.818 };
    expect(haversineM(a, a)).toBe(0);
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });

  it('matches known distances', () => {
    // One degree of latitude ~ 111.2 km on the mean sphere.
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
    // Demo Hampankatta -> Kavoor is ~7.5 km.
    const km = haversineM({ lat: 12.8703, lng: 74.8436 }, { lat: 12.933, lng: 74.818 }) / 1000;
    expect(km).toBeGreaterThan(7.2);
    expect(km).toBeLessThan(7.8);
  });

  it('handles antipodal points without NaN', () => {
    const d = haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(Math.PI * 6_371_008.8, -1);
  });
});

describe('pathLengthM / pointAlongPath', () => {
  const path: LatLngTuple[] = [
    [0, 0],
    [0, 1],
    [0, 3],
  ];

  it('sums segment lengths; empty and single-vertex paths are 0', () => {
    expect(pathLengthM([])).toBe(0);
    expect(pathLengthM([[1, 1]])).toBe(0);
    const one = haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(pathLengthM(path)).toBeCloseTo(3 * one, 3);
  });

  it('interpolates by distance, not by vertex count', () => {
    // Halfway by distance is lng 1.5 (inside the second, longer segment).
    const mid = pointAlongPath(path, 0.5)!;
    expect(mid[0]).toBeCloseTo(0, 9);
    expect(mid[1]).toBeCloseTo(1.5, 6);
    const third = pointAlongPath(path, 1 / 3)!;
    expect(third[1]).toBeCloseTo(1, 6);
  });

  it('clamps the fraction and handles degenerate paths', () => {
    expect(pointAlongPath(path, -0.2)).toEqual([0, 0]);
    expect(pointAlongPath(path, 0)).toEqual([0, 0]);
    expect(pointAlongPath(path, 1)).toEqual([0, 3]);
    expect(pointAlongPath(path, 7)).toEqual([0, 3]);
    expect(pointAlongPath(path, NaN)).toEqual([0, 0]);
    expect(pointAlongPath([], 0.5)).toBeNull();
    expect(pointAlongPath([[5, 5]], 0.5)).toEqual([5, 5]);
    expect(pointAlongPath([[5, 5], [5, 5]], 0.5)).toEqual([5, 5]);
  });
});
