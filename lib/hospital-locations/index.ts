/**
 * Hospital locations for the react-leaflet map. getHospitalLocations() is the
 * seam: today it reads the static demo file; a DB-backed source (lat/lng on
 * `hospitals`) can replace it without changing the response shape.
 */
import locationsJson from '../../data/hospital-locations.json';
import { computeBounds, computeCenter, sanitizeHospitals } from './geo';
import type { HospitalLocationsResponse } from './types';

export type {
  HospitalLocation,
  HospitalLocationsResponse,
  LatLng,
  LeafletBounds,
} from './types';
export { computeBounds, computeCenter, isValidLatLng, sanitizeHospitals } from './geo';

/** Builds the response from a raw locations file; null if no valid hospitals. */
export function buildHospitalLocations(file: unknown): HospitalLocationsResponse | null {
  const raw = (typeof file === 'object' && file !== null ? file : {}) as Record<string, unknown>;
  const hospitals = sanitizeHospitals(raw.hospitals);
  const center = computeCenter(hospitals);
  const bounds = computeBounds(hospitals);
  if (center === null || bounds === null) return null;
  return {
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    center,
    bounds,
    hospitals,
  };
}

export function getHospitalLocations(): HospitalLocationsResponse | null {
  return buildHospitalLocations(locationsJson);
}
