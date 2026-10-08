/**
 * Hospital locations for the react-leaflet map (Phase 6, D-04). Rows come
 * from Neon `hospitals` (latitude/longitude/address); rows without a valid
 * position are dropped rather than guessed.
 */
import { computeBounds, computeCenter, isValidLatLng } from '../geo';
import type { HospitalLocation, HospitalLocationsResponse } from './types';

export type { HospitalLocation, HospitalLocationsResponse, LatLng, LeafletBounds } from './types';

/**
 * Keeps rows with a non-empty string id and name and a valid
 * latitude/longitude. Duplicate ids keep the first occurrence. Empty or
 * non-string addresses are omitted.
 */
export function toHospitalLocations(rows: readonly unknown[]): HospitalLocation[] {
  const seen = new Set<string>();
  const out: HospitalLocation[] = [];
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const { id, name, latitude, longitude, address } = row as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || typeof name !== 'string' || name === '') continue;
    if (!isValidLatLng(latitude, longitude)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const loc: HospitalLocation = { id, name, lat: latitude as number, lng: longitude as number };
    if (typeof address === 'string' && address !== '') loc.address = address;
    out.push(loc);
  }
  return out;
}

/** Builds the response from raw hospital rows; null if none has a valid position. */
export function buildHospitalLocations(rows: readonly unknown[]): HospitalLocationsResponse | null {
  const hospitals = toHospitalLocations(rows);
  const center = computeCenter(hospitals);
  const bounds = computeBounds(hospitals);
  if (center === null || bounds === null) return null;
  return { center, bounds, hospitals };
}

/**
 * Reads hospitals from Neon. db/client is imported lazily so importing this
 * module (tests, build) never opens a connection. Throws on DB failure.
 */
export async function getHospitalLocations(): Promise<HospitalLocationsResponse | null> {
  const [{ db }, { hospitals }] = await Promise.all([
    import('../../db/client'),
    import('../../db/schema'),
  ]);
  const rows = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      latitude: hospitals.latitude,
      longitude: hospitals.longitude,
      address: hospitals.address,
    })
    .from(hospitals)
    .orderBy(hospitals.id);
  return buildHospitalLocations(rows);
}
