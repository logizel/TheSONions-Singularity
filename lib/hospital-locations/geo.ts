/**
 * Pure geometry helpers for the hospital map: validation, centroid, bounds.
 */
import type { HospitalLocation, LatLng, LeafletBounds } from './types';

/** Padding (degrees) for a zero-width axis so Leaflet doesn't zoom to max. */
export const MIN_BOUNDS_PAD_DEG = 0.01;

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Arithmetic centroid; null for an empty list. */
export function computeCenter(points: readonly LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/**
 * [[south, west], [north, east]]; null for an empty list. An axis with zero
 * span (e.g. a single hospital) is padded by MIN_BOUNDS_PAD_DEG each side.
 */
export function computeBounds(points: readonly LatLng[]): LeafletBounds | null {
  if (points.length === 0) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  if (south === north) {
    south = Math.max(-90, south - MIN_BOUNDS_PAD_DEG);
    north = Math.min(90, north + MIN_BOUNDS_PAD_DEG);
  }
  if (west === east) {
    west = Math.max(-180, west - MIN_BOUNDS_PAD_DEG);
    east = Math.min(180, east + MIN_BOUNDS_PAD_DEG);
  }
  return [
    [south, west],
    [north, east],
  ];
}

/**
 * Keeps entries with a non-empty string id and name and a valid lat/lng.
 * Duplicate ids keep the first occurrence. Non-string addresses are dropped.
 */
export function sanitizeHospitals(raw: unknown): HospitalLocation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: HospitalLocation[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, name, lat, lng, address } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || typeof name !== 'string' || name === '') continue;
    if (!isValidLatLng(lat, lng)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const loc: HospitalLocation = { id, name, lat: lat as number, lng: lng as number };
    if (typeof address === 'string' && address !== '') loc.address = address;
    out.push(loc);
  }
  return out;
}
