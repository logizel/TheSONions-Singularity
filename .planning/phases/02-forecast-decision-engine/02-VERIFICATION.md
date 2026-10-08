---
phase: 02-forecast-decision-engine
verified: 2026-10-08T16:35:00Z
status: gaps_found
score: 11/13 must-haves verified
covered_files:
  - .planning/phases/02-forecast-decision-engine/02-01-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-02-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-03-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-01-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-02-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-03-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-CONTEXT.md
  - .planning/phases/02-forecast-decision-engine/02-REVIEW.md
  - lib/engine/types.ts
  - lib/engine/errors.ts
  - lib/engine/seeds.ts
  - lib/engine/forecast.ts
  - lib/engine/stockout.ts
  - lib/engine/outbreak.ts
  - lib/engine/waste.ts
  - lib/engine/moves.ts
  - lib/engine/priorities.ts
covered_digest: "unavailable-no-fingerprint-verb"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Waste units equal stock minus forecast demand to expiry capped at 90 days, warning per hospital/medicine with expiring-unused quantities"
    status: failed
    reason: "BL-01 confirmed at runtime: wasteRisk() does no round1, so outputs carry float dust (3500-45x37.3 yields 1821.5000000000014, not quotable) and the exact-zero boundary warns falsely (stock == demand yields waste 1e-14 with warns:true, violating WASTE-02 'warns exactly when wasteUnits > 0')"
    artifacts:
      - path: "lib/engine/waste.ts"
        issue: "lines 54-62: raw float Math.max(0, stock - demand) with no round1; warns decided on dust"
    missing:
      - "Round the difference (round1(stock - demand)) and decide warns on the rounded value, per 02-REVIEW.md BL-01 fix"
  - truth: "Senders always keep 7 days of cover after sending and never send beyond the receiver's exact need"
    status: failed
    reason: "MJ-02 confirmed at runtime: validateRequest has no self-send or duplicate-sender guard. Two entries for H-S (stock 100, dailyDemand 10, max sendable 30) shipped 60 total, leaving 40 of the required 70 buffer — D-09 silently defeated. Self-send (H-R sending to H-R) also accepted."
    artifacts:
      - path: "lib/engine/moves.ts"
        issue: "validateRequest lines 73-104: no hospitalId-equals-receiver and no duplicate-sender rejection"
    missing:
      - "Reject sender hospitalId equal to receiverHospitalId and duplicate sender IDs in validateRequest, per 02-REVIEW.md MJ-02 fix"
  - truth: "Tied priority scores break by soonness before hospital/medicine identity (module docstring contract, D-13 soonness-first)"
    status: failed
    reason: "MJ-01 confirmed at runtime: two signals both scoring 50 (H-Zed stockout now vs H-Alp stockout in 20d) sort H-Alp first — alphabetical, not soonness. Docstring promises 'ties break by soonness, then hospital/medicine identity' but the comparator has no soonness term and no test covers tied scores."
    artifacts:
      - path: "lib/engine/priorities.ts"
        issue: "lines 130-135: sort comparator lacks the b.factors.soonness - a.factors.soonness term"
    missing:
      - "Add the soonness tiebreak term (or correct the docstring) plus one tied-scores test, per 02-REVIEW.md MJ-01 fix"
---

# Phase 02: Forecast & Decision Engine Verification Report

**Phase Goal:** The system turns history and stock into forecasts, outbreak flags, stock-out and waste warnings, transfer suggestions, and ranked priorities.
**Verified:** 2026-10-08T16:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A 60-day daily demand history produces a 30-day daily forecast array with days 15-30 flagged advisory | ✓ VERIFIED | `forecast.ts:39-53`: weekday-average baseline, `advisory: i+1 >= ADVISORY_FROM_DAY (15)`; `forecast.test.ts` asserts shape + flags; suite green |
| 2 | MAPE on the deterministic normal seed sits in the 3-11% band | ✓ VERIFIED | `mape()` ignores zero-demand days (`forecast.ts:79`); band asserted in `forecast.test.ts`; 51/51 green |
| 3 | Stock plus forecast depletes day-by-day into days-until-stockout, warning when cover is shorter than supplier lead time | ✓ VERIFIED | `stockout.ts:56-67` depletion loop + `warns: days < leadTimeDays`; boundary asserted in `stockout.test.ts` (incl. end-to-end `history -> forecast() -> stockoutRisk()` at `stockout.test.ts:21-22`) |
| 4 | Zero forecast demand reports capped 90+ days cover, never Infinity or null | ✓ VERIFIED | `stockout.ts:51-54` returns `ZERO_DEMAND_COVER_DAYS (90)`; asserted in test |
| 5 | Bad input to forecast/stockout (negative stock, wrong history length, gaps) throws typed EngineInputError | ✓ VERIFIED | Guard-clauses in `forecast.ts:14-29`, `stockout.ts:30-49`; throw tests green |
| 6 | A hospital/medicine with demand above +2sigma for 2 consecutive days is flagged as an outbreak and the flag clears after 2 days back inside the band | ✓ VERIFIED | `outbreak.ts:45-80`: full-60d baseline (D-05), 2-day enter, 2-day exit state machine; enter day 58 on outbreak seed, no false positive on normal seed, single-spike insufficient — all asserted in `outbreak.test.ts` |
| 7 | Flagged series switch to a last-7-day-average trend forecast until demand normalizes | ✓ VERIFIED | `trendForecast()` (`outbreak.ts:88-96`): flat last-7d average, 1-decimal, advisory days 15-30; asserted in test |
| 8 | Waste units equal stock minus forecast demand to expiry capped at 90 days, warning per hospital/medicine with expiring-unused quantities | ✗ FAILED | Formula correct (`waste.ts:54-62`, 90d cap, `waste.test.ts` consumes `forecast()` output per `waste.test.ts:18`) BUT BL-01 reproduced: `wasteRisk(1119, 30x37.3, 30)` → `{wasteUnits: 6.82e-13, warns: true}`; `wasteRisk(21, 30x0.7, 30)` → `{wasteUnits: 1.07e-14, warns: true}` — false warning on exact-zero, non-quotable dust on every output (D-02 violation) |
| 9 | Bad input to outbreak/waste functions throws typed EngineInputError | ✓ VERIFIED | Guards in `outbreak.ts:21-36`, `waste.ts:33-52`; throw tests green |
| 10 | Short hospitals receive transfers that pass all 5 feasibility checks, with split shipments combining multiple senders and sender order waste-first then nearest | ✓ VERIFIED | `moves.ts:126-135` (arrival `<`, shelf-life `>`, waste-first + nearest sort), split loop `139-155`; multi-sender seed tests assert split + ordering + feasibility rejection; no sibling cross-imports (parallel-safe as planned) |
| 11 | Any need transfers cannot cover becomes an exact emergency supplier order for the remainder | ✓ VERIFIED | `moves.ts:157-168`: one order for exactly `remaining`; asserted in `moves.test.ts` |
| 12 | Senders always keep 7 days of cover after sending and never send beyond the receiver's exact need | ✗ FAILED | `sendable = stock - 7 x dailyDemand` (`moves.ts:142`) holds for distinct senders, BUT MJ-02 reproduced: duplicate H-S entries (stock 100, dailyDemand 10) shipped 60 total vs D-09 max 30, leaving 40 of the required 70 buffer; self-send H-R→H-R also accepted. "Always" is falsified |
| 13 | Competing hospitals are globally ranked by 0-100 scores with soonness dominating, each with a factor breakdown and one human sentence | ✓ VERIFIED | `priorities.ts:102-137`: 60/25/15 soonness-first weights, global descending sort, `{soonness, emergencyShare, patientLoad, substitute}` breakdown + sentence quoting stockout days and emergency share; weight-order asserted (`priorities.test.ts`, 5 tests). Tie behavior excluded — see gap 3 (MJ-01) |

**Score:** 11/13 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` / `tsconfig.json` / `vitest.config.ts` | harness | ✓ VERIFIED | Exists; `npx vitest run` → 6 files, 51 tests pass; `npx tsc --noEmit` clean |
| `lib/engine/types.ts` | DemandHistory/ForecastDay shim + window constants | ✓ VERIFIED | Substantive; imported by forecast/outbreak/stockout/waste. Note MN-04: `RiskSignal` exported but consumed by nothing (moves uses `MoveRequest`, priorities uses `PrioritySignal`) — minor, not a gap |
| `lib/engine/errors.ts` | EngineInputError | ✓ VERIFIED | Imported by all 6 modules |
| `lib/engine/seeds.ts` | 4 deterministic D-22 scenarios | ✓ VERIFIED | 154 lines, `seeds` + `allSeedHistories()`; no `Math.random`/`Date.now` (only a comment mention); 60-point smoke tests green |
| `lib/engine/forecast.ts` | forecast()+mape()+networkMean() | ✓ VERIFIED | Wired (imported by 3 test files + stockout/waste tests derive fixtures from it) |
| `lib/engine/stockout.ts` | stockoutRisk() | ✓ VERIFIED | Wired end-to-end in `stockout.test.ts:21-22` |
| `lib/engine/outbreak.ts` | detectOutbreak()+trendForecast() | ✓ VERIFIED | Exercises outbreak + normal seeds per plan key link |
| `lib/engine/waste.ts` | wasteRisk() | ⚠️ PRESENT, BUGGY | Exists, wired, formula right — but BL-01 float bug (see gap 1) |
| `lib/engine/moves.ts` | suggestMoves() | ⚠️ PRESENT, GUARD MISSING | Exists, wired, 5 checks + split + exact orders right — but MJ-02 identity guard missing (see gap 2) |
| `lib/engine/priorities.ts` | rankPriorities() | ⚠️ PRESENT, TIEBREAK MISSING | Exists, wired, weights + global sort + justifications right — but MJ-01 tiebreak missing (see gap 3) |
| All 6 `*.test.ts` | seeded suites | ✓ VERIFIED | 51/51 pass, run in this verification session |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `forecast.test.ts` | `forecast.ts` + `seeds.ts` | imports forecast()/mape() + scenarios | WIRED | All 6 test files import their module under test (grep-confirmed) |
| `stockout.test.ts` | `forecast.ts` output | `forecast(seeds.normal.history)` → `stockoutRisk()` | WIRED | `stockout.test.ts:21-22`, history-to-warning slice |
| `waste.test.ts` | `forecast.ts` output + waste seed | `forecast(seeds.waste.history)` | WIRED | `waste.test.ts:18`, no reimplemented forecast math |
| `outbreak.test.ts` | outbreak + normal seeds | enter/exit/no-false-positive cases | WIRED | Per plan key link |
| `moves.test.ts` | multi-sender seed | split shipments + exact remainder | WIRED | 7 tests green |
| `priorities.test.ts` | inline fixtures | global sort + justification shape | WIRED | 5 tests green |
| `moves.ts` / `priorities.ts` | sibling modules | precomputed inputs, no cross-imports | WIRED (by absence) | `NO_CROSS_IMPORTS_OK` — parallel-safe as planned |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `forecast.ts` | `out[]` values | weekday means of the 60-point history | Yes — real computed means, MAPE ~7.3% proves non-trivial | ✓ FLOWING |
| `stockout.ts` | `daysUntilStockout` | day-by-day depletion of stock vs forecast values | Yes | ✓ FLOWING |
| `outbreak.ts` | `flagged` / trend array | mean+2σ over history / last-7d average | Yes | ✓ FLOWING |
| `waste.ts` | `wasteUnits` | `stock - demand(min(expiry,90))` | Yes, but float dust (BL-01) | ⚠️ STATIC-adjacent (precision, not source) |
| `moves.ts` | `transfers` / `orders` | sendable-surplus math over precomputed inputs | Yes | ✓ FLOWING |
| `priorities.ts` | `score` / `reason` | 60/25/15 weights over precomputed signals | Yes | ✓ FLOWING |

No hollow props, no static fallbacks, no mock data sources. All values trace to real computation over history/stock inputs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npx vitest run` | 6 files, 51 passed | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | clean | ✓ PASS |
| BL-01 repro | `tsx` script: `wasteRisk(1119, 30x37.3, 30)` and `wasteRisk(21, 30x0.7, 30)` | `{6.82e-13, warns:true}`, `{1.07e-14, warns:true}` — false warns, dust | ✗ FAIL (gap 1) |
| MJ-01 repro | `tsx` script: tied 50/50 (H-Zed 0d vs H-Alp 20d) | H-Alp first — alphabetical, not soonness | ✗ FAIL (gap 3) |
| MJ-02 repro | `tsx` script: duplicate H-S senders, need 60 | sent 60 vs D-09 max 30 (keeps 40 of 70 buffer); self-send accepted | ✗ FAIL (gap 2) |
| Determinism | grep `Math.random\|Date.now` in `lib/engine/` | only a comment mention | ✓ PASS |
| Stub markers | grep TODO/FIXME/XXX/placeholder/console.log/return null | none in `lib/engine/*.ts` | ✓ PASS |

### Probe Execution

No probes declared in any PLAN/SUMMARY for this phase. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FCAST-01 | 02-01 | 30-day forecast from 60d weekly pattern | ✓ SATISFIED | forecast() + 14 tests |
| FCAST-02 | 02-01 | MAPE in 3-11% band | ✓ SATISFIED | mape() + band assertion (~7.3%) |
| OUTBK-01 | 02-02 | Flag on +2σ for 2 consecutive days | ✓ SATISFIED | detectOutbreak() enter/exit tests |
| OUTBK-02 | 02-02 | Recent-rising-trend forecast while flagged | ✓ SATISFIED | trendForecast() flat last-7d test |
| RISK-01 | 02-01 | Days-until-stockout per hospital/medicine | ✓ SATISFIED | stockoutRisk() happy-path tests |
| RISK-02 | 02-01 | Warn when cover < lead time | ✓ SATISFIED | Warning-boundary tests |
| WASTE-01 | 02-02 | Waste units = stock − demand-to-expiry ≤90d | ⚠️ SATISFIED WITH BUG | Formula right; BL-01 precision bug on exact-zero boundary |
| WASTE-02 | 02-02 | Warn per hospital/medicine with quantities | ✗ BLOCKED ON BOUNDARY | False `warns:true` when arithmetic waste is exactly zero (BL-01) |
| MOVE-01 | 02-03 | 5-check transfers, waste-first-nearest, split | ⚠️ SATISFIED WITH GUARD GAP | Holds for well-formed sender pools; duplicate/self-send bypasses D-09 (MJ-02) |
| MOVE-02 | 02-03 | Exact emergency order for remainder | ✓ SATISFIED | Remainder-order test |
| PRIOR-01 | 02-03 | Score by load/emergency/soonness/substitute | ✓ SATISFIED | 60/25/15 weights, order asserted |
| PRIOR-02 | 02-03 | Visible ranking with reasons | ✓ SATISFIED | Global sort + breakdown + sentence |

All 12 Phase 2 requirement IDs from the three PLAN frontmatters are accounted for (01: FCAST-01/02, RISK-01/02; 02: OUTBK-01/02, WASTE-01/02; 03: MOVE-01/02, PRIOR-01/02). No orphaned Phase 2 IDs in REQUIREMENTS.md — traceability table marks all 12 Complete.

### CONTEXT Decisions (D-01..D-22) honored?

D-01 ✓, D-02 partial (waste.ts violates 1-decimal discipline — BL-01), D-03 ✓, D-04 ✓, D-05 ✓, D-06 ✓, D-07 ✓, D-08 ✓, D-09 partial (enforced in math, bypassable via duplicate senders — MJ-02), D-10 ✓, D-11 ✓, D-12 ✓, D-13 partial (weights soonness-first, but tiebreak contradicts — MJ-01), D-14 ✓, D-15 ✓, D-16 ✓, D-17 ✓, D-18 ✓, D-19 ✓, D-20 partial (identity-uniqueness guards missing — MJ-02), D-21 ✓, D-22 ✓.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `waste.ts` | 54-62 | float dust + false warns on exact-zero (BL-01) | 🛑 Blocker | Wrong answers to dashboard/quote-only chat; WASTE-02 boundary violated |
| `priorities.ts` | 130-135 | documented soonness tiebreak not implemented (MJ-01) | ⚠️ Warning | Tied urgencies ordered alphabetically; no test covers ties |
| `moves.ts` | 88-103 | no self-send/duplicate-sender guard (MJ-02) | ⚠️ Warning | D-09 buffer silently violable (proven: 60 sent vs 30 max) |
| `moves.ts` / `priorities.ts` / `stockout.ts` / `waste.ts` | various | fractional "whole days" accepted inconsistently (MN-02) | ℹ️ Info | No failing behavior; needs a locked decision, not a fix |
| `types.ts` | 28-36 | unused exported `RiskSignal` contradicting real shapes (MN-04) | ℹ️ Info | Could mislead Phase 3 into programming against the wrong shape; cheap to delete/alias |
| — | — | MN-01 (sub-0.05 need vanishes), MN-03 (duplicated validateHistory/round1), MN-05 (networkMean negatives), MN-06 (unpinned boundary operators) | ℹ️ Info | Review minors; none falsify a must-have; recommend fixing MN-04 + MN-06 with the gaps |

### Human Verification Required

None. Pure-function engine with 51 passing unit tests; no UI, real-time behavior, or external integration in scope. All failures were reproduced programmatically.

### Gaps Summary

Phase 2 delivers a working forecast-to-decision engine — history-to-warning, outbreak, waste, moves, and priorities all compute real, wired, tested numbers (51/51 green, typecheck clean, no stubs). But the phase goal ("turns history and stock into … warnings, transfer suggestions, and ranked priorities") is not fully achieved because the code review's three confirmed findings stand unfixed on the branch (no fix commits after `53caa2b`):

1. **BL-01 (BLOCKER):** `wasteRisk` returns float dust and false-warns on the exact-zero boundary — a genuine wrong-answer bug that Phase 3 (ResultsJSON + quote-only chat) would propagate verbatim. One-line fix (`round1` the difference).
2. **MJ-02 (MAJOR):** `suggestMoves` accepts duplicate/self senders, silently defeating the D-09 7-day buffer (runtime-proven: sender left with 40 of 70 required cover). Small `validateRequest` fix.
3. **MJ-01 (MAJOR):** `rankPriorities` tie ordering contradicts its own docstring and D-13 (runtime-proven: 20d-cover outranks same-score stockout-now alphabetically). One comparator term + one test.

Fixes are small and localized (all three fixes from 02-REVIEW.md apply cleanly; no test currently covers the three behaviors, so no existing test should break). Recommend `/gsd-plan-phase --gaps` for a single small fix plan, then re-verification focused on the 3 gaps.

---

_Verified: 2026-10-08T16:35:00Z_
_Verifier: the agent (gsd-verifier)_
