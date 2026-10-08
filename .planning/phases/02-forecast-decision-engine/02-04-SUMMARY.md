---
phase: 02-forecast-decision-engine
plan: "04"
subsystem: engine
tags: [typescript, vitest, forecast-engine, gap-closure]

# Dependency graph
requires:
  - phase: 02-forecast-decision-engine (plans 02-01/02-02/02-03)
    provides: [forecast/stockout/outbreak/waste/moves/priorities modules plus 51-test suite that this plan fixes]
provides:
  - 1-decimal quotable wasteRisk with exact-zero boundary honoring WASTE-02
  - validateRequest sender-identity guards closing the D-09 buffer bypass
  - soonness-first tiebreak in rankPriorities per docstring and D-13
  - 5 regression tests reproducing the verifier's exact reproductions (56/56 green)
affects: [phase-3-api-chat-access, phase-5-integration]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 2111
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [module-local round1 1-decimal helper shared by forecast/outbreak/moves/waste, seen-set identity validation in validateRequest, factor-descending comparator tiebreak]

key-files:
  created: []
  modified: [lib/engine/waste.ts, lib/engine/waste.test.ts, lib/engine/moves.ts, lib/engine/moves.test.ts, lib/engine/priorities.ts, lib/engine/priorities.test.ts]

key-decisions:
  - "Round the waste difference (not the operands) so the WASTE-02 warn boundary is decided on the quotable number"
  - "Reject (not merge) duplicate sender IDs and self-send with typed EngineInputError per D-20"
  - "Implement the docstring-promised soonness tiebreak rather than correcting the docstring, per D-13 soonness-first"

patterns-established:
  - "Boundary assertions pin rounded engine outputs: expect round1(expected), never raw-float toBeCloseTo at high precision"

requirements-completed: [WASTE-01, WASTE-02, MOVE-01, PRIOR-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Quotable 1-decimal waste with no false warn on exact zero (BL-01)"
    requirement: "WASTE-02"
    verification:
      - kind: unit
        ref: "lib/engine/waste.test.ts#BL-01 regression: 1-decimal quotable waste, exact-zero boundary"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duplicate sender IDs and self-send throw EngineInputError (MJ-02)"
    requirement: "MOVE-01"
    verification:
      - kind: unit
        ref: "lib/engine/moves.test.ts#rejects duplicate sender IDs and self-send with EngineInputError"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tied priority scores order by soonness before identity (MJ-01)"
    requirement: "PRIOR-02"
    verification:
      - kind: unit
        ref: "lib/engine/priorities.test.ts#breaks tied scores by soonness before hospital/medicine identity"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-10-08
status: complete
---

# Phase 02 Plan 04: Gap Closure Summary

**Closed all 3 verified engine gaps (BL-01 waste exactness, MJ-02 sender buffer bypass, MJ-01 priority tiebreak) with localized fixes plus one regression test each — 56/56 suite green, typecheck clean.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-08T11:21:10Z
- **Completed:** 2026-10-08T11:23:35Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- BL-01 closed: `wasteRisk` rounds the stock-minus-demand difference to 1 decimal per D-02 and decides `warns` on the rounded value — exact-zero yields `{0, false}`, dust case `1119/37.3` yields clean `0`, nonzero dust yields quotable `1821.5`
- MJ-02 closed: `validateRequest` rejects self-send and duplicate sender IDs with typed `EngineInputError` — the D-09 7-day buffer can no longer be bypassed via duplicated entries (T-02-04 mitigated)
- MJ-01 closed: `rankPriorities` comparator inserts the soonness-factor descending term between score and identity terms — tied 50/50 ranks stockout-now H-Zed above 20d-cover H-Alp per docstring and D-13
- Plan-level verification: `npx vitest run` 6 files / 56 tests pass (51 existing + 5 new), `npx tsc --noEmit` clean, only the 6 plan-listed files touched, `lib/contracts.ts` nonexistent (Phase 1 pending) and untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix BL-01: round waste difference and decide warns on rounded value** - `d552988` (fix)
2. **Task 2: Fix MJ-02: reject self-send and duplicate sender IDs in validateRequest** - `09425a5` (fix)
3. **Task 3: Fix MJ-01: add soonness tiebreak to priority comparator plus tied-scores test** - `ba422bb` (fix)

## Files Created/Modified

- `lib/engine/waste.ts` - Module-local `round1` helper; `wasteUnits = max(0, round1(stock - demand))`, warns decided on rounded value
- `lib/engine/waste.test.ts` - New BL-01 regression describe (3 tests: 0.7x30/stock-21 boundary, 1119/37.3 dust case, 1821.5 nonzero dust); seed expectation pinned to 1-decimal precision (see deviation)
- `lib/engine/moves.ts` - `validateRequest` seen-set rejects duplicate sender IDs and sender-equals-receiver via existing `fail` helper
- `lib/engine/moves.test.ts` - New MJ-02 regression test (duplicated H-S vs need 60 throws; self-send throws)
- `lib/engine/priorities.ts` - Comparator gains `b.factors.soonness - a.factors.soonness` term between score and identity terms
- `lib/engine/priorities.test.ts` - New MJ-01 regression test with pinned tied-50/50 fixtures (H-Zed vs H-Alp)

## Decisions Made

- Round the waste difference, not the operands, so the WASTE-02 warn boundary is decided on the quotable number (per 02-REVIEW.md BL-01 fix, D-02)
- Reject (not merge) duplicate sender IDs — merging would silently reinterpret caller intent; D-20 demands typed errors on untrusted input (T-02-04)
- Implement the docstring-promised soonness tiebreak rather than correcting the docstring — D-13 soonness-first is a locked user decision (T-02-05 threat on output precision likewise mitigated via the BL-01 rounding)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing waste-seed test pinned the unrounded dust value**
- **Found during:** Task 1 (Fix BL-01)
- **Issue:** `waste.test.ts` asserted `toBeCloseTo(stock - demand, 8)` — precision-8 closeness to the raw float difference. After correct 1-decimal rounding, the seed's true value sits on a rounding boundary (raw `2994.35…` → quotable `2994.4`, diff `0.05`), so the old assertion failed. The old assertion encoded the buggy behavior and contradicted locked decision D-02.
- **Fix:** Minimal one-expectation update — compare against `Math.round((stock - demand) * 10) / 10` at precision 8. All other existing tests left byte-identical and passing.
- **Files modified:** lib/engine/waste.test.ts
- **Verification:** `npx vitest run lib/engine/waste.test.ts` → 10/10 pass
- **Committed in:** d552988 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale test assertion contradicting a locked decision)
**Impact on plan:** Required for correctness; no scope creep. No other engine files touched, no guard clauses/weights/shapes changed.

## Issues Encountered

None beyond the deviation above. All three REVIEW.md fixes applied cleanly; no existing test (other than the one stale precision assertion) broke.

## Threat Flags

None beyond the plan's threat model — T-02-04 (sender identity validation) and T-02-05 (waste output precision) are both mitigated by the Task 2 and Task 1 fixes respectively. No new network endpoints, auth paths, file access, or schema changes: pure functions only, no I/O.

## Known Stubs

None. All values trace to real computation; no placeholder text, TODOs, or empty fallbacks introduced (grep-confirmed scope is the 6 plan files).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 engine numbers are now quotable and guard-claused: ready for Phase 3 (ResultsJSON + quote-only chat) to consume verbatim
- Recommend re-running `/gsd-verify-work 2` focused on the 3 gaps (BL-01, MJ-02, MJ-01) to flip 02-VERIFICATION.md to fully verified
- No blockers or concerns

---
*Phase: 02-forecast-decision-engine*
*Completed: 2026-10-08*
