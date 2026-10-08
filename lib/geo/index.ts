/**
 * Pure geometry helpers for the hospital map (Phase 6): lat/lng validation,
 * centroid, Leaflet bounds, great-circle distance, and path interpolation.
 *
 * Convention: every point is { lat, lng } or [lat, lng] (Leaflet order).
 * GeoJSON / OSRM use [lng, lat]; flip at the boundary, never in here.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Leaflet LatLngTuple: [lat, lng]. */
export type LatLngTuple = [number, number];

/** Leaflet LatLngBoundsExpression: [[south, west], [north, east]]. */
export type LeafletBounds = [LatLngTuple, LatLngTuple];

/** Padding (degrees) for a zero-width axis so Leaflet doesn't zoom to max. */
export const MIN_BOUNDS_PAD_DEG = 0.01;

/** Mean Earth radius (m), IUGG. */
export const EARTH_RADIUS_M = 6_371_008.8;

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

const rad = (d: number): number => (d * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total haversine length of a [lat, lng] polyline in metres. */
export function pathLengthM(path: readonly LatLngTuple[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineM(
      { lat: path[i - 1][0], lng: path[i - 1][1] },
      { lat: path[i][0], lng: path[i][1] },
    );
  }
  return total;
}

/**
 * Point at `fraction` (clamped to [0, 1]) of the way along a [lat, lng]
 * polyline, by distance. Linear between vertices (fine at city scale).
 * Returns null for an empty path; a single vertex is returned as-is.
 */
export function pointAlongPath(path: readonly LatLngTuple[], fraction: number): LatLngTuple | null {
  if (path.length === 0) return null;
  if (path.length === 1 || !Number.isFinite(fraction) || fraction <= 0) return [path[0][0], path[0][1]];
  const last = path[path.length - 1];
  if (fraction >= 1) return [last[0], last[1]];
  const total = pathLengthM(path);
  if (total === 0) return [path[0][0], path[0][1]];
  let target = total * fraction;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = haversineM({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= seg;
  }
  return [last[0], last[1]];
}
