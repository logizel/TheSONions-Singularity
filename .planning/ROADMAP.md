# Roadmap: TheSONions-Singularity — Hospital Stock Balancer

## Overview

From an empty repo to a working network inventory balancer in five track-owned horizontal layers: P2 lays the data foundation and freezes the shared contracts every track builds against, P3 builds the pure-TS forecast and decision engine, P4 exposes ResultsJSON APIs with role-based access and the quote-only chatbot, P1 puts it all on one screen with drill-in, and a final integration phase wires every track together through the frozen contracts so the administrator sees live, matching numbers end to end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Layer + Frozen Contracts** - Stock/usage/load entry, CSV upload, Excel export, Neon schema; freezes shared contracts (Track P2)
- [ ] **Phase 2: Forecast & Decision Engine** - Forecast, outbreak, stock-out, waste, moves, priority as pure TS functions (Track P3)
- [ ] **Phase 3: API, Chat & Access** - ResultsJSON APIs, rule-based quote-only chatbot + validator, role-based auth (Track P4)
- [ ] **Phase 4: Dashboard UI** - One-screen dashboard with drill-in and chat panel (Track P1)
- [ ] **Phase 5: Integration & Wiring** - Wire all tracks through frozen contracts into one working prototype

## Phase Details

### Phase 1: Data Layer + Frozen Contracts
**Goal**: Hospital and network admins can record and configure the full per-hospital/medicine picture, and every track builds against contracts frozen in this phase
**Track**: P2 — owns `db/`, `scripts/`, `lib/contracts.ts` (frozen shared contract)
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. Hospital admin can enter current stock per medicine with expiry date
  2. Hospital admin can enter daily usage counts plus patient load count and emergency share percent
  3. Network admin can configure transport days between hospitals and supplier lead times
  4. Hospital admin can bulk-upload 60 days of demand history via CSV and export data to Excel
**Plans**: TBD

Notes:
- Freezes shared contracts day 1: `db/schema.ts` types, `lib/contracts.ts` (engine in/out + ResultsJSON shape), and a `theme/tokens.ts` stub for P1. Later phases consume these contracts; no phase edits another track's directories.

### Phase 2: Forecast & Decision Engine
**Goal**: The system turns history and stock into forecasts, outbreak flags, stock-out and waste warnings, transfer suggestions, and ranked priorities
**Track**: P3 — owns `lib/engine/` (pure TS + tests only)
**Depends on**: Phase 1
**Requirements**: FCAST-01, FCAST-02, OUTBK-01, OUTBK-02, RISK-01, RISK-02, WASTE-01, WASTE-02, MOVE-01, MOVE-02, PRIOR-01, PRIOR-02
**Success Criteria** (what must be TRUE):
  1. System produces a 30-day demand forecast per hospital/medicine from the 60-day weekly pattern and reports forecast error (MAPE) in the 3-11% target band
  2. A hospital whose daily demand climbs far above normal (+2σ for 2 consecutive days) is flagged as an outbreak and switches to recent-rising-trend forecast until demand normalizes
  3. Administrator is warned per hospital/medicine when days-until-stockout is shorter than the supplier lead time
  4. Administrator is warned per hospital/medicine with expiring-unused quantities computed as stock minus realistic demand before expiry (capped at 90 days)
  5. Administrator receives transfer suggestions passing all 5 checks plus emergency supplier orders for the remainder, with competing hospitals visibly ranked and justified
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Tracer: harness plus forecast/stockout history-to-warning slice on deterministic seeds
- [ ] 02-02-PLAN.md — Outbreak detection with trend switching plus expiry-waste risk
- [ ] 02-03-PLAN.md — Transfer suggestions with remainder orders plus global priority ranking

Notes:
- Pure statistical TypeScript (weekday averages + trend switch), no ML training. Verified by unit tests against seeded data; no DB or UI code in this phase.

### Phase 3: API, Chat & Access
**Goal**: Roles are enforced on every path, engine results are servable as ResultsJSON, and the administrator can ask risk questions answered only with quoted system numbers
**Track**: P4 — owns `app/api/`, `lib/chat/`, `middleware.ts`
**Depends on**: Phase 2
**Requirements**: CHAT-01, CHAT-02, CHAT-03, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. Hospital admin can read/write own hospital details and read only other hospitals, while network admin has full read/write access including moves and orders
  2. Administrator can ask risk questions (e.g. "Which hospital is most at risk next week?") and receive answers built only by quoting precomputed ResultsJSON, never calculated by the chatbot
  3. Any chatbot answer containing a number not present in ResultsJSON is rejected by the validator
  4. Precomputed ResultsJSON is servable over API so dashboard and chat clients consume the same numbers
**Plans**: TBD

Notes:
- Chatbot is a rule-based intent matcher + templates + number validator; no DB access and no calculation inside chat code. Interface stays swappable to a local/remote LLM later (v2 CHAT-04).

### Phase 4: Dashboard UI
**Goal**: The administrator runs the whole network from one screen and can drill into any hospital
**Track**: P1 — owns `app/` (pages, except `app/api/`), `components/`, `theme/tokens.ts` (theme choice final)
**Depends on**: Phase 1
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Administrator sees inventory, forecast, shortage risk, expiry risk, recommended moves, and priority hospitals on one screen
  2. Administrator can click into any hospital for its detail
**Plans**: TBD
**UI hint**: yes

Notes:
- Builds against the Phase 1 frozen contracts and mock ResultsJSON, so UI work is independent of Phase 3 completion; final wiring happens in Phase 5.

### Phase 5: Integration & Wiring
**Goal**: All four tracks work as one prototype — live data flows from entry to engine to API to screen with matching numbers and enforced roles
**Track**: All tracks coordinated through frozen contracts; no new track directories, no contract changes
**Depends on**: Phases 3 and 4 (and transitively Phases 1-2)
**Requirements**: (none — carries no new requirements; re-verifies Phases 1-4 working together)
**Success Criteria** (what must be TRUE):
  1. Figures recorded in data entry match the engine outputs, API responses, and displayed values for the same hospital and medicine
  2. A full chain works on seeded network data: CSV upload produces forecasts, warnings, transfer suggestions, and chatbot answers quoting those same numbers
  3. Role-based access holds across every path: hospital admins cannot modify other hospitals' records or moves, network admin can
**Plans**: TBD

Notes:
- Contract changes are out of scope here; any mismatch found is fixed inside the owning track's directories. Do NOT assign people in the roadmap — track-to-person mapping lives in docs/TEAM.md.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer + Frozen Contracts | 0/TBD | Not started | - |
| 2. Forecast & Decision Engine | 0/TBD | Not started | - |
| 3. API, Chat & Access | 0/TBD | Not started | - |
| 4. Dashboard UI | 0/TBD | Not started | - |
| 5. Integration & Wiring | 0/TBD | Not started | - |
