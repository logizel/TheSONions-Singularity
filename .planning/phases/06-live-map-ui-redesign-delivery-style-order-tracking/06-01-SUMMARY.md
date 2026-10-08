---
phase: 06
plan: 01
status: complete
branch: feat/hospital-map-data
commits: [49228fb, 992de4f, c980108, 0ab9a20, fe297f0, 56e2572]
---

# 06-01 Summary: live data pipeline, hospital coordinates, routing API

## Delivered
- **Neon:** migration `0001_hospital_coordinates` (3 nullable columns + range check) and demo coordinates for `h-civil`, `h-stmary`, `h-north`, both applied with user approval. `__drizzle_migrations` now records 2 entries.
- **`lib/network`:** DB → engine → `ResultsJSON` v2. Live run against Neon: window 2026-08-09..2026-10-07, MAPE 7.5% (in-sample), 2 stock-out warnings (Paracetamol at Northgate / St Mary), 1 transfer (City Civil → Northgate, 521.4 u, 1 d), 2 supplier orders, 0 waste, no outbreaks.
- **APIs:** `/api/results` (live, 30 s cache, blob fallback), `/api/chat` (same snapshot), `/api/hospital-locations` (DB), `GET /api/route` (OSRM, straight-line fallback).
- **Tests:** 102/102 (46 new across geo, routing, hospital-locations, network, chat).

## Verification
- typecheck clean; vitest 102/102; `next build` green (`ƒ /api/route` listed).
- `next start` + gen-cookie curl:
  - results: no cookie 401; network_admin, hospital_admin 200; POST 405; `X-Results-Source: live`.
  - locations: 401 / 200 / 200 / 405. Before the migration it returned 503 (as designed).
  - route: no cookie 401; missing params, same id and bad chars 400; unknown 404; hospital_admin 200; POST 405.
  - Real OSRM: civil→north 9.96 km / 12.9 min (278 pts), north→civil 12.46 km, civil→stmary 6.05 km, stmary→north 12.65 km. All points fall in Mangaluru in `[lat,lng]` order. A cached repeat call took 0.09 s.
  - Chat answers quote live numbers (risk score 35, 10 d vs 21 d lead, 521.4 u transfer).

## Deviations / notes
- `lib/engine` imports were made extensionless: Turbopack can't resolve `.js` → `.ts`. No logic change.
- `lib/chat` entity extraction can't parse phrasing like "Hospital X run out…" (an existing limitation); the tests use supported phrasing.
- A `next dev` on :3000 (PID 49134, not started by this session) blocked a second dev server, so verification used `next start` on :3123.
- Context7 and Playwright MCPs were not loaded in this session. No browser checks were needed for 06-01.
