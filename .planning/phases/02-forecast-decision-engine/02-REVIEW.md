# Phase 02 — Forecast & Decision Engine: Code Review

**Branch:** `gsd/phase-2-forecast-decision-engine`
**Scope:** `lib/engine/` — `forecast.ts`, `stockout.ts`, `outbreak.ts`, `waste.ts`, `moves.ts`, `priorities.ts`, `types.ts`, `errors.ts`, `seeds.ts` (+ tests)
**Context read:** `02-CONTEXT.md` (D-01…D-22)
**Method:** full read of every source + test file, edge-case tracing, runtime proof of float behavior with `node`
**Security:** no attack surface in scope — pure functions, no I/O, no secrets, no `eval`, no deserialization. No security findings.
**Verdict:** advisory, non-blocking — but item BL-01 is a genuine wrong-answer bug and should be fixed before Phase 3 consumes these numbers.

## Findings

### BL-01 (BLOCKER): `wasteRisk` returns float dust and can warn on exact-zero waste

**File:** `lib/engine/waste.ts:54-62`

`wasteUnits` is computed as `stock - demand` over raw float sums with no `round1`, violating the module's own D-02 contract ("1-decimal engine floats"). Two consequences, both reproduced at runtime:

1. **Non-quotable output.** `3500 - sum(45 × 37.3)` yields `1821.5000000000014` instead of `1821.5`. Every downstream consumer (dashboard, quote-only chat) inherits the dust.
2. **Wrong `warns` on the exact-zero boundary.** When stock exactly equals demand in real arithmetic, the float sum can land a hair *below* the true value, producing a tiny positive `wasteUnits` and `warns: true`:
   - daily `0.7` × 30d, stock `21` → demand `20.99999999999999`, waste `1.07e-14`, `warns: true` (should be `false`)
   - daily `2.3` × 30d, stock `69` → waste `4.26e-14`, `warns: true`
   - daily `7.7` × 30d, stock `231` → waste `1.14e-13`, `warns: true`
   - daily `37.3` × 30d, stock `1119` → waste `6.82e-13`, `warns: true`

   (Negative-side dust is masked by `Math.max(0, …)`, so the error is one-sided: false waste warnings, never missed ones — but WASTE-02 says "warns exactly when wasteUnits is greater than zero", and on exact arithmetic it is zero.)

Notably, `moves.ts` and `stockout.ts` already do 1-decimal discipline (`round1`, `EPS`) — `waste.ts` is the odd one out, and its tests pass only because they use `toBeCloseTo`.

**Fix:**
```ts
const round1 = (n: number): number => Math.round(n * 10) / 10;
// …after computing demand:
const wasteUnits = Math.max(0, round1(stock - demand));
return { wasteUnits, warns: wasteUnits > 0 };
```
(Round the difference, not the operands, so the boundary is decided on the quotable number.)

---

### MJ-01 (MAJOR): `rankPriorities` tiebreak documented but not implemented

**File:** `lib/engine/priorities.ts:97-101` (docstring) vs `lib/engine/priorities.ts:130-135` (code)

Docstring: "Deterministic: ties break by soonness, then hospital/medicine identity." Code:
```ts
entries.sort(
  (a, b) =>
    b.score - a.score ||
    a.hospitalId.localeCompare(b.hospitalId) ||
    a.medicine.localeCompare(b.medicine),
);
```
There is no soonness tiebreak — equal scores fall straight through to identity ordering. Two signals with identical scores but very different urgency (e.g. stockout in 2d with a substitute vs stockout in 12d without) are ordered alphabetically rather than by soonness, contradicting the module's own contract and the D-13 soonness-first principle. No test covers tied scores, so this is invisible to the suite.

**Fix:** either implement what the docstring promises —
```ts
b.score - a.score ||
b.factors.soonness - a.factors.soonness ||
a.hospitalId.localeCompare(b.hospitalId) ||
a.medicine.localeCompare(b.medicine),
```
— or correct the docstring if identity ordering is intended.

---

### MJ-02 (MAJOR): `suggestMoves` has no self-send / duplicate-sender guard; D-09 buffer can be silently violated

**File:** `lib/engine/moves.ts:119-155`

Nothing prevents the receiver's own `hospitalId` from appearing in `senders` (a hospital shipping to itself), and nothing prevents the same `hospitalId` from appearing twice. The second case is the dangerous one: `sendable` is computed per-entry from full `stock` (`stock - 7 × dailyDemand`), so two entries for the same hospital each offer up to the full surplus and the combined allocation can exceed `stock - buffer` — defeating the D-09 "sender keeps 7 days of cover" guarantee without any error. Upstream presumably never duplicates today, but the engine's whole design thesis (D-20: "keeps the engine pure and auditable") is that it does not trust its inputs — every other invariant is guard-claused except identity uniqueness.

**Fix:** in `validateRequest`, reject a sender whose `hospitalId` equals `receiverHospitalId` and reject (or merge) duplicate sender IDs:
```ts
const seen = new Set<string>();
for (const s of input.senders) {
  if (s.hospitalId === input.receiverHospitalId)
    fail(`senders[${i}] is the receiver itself (${s.hospitalId})`);
  if (seen.has(s.hospitalId)) fail(`duplicate sender ${s.hospitalId}`);
  seen.add(s.hospitalId);
}
```

---

### MN-01 (MINOR): sub-0.05 `needUnits` vanishes silently — no transfer, no order

**File:** `lib/engine/moves.ts:138, 158-159`

`remaining = round1(input.needUnits)` maps any need below 0.05 to `0`, the allocation loop breaks immediately, and `remaining > 0` is false — so the function returns `{ transfers: [], orders: [] }`. A real (if tiny) need produces neither shipment nor emergency order; the demand signal just disappears. Given D-02 1-decimal math this is arguably "rounds to zero", but dropping it without a trace is worse than either fulfilling or ordering it.

**Fix:** reject `needUnits` below the engine's 0.1 granularity in `validateRequest`, or document that sub-granularity needs round to zero.

---

### MN-02 (MINOR): "whole days" fields accept fractions; fractional handling is inconsistent across modules

**Files:** `lib/engine/moves.ts:93-102`, `lib/engine/priorities.ts:74-77`, `lib/engine/stockout.ts:47-49`, `lib/engine/waste.ts:54`

`MoveSender.transportDays`, `MoveRequest.receiverDaysUntilStockout`, `PrioritySignal.daysUntilStockout`, and `stockoutRisk.leadTimeDays` are all documented as whole days but validated only as `finite, >= 0`. Worse, the modules disagree on what a fraction *means*: `waste.ts` floors `daysToExpiry`, while `moves.ts` compares raw fractions (`transportDays < receiverDaysUntilStockout`) and `priorities.ts` interpolates them into `reason` (`stockout in 2.5d`). A fractional lead time of `9.5` vs integer cover of `9` flips `warns` on dust-thin grounds.

**Fix:** enforce `Number.isInteger` on documented whole-day inputs (with a clear `EngineInputError`), or document fractional acceptance and floor/round at each boundary consistently.

---

### MN-03 (MINOR): duplicated `validateHistory` and `round1` across modules

**Files:** `lib/engine/forecast.ts:11,14-29` vs `lib/engine/outbreak.ts:18,21-36`; `round1` in `forecast.ts:11`, `outbreak.ts:18`, `moves.ts:62`, inline variant `priorities.ts:95`

Two independent copies of the 60-point history guard and three-plus copies of 1-decimal rounding. Any future change to validation (e.g. the integer rule from MN-02) must land in N places; drift here would be silent because each module's tests only exercise its own copy.

**Fix:** export `validateHistory` and `round1` from one place (`types.ts` or a small `lib/engine/math.ts`) and reuse.

---

### MN-04 (MINOR): `RiskSignal` shim is exported but consumed by nothing; pattern doc already drifted

**File:** `lib/engine/types.ts:28-36`

No engine module imports `RiskSignal` — `moves.ts` takes `MoveRequest`/`MoveSender`, `priorities.ts` takes `PrioritySignal`. The shim's stated purpose ("consumed by downstream modules (moves, priorities in plans 02-03)") did not materialize, and `02-PATTERNS.md:206` already shows the drift (`rankPriorities(signals: RiskSignal[])` — the real signature is `PrioritySignal[]`). An unused exported type that contradicts the code invites Phase 3 to program against the wrong shape.

**Fix:** delete `RiskSignal` if `PrioritySignal` won, or re-export/alias so there is exactly one risk-signal shape; fix the `02-PATTERNS.md` signature.

---

### MN-05 (MINOR): `networkMean` accepts negative errors without complaint

**File:** `lib/engine/forecast.ts:87-100`

MAPE-as-fraction can exceed 1 but can never be negative; `networkMean([-0.5, 0.9])` happily returns `0.2`. Every sibling validator rejects negatives (D-20). A sign-flipped upstream value would silently corrupt the network mean instead of throwing at the boundary.

**Fix:** `if (v < 0) throw new EngineInputError(...)` in the loop.

---

### MN-06 (MINOR): feasibility boundary operators need a locked decision

**File:** `lib/engine/moves.ts:126-135`

- Arrival check is strict `<`: a shipment arriving *exactly* on stockout day (`transportDays === receiverDaysUntilStockout`) is rejected — the receiver stocks out the same day the truck arrives.
- Shelf-life check is strict `>`: stock expiring exactly on arrival day (`daysToExpiry === transportDays`) is rejected.

Both choices are defensible (conservative), and the arrival one matches "arrives before the receiver runs out" literally — but neither boundary is pinned by a D-decision or a test, so a future implementer "simplifying" `<` to `<=` would change admin-visible behavior with no failing test. Note the asymmetry risk: relaxing arrival to `<=` while keeping shelf-life `>` would accept medicine that arrives on stockout day but expires that same day.

**Fix:** add one test per boundary (`transportDays === cover`, `daysToExpiry === transportDays`) locking the intended behavior, with a comment citing the rationale.

---

## Explicitly checked, no finding

- **Security:** pure computation only — no I/O, no network, no secrets, no `eval`/`Function`/`innerHTML`, no deserialization. `reason`-string interpolation of IDs is an XSS *downstream* concern (dashboard/chat must escape); not flaggable here.
- **`mape` negative-on-zero-day path:** the negative check precedes the zero-skip (`forecast.ts:76-79`), so `mape([0], [-5])` throws correctly. No bypass.
- **`stockoutRisk` EPS/exact-cover logic:** `remaining + EPS < day.value` handles 1-decimal sums correctly; verified `100u @ 10u/day → 10 days, no warn at lead 10`.
- **Outbreak enter/exit state machine:** re-entry after exit, single-inside-day retention, and `enteredOnDay = i - 1` all trace correctly; population-σ matches the locked D-05 baseline and the tests' independent reimplementation.
- **`trendForecast` flat average, advisory flags, weekday alignment `(60+i)%7`, `validateHistory` gap/negative/length guards, empty-sender-pool throw (locked by test), `EngineInputError` shape:** all correct.
- **INFO (not flagged):** 60 history points don't divide evenly into weekday buckets (weekdays 0–3 get 9 samples, 4–6 get 8) — inherent, negligible bias; `stock=0 + zero demand → 90d cover` follows D-17 literally; `02-PATTERNS.md` signature drift is covered under MN-04.

## Summary of required actions

| ID | Severity | Fix |
|----|----------|-----|
| BL-01 | BLOCKER | `round1` the waste difference; decide `warns` on the rounded value |
| MJ-01 | MAJOR | Implement or retract the soonness tiebreak in `rankPriorities` |
| MJ-02 | MAJOR | Reject self-send and duplicate sender IDs in `validateRequest` |
| MN-01…MN-06 | MINOR | As above; MN-04 and MN-06 are the cheapest and most valuable |
