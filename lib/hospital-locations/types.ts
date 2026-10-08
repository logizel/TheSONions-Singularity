/**
 * Response types for GET /api/hospital-locations. Explicit lat/lng fields,
 * never GeoJSON: Leaflet takes [lat, lng] while GeoJSON is [lng, lat].
 */
import type { LatLng, LeafletBounds } from '../geo';

export type { LatLng, LeafletBounds };

export interface HospitalLocation {
  /** Same id the dashboard uses for ?hospital=<id> (DB seed ids). */
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface HospitalLocationsResponse {
  center: LatLng;
  bounds: LeafletBounds;
  hospitals: HospitalLocation[];
}
