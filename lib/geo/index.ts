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

/**
 * Splits a [lat, lng] polyline at `fraction` of its length into the
 * travelled part (start -> point) and the remaining part (point -> end).
 * Both share the split point so they draw as one continuous line.
 */
export function splitPathAt(
  path: readonly LatLngTuple[],
  fraction: number,
): { travelled: LatLngTuple[]; remaining: LatLngTuple[] } {
  if (path.length === 0) return { travelled: [], remaining: [] };
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const point = pointAlongPath(path, f) as LatLngTuple;
  if (f <= 0) return { travelled: [point], remaining: path.map((p) => [p[0], p[1]]) };
  if (f >= 1) return { travelled: path.map((p) => [p[0], p[1]]), remaining: [point] };
  const total = pathLengthM(path);
  let target = total * f;
  const travelled: LatLngTuple[] = [[path[0][0], path[0][1]]];
  let i = 1;
  for (; i < path.length; i++) {
    const seg = haversineM({ lat: path[i - 1][0], lng: path[i - 1][1] }, { lat: path[i][0], lng: path[i][1] });
    if (target <= seg) break;
    target -= seg;
    travelled.push([path[i][0], path[i][1]]);
  }
  travelled.push(point);
  const remaining: LatLngTuple[] = [point, ...path.slice(i).map((p): LatLngTuple => [p[0], p[1]])];
  return { travelled, remaining };
}

/** Initial great-circle bearing a -> b, degrees clockwise from north (0..360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = rad(a.lat);
  const φ2 = rad(b.lat);
  const Δλ = rad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Direction of travel at `fraction` along the path (looks a short step ahead). */
export function bearingAlongPath(path: readonly LatLngTuple[], fraction: number): number {
  if (path.length < 2) return 0;
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const a = pointAlongPath(path, Math.min(f, 0.999)) as LatLngTuple;
  const b = pointAlongPath(path, Math.min(1, Math.min(f, 0.999) + 0.001)) as LatLngTuple;
  if (a[0] === b[0] && a[1] === b[1]) {
    return bearingDeg({ lat: path[0][0], lng: path[0][1] }, { lat: path[path.length - 1][0], lng: path[path.length - 1][1] });
  }
  return bearingDeg({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
}

/** Two-point [lat, lng] path a -> b (the straight-line fallback). */
export function straightPath(a: LatLng, b: LatLng): LatLngTuple[] {
  return [
    [a.lat, a.lng],
    [b.lat, b.lng],
  ];
}
