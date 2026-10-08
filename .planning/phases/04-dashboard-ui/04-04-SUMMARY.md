---
phase: 04-dashboard-ui
plan: 04
subsystem: ui
tags: [nextjs, react, dashboard, cross-filter, risk-badges]

# Dependency graph
requires:
  - phase: 04-dashboard-ui plans 01-03
    provides: [six-card dashboard, drill-in panel per-row risk semantics, fixture slices]
provides:
  - Filtered, risk-consistent inventory card with scope-honest total caption
  - Closed gaps G-04-1 (inventory cross-filter) and G-04-2 (dashboard/panel badge consistency)
affects: [04-05 gap closure, phase 5 auth wiring, verify-work UAT]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 897
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns: [per-medicine risk inputs shared between card builder and panel derivation]

key-files:
  created: []
  modified: [app/page.tsx, components/cards/InventoryCard.tsx]

key-decisions:
  - "Min-row medicine's own lead/buffer drives the card badge, matching HospitalPanel per-row derivation exactly"
  - "Optional scope prop (hospital name or null) keeps unfiltered caption byte-identical to prior wording"

patterns-established:
  - "Card badge math reuses panel per-row semantics: riskForDaysToStockout evaluated on the same (days, lead, buffer) arguments"

requirements-completed: [UI-01, UI-02]

coverage:
  - id: D1
    description: "Inventory card filters to the selected hospital with badge math matching the drill-in panel"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "npm run typecheck && npm run build"
        status: pass
      - kind: other
        ref: "region-scoped grep: selectedId x4 + leadByMedicine|medicineId inside buildInventoryRows"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inventory header caption names the hospital in view when filtered, network-wide wording when unfiltered"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "grep scope on both InventoryCard.tsx and page.tsx call site"
        status: pass
    human_judgment: true
    rationale: "Caption honesty is a visual/copy judgment — automation confirms wiring, a human confirms the rendered wording reads correctly in both states"

# Metrics
duration: 3min
completed: 2026-10-08
plan_head_before: bcde74f71173edd38c21b228f9815c4df08e6a83
plan_head_after: 41d1a1a54bb2b54e92cdd55799caa6c600f90d7fb
status: complete
---

# Phase 04 Plan 04: Dashboard Gap Closure Summary

**Inventory card now cross-filters with the selected hospital and shares the drill-in panel's per-medicine risk inputs, with a scope-honest total caption**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-08T13:59:09Z
- **Completed:** 2026-10-08T14:01:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `buildInventoryRows` filters hospitals by the validated `selectedId` before mapping — `?hospital=h-city` yields exactly one inventory row (G-04-1 closed)
- Card badge evaluates `riskForDaysToStockout` on the min row's own medicine lead/buffer (panel derivation), so h-city/m-cefix 16d reads `ok` on both dashboard and drill-in (G-04-2 closed)
- Inventory header caption is scope-honest: names the hospital when filtered, keeps network-wide wording unfiltered (T-4-15 mitigated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Filter buildInventoryRows by selectedId with per-medicine risk inputs** - `5081898` (fix)
2. **Task 2: Scope or relabel the inventory total when filtered** - `41d1a1a` (feat)

## Files Created/Modified

- `app/page.tsx` - selectedId filter + per-medicine lead/buffer lookup in `buildInventoryRows`; `scope` wired from `selectedHospital` at the InventoryCard call site
- `components/cards/InventoryCard.tsx` - optional `scope` prop; header caption renders hospital-scoped or network-wide wording

## Verification Evidence

- `npm run typecheck` — green (both tasks)
- `npm run build` — green, static prerender intact (both tasks)
- Region-scoped check Task 1: `selectedId` appears 4x inside `buildInventoryRows` (≥3 required) and `leadByMedicine|medicineId` present — passes
- Presence check Task 2: `scope` appears 4x in `InventoryCard.tsx`, 2x in `app/page.tsx` (both sides wired) — passes
- Numeric cross-check on fixture: h-city min row is m-cefix 16d with lead 4 + buffer 10 → `ok` under both the new card inputs and the panel per-row derivation (previously card used global-max lead/buffer → `warning`, the reported divergence)

## Gaps Closed

- **G-04-1:** Clicking a hospital now filters ALL SIX cards including inventory; the filtered single-row sum is labeled with the hospital name, never as a network total
- **G-04-2:** Dashboard and drill-in agree on risk for the same stock (verified on the h-city/m-cefix 16d case)

## Decisions Made

- Min-row medicine's own lead/buffer drives the card badge, matching the HospitalPanel per-row derivation exactly (first-min-row wins on ties, `?? 0` fallbacks mirror the panel) — per plan
- Optional `scope` prop typed `string | null` with unfiltered caption byte-identical to prior wording — no visual change unless filtered

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Commits landed on `main` per established repo practice (prior `feat(04-03)` commits in this phase did the same); untracked `.gsd/`, `.planning/milestone.lock`, `.planning/state.json` are pre-existing tooling artifacts, left untouched.

## Threat Flags

None — no new surface beyond the plan's threat model. T-4-14 (selectedId already validated by `isKnownHospitalId`, unchanged path) and T-4-15 (caption now scope-honest) mitigations hold; no new packages added.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: `app/page.tsx`, `components/cards/InventoryCard.tsx`
- FOUND: commits `5081898`, `41d1a1a` in `git log`
- No file deletions in either commit; no new untracked source files

## Next Phase Readiness

- Dashboard surface gaps G-04-1/G-04-2 closed; 04-05 (chat+roles gaps) can proceed independently — no shared files
- Human UAT recommended for the filtered caption wording and the h-city badge reading (see coverage D2)

---
*Phase: 04-dashboard-ui*
*Completed: 2026-10-08*
