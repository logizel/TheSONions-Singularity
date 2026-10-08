---
phase: 02-forecast-decision-engine
verified: 2026-10-08T17:10:00Z
status: passed
score: 13/13 must-haves verified
covered_files:
  - .planning/phases/02-forecast-decision-engine/02-01-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-02-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-03-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-04-PLAN.md
  - .planning/phases/02-forecast-decision-engine/02-01-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-02-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-03-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-04-SUMMARY.md
  - .planning/phases/02-forecast-decision-engine/02-CONTEXT.md
  - lib/engine/types.ts
  - lib/engine/errors.ts
  - lib/engine/seeds.ts
  - lib/engine/forecast.ts
  - lib/engine/stockout.ts
  - lib/engine/outbreak.ts
  - lib/engine/waste.ts
  - lib/engine/moves.ts
  - lib/engine/priorities.ts
covered_digest: "v2:sha256:40db7b7b8b9f8e4307a80b14c75a7bc6af3da722ae9967cc0dd8a624e3012374"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/13
  gaps_closed:
    - "Waste units equal stock minus forecast demand to expiry capped at 90 days, warning per hospital/medicine with expiring-unused quantities (BL-01)"
    - "Senders always keep 7 days of cover after sending and never send beyond the receiver's exact need (MJ-02)"
    - "Tied priority scores break by soonness before hospital/medicine identity (MJ-01)"
  gaps_remaining: []
  regressions: []
---

# Phase 02: Forecast & Decision Engine Verification Report

**Phase Goal:** The system turns history and stock into forecasts, outbreak flags, stock-out and waste warnings, transfer suggestions, and ranked priorities.
**Verified:** 2026-10-08T17:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 02-04, commits d552988, 09425a5, ba422bb)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A 60-day daily demand history produces a 30-day daily forecast array with days 15-30 flagged advisory | ✓ VERIFIED | `forecast.ts:39-53`: weekday-average baseline, `advisory: i+1 >= 15`; shape + flags asserted in `forecast.test.ts`; 56/56 green |
| 2 | MAPE on the deterministic normal seed sits in the 3-11% band | ✓ VERIFIED | `mape()` ignores zero-demand days; band asserted in `forecast.test.ts` (~7.3%); suite green |
| 3 | Stock plus forecast depletes day-by-day into days-until-stockout, warning when cover is shorter than supplier lead time | ✓ VERIFIED | `stockout.ts` depletion loop + `warns: days < leadTimeDays`; boundary asserted incl. end-to-end `history -> forecast() -> stockoutRisk()` |
| 4 | Zero forecast demand reports capped 90+ days cover, never Infinity or null | ✓ VERIFIED | `stockout.ts` returns 90-day cap; asserted in test |
| 5 | Bad input to forecast/stockout throws typed EngineInputError | ✓ VERIFIED | Guard-clauses in `forecast.ts`, `stockout.ts`; throw tests green |
| 6 | A hospital/medicine with demand above +2sigma for 2 consecutive days is flagged as an outbreak and the flag clears after 2 days back inside the band | ✓ VERIFIED | `outbreak.ts`: full-60d baseline, 2-day enter, 2-day exit; enter day 58 on outbreak seed, no false positive on normal seed — all asserted |
| 7 | Flagged series switch to a last-7-day-average trend forecast until demand normalizes | ✓ VERIFIED | `trendForecast()`: flat last-7d average, 1-decimal, advisory days 15-30; asserted in test |
| 8 | Waste units equal stock minus forecast demand to expiry capped at 90 days, warning per hospital/medicine with expiring-unused quantities | ✓ VERIFIED | `waste.ts:66`: `wasteUnits = max(0, round1(stock - demand))`, warns on rounded value. Runtime repro: `wasteRisk(21, 30x0.7, 30)` → `{0, warns:false}`; `wasteRisk(1119, 30x37.3, 30)` → `{0, warns:false}` clean 1-decimal. Regression suite `waste.test.ts:58` green |
| 9 | Bad input to outbreak/waste functions throws typed EngineInputError | ✓ VERIFIED | Guards in `outbreak.ts`, `waste.ts:36-55`; throw tests green |
| 10 | Short hospitals receive transfers that pass all 5 feasibility checks, with split shipments combining multiple senders and sender order waste-first then nearest | ✓ VERIFIED | `moves.ts:134-143` (arrival `<`, shelf-life `>`, waste-first + nearest sort), split loop; multi-sender seed tests assert split + ordering + feasibility rejection; no sibling cross-imports |
| 11 | Any need transfers cannot cover becomes an exact emergency supplier order for the remainder | ✓ VERIFIED | `moves.ts`: one order for exactly `remaining`; asserted in `moves.test.ts` |
| 12 | Senders always keep 7 days of cover after sending and never send beyond the receiver's exact need | ✓ VERIFIED | `validateRequest` seen-set rejects duplicate sender IDs and sender-equals-receiver (`moves.ts:91-100`), closing the D-09 bypass. Runtime repro: duplicate H-S entries (stock 100, dailyDemand 10, need 60) → EngineInputError; self-send H-R→H-R → EngineInputError. Regression test `moves.test.ts:293` green |
| 13 | Competing hospitals are globally ranked by 0-100 scores with soonness dominating, each with a factor breakdown and one human sentence; tied scores break by soonness before identity | ✓ VERIFIED | `priorities.ts:130-136`: comparator `score ↓, soonness ↓, hospitalId, medicine`. Runtime repro: tied 50/50 ranks H-Zed (0d) before H-Alp (20d). Regression test `priorities.test.ts:145` green |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Gap-Closure Confirmation (plan 02-04 must-haves)

| Gap plan truth | Status | Evidence |
|---|---|---|
| Waste units … warning per hospital/medicine with expiring-unused quantities | ✓ VERIFIED | `waste.ts:23,66` round1 helper; repro `{0,false}` on both verifier cases; `waste.test.ts` 10/10 |
| Senders always keep 7 days of cover … never send beyond exact need | ✓ VERIFIED | `moves.ts:91-100` identity guards; both repro throws; `moves.test.ts` 8/8 |
| Tied priority scores break by soonness before identity | ✓ VERIFIED | `priorities.ts:133` soonness term; H-Zed > H-Alp repro; `priorities.test.ts` 6/6 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` / `tsconfig.json` / `vitest.config.ts` | harness | ✓ VERIFIED | Exists; `npx vitest run` → 6 files, 56 tests pass; `npx tsc --noEmit` clean |
| `lib/engine/types.ts` | DemandHistory/ForecastDay shim + window constants | ✓ VERIFIED | Substantive; imported by all engine modules |
| `lib/engine/errors.ts` | EngineInputError | ✓ VERIFIED | Imported by all 6 modules |
| `lib/engine/seeds.ts` | 4 deterministic D-22 scenarios | ✓ VERIFIED | No `Math.random`/`Date.now` (only a comment mention); 60-point smoke tests green |
| `lib/engine/forecast.ts` | forecast()+mape()+networkMean() | ✓ VERIFIED | Wired into stockout/waste tests |
| `lib/engine/stockout.ts` | stockoutRisk() | ✓ VERIFIED | Wired end-to-end in `stockout.test.ts` |
| `lib/engine/outbreak.ts` | detectOutbreak()+trendForecast() | ✓ VERIFIED | Exercises outbreak + normal seeds |
| `lib/engine/waste.ts` | wasteRisk() with round1 + rounded warns | ✓ VERIFIED | Fix confirmed at runtime; 10/10 tests |
| `lib/engine/moves.ts` | suggestMoves() with identity guards | ✓ VERIFIED | Fix confirmed at runtime; 8/8 tests |
| `lib/engine/priorities.ts` | rankPriorities() with soonness tiebreak | ✓ VERIFIED | Fix confirmed at runtime; 6/6 tests |
| All 6 `*.test.ts` | seeded suites + 5 gap-regression tests | ✓ VERIFIED | 56/56 pass, run in this verification session |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `forecast.test.ts` | `forecast.ts` + `seeds.ts` | imports forecast()/mape() + scenarios | WIRED | All 6 test files import their module under test |
| `stockout.test.ts` | `forecast.ts` output | `forecast(seeds.normal.history)` → `stockoutRisk()` | WIRED | History-to-warning slice |
| `waste.test.ts` | `forecast.ts` output + waste seed | `forecast(seeds.waste.history)` | WIRED | No reimplemented forecast math; BL-01 regression asserts exact-zero boundary + 1-decimal output |
| `outbreak.test.ts` | outbreak + normal seeds | enter/exit/no-false-positive cases | WIRED | Per plan key link |
| `moves.test.ts` | multi-sender seed | split shipments + exact remainder | WIRED | MJ-02 regression asserts EngineInputError on duplicate/self-send |
| `priorities.test.ts` | inline fixtures | global sort + justification shape | WIRED | MJ-01 regression asserts soonness ordering on tied 50/50 |
| `moves.ts` / `priorities.ts` | sibling modules | precomputed inputs, no cross-imports | WIRED (by absence) | Parallel-safe as planned |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `forecast.ts` | `out[]` values | weekday means of the 60-point history | Yes — MAPE ~7.3% proves non-trivial | ✓ FLOWING |
| `stockout.ts` | `daysUntilStockout` | day-by-day depletion of stock vs forecast | Yes | ✓ FLOWING |
| `outbreak.ts` | `flagged` / trend array | mean+2σ over history / last-7d average | Yes | ✓ FLOWING |
| `waste.ts` | `wasteUnits` | `round1(stock - demand(min(expiry,90)))` | Yes — 1-decimal quotable | ✓ FLOWING |
| `moves.ts` | `transfers` / `orders` | sendable-surplus math over precomputed inputs | Yes | ✓ FLOWING |
| `priorities.ts` | `score` / `reason` | 60/25/15 weights over precomputed signals | Yes | ✓ FLOWING |

No hollow props, no static fallbacks, no mock data sources.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green | `npx vitest run` | 6 files, 56 passed | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | clean | ✓ PASS |
| BL-01a repro | `wasteRisk(21, 30x0.7, 30)` | `{wasteUnits:0, warns:false}` | ✓ PASS |
| BL-01b repro | `wasteRisk(1119, 30x37.3, 30)` | `{wasteUnits:0, warns:false}` clean 1-decimal | ✓ PASS |
| MJ-02a repro | duplicate H-S senders vs need 60 | EngineInputError thrown | ✓ PASS |
| MJ-02b repro | self-send H-R→H-R | EngineInputError thrown | ✓ PASS |
| MJ-01 repro | tied 50/50 (H-Zed 0d vs H-Alp 20d) | H-Zed:50 > H-Alp:50 (soonness first) | ✓ PASS |
| Determinism | grep `Math.random\|Date.now` in `lib/engine/` | only a comment mention in seeds.ts | ✓ PASS |
| Stub markers | grep TODO/FIXME/XXX/placeholder/console.log | none in `lib/engine/*.ts` | ✓ PASS |

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
| WASTE-01 | 02-02 + 02-04 | Waste units = stock − demand-to-expiry ≤90d | ✓ SATISFIED | BL-01 fix: rounded quotable quantities |
| WASTE-02 | 02-02 + 02-04 | Warn per hospital/medicine with quantities | ✓ SATISFIED | warns decided on rounded value; exact-zero → no warn |
| MOVE-01 | 02-03 + 02-04 | 5-check transfers, waste-first-nearest, split | ✓ SATISFIED | MJ-02 fix: identity guards close D-09 bypass |
| MOVE-02 | 02-03 | Exact emergency order for remainder | ✓ SATISFIED | Remainder-order test |
| PRIOR-01 | 02-03 | Score by load/emergency/soonness/substitute | ✓ SATISFIED | 60/25/15 weights, order asserted |
| PRIOR-02 | 02-03 + 02-04 | Visible ranking with reasons | ✓ SATISFIED | MJ-01 fix: soonness tiebreak per docstring + D-13 |

All 12 Phase 2 requirement IDs accounted for. No orphaned Phase 2 IDs in REQUIREMENTS.md.

### CONTEXT Decisions (D-01..D-22) honored?

All honored: D-01 ✓, D-02 ✓ (waste.ts now rounds the difference — BL-01 closed), D-03 ✓, D-04 ✓, D-05 ✓, D-06 ✓, D-07 ✓, D-08 ✓, D-09 ✓ (buffer unbypassable — MJ-02 closed), D-10 ✓, D-11 ✓, D-12 ✓, D-13 ✓ (tiebreak implemented — MJ-01 closed), D-14 ✓, D-15 ✓, D-16 ✓, D-17 ✓, D-18 ✓, D-19 ✓, D-20 ✓ (identity-uniqueness guards added), D-21 ✓, D-22 ✓.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No blockers, warnings, or stub markers in `lib/engine/` | — | Clean: no TODO/FIXME/XXX/placeholder/console.log; deterministic; 56/56 green |

Prior-verification INFO items (MN-02 fractional days, MN-04 unused RiskSignal, MN-01/MN-03/MN-05/MN-06 minors) remain as non-blocking notes; none falsify a must-have.

### Human Verification Required

None. Pure-function engine with 56 passing unit tests; no UI, real-time behavior, or external integration in scope. All three prior gaps were re-reproduced programmatically and confirmed fixed.

### Gaps Summary

All three prior gaps are closed with runtime proof on branch `gsd/phase-2-forecast-decision-engine`: BL-01 (waste rounds the difference, exact-zero yields `{0, false}`), MJ-02 (duplicate/self-send throw EngineInputError), MJ-01 (tied 50/50 ranks H-Zed before H-Alp). Full suite 56/56 green, typecheck clean. Phase goal achieved — ready to proceed.

---

_Verified: 2026-10-08T17:10:00Z_
_Verifier: the agent (gsd-verifier)_
