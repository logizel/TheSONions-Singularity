import type { LatLngTuple, LeafletBounds } from "@/lib/geo";
import type { MapHospital } from "@/lib/dashboard/view";

export interface MapInsets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** Straight planned-transfer connector (Moves tab): not a road. */
export interface Connector {
  key: string;
  from: LatLngTuple;
  to: LatLngTuple;
}

/** Road (or straight-line estimate) route for a cart line. */
export interface RouteLine {
  key: string;
  path: LatLngTuple[];
  approximate: boolean;
  focused: boolean;
}

export interface TrackingOverlay {
  travelled: LatLngTuple[];
  remaining: LatLngTuple[];
  approximate: boolean;
  /** null hides the vehicle (cancelled after dispatch, or no route yet). */
  vehicle: { position: LatLngTuple; bearing: number; label: string } | null;
}

export interface HospitalMapProps {
  hospitals: MapHospital[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** What to fit: all hospitals, or a route while the cart/tracking is open. */
  fitBounds: LeafletBounds;
  insets: MapInsets;
  connectors: Connector[];
  routes: RouteLine[];
  tracking: TrackingOverlay | null;
  reducedMotion: boolean;
  tileUrl: string;
}
