---
phase: 04-dashboard-ui
plan: "02"
subsystem: ui
tags: [nextjs, react, typescript, side-panel, role-gating, mock-fixture]

# Dependency graph
requires:
  - phase: 04-dashboard-ui plan 01
    provides: stable HospitalPanelProps mount interface, shared cross-filter state with ?hospital=id sync, fixture slices and card vocabulary
  - phase: 01-data-layer-frozen-contracts
    provides: buffer_days, substitute_ids, directed transport matrix, lead_days feeding move rows
  - phase: 03-api-chat-access
    provides: ResultsJSON envelope shape and auth-scoping mirror for role views
provides:
  - Fully implemented HospitalPanel (read-only drill-in with stock-only header, switcher, priority reasons, moves in/out)
  - Expandable MedicineRow rows with forecast, days-to-stockout, waste, and explainable transit/shelf-life move rows
  - Prototype roles layer (hospital_admin vs network_admin display gating) applied in dashboard and panel
affects: [04-dashboard-ui plan 03 chat, phase 5 integration wiring]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 9984
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [fixture-validated switcher driving shared filter state, explainable move rows with transit plus shelf-life rationale, prop-default role stub with display-only gating]

key-files:
  created: [components/panel/MedicineRow.tsx, components/roles.tsx]
  modified: [components/panel/HospitalPanel.tsx, components/cards/MovesCard.tsx, app/page.tsx]

key-decisions:
  - "Panel imports the static fixture directly so Plan 01 prop interface stays stable; role/ownHospitalId added as optional props only"
  - "Switcher is fixture-id buttons (never free text) calling the shared onSelectHospital, so cards refilter and ?hospital=id updates identically to card clicks"
  - "Move rationale cites whichever fixture numbers support: waste-first, nearest-sender, buffer cushion, need-cap; shelf life counts from arrival to sender's earliest recorded expiry with a 14-day prototype floor"
  - "Role gating is display-only by design with Phase 3 server-side enforcement and Phase 5 wiring deferred in code comments; worded to keep the no-middleware-literal grep gate green"
  - "UI-02 left Pending: sibling plan 04-03 also declares UI-02 with no SUMMARY yet (shared-ID gate)"

patterns-established:
  - "MoveRow: every move row states transit days, shelf-life-on-arrival check, and sender rationale as escaped text"
  - "RoleSwitcher prototype toggle defaults network_admin; hospital_admin hides move/order actions off the prototype own hospital (h-city)"

requirements-completed: []  # REQUIRED — UI-02 declared by this plan but gated: sibling 04-03 also declares UI-02 with no SUMMARY yet

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Side panel shell with full read-only hospital detail and fixture-validated switcher refiltering cards and URL"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "npm run build (pass) + readonly grep gate (pass: READONLY-OK) + stock-only header check (pass: no rendered patient-load stats)"
        status: pass
    human_judgment: true
    rationale: "Panel placement beside the dashboard, switcher refilter behavior, and header adequacy are visual/interactive; needs a human browser look"
  - id: D2
    description: "Expandable per-medicine rows with forecast, days-to-stockout, waste, and transit/shelf-life move rows with sender rationale"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "npm run build + npm run typecheck (pass) + transit/shelf grep (pass: 28 hits) + XSS grep (pass)"
        status: pass
    human_judgment: true
    rationale: "Expand/collapse interaction and rationale readability need a human browser look; no screenshots captured"
  - id: D3
    description: "Role-filtered views (hospital_admin own-full/others-read-only, network_admin full) in dashboard and panel, display-only with server enforcement deferred"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "npm run build (pass) + no-middleware grep (pass: NO-MIDDLEWARE-TOUCHED) + no-P4-paths check (pass)"
        status: pass
    human_judgment: true
    rationale: "Flipping the role toggle and confirming per-row action visibility is client interaction; needs a human browser look"

# Metrics
duration: 8min
completed: 2026-10-08
status: complete
---

# Phase 04 Plan 02: Hospital drill-in panel Summary

**Read-only hospital side panel with expandable per-medicine detail, explainable transit/shelf-life move rows, a card-refiltering hospital switcher, and prototype role-filtered views — all behind the stable Plan 01 mount interface**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-08T12:20:32Z
- **Completed:** 2026-10-08T12:28:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Side panel rendering complete read-only hospital detail from the same fixture slices as the cards: per-medicine stock with expiry dates, forecast line, shortage/expiry warnings, moves in/out, priority score reasons, and a stock-only header
- Hospital switcher (fixture-id buttons) driving the shared cross-filter state so main cards refilter and `?hospital=id` updates identically to card clicks, with unknown ids falling back to a guided empty copy
- Expandable medicine rows revealing forecast outlook, days-to-stockout vs lead time, waste quantity with expiry date, and per-medicine suggested moves; every move row states transit days, shelf-life-on-arrival check, and a sender rationale citing waste-first / nearest-sender / buffer / need-cap
- Prototype role layer defaulting to network_admin: hospital_admin sees own hospital full and others read-only with move/order actions hidden, network_admin sees approve/order actions everywhere — applied in both the MovesCard dashboard and the drill-in panel, documented as display-only with server enforcement deferred to Phase 3 / Phase 5

## Task Commits

Each task was committed atomically:

1. **Task 1: Side panel shell plus full detail plus switcher** - `599d87c` (feat)
2. **Task 2: Expandable medicine rows plus transit and shelf-life move rows** - `091b9d1` (feat)
3. **Task 3: Role-filtered views for hospital and network admins** - `e493f33` (feat)

**Plan metadata:** docs commit follows STATE/ROADMAP updates below

## Files Created/Modified

- `components/panel/HospitalPanel.tsx` - Full drill-in: stock-only header, switcher, priority reasons, medicine list, hospital moves in/out (modified Plan 01 shell, prop interface kept stable with optional additions)
- `components/panel/MedicineRow.tsx` - Expandable medicine rows plus shared MoveRow with transit/shelf-life/rationale and `buildMoveDetail` fixture explainer (created)
- `components/roles.tsx` - Prototype role view layer: Role type, stub defaults, display-only visibility helpers, RoleSwitcher toggle (created)
- `components/cards/MovesCard.tsx` - Optional role props with display-only Approve/Order affordances per row (supporting edit beyond plan `<files>`, P1-owned)
- `app/page.tsx` - Prototype role state plus RoleSwitcher mount, role threading into MovesCard and HospitalPanel (supporting edit beyond plan `<files>`, P1-owned)

## Decisions Made

- Panel imports the static fixture directly instead of growing HospitalPanelProps: the Plan 01 mount in page.tsx keeps compiling, and panel figures always match the cards by construction
- No new dependencies added (T-4-SC): badges, sparklines, and inline styles reuse the Plan 01 primitives, so no human checkpoint tripped
-Approve/Order buttons are intentionally no-op display affordances (`onClick={() => {}}` with prototype titles) — visibility is the D-26 requirement; behavior wires up in Phase 5 (tracked as known stubs, not defects)
- UI-02 stays Pending: sibling plan 04-03 declares UI-01+UI-02 with no SUMMARY yet, so the shared-ID gate blocks completion until the last declaring plan lands (same treatment 04-01 gave UI-01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comments tripped the plan's literal grep gates**
- **Found during:** Tasks 1 and 3 (threat-gate verification)
- **Issue:** Comments describing the read-only/XSS rules contained the literal strings the plan forbids via grep (`<input>`, `dangerouslySetInnerHTML`, `middleware`), failing gates with no actual usage present
- **Fix:** Reworded comments to describe the rules without the literal strings (same precedent as 04-01 deviation 2)
- **Files modified:** components/panel/HospitalPanel.tsx, components/panel/MedicineRow.tsx
- **Verification:** READONLY-OK, XSS-OK, NO-MIDDLEWARE-TOUCHED gates pass
- **Committed in:** 599d87c, 091b9d1, e493f33 (within task commits)

**2. Supporting files beyond the plan's `<files>` list (informational)**
- `app/page.tsx` (role state + switcher mount + prop threading) and `components/cards/MovesCard.tsx` (per-row role-gated action affordances) — both P1-owned, both directly required by the Task 3 acceptance criterion "in both dashboard and panel". No scope creep.

---

**Total deviations:** 2 tracked (1 bug auto-fix, 1 informational)
**Impact on plan:** No scope creep; all changes serve the plan's must-haves and threat mitigations.

## Issues Encountered

- No `gsd_run` CLI in this environment, so STATE.md/ROADMAP.md updates are applied by direct file edit (same content the state verbs would write) — same as 04-01
- No E2E runner in the repo (adding one would trip the T-4-SC blocking checkpoint), so panel open/expand/switch/role-flip behavior is logic- and build-verified only, flagged `human_judgment: true` for browser verification

## Known Stubs

- `components/cards/MovesCard.tsx:84,134` and `components/panel/MedicineRow.tsx:201` — Approve/Order buttons are display-only no-ops (`onClick={() => {}}`) with prototype titles; behavior wires up in Phase 5 — intentional per D-26 display-only gating
- `app/page.tsx` empty state links to `/data-entry` (Phase 1 screens do not exist yet) — carried over from 04-01, resolves when Phase 1 lands
- `components/roles.tsx` `PROTOTYPE_DEFAULT_ROLE` / `PROTOTYPE_OWN_HOSPITAL_ID` — stub role values until the Phase 3 server-side auth layer lands

## Threat Flags

None — no new security surface beyond the plan's threat register. Role prop → action visibility is T-4-06 (transferred to Phase 3/5, documented in code); switcher validates fixture ids (T-4-07); off-hospital actions hidden with no PHI in rows (T-4-08); no raw-HTML injection (T-4-09); no new dependencies (T-4-SC, package.json untouched); no P4-owned paths created or edited.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-03 (chat implements behind `ChatPanelProps`; advisory grey + outbreak banner treatments untouched by this plan)
- Browser verification wanted: panel open/expand/switch flow, move rationale readability, role-toggle action flips in dashboard and panel, `?hospital=id` sync from the switcher
- No blockers

## Self-Check: PASSED

- All created files verified present on disk (`components/panel/MedicineRow.tsx`, `components/roles.tsx`)
- All 3 task commits (`599d87c`, `091b9d1`, `e493f33`) verified in `git log`
- `npm run build` + `npm run typecheck` pass; readonly, XSS, no-middleware, and no-P4-paths gates pass

---
*Phase: 04-dashboard-ui*
*Completed: 2026-10-08*
