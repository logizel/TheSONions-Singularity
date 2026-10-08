/**
 * Response types for GET /api/hospital-locations. Explicit lat/lng fields,
 * never GeoJSON: Leaflet takes [lat, lng] while GeoJSON is [lng, lat].
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Leaflet LatLngBoundsExpression: [[south, west], [north, east]]. */
export type LeafletBounds = [[number, number], [number, number]];

export interface HospitalLocation {
  /** Same id the dashboard uses for ?hospital=<id>. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface HospitalLocationsResponse {
  source: string;
  updatedAt: string;
  center: LatLng;
  bounds: LeafletBounds;
  hospitals: HospitalLocation[];
}
