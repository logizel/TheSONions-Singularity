// DEMO DATA (Phase 6, D-04): fictional hospitals placed at fictional points in
// Mangaluru, 4.5-10.7 km apart so 1-2 day transport stays plausible. These
// are not real facilities. Used by seed.ts and set-demo-coordinates.ts.
export const DEMO_COORDINATES: Record<string, { latitude: number; longitude: number; address: string }> = {
  "h-civil": { latitude: 12.8703, longitude: 74.8436, address: "Demo location near Hampankatta, Mangaluru" },
  "h-stmary": { latitude: 12.8605, longitude: 74.8835, address: "Demo location near Padil, Mangaluru" },
  "h-north": { latitude: 12.933, longitude: 74.818, address: "Demo location near Kavoor, Mangaluru" },
};
