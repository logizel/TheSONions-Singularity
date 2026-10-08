# Phase 6 — Live map + UI redesign + delivery-style order tracking: Context

**Gathered:** 2026-10-09 (user Q&A in session; sole active developer, may edit any directory and amend contracts)

## Why

Three hospital id sets disagree (UI fixture `h-city…`, `data/results.json` `h1`, Neon `h-civil…`), and the merged "phase-5 integration" never reads the DB: `scripts/generate-results.ts` runs one hardcoded engine seed and emits empty transfers/orders/priorities. The dashboard and chat still read `app/data/mock-results.json`. The user wants a map-first redesign, a Leaflet/OSM map fed from the DB, and delivery-app-style tracking of accepted transfers.

## Locked decisions

- **D-01 (A4) IDs:** DB seed ids `h-civil`, `h-stmary`, `h-north` everywhere. The fixture is retired; `/api/results` is the single UI/chat/cart snapshot.
- **D-02 Data source:** a live DB → engine pipeline. `lib/network/` reads Neon read-only, assembles 60-day histories (interpolating NULL gaps), runs every `lib/engine` function per hospital × medicine, and builds `ResultsJSON` v2. The engine modules are called, never reimplemented; integration-level choices (need, sender pool, waste tiers) are documented in code.
- **D-03 Contract amendment:** `ResultsJSON` gains the fields the dashboard needs (hospital summaries, medicines, transport, leads, inventory, typed emergency orders, ranked priorities with factors, MAPE percent, advisory window). `HospitalRow` gains optional `latitude`/`longitude`/`address`.
- **D-04 (A5) Coordinates:** fictional demo points in Mangaluru (Hampankatta, Padil, Kavoor), 4.5–10.7 km apart, labelled demo data. They are stored in Neon as nullable `hospitals.latitude/longitude/address`.
- **D-05 Migrations:** drizzle-kit **generate** only. The SQL is shown to the user, and **apply/seed/update runs only after explicit approval**.
- **D-06 Routing:** `GET /api/route?from&to` resolves ids server-side. OSRM base comes from `ROUTING_BASE_URL` (default: public demo server, fair-use). An in-memory pair cache is used, with a straight-line + haversine fallback (`approximate: true`). OSRM is `lng,lat`; responses are `[lat,lng]`.
- **D-07 (A1) Cart:** engine hospital-to-hospital transfers. Emergency supplier orders form a separate section with a lead-time timeline only (no coordinates → no route).
- **D-08 (A2) Order state:** new Neon tables `orders` + `order_lines` (additive migration, ask before applying). Lifecycle: Suggested → Accepted → Packed → In transit → Delivered (+ Cancelled). Idempotent deterministic key. Delivery never mutates `stock_batches`.
- **D-09 (A3) Design:** light, map-first operations layout: warm off-white, deep ink, one signal colour. CSS Modules + CSS variables (`theme/tokens.ts` = typed mirror), next/font self-hosted pair, tabular numerals. Bans per the brief (no Inter/Roboto/Arial/Space Grotesk, slate+blue, gradients, glass, emoji icons, identical card grids).
- **D-10 Time semantics:** "Engine delivery window: N days" (ResultsJSON `transportDays`) and "Road drive time/distance" (routing) are always shown separately, never merged. Vehicle movement is simulated on a demo clock and labelled "Simulated".
- **D-11 Chat:** stays quote-only. `lib/chat` reads name-joined rows from ResultsJSON v2; the validator haystack is the same snapshot. No new numbers are fed to chat.
- **D-12 Delivery:** 3 stacked PRs: `feat/hospital-map-data` (built on `feat/hospital-locations-api`) → `feat/ui-redesign-map` → `feat/order-tracking`. Never push main, never merge. `origin/ui-enhancements` (another author, Tailwind/indigo) is out of scope and ignored.

## Deferred / out of scope

- Renaming `middleware.ts` → `proxy.ts` (deprecated in Next 16): noted, not done.
- Real geocoding, real fleet tracking, supplier locations.
