/**
 * Response-builder tests plus a guard on the real demo data file: ids and
 * names match the DB seed, coordinates are valid and 3-15 km apart.
 */
import { describe, expect, it } from 'vitest';
import { buildHospitalLocations, getHospitalLocations } from './index';
import type { LatLng } from './types';

// Mirrors HOSPITALS in scripts/seed.ts (the Neon source of truth).
const SEED_HOSPITALS: Record<string, string> = {
  'h-civil': 'City Civil Hospital',
  'h-stmary': 'St Mary Clinic',
  'h-north': 'Northgate General',
};

function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe('buildHospitalLocations', () => {
  it('returns null when no valid hospitals survive', () => {
    expect(buildHospitalLocations({ hospitals: [] })).toBeNull();
    expect(buildHospitalLocations({ hospitals: [{ id: 'x', name: 'X', lat: NaN, lng: 0 }] })).toBeNull();
    expect(buildHospitalLocations(null)).toBeNull();
  });

  it('passes source/updatedAt through and derives center and bounds', () => {
    const res = buildHospitalLocations({
      source: 'demo-coordinates',
      updatedAt: '2026-10-09T00:00:00.000Z',
      hospitals: [
        { id: 'a', name: 'A', lat: 10, lng: 70 },
        { id: 'b', name: 'B', lat: 12, lng: 72 },
      ],
    })!;
    expect(res.source).toBe('demo-coordinates');
    expect(res.updatedAt).toBe('2026-10-09T00:00:00.000Z');
    expect(res.center).toEqual({ lat: 11, lng: 71 });
    expect(res.bounds).toEqual([
      [10, 70],
      [12, 72],
    ]);
    expect(res.hospitals.map((h) => h.id)).toEqual(['a', 'b']);
  });
});

describe('real data file (data/hospital-locations.json)', () => {
  const res = getHospitalLocations();

  it('passes validation with every seed hospital present, nothing dropped', () => {
    expect(res).not.toBeNull();
    expect(res!.source).toBe('demo-coordinates');
    expect(Number.isNaN(Date.parse(res!.updatedAt))).toBe(false);
    const byId = Object.fromEntries(res!.hospitals.map((h) => [h.id, h.name]));
    expect(byId).toEqual(SEED_HOSPITALS);
  });

  it('places hospitals 3-15 km apart so markers are distinguishable', () => {
    const hs = res!.hospitals;
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const km = haversineKm(hs[i], hs[j]);
        expect(km).toBeGreaterThanOrEqual(3);
        expect(km).toBeLessThanOrEqual(15);
      }
    }
  });
});
