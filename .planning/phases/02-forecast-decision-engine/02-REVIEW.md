---
phase: 02-forecast-decision-engine
reviewed: 2026-10-08T19:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - lib/engine/waste.ts
  - lib/engine/waste.test.ts
  - lib/engine/moves.ts
  - lib/engine/moves.test.ts
  - lib/engine/priorities.ts
  - lib/engine/priorities.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 02: Code Review Report (incremental re-review — gap-closure fixes)

**Reviewed:** 2026-10-08T19:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (info only — no BLOCKER or WARNING items; gap-closure accepted)

## Summary

Incremental re-review of the three gap-closure fixes landed since `diff_base`
`5628797` (commits `d552988`, `09425a5`, `ba422bb` plus regression tests).
Scope confirmed via `git diff --name-only`: exactly the six listed files changed
in source; everything else in the diff range is planning docs.

All three prior major findings verify as **fixed** — each fix implements the
prior review's recommended patch verbatim (or better), each carries a pinned
regression test reproducing the original report, and the full engine suite
passes (56/56 across all 6 test files, 24/24 in this scope). No new BLOCKER or
WARNING issues were found in the fix code itself. Two INFO-level observations
below; neither blocks Phase 3 consumption.

## Verified fixed (prior findings)

### BL-01 (BLOCKER) — FIXED: `wasteRisk` now rounds the difference, warns on the quotable number

**File:** `lib/engine/waste.ts:23,64-67`
**Verification:** Fix is the recommended patch verbatim —
`const wasteUnits = Math.max(0, round1(stock - demand))` with
`round1 = (n) => Math.round(n * 10) / 10`, deciding `warns` on the rounded
value. Regression tests pin all three original reproductions
(`waste.test.ts:58-84`): stock 21 vs 30x0.7d, stock 1119 vs 30x37.3d, and the
3500/37.3/45d dust case asserting exactly `1821.5`. Note the tests use `toBe`
(which is `Object.is`-strict), so a `-0` result from negative-side dust would
fail — passing tests prove `Math.max(0, …)` yields `+0`. Full suite green.
No over-rounding: operands stay raw, only the difference rounds, so the
WASTE-02 boundary is decided on the D-02 quotable number as recommended.

### MJ-01 (MAJOR) — FIXED: soonness tiebreak implemented as documented

**File:** `lib/engine/priorities.ts:130-136`
**Verification:** Comparator now reads
`b.score - a.score || b.factors.soonness - a.factors.soonness ||
a.hospitalId.localeCompare(b.hospitalId) || a.medicine.localeCompare(b.medicine)`,
exactly the recommended patch. Regression test (`priorities.test.ts:145-174`)
pins the arithmetic independently: H-Zed (0d, 0%, 0 load, substitute →
60+0+0−10=50) vs H-Alp (20d, 60%, 1000 load, no substitute → 20+15+15+0=50),
both score 50, H-Zed ranks first on soonness (60 vs 20), not alphabetically.
Determinism preserved (identity fallback retained as final tiebreak).

### MJ-02 (MAJOR) — FIXED: self-send and duplicate-sender rejection in `validateRequest`

**File:** `lib/engine/moves.ts:88-100`
**Verification:** `Set`-based guard rejects a sender whose `hospitalId` equals
`receiverHospitalId` and any duplicate sender ID, with indexed messages —
slightly better than the recommended sketch (which omitted the index).
Regression test (`moves.test.ts:293-324`) reproduces the original attack on the
D-09 buffer (stock 100, 10/d → max sendable 30, need 60 across two duplicate
entries) and asserts `EngineInputError`, plus the self-send case. Guard order
is correct (identity checks after the per-entry object/shape checks, so a
`null` entry still fails on shape, never pollutes the set). Intended behavior
change (duplicates now throw instead of silently over-allocating) is the point
of the fix, not a regression.

## Info

### IN-01: Fix adds a fourth `round1` copy — MN-03 persists and grows

**File:** `lib/engine/waste.ts:23`
**Issue:** The BL-01 fix introduces yet another local `round1`
(`forecast.ts`, `outbreak.ts`, `moves.ts`, now `waste.ts`, plus the inline
variant in `priorities.ts:95`). The fix correctly follows the established local
pattern, so this is not a defect in the fix — but the next validation change
(e.g. the MN-02 integer rule) must now land in five places, and drift stays
silent because each module's tests exercise only their own copy.
**Fix:** Export one `round1` (and `validateHistory`) from `types.ts` or a
small `lib/engine/math.ts` and reuse — as already recommended under MN-03.
No action required before Phase 3; cheapest when the next engine touch happens.

### IN-02: True waste in (0, 0.05) rounds to zero with no warning — accepted D-02 consequence

**File:** `lib/engine/waste.ts:66`
**Issue:** `round1` maps any real waste below 0.05 to `0`, so `warns` is
`false` despite non-zero true waste (e.g. stock 100.04 vs demand 100 → 0, no
warn). This is internally consistent (`warns` derives from the rounded,
quotable value, satisfying WASTE-02 literally) and contract-compliant under
D-02 1-decimal engine math — it is the waste-side parity of the already-accepted
MN-01 (moves-side sub-granularity rounding). Proved by arithmetic inspection
(`Math.round(0.4)/10 === 0`); not covered by a test, and none is demanded.
**Fix:** None required. If Phase 3 wants zero silent-drops, document that
sub-0.05 waste rounds to zero (same note as MN-01) or reject sub-granularity
inputs at validation — do both sides together or neither.

## Still-open prior minors (unchanged by this scope, carried over)

These were out of the gap-closure scope and the diff confirms none of the
touched lines address them; restated for continuity, not re-argued:

| ID | Severity | Location | State |
|----|----------|----------|-------|
| MN-01 | MINOR | `moves.ts:146,167` — sub-0.05 `needUnits` vanishes silently | Open, unchanged |
| MN-02 | MINOR | `moves.ts:101-110`, `priorities.ts:74-77`, `waste.ts:53,57` — "whole days" accept fractions, inconsistent handling | Open, unchanged |
| MN-03 | MINOR | `round1`/`validateHistory` duplication | Open, extended by one copy (see IN-01) |
| MN-04 | MINOR | `types.ts` unused `RiskSignal` shim | Open, out of this scope (not re-verified) |
| MN-05 | MINOR | `forecast.ts` `networkMean` accepts negatives | Open, out of this scope (not re-verified) |
| MN-06 | MINOR | `moves.ts:137-138` strict `<` / `>` feasibility boundaries unpinned by tests | Open, unchanged |

## Explicitly checked, no finding

- **Security:** fix code adds no attack surface — pure functions, no I/O, no
  secrets, no `eval`, no deserialization. New error messages interpolate only
  hospital IDs into `EngineInputError` text (same as all existing guards;
  downstream XSS-escaping concern unchanged, not flaggable here).
- **Fix-code edge cases traced:** `windowDays = 0` → empty slice → demand 0 →
  whole stock is waste (correct: expires now); negative-side dust → `+0` via
  `Math.max` (proved by `Object.is`-strict `toBe(0)` passing); duplicate guard
  cannot be bypassed by `null` entries (shape check precedes set insert);
  soonness tiebreak on `round1`'d factors stays fully deterministic via the
  retained identity fallback.
- **Test quality:** waste expectation recomputed independently from
  `forecast()` output (valid: waste-seed expiry ≈45d ≥ 30d, matching the
  formula's assumption); moves duplicate test uses distinct objects with equal
  IDs (true duplicate, not aliasing); priorities test pins exact score-50/50
  arithmetic by hand. No tautological assertions, no weakened thresholds —
  the previously-pinned `toBeCloseTo` dust values were correctly *replaced*,
  not loosened.
- **No regressions:** full `lib/engine/` suite 56/56 green, including the
  `moves.test.ts` seed tests that consume `wasteRisk()` output (the rounding
  change propagates safely through waste-first ordering).

---

_Reviewed: 2026-10-08T19:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
