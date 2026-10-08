# Deferred items: quick 261009-3hj

## Follow-up issue for P2 (not filed: GitHub MCP token got 403 creating issues on logizel/TheSONions-Singularity)

**Title:** P2: add nullable latitude/longitude to hospitals + seed (map data source)

**Track:** P2 Data (`db/`, `scripts/`). `db/schema.ts` is frozen, so this needs all-track sign-off.

1. Add nullable `latitude`/`longitude` (e.g. `doublePrecision`, WGS84 decimal degrees) to `hospitals` in `db/schema.ts`, plus a drizzle migration.
2. Seed `h-civil`, `h-stmary`, and `h-north` in `scripts/seed.ts` with the demo values from `data/hospital-locations.json` (Mangaluru: 12.8703/74.8436, 12.8605/74.8835, 12.933/74.818).
3. Then switch the body of `getHospitalLocations()` (`lib/hospital-locations/index.ts`) to query `hospitals`. `sanitizeHospitals()` already drops null or invalid coordinates, so the response shape does not change.

**Acceptance:** typecheck/test/build pass; `GET /api/hospital-locations` keeps the same shape and ids, with data read from Neon.
