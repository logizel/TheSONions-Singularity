---
quick_id: 261009-3hj
status: complete
branch: feat/hospital-locations-api
commits: [8da88de, 4b24c67, b8f4c6d]
---

# Summary: hospital locations API for react-leaflet map

Added `GET /api/hospital-locations` (backend only): static demo data `data/hospital-locations.json` (DB seed ids, fictional Mangaluru points), pure helpers + `getHospitalLocations()` seam in `lib/hospital-locations/`, route at `app/api/hospital-locations/route.ts`, contract doc `docs/hospital-locations-api.md`.

## Verification
- typecheck clean; vitest 71/71 (15 new); `next build` passes.
- Dev server + gen-cookie: no cookie 401, network_admin 200, hospital_admin 200, POST 405, `Cache-Control: private, max-age=300`; ids ⊂ {h-civil,h-stmary,h-north}; coords in range; bounds ordered.

## Deviations
- `.js` import suffixes (lib/engine style) break Turbopack resolution in the App Route build, so this module uses extensionless imports (lib/chat style).
- Context7 MCP wasn't loaded in this session (it was added mid-session). Leaflet conventions were checked against the react-leaflet and leafletjs.com docs instead.
- The P2 follow-up issue could not be filed (GitHub token 403). Text is in `261009-3hj-deferred-items.md`.
- Planner and executor ran inline instead of as spawned subagents.
