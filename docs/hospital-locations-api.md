# Hospital locations API

Backend contract for the react-leaflet hospital map. The map UI is built in the P1 track; this endpoint only serves data.

## Endpoint

`GET /api/hospital-locations`

- **Auth:** same as every `/api/*` route. `middleware.ts` requires a signed `session` cookie. Both roles (`network_admin`, `hospital_admin`) can read. No cookie → `401 {"error":"Unauthorized"}`.
- **Methods:** GET only. Any other method → `405`.
- **Caching:** `Cache-Control: private, max-age=300` (authenticated, never shared caches).

### 200 response

```json
{
  "source": "demo-coordinates",
  "updatedAt": "2026-10-09T00:00:00.000Z",
  "center": { "lat": 12.8879, "lng": 74.8484 },
  "bounds": [[12.8605, 74.818], [12.933, 74.8835]],
  "hospitals": [
    { "id": "h-civil",  "name": "City Civil Hospital", "lat": 12.8703, "lng": 74.8436, "address": "Demo location near Hampankatta, Mangaluru" },
    { "id": "h-stmary", "name": "St Mary Clinic",      "lat": 12.8605, "lng": 74.8835, "address": "Demo location near Padil, Mangaluru" },
    { "id": "h-north",  "name": "Northgate General",   "lat": 12.933,  "lng": 74.818,  "address": "Demo location near Kavoor, Mangaluru" }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `source` | string | `"demo-coordinates"` for now (fictional points). |
| `updatedAt` | ISO 8601 string | When the location data was last changed. |
| `center` | `{lat, lng}` | Centroid of all hospitals. |
| `bounds` | `[[south, west], [north, east]]` | A Leaflet `LatLngBoundsExpression`. Pass it straight to `<MapContainer bounds>`. A single hospital gets ±0.01° padding so the map doesn't zoom all the way in. |
| `hospitals[].id` | string | The **DB seed id** (`h-civil`, `h-stmary`, `h-north`). This is the same id used in `?hospital=<id>` once the dashboard reads live data. Join transfers on it to draw lines. |
| `hospitals[].name` | string | Matches `hospitals.name` in Neon. |
| `hospitals[].lat`, `lng` | number | WGS84 decimal degrees. |
| `hospitals[].address` | string, optional | Display text only. |

### 503 response

`{"error":"Hospital locations unavailable"}` when no valid hospital survives validation. Entries with invalid coordinates or duplicate ids are dropped.

## ⚠ Coordinate order

Leaflet takes **`[lat, lng]`**. GeoJSON uses **`[lng, lat]`**. This API deliberately returns named `lat`/`lng` fields (not GeoJSON) so you never have to guess. Always build positions as `[h.lat, h.lng]`. Swapping them moves Mangaluru (12.87° N, 74.84° E) into the Arctic Ocean near Svalbard (74.84° N, 12.87° E).

## react-leaflet usage (example for the map track)

```tsx
"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type HospitalLocationsResponse = {
  bounds: [[number, number], [number, number]];
  hospitals: { id: string; name: string; lat: number; lng: number; address?: string }[];
};

export function HospitalMap({ data }: { data: HospitalLocationsResponse }) {
  // MapContainer props are immutable after mount: render only once data has loaded.
  return (
    <MapContainer bounds={data.bounds} boundsOptions={{ padding: [24, 24] }} style={{ height: 400 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {data.hospitals.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lng]}>
          <Popup>{h.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

Fetch with `fetch("/api/hospital-locations")` from the browser; the session cookie is sent automatically on same-origin requests. Leaflet touches `window`, so load the map with `next/dynamic` and `{ ssr: false }`.

## Source of the data

- `data/hospital-locations.json`: static demo coordinates, imported at build time.
- `lib/hospital-locations/`: validation, center/bounds, and `getHospitalLocations()`. That function is the seam: when `hospitals` gains `latitude`/`longitude` columns, only its body changes. The response shape stays the same.

## Known gaps

- Coordinates are fictional demo points in Mangaluru, not real facilities.
- The dashboard fixture (`app/data/mock-results.json`) still uses `h-city`/`h-north`/`h-river`. Map ids match the DB seed, so joins line up once the UI reads live `/api/results`.
