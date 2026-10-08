# Map data APIs

Backend contracts for the Leaflet hospital map (Phase 6). All routes sit behind `middleware.ts`: a signed `session` cookie is required, both roles (`network_admin`, `hospital_admin`) can read, and no cookie gets `401 {"error":"Unauthorized"}`. Only `GET` is exported, so any other method gets `405`. Error bodies are `{"error": "..."}`, never stack traces.

## ⚠ Coordinate order

Leaflet takes **`[lat, lng]`**. GeoJSON and OSRM use **`[lng, lat]`**. Every response here is Leaflet order: either named `lat`/`lng` fields or `[lat, lng]` tuples. Build positions as `[h.lat, h.lng]`. Swapping them moves Mangaluru (12.87° N, 74.84° E) into the Arctic Ocean near Svalbard (74.84° N, 12.87° E).

## `GET /api/hospital-locations`

Hospitals from Neon `hospitals` (`latitude`, `longitude`, `address`). Rows without a valid position are dropped.

```json
{
  "center": { "lat": 12.8879, "lng": 74.8484 },
  "bounds": [[12.8605, 74.818], [12.933, 74.8835]],
  "hospitals": [
    { "id": "h-civil",  "name": "City Civil Hospital", "lat": 12.8703, "lng": 74.8436, "address": "Demo location near Hampankatta, Mangaluru" },
    { "id": "h-stmary", "name": "St Mary Clinic",      "lat": 12.8605, "lng": 74.8835, "address": "Demo location near Padil, Mangaluru" },
    { "id": "h-north",  "name": "Northgate General",   "lat": 12.933,  "lng": 74.818,  "address": "Demo location near Kavoor, Mangaluru" }
  ]
}
```

| Field | Notes |
|-------|-------|
| `center` | Centroid of the hospitals. |
| `bounds` | `[[south, west], [north, east]]`, a Leaflet `LatLngBoundsExpression`. Pass it straight to `<MapContainer bounds>`. One hospital gets ±0.01° padding. |
| `hospitals[].id` | DB id: the same id as `?hospital=<id>` and every `ResultsJSON` row. |
| `address` | Optional display text. |

`Cache-Control: private, max-age=300`. `503` when the DB is unreachable or no hospital has a position.

## `GET /api/route?from=<id>&to=<id>`

Road route between two hospitals. Ids are resolved server-side; the client never sends coordinates.

```json
{ "from": "h-civil", "to": "h-north", "distanceM": 9960.4, "durationS": 774.2, "path": [[12.870346, 74.843564], "..."], "approximate": false }
```

- `distanceM` / `durationS` are **road** distance and drive time from OSRM. They are not the engine's delivery window (`transportDays` in `ResultsJSON`), and the UI shows the two separately.
- Routes are directional (one-way streets), so `a→b` may differ from `b→a`.
- When OSRM is unreachable, the API returns a straight line: `approximate: true`, haversine `distanceM`, and `durationS: null`.
- Errors: `400` for missing or invalid ids or `from === to`, `404` when an id is unknown or has no position, `503` when the DB is down.
- `Cache-Control: private, max-age=3600`. The server also caches each successful pair in memory.
- **OSRM server:** `ROUTING_BASE_URL`, defaulting to the public demo server `https://router.project-osrm.org`. That server is **fair-use only with no SLA: fine for a demo, not for production.** Self-host OSRM for real use.

## `GET /api/results`

The single `ResultsJSON` v2 snapshot (`lib/contracts.ts`) that the dashboard, chat and cart read. It is built live from Neon through the engine (`lib/network`) and reused for 30 s. If the DB is down, the last `data/results.json` is served with `X-Results-Source: snapshot` (otherwise `live`). Regenerate that blob with `node --env-file=.env --import tsx scripts/generate-results.ts`.

## react-leaflet usage (for the map track)

```tsx
"use client";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";

export function HospitalMap({ data, route }: { data: HospitalLocationsResponse; route?: { path: [number, number][] } }) {
  // MapContainer props are immutable after mount: render once data has loaded.
  return (
    <MapContainer bounds={data.bounds} boundsOptions={{ padding: [24, 24] }} style={{ height: 400 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {data.hospitals.map((h) => <Marker key={h.id} position={[h.lat, h.lng]} />)}
      {route && <Polyline positions={route.path} />}
    </MapContainer>
  );
}
```

Leaflet touches `window`, so load the map with `next/dynamic(..., { ssr: false })`.

## Demo data

Coordinates are **fictional demo points** in Mangaluru (`scripts/demo-coordinates.ts`). They are not real facilities. To fill them without reseeding, run `scripts/set-demo-coordinates.ts`; it only issues `UPDATE`s by id.
