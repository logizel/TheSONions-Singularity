---
phase: 02-forecast-decision-engine
plan: "03"
subsystem: engine
tags: [typescript, vitest, transfers, emergency-orders, priority-ranking, pure-functions]

requires:
  - phase: 02-forecast-decision-engine plan 01
    provides: TS + vitest harness, types shim, EngineInputError, multi-sender seed fixtures
  - phase: 02-forecast-decision-engine plan 02
    provides: outbreak flags and waste quantities as consumable risk-signal shapes (read-only)
provides:
  - suggestMoves() in lib/engine/moves.ts (7 tests): 5-check transfers, split shipments, exact remainder orders
  - rankPriorities() in lib/engine/priorities.ts (5 tests): soonness-first 0-100 global ranking with justifications
affects: [phase-3-api-chat, phase-4-dashboard]

actuals:
  tokens: 7150
  tasks: 2
  commits: 2
  plan_head_before: e830a12
  plan_head_after: 37da631

tech-stack:
  added: []
  patterns: [pure-function engine modules, typed-error guard-clauses, precomputed-input modules]

key-files:
  created:
    - lib/engine/moves.ts
    - lib/engine/moves.test.ts
    - lib/engine/priorities.ts
    - lib/engine/priorities.test.ts
  modified: []

key-decisions:
  - "Arrival check is strict transportDays < cover days; shelf-life check is daysToExpiry > transportDays"
  - "Sendable surplus computed inside moves.ts as stock minus 7x dailyDemand (never a caller-supplied surplus), so the D-09 buffer is enforced, not trusted"
  - "Priority weights 60/25/15 with -10 substitute penalty sum to exactly 100; soonness decays linearly to zero at 30d cover, load saturates at 1000 patients/day"
  - "TDD run with one feat commit per task per dispatch instruction (RED observed pre-commit, not as separate test() commits)"

patterns-established:
  - "Precomputed-input modules: moves/priorities take risk numbers as plain inputs and never import sibling engine modules — tests may derive fixtures via forecast/wasteRisk/stockoutRisk, source never does"

requirements-completed: [MOVE-01, MOVE-02, PRIOR-01, PRIOR-02]

coverage:
  - id: D1
    description: "Transfers pass all 5 feasibility checks with split shipments covering the exact need (MOVE-01, D-10)"
    requirement: "MOVE-01"
    verification:
      - kind: unit
        ref: "lib/engine/moves.test.ts#covers the receiver need with split shipments / rejects transfers arriving after stockout or with insufficient shelf life"
        status: pass
    human_judgment: false
  - id: D2
    description: "Waste-first-nearest sender ordering, 7-day sender buffers, exact-need quantities (D-09, D-11, D-12)"
    requirement: "MOVE-01"
    verification:
      - kind: unit
        ref: "lib/engine/moves.test.ts#orders senders waste-first then nearest / excludes or caps a sender / never sends beyond the receiver need"
        status: pass
    human_judgment: false
  - id: D3
    description: "Uncovered remainder becomes one exact emergency supplier order (MOVE-02, D-12)"
    requirement: "MOVE-02"
    verification:
      - kind: unit
        ref: "lib/engine/moves.test.ts#orders exactly the uncovered remainder when need exceeds total sendable surplus"
        status: pass
    human_judgment: false
  - id: D4
    description: "Competing hospitals globally ranked by soonness-first 0-100 scores with breakdowns and one-sentence reasons (PRIOR-01/02, D-13..D-16)"
    requirement: "PRIOR-01"
    verification:
      - kind: unit
        ref: "lib/engine/priorities.test.ts#returns scores 0-100 sorted descending globally / soonness dominates / emergency share outranks load / breakdown plus sentence"
        status: pass
    human_judgment: false
  - id: D5
    description: "Bad input to either function throws typed EngineInputError"
    verification:
      - kind: unit
        ref: "lib/engine/moves.test.ts#throws EngineInputError on bad input + lib/engine/priorities.test.ts#scores are deterministic and bad input throws"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-10-08
status: complete
---

# Phase 02 Plan 03: Transfer Suggestions + Priority Ranking Summary

**5-check transfer suggestions with split shipments and exact remainder orders, plus soonness-first 0-100 global priority ranking with quotable justifications — 12 new vitest tests, 51/51 green**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-08T10:53:00Z
- **Completed:** 2026-10-08T10:55:13Z
- **Tasks:** 2
- **Files modified:** 4 created, 0 modified

## Accomplishments

- `suggestMoves()` enforces all 5 MOVE-01 checks per transfer (arrival before stockout, shelf life on arrival, 7-day sender buffer, nothing beyond need, waste-first-nearest order), splits shipments across senders (D-10), and emits one exact-remainder emergency order (MOVE-02)
- Seed proof: both multi-sender seed senders combine to cover a 500u need exactly, sender-b (more waste) ships first per D-11; the true seed-derived ~2d receiver cover correctly rejects the 3-day sender while keeping the 1-day sender
- `rankPriorities()` scores every hospital/medicine 0-100 integer with 60/25/15 soonness-first weights and a -10 substitute penalty, sorts one global worst-first list (D-15), and attaches a factor breakdown plus one sentence quoting stockout days and emergency share (D-16)
- Weight order proven: sooner stockout beats 12x patient load; emergency share beats load on tied soonness; substitute lowers the score
- Typed `EngineInputError` on negative/NaN/missing inputs in both modules; deterministic output, input never mutated

## Task Commits

Each task was committed atomically:

1. **Task 1: Transfer suggestions plus emergency remainder orders** - `07c6815` (feat)
2. **Task 2: Global priority ranking with justifications** - `37da631` (feat)

## Files Created/Modified

- `lib/engine/moves.ts` - `suggestMoves()` with SENDER_BUFFER_DAYS=7, 1-decimal exact math
- `lib/engine/moves.test.ts` - 7 tests against the multi-sender seed plus inline edge fixtures
- `lib/engine/priorities.ts` - `rankPriorities()` with PrioritySignal/Priority/PriorityFactors shapes
- `lib/engine/priorities.test.ts` - 5 tests with inline competing-signal fixtures

## Decisions Made

- Arrival check is strict `transportDays < receiverDaysUntilStockout` (arriving exactly as stock runs out is too late); shelf-life check is `daysToExpiry > transportDays` (stock must survive the trip with cover to spare).
- Sendable surplus is computed inside moves.ts as `stock - 7 × dailyDemand`, never accepted as a caller-supplied number — the D-09 buffer is enforced by the engine, not trusted from upstream.
- Priority weights 60/25/15 with a -10 substitute penalty sum to exactly 100 so the full band is reachable; soonness decays linearly to zero at 30d cover, load saturates monotonically at 1000 patients/day.
- TDD executed as RED (test written, suite fails on missing module) → GREEN (implementation, suite passes) with a single `feat(02-03)` commit per task per the dispatch instruction's commit-scope format.
- Split-shipment test fixes receiver cover at 6d so both seed transports qualify (isolating split/ordering); the true seed-derived cover (~2d) is used in the feasibility test where the 3-day sender must be rejected.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Seed probing confirmed the fixture shapes numerically before writing tests (receiver ~2d cover vs 3d/1d transports; sender-b waste > sender-a waste), which is why the split test uses an explicit 6d cover while the feasibility test uses the true derived cover.

## Threat Flags

None — no security-relevant surface beyond the plan's threat model. Threat T-02-01 (tampering via inputs) is mitigated: both modules guard-clause with `EngineInputError` on negative/NaN/missing inputs and empty sender pools; exact-need math with no rounding or margin keeps outputs auditable; no I/O, no secrets, no network.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 engine complete (all 3 plans): forecast, outbreak, stockout, waste, moves, priorities — every number is quotable for Phase 3 ResultsJSON APIs and the quote-only chatbot.
- Plan 01/02 files untouched (`forecast.ts`, `stockout.ts`, `outbreak.ts`, `waste.ts`, `seeds.ts`, `types.ts`, `errors.ts` unmodified); no P2-owned files created (`lib/contracts.ts` still absent, types shim still the contract).

## Self-Check: PASSED

- SUMMARY.md, moves.ts, priorities.ts exist on disk.
- Task commits `07c6815`, `37da631` exist in history.
- Zero stub markers (TODO/FIXME/placeholder) in new source files.
- Plan verification re-run: `npx vitest run` → 6 files, 51 tests, all pass; `npx tsc --noEmit` clean; plan-01/02 files and P2 paths untouched.
