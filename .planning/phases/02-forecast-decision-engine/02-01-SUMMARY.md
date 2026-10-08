---
phase: 02-forecast-decision-engine
plan: "01"
subsystem: engine
tags: [typescript, vitest, forecasting, mape, stockout, pure-functions]

requires:
  - phase: 01-data-contracts
    provides: nothing yet (contracts pending — used local types shim instead)
provides:
  - TS + vitest harness (package.json, tsconfig strict, vitest.config.ts)
  - lib/engine tracer slice: types shim, EngineInputError, forecast()+mape()+networkMean(), stockoutRisk()
  - Deterministic seeds for all four D-22 scenarios with seed-shape smoke tests
affects: [02-02 (outbreak+waste), 02-03 (moves+priorities), phase-3-api-chat, phase-4-dashboard]

actuals:
  tokens: 6400
  tasks: 3
  commits: 3

tech-stack:
  added: [typescript ^5.6, vitest ^2.1]
  patterns: [pure-function engine modules, typed-error guard-clauses, deterministic committed seeds]

key-files:
  created:
    - package.json
    - tsconfig.json
    - vitest.config.ts
    - lib/engine/types.ts
    - lib/engine/errors.ts
    - lib/engine/seeds.ts
    - lib/engine/forecast.ts
    - lib/engine/forecast.test.ts
    - lib/engine/stockout.ts
    - lib/engine/stockout.test.ts
  modified: []

key-decisions:
  - "Weekday-average baseline keyed on history index (forecast day i = weekday (60+i)%7) — verifiable in one assertion"
  - "Period-9 deterministic noise on seeds (not period-7) so weekday averages carry real residual error — MAPE ~7.3%"
  - "Zero-demand stockout returns {90, warns: 90 < leadTime} via the formula, not a hardcoded warns:false"
  - "Stock surviving the 30-day window extends at the window mean rate; zero total demand takes the D-17 90 cap"

patterns-established:
  - "Pure-function module shape: type-only imports + EngineInputError guard-clauses, no I/O/randomness/time"
  - "1-decimal engine floats via round1(); integer rounding happens at consumption"
  - "Seed scenarios carry stock/leadTime/daysToExpiry/transportDays so plans 02-03 read fixtures without edits"

requirements-completed: [FCAST-01, FCAST-02, RISK-01, RISK-02]

coverage:
  - id: D1
    description: "Daily 30-day forecast array with advisory flags on days 15-30 (FCAST-01)"
    requirement: "FCAST-01"
    verification:
      - kind: unit
        ref: "lib/engine/forecast.test.ts#produces a 30-day daily ForecastDay array / flags days 15-30 advisory"
        status: pass
    human_judgment: false
  - id: D2
    description: "MAPE in the 3-11% band on the deterministic normal seed (FCAST-02, measured ~7.3%)"
    requirement: "FCAST-02"
    verification:
      - kind: unit
        ref: "lib/engine/forecast.test.ts#MAPE on the deterministic normal seed sits in the 3-11% band"
        status: pass
    human_judgment: false
  - id: D3
    description: "Days-until-stockout with lead-time warning boundary incl. zero-demand 90 cap (RISK-01/02, D-17)"
    requirement: "RISK-01"
    verification:
      - kind: unit
        ref: "lib/engine/stockout.test.ts#history-to-warning slice + warning boundary + zero-demand cap"
        status: pass
    human_judgment: false
  - id: D4
    description: "Typed EngineInputError on bad input; all four D-22 seed fixtures deterministic"
    verification:
      - kind: unit
        ref: "lib/engine/forecast.test.ts#input validation + seed completeness"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-08
status: complete
---

# Phase 02 Plan 01: Tracer Harness + Forecast/Stockout Slice Summary

**Weekday-average 30-day forecast (MAPE ~7.3%) wired end-to-end into days-until-stockout warnings on deterministic seeds — 23 vitest tests green**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-08T10:39:48Z
- **Completed:** 2026-10-08T10:44:53Z
- **Tasks:** 3
- **Files modified:** 10 created, 1 extended

## Accomplishments

- Minimal TS strict (NodeNext) + vitest harness, installed and green
- `forecast()` daily 30-day array with days 15-30 flagged advisory, 1-decimal floats, weekday-average baseline
- `mape()` ignoring zero-demand days + `networkMean()`; normal-seed MAPE ~7.3% in the 3-11% band
- `stockoutRisk()` day-by-day depletion, warns exactly when cover < lead time, zero demand capped at 90 (never Infinity/null)
- All four D-22 seed fixtures deterministic and committed; outbreak tail verified as two consecutive +2σ days

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer: harness plus forecast end-to-end on the normal seed** - `b429d93` (feat)
2. **Task 2: Stockout risk wired to the forecast output** - `5d87c88` (feat)
3. **Task 3: Seed completeness check across all four scenarios** - `01ab65e` (feat)

## Files Created/Modified

- `package.json` - minimal package with vitest+typescript devDeps, test/typecheck scripts
- `tsconfig.json` - strict, NodeNext, includes lib/
- `vitest.config.ts` - node environment, lib/**/*.test.ts
- `.gitignore` - node_modules/, dist/ (incidental, unplanned but required hygiene)
- `lib/engine/types.ts` - local compat shim (DemandHistory, ForecastDay, RiskSignal, window constants)
- `lib/engine/errors.ts` - EngineInputError (D-20)
- `lib/engine/forecast.ts` - forecast(), mape(), networkMean()
- `lib/engine/seeds.ts` - all four D-22 scenarios + allSeedHistories() helper
- `lib/engine/forecast.test.ts` - 14 tests (forecast shape, MAPE band, validation, seed smoke)
- `lib/engine/stockout.ts` - stockoutRisk()
- `lib/engine/stockout.test.ts` - 9 tests (happy path, warning boundary, 90 cap, throws)

## Decisions Made

- `lib/contracts.ts` (P2-owned) confirmed absent → used the local `lib/engine/types.ts` shim per plan; never created/edited P2 files.
- Weekday-average baseline keyed on history index: forecast day `i` uses weekday `(60+i)%7`. Simple, deterministic, directly asserted in test.
- Seed noise uses a period-9 deterministic pattern (not period-7): period-7 noise is identical per weekday, giving MAPE 0%; period-9 gives genuine residual error and MAPE ~7.3%.
- Zero-demand stockout returns `warns: 90 < leadTimeDays` via formula rather than hardcoded false — correct for sane lead times, honest for absurd ones.
- Stock surviving the 30-day window extends at the window's mean daily rate; only truly-zero total demand takes the D-17 90 cap.

## Deviations from Plan

None - plan executed exactly as written. (One incidental addition: `.gitignore` with node_modules//dist/ so `node_modules` from `npm install` never leaks into git — standard hygiene, committed inside the Task 1 commit.)

## Issues Encountered

None. First seed-noise candidate (period-7) produced MAPE 0.0% and was rejected before any file was written — design iteration, not a deviation.

## Threat Flags

None — no security-relevant surface beyond the plan's threat model. Threat T-02-01 (tampering via inputs) is mitigated: every engine entry point guard-clauses with `EngineInputError` on negative stock, wrong history length, gaps, and negative/NaN forecast values; engine holds no secrets, performs no I/O, makes no network calls.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 02-02 (outbreak + waste): `seeds.outbreak` tail verified +2σ-enter-shaped, `seeds.waste` stock (3500u) dwarfs demand-to-expiry — fixtures need no edits.
- Ready for 02-03 (moves + priorities): `seeds.multiSender` receiver + two senders with differing waste/transport terms in place; `RiskSignal` shim shape available.
- Reconciliation note for Phase 1: when P2 freezes `lib/contracts.ts`, align `lib/engine/types.ts` against it.

## Self-Check: PASSED

- All 10 files exist on disk (verified via creation + test runs importing them).
- All 3 task commits exist (`b429d93`, `5d87c88`, `01ab65e` — committed above, hashes recorded at commit time).
- Plan verification re-run: `npx vitest run` → 2 files, 23 tests, all pass; `npx tsc --noEmit` clean; `ls lib/engine/*.test.ts` → exactly forecast.test.ts + stockout.test.ts; `lib/contracts.ts` absent (untouched).

---
*Phase: 02-forecast-decision-engine*
*Completed: 2026-10-08*
