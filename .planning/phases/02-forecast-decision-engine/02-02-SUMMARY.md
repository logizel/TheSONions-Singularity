---
phase: 02-forecast-decision-engine
plan: "02"
subsystem: engine
tags: [typescript, vitest, outbreak-detection, trend-forecast, waste-risk, pure-functions]

requires:
  - phase: 02-forecast-decision-engine plan 01
    provides: TS + vitest harness, types shim, EngineInputError, deterministic seeds (normal/outbreak/waste)
provides:
  - detectOutbreak() + trendForecast() in lib/engine/outbreak.ts (9 tests)
  - wasteRisk() in lib/engine/waste.ts (7 tests)
affects: [02-03 (moves+priorities consume outbreak flags and waste quantities), phase-3-api-chat, phase-4-dashboard]

actuals:
  tokens: 3500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: [pure-function engine modules, typed-error guard-clauses, seeded tests citing decision IDs]

key-files:
  created:
    - lib/engine/outbreak.ts
    - lib/engine/outbreak.test.ts
    - lib/engine/waste.ts
    - lib/engine/waste.test.ts
  modified: []

key-decisions:
  - "OutbreakFlag shape { flagged, enteredOnDay } — enteredOnDay is the first index of the entering pair, null when clear"
  - "Exit state machine: re-entry after a clear records the latest entry day; a single inside day resets nothing"
  - "wasteRisk extension at the 30-day array's mean daily rate up to min(expiry, 90); fractional expiry floored"
  - "TDD run with one feat commit per task per dispatch instruction (RED observed pre-commit, not as separate test() commits)"

patterns-established:
  - "Local validateHistory guard per module (stockout.ts precedent) over importing forecast.ts — modules stay independently unit-testable"
  - "Meaningfulness assertions in tests: spikes proven above the band before asserting flag behavior"

requirements-completed: [OUTBK-01, OUTBK-02, WASTE-01, WASTE-02]

coverage:
  - id: D1
    description: "Outbreak flag enters on +2σ for 2 consecutive days over the 60-day baseline and clears after 2 days back inside (OUTBK-01)"
    requirement: "OUTBK-01"
    verification:
      - kind: unit
        ref: "lib/engine/outbreak.test.ts#flags the outbreak seed with entry day 58 / clears after 2 consecutive days back inside / one day back inside does not clear"
        status: pass
    human_judgment: false
  - id: D2
    description: "Flagged series switch to a flat last-7-day-average trend forecast with advisory flags on days 15-30 (OUTBK-02)"
    requirement: "OUTBK-02"
    verification:
      - kind: unit
        ref: "lib/engine/outbreak.test.ts#returns a flat 30-day array at the last-7-day average with advisory flags on days 15-30"
        status: pass
    human_judgment: false
  - id: D3
    description: "Waste quantities equal stock minus forecast demand to expiry capped at 90 days, warning exactly when waste > 0 (WASTE-01/02)"
    requirement: "WASTE-01"
    verification:
      - kind: unit
        ref: "lib/engine/waste.test.ts#reports the exact expiring-unused quantity on the waste seed / caps the demand window at 90 days / reports the entire stock as waste when forecast demand is zero"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bad input to either function throws typed EngineInputError"
    verification:
      - kind: unit
        ref: "lib/engine/outbreak.test.ts#input validation + lib/engine/waste.test.ts#input validation"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-10-08
status: complete
---

# Phase 02 Plan 02: Outbreak + Waste Risk Summary

**+2σ outbreak enter/exit state machine with flat last-7-day trend switching, and stock-minus-demand-to-expiry waste with 90-day cap — 16 new vitest tests, 39/39 green**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-08T10:47:51Z
- **Completed:** 2026-10-08T10:49:58Z
- **Tasks:** 2
- **Files modified:** 4 created, 0 modified

## Accomplishments

- `detectOutbreak()` enters on 2 consecutive days above mean+2σ over the full 60-day baseline (entry day 58 on the outbreak seed), exits only after 2 consecutive days back inside — no false positive on the normal seed, single spike day insufficient
- `trendForecast()` flat last-7-day-average 30-day projection in 1-decimal floats with advisory flags on days 15-30
- `wasteRisk()` exact expiring-unused quantities (waste seed: ~2990u, warns true), zero when stock depletes first, 90-day cap honored, zero-demand reports the whole stock as waste
- Typed `EngineInputError` on short/gappy/negative history and negative stock/expiry in both modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Outbreak detection plus trend-forecast switch** - `dc38111` (feat)
2. **Task 2: Expiry-waste risk from stock and forecast** - `2ef77af` (feat)

## Files Created/Modified

- `lib/engine/outbreak.ts` - `detectOutbreak()` state machine + `trendForecast()` flat projection
- `lib/engine/outbreak.test.ts` - 9 tests against outbreak/normal seeds plus constructed exit/wobble histories
- `lib/engine/waste.ts` - `wasteRisk()` with 90-day capped window
- `lib/engine/waste.test.ts` - 7 tests consuming `forecast()` output plus the waste seed

## Decisions Made

- `OutbreakFlag` shape `{ flagged: boolean; enteredOnDay: number | null }` (plan wording "flagged" over the PATTERNS.md `isOutbreak` sketch — plan takes precedence); `enteredOnDay` is the first index of the entering pair, null when clear.
- Exit state machine supports re-entry: a clear resets the entry day, and a later spike pair re-flags with the latest entry day; a single inside day resets neither counter to a clear.
- `wasteRisk` extends past day 30 at the 30-day array's mean daily rate, and floors fractional `daysToExpiry` (integers unaffected).
- TDD executed as RED (test written, suite fails on missing module) → GREEN (implementation, suite passes) with a single `feat(02-02)` commit per task per the dispatch instruction's commit-scope format — RED evidence observed via failing runs, not via separate `test()` commits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. First-run thresholds confirmed the seed shapes numerically (outbreak threshold ~61.6 with spikes at 72/75; waste demand-to-expiry ≈ 510 vs 3500 stock).

## Threat Flags

None — no security-relevant surface beyond the plan's threat model. Threat T-02-01 (tampering via inputs) is mitigated: both modules guard-clause with `EngineInputError` on short/gappy/negative history, malformed forecast arrays, and negative stock/expiry; no I/O, no secrets, no network.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-03 (moves + priorities): `detectOutbreak()` returns per-series `{ flagged, enteredOnDay }` and `wasteRisk()` returns exact `{ wasteUnits, warns }` quotable quantities — both consumable as `RiskSignal` inputs without edits.
- Plan 01 files untouched (`forecast.ts`, `stockout.ts`, `seeds.ts`, `types.ts`, `errors.ts` unmodified); no P2-owned files created (`lib/contracts.ts` still absent, types shim still the contract).

---
*Phase: 02-forecast-decision-engine*
*Completed: 2026-10-08*

## Self-Check: PASSED

- SUMMARY.md, outbreak.ts, waste.ts exist on disk.
- Task commits `dc38111`, `2ef77af` exist in history.
- Zero stub markers (TODO/FIXME/placeholder) in new source files.
- Plan verification re-run: `npx vitest run` → 4 files, 39 tests, all pass; `npx tsc --noEmit` clean; plan-01 files and P2 paths untouched.
