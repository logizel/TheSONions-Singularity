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

- **D-13 Demo sign-in:** `/sign-in` page (outside `/api`) with a server action that sets the signed `session` cookie (same HMAC as `scripts/gen-cookie.ts`) for a chosen role + hospital. It is enabled only when `DEMO_AUTH=true` and labelled "Demo sign-in". The top-bar role switcher re-issues the cookie, so server 401/403 rules apply in the UI. `PROTOTYPE_OWN_HOSPITAL_ID` is replaced by the cookie's hospitalId.

## Design brief (binding for 06-02/06-03, from the user)

Commit to ONE direction (D-09: light, map-first operations) and execute it fully.

**Banned:**
- the default font stack, Inter, Roboto, Arial, Space Grotesk. Choose a characterful display + body pair via `next/font` (self-hosted, no CDN), with **tabular numerals for every figure**.
- slate + blue palette (the current UI is slate + `#2563eb`), purple/blue gradients, gradient text, glow blobs, glassmorphism everywhere, sparkle/"AI" iconography, emoji as icons.
- a grid of identical rounded white cards with hairline shadows (the current UI is exactly this: 6 identical cards). Use hierarchy, density changes, dividers, and tables where data is tabular.
- filler microcopy ("Unlock insights", exclamation marks). Write terse operational copy with real units.

**Required:**
- a strict semantic risk scale (critical / low / ok) that is colour-blind safe and **never colour-only** (icon/shape/label too); AA contrast.
- purposeful motion only (marker pulse, vehicle movement, sheet slide), honouring `prefers-reduced-motion`.
- responsive from 390 px to 1440 px+.
- CSS Modules + CSS variables (no Tailwind or other CSS framework); `theme/tokens.ts` stays as the typed mirror of the variables. Inline styles are replaced.
- Allowed new deps: leaflet, react-leaflet (5.0.0, peer react ^19), @types/leaflet, fonts via next/font. Anything else needs approval.

**Layout (06-02):** the MAP is the hero. Full-bleed Leaflet map; a floating top bar (title, updated-at, role switcher, refresh); on desktop a left panel holding the 6 data sections as a designed, tabbed or sectioned list (not 6 identical cards); drill-in becomes a sheet over the map; on mobile, a bottom sheet. Every data point from the six old cards stays reachable. A non-map list alternative gives the same information; markers are keyboard and screen-reader accessible.

**Map (06-02):** OSM tiles with visible "© OpenStreetMap contributors" attribution (never removed); tile URL configurable via `NEXT_PUBLIC_TILE_URL`. Custom `L.divIcon` markers (this avoids Leaflet's broken default-icon path under bundlers). Marker state comes from risk (critical/low/ok); outbreak gets a subtle pulse; the selected hospital is emphasised. Marker click = the same `?hospital=` selection as everywhere else. Join `/api/hospital-locations` with `/api/results` by id.

**Tracking (06-03):** cart = engine transfers with a checkout-style summary (total units, medicines, total road distance, longest ETA, each line's checks passed). The tracking sheet shows a big ETA, road distance remaining, a status stepper with timestamps, the route polyline, and a vehicle moving along it on a demo clock with an adjustable time scale, labelled "Simulated". "Engine delivery window: N days" and "Road drive time / distance" stay separate. Supplier orders appear as a lead-time timeline only. No fabricated driver names, phones or plates.

## Behaviour that must survive the redesign (06-02)

- `?hospital=<id>` URL cross-filter (single selection, toggle, unknown id dropped, back/forward restores).
- Drill-in per hospital (stock per medicine vs lead + buffer, moves in/out, priority, outbreak).
- Role gating: hospital_admin RW-own / RO-others; network_admin full (now cookie-backed, D-13).
- The chatbot panel (quote-only, risk chips, context-aware of the selected hospital, collapse/restore with draft kept).
- 15–30 day forecast ADVISORY labelling; MAPE display; outbreak chips/banner; manual Refresh + updated-at timestamp; skeleton and empty states.
- data-testids (keep, or update `.planning/phases/04-dashboard-ui/04-UAT.md`): dashboard-header, header-timestamp, refresh-button, role-switcher, outbreak-banner, filter-banner, clear-filter, dashboard-grid, loading-skeletons, empty-state, empty-state-data-entry-link (its `/data-entry` target does not exist: fix or stop linking), hospital-panel, hospital-panel-close, hospital-panel-switcher, hospital-panel-header-stock, hospital-panel-moves, hospital-panel-priority, chat-panel, chat-fab, chat-collapse, chat-history, chat-empty, chat-welcome, chat-chips, prompt-bar, prompt-bar-input, prompt-bar-send.

## Data available to the UI (from 06-01)

`GET /api/results` (ResultsJSON v2, `lib/contracts.ts`), `GET /api/hospital-locations` ({center, bounds, hospitals[{id,name,lat,lng,address}]}), `GET /api/route?from&to` ({distanceM, durationS|null, path[[lat,lng]], approximate}), `POST /api/chat` ({question} → {answer}). Live network today: 3 hospitals, 5 medicines, 2 critical stock-outs, 1 transfer, 2 supplier orders, 0 waste, 0 outbreaks. The UI must look good with sparse sections too.

## Deferred / out of scope

- Renaming `middleware.ts` → `proxy.ts` (deprecated in Next 16): noted, not done.
- Real geocoding, real fleet tracking, supplier locations.
