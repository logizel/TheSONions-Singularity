# Phase 2: Forecast & Decision Engine - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** 10 (9 new + 1 pending-upstream compat)
**Analogs found:** 0 / 10

> Greenfield repo: `git ls-files` shows zero tracked source files (README, docs,
> and `.planning/` only) and `Glob("**/*.ts")` returns nothing. There is no
> existing engine, component, service, middleware, or utility code to copy from,
> and `.planning/codebase/` does not exist. Every entry below is therefore
> recorded under "No Analog Found" with a **fallback standard-convention
> pattern** derived directly from the locked decisions in `02-CONTEXT.md`
> (D-01–D-22). These fallbacks are prescriptive templates grounded in user
> decisions — not excerpts from the codebase. No mirror paths are emitted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/engine/forecast.ts` | service (pure function) | transform (60d history → 30d forecast) | none — greenfield | no-analog |
| `lib/engine/outbreak.ts` | service (pure function) | transform (series → flag + trend forecast) | none — greenfield | no-analog |
| `lib/engine/stockout.ts` | service (pure function) | transform (stock + forecast → days + warning) | none — greenfield | no-analog |
| `lib/engine/waste.ts` | service (pure function) | transform (stock + forecast + expiry → waste qty) | none — greenfield | no-analog |
| `lib/engine/moves.ts` | service (pure function) | transform (risks + surpluses → transfers + orders) | none — greenfield | no-analog |
| `lib/engine/priorities.ts` | service (pure function) | transform (risk signals → 0–100 scores + ranking) | none — greenfield | no-analog |
| `lib/engine/errors.ts` | utility | — (synchronous typed throw, no I/O) | none — greenfield | no-analog |
| `lib/engine/seeds.ts` | test fixture | batch (deterministic committed datasets) | none — greenfield | no-analog |
| `lib/engine/*.test.ts` (one per module) | test | batch (unit assertions vs seeds) | none — greenfield | no-analog |
| `lib/contracts.ts` (pending Phase 1 — define I/O compatibly if missing) | model (shared types) | — (type-only, no runtime flow) | none — greenfield | no-analog |

Track ownership (from `docs/TEAM.md`): P3 owns `lib/engine/` only. `lib/contracts.ts`
is frozen by P2 in Phase 1 — Phase 2 must consume it if it exists, or define engine
I/O compatibly with the CONTEXT shapes without editing outside `lib/engine/`
(open a GitHub issue for the P2 owner if contract changes are needed).

## Pattern Assignments

### `lib/engine/forecast.ts` (service, transform)

**Analog:** none — greenfield. Fallback: standard TypeScript pure-function convention.

**Locked decisions shaping this file:** D-01 (daily 30-day array per
hospital/medicine), D-02 (1-decimal floats; rounding happens at consumption),
D-03 (per-day `advisory: true` flag on days 15–30 inside the single array),
D-04 (MAPE per series ignoring zero-demand days + network mean; 3–11% band),
D-07 (rising-trend input = last-7-day average — consumed from `outbreak.ts`,
not computed here), D-08 (per hospital/medicine granularity).

**Fallback pattern — copy this shape:**
```typescript
import type { DemandHistory, ForecastDay } from '../contracts'; // or ./types compat shim if contracts missing
import { EngineInputError } from './errors';

export function forecast(history: DemandHistory): ForecastDay[] {
  if (history.length !== 60) throw new EngineInputError('history must be 60 daily points');
  // weekday-average baseline → 30 daily points, 1-decimal floats;
  // days 15-30 carry advisory: true (D-01, D-02, D-03)
}

export function mape(actual: number[], predicted: number[]): number {
  // ignore zero-demand days; network mean computed by caller (D-04)
}
```

**Validation pattern (D-20):** guard-clause at top, `throw new EngineInputError(...)`
on negative stock / wrong history length / gaps — no warning accumulation.

---

### `lib/engine/outbreak.ts` (service, transform)

**Analog:** none — greenfield. Fallback: standard TypeScript pure-function convention.

**Locked decisions:** D-05 (baseline = mean/σ over full 60-day history),
OUTBK-01 (+2σ for 2 consecutive days to enter), D-06 (exit after 2 consecutive
days back inside band), D-07 (trend forecast = last-7-day average),
D-08 (per hospital/medicine flag), OUTBK-02 (flagged series switches to trend
forecast until normalized).

**Fallback pattern — copy this shape:**
```typescript
import type { DemandHistory, ForecastDay } from '../contracts';
import { EngineInputError } from './errors';

export interface OutbreakFlag {
  isOutbreak: boolean;
  enteredOnDay: number | null;
}

export function detectOutbreak(history: DemandHistory): OutbreakFlag {
  // mean/σ over full 60d (D-05); enter on 2 consecutive days > mean+2σ (OUTBK-01);
  // exit after 2 consecutive days back inside band (D-06)
}

export function trendForecast(history: DemandHistory): ForecastDay[] {
  // flat last-7-day average projection, 1-decimal floats, advisory flags per D-03 (D-07)
}
```

---

### `lib/engine/stockout.ts` (service, transform)

**Analog:** none — greenfield. Fallback: standard TypeScript pure-function convention.

**Locked decisions:** D-01 (daily depletion against the 30-day array),
D-02 (consume 1-decimal forecast as-is; no rounding here), D-17 (zero forecast
demand → days-until-stockout capped at 90+ cover, never Infinity/null),
RISK-01 (days-until-stockout per hospital/medicine), RISK-02 (warn when cover <
supplier lead time).

**Fallback pattern — copy this shape:**
```typescript
import type { ForecastDay } from '../contracts';
import { EngineInputError } from './errors';

export interface StockoutRisk {
  daysUntilStockout: number; // 90+ cap when demand is zero (D-17)
  warns: boolean;            // true when cover < supplier lead time (RISK-02)
}

export function stockoutRisk(stock: number, forecast: ForecastDay[], leadTimeDays: number): StockoutRisk {
  if (stock < 0) throw new EngineInputError('stock must be >= 0');
  // deplete stock day-by-day over forecast; zero-demand → 90+ cap (D-17)
}
```

---

### `lib/engine/waste.ts` (service, transform)

**Analog:** none — greenfield. Fallback: standard TypeScript pure-function convention.

**Locked decisions:** D-18 (waste = stock − forecast demand to expiry, capped at
90 days; 30d forecast when expiry is near, full window to expiry otherwise),
WASTE-01/WASTE-02 (per hospital/medicine expiring-unused quantities + warning).

**Fallback pattern — copy this shape:**
```typescript
import type { ForecastDay } from '../contracts';
import { EngineInputError } from './errors';

export interface WasteRisk {
  wasteUnits: number; // stock minus realistic demand before expiry, 90d cap (D-18)
  warns: boolean;     // true when wasteUnits > 0 (WASTE-02)
}

export function wasteRisk(stock: number, forecast: ForecastDay[], daysToExpiry: number): WasteRisk {
  if (stock < 0) throw new EngineInputError('stock must be >= 0');
  // sum forecast demand over min(daysToExpiry, 90); near expiry uses the 30d array (D-18)
}
```

---

### `lib/engine/moves.ts` (service, transform)

**Analog:** none — greenfield. Fallback: standard TypeScript pure-function convention.

**Locked decisions:** D-09 (sender keeps 7 days of cover after sending),
D-10 (split shipments allowed — multiple surplus hospitals may combine),
D-11 (sender order: waste-first, tie-break by fewest transport days),
D-12 (exact need: `min(need, sendable surplus)`; emergency order = exact
uncovered remainder, no pack rounding, no safety margin), MOVE-01 (all 5 checks:
arrives before receiver runs out; shelf life on arrival; sender buffer; nothing
beyond need; waste-first + nearest preference), MOVE-02 (emergency order for
remainder).

**Fallback pattern — copy this shape:**
```typescript
import { EngineInputError } from './errors';

export interface Transfer { from: string; to: string; medicine: string; quantity: number; }
export interface EmergencyOrder { hospital: string; medicine: string; quantity: number; }

export function suggestMoves(input: NetworkPosition): { transfers: Transfer[]; orders: EmergencyOrder[] } {
  // 1. compute need per receiver (exact need, D-12)
  // 2. filter senders through all 5 checks incl. 7-day post-send cover (D-09, MOVE-01)
  // 3. sort senders waste-first, tie-break fewest transport days (D-11)
  // 4. allow split shipments across senders (D-10); remainder → exact emergency order (D-12, MOVE-02)
}
```

---

### `lib/engine/priorities.ts` (service, transform)

**Analog:** none — greenfield. Fallback: standard TypeScript pure-function convention.

**Locked decisions:** D-13 (weights soonness-first: soonness ≫ emergency share ≫
patient load ≫ substitute existence), D-14 (0–100 score per hospital/medicine,
sortable and quotable), D-15 (global ranking across all hospitals/medicines),
D-16 (justification = factor breakdown + one human sentence, e.g. "stockout in
6d, emergency 40%"), PRIOR-01/PRIOR-02.

**Fallback pattern — copy this shape:**
```typescript
export interface Priority {
  hospital: string;
  medicine: string;
  score: number; // 0-100 (D-14)
  breakdown: { soonness: number; emergencyShare: number; patientLoad: number; substitute: number };
  reason: string; // one human sentence, e.g. "stockout in 6d, emergency 40%" (D-16)
}

export function rankPriorities(signals: RiskSignal[]): Priority[] {
  // soonness-first weights (D-13); global sort desc by score (D-15)
}
```

---

### `lib/engine/errors.ts` (utility, synchronous throw)

**Analog:** none — greenfield. Fallback: standard typed-error convention (D-20:
bad input → throw typed errors, not warning accumulation).

**Fallback pattern — copy this shape:**
```typescript
export class EngineInputError extends Error {
  readonly code = 'ENGINE_INPUT_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'EngineInputError';
  }
}
```

**Apply to:** every `lib/engine/*.ts` pure function — guard-clauses throw
`EngineInputError` on negative stock, wrong history length, or gaps in history.
No try/catch inside the engine (pure, auditable); callers (Phase 3 API, tests)
decide how to surface it.

---

### `lib/engine/seeds.ts` (test fixture, batch)

**Analog:** none — greenfield. Fallback: standard deterministic-fixture convention.

**Locked decisions:** D-21 (deterministic committed seeds; MAPE asserted in the
3–11% band deterministically, no randomness), D-22 (seeds cover all four
scenarios: normal demand, outbreak spike, expiry waste, multi-sender
competition).

**Fallback pattern — copy this shape:**
```typescript
import type { DemandHistory } from '../contracts';

export interface SeedScenario { name: string; history: DemandHistory; stock: number; }

export const seeds: Record<'normal' | 'outbreak' | 'waste' | 'multiSender', SeedScenario> = {
  // hard-coded arrays, no Math.random, committed to git (D-21, D-22)
};
```

---

### `lib/engine/*.test.ts` (test, batch unit)

**Analog:** none — greenfield. Fallback: standard Vitest (or Jest — whichever
Phase 1 installs; if neither exists yet, planner defaults to Vitest as the
Next.js-TS standard) unit-test convention, one test file per engine module,
asserting against `seeds.ts`.

**Fallback pattern — copy this shape:**
```typescript
import { describe, expect, it } from 'vitest';
import { forecast, mape } from './forecast';
import { seeds } from './seeds';

describe('forecast', () => {
  it('produces a 30-day daily array with advisory flags on days 15-30', () => {
    const out = forecast(seeds.normal.history);
    expect(out).toHaveLength(30);
    expect(out.slice(14).every((d) => d.advisory)).toBe(true);
  });

  it('MAPE sits in the 3-11% band on the normal seed', () => {
    expect(mape(seeds.normal.history.slice(30), forecast(seeds.normal.history).map((d) => d.value)))
      .toBeGreaterThanOrEqual(0.03);
  });

  it('throws EngineInputError on negative stock / short history', () => {
    expect(() => forecast([1, 2, 3] as never)).toThrow();
  });
});
```

**Coverage rule from CONTEXT:** every D-01–D-20 behavior gets at least one seeded
assertion; the four D-22 scenarios each get a dedicated test path (normal MAPE
band, outbreak enter/exit, waste quantities, multi-sender split + order remainder).

---

### `lib/contracts.ts` (model, type-only — pending Phase 1)

**Analog:** none — greenfield. Fallback: standard shared-types-module convention.

**Status:** owned and frozen by P2 in Phase 1; may not exist yet. Planner must
check for its existence at plan time. If missing, define engine I/O compatibly
with the CONTEXT shapes **without creating files outside `lib/engine/`**
(e.g. a local `lib/engine/types.ts` shim mirroring the expected
`DemandHistory`, `ForecastDay` (`{ value: number; advisory: boolean }`),
and ResultsJSON shapes) and open a GitHub issue for the P2 owner to reconcile.
Do NOT create or edit `lib/contracts.ts` from Phase 2 (strict track ownership,
`docs/TEAM.md`).

## Shared Patterns

### Pure-function module shape (D-19)
**Source:** fallback convention (no codebase analog).
**Apply to:** all six engine modules.
```typescript
// imports: type-only from '../contracts' (or ./types shim) + { EngineInputError } from './errors'
// no DB, no fetch, no Date.now(), no Math.random — deterministic in/out
export function verb(noun: Input): Output { /* guard-clauses, then math */ }
```
One pure function per concern — `forecast()`, `detectOutbreak()`,
`stockoutRisk()`, `wasteRisk()`, `suggestMoves()`, `rankPriorities()` — each
independently importable and unit-testable. No `runEngine` entry point.

### Typed-error handling (D-20)
**Source:** `lib/engine/errors.ts` (new, fallback convention).
**Apply to:** all engine modules + all test files (assert the throw).
```typescript
if (stock < 0) throw new EngineInputError('stock must be >= 0');
```
No error accumulation, no result-envelope `{ ok, warnings }` — invalid input
throws, valid input returns plain data.

### Numeric conventions (D-02, D-14)
**Source:** fallback convention.
**Apply to:** `forecast.ts`, `outbreak.ts` (trend), `priorities.ts`, and every consumer.
```typescript
const round1 = (n: number) => Math.round(n * 10) / 10; // engine keeps 1-decimal floats
// scores: Math.round() to 0-100 integer at emission in priorities.ts
```
Rounding to integers happens at consumption (transfer math, chat quotes) —
the engine itself emits 1-decimal floats (forecasts) and 0–100 scores.

### Quotable outputs (D-14, D-16; downstream Phase 3/4)
**Source:** fallback convention.
**Apply to:** `priorities.ts`, `moves.ts`, `stockout.ts`, `waste.ts`.
Every emitted number must be directly quotable from ResultsJSON by the dashboard
and the quote-only chatbot — hence numeric scores (not bands), exact quantities
(no rounding/margin, D-12), and machine-readable breakdowns plus one human sentence.

### Deterministic test discipline (D-21, D-22)
**Source:** fallback convention.
**Apply to:** `seeds.ts` + all `*.test.ts`.
No randomness, no time-dependence, no network. Seeds committed to git; MAPE band
asserted deterministically; all four scenarios covered.

## No Analog Found

Files with no close match in the codebase (planner must use the fallback
standard-TypeScript pure-function patterns above instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/engine/forecast.ts` | service | transform | Greenfield — no TS source tracked in git |
| `lib/engine/outbreak.ts` | service | transform | Greenfield — no TS source tracked in git |
| `lib/engine/stockout.ts` | service | transform | Greenfield — no TS source tracked in git |
| `lib/engine/waste.ts` | service | transform | Greenfield — no TS source tracked in git |
| `lib/engine/moves.ts` | service | transform | Greenfield — no TS source tracked in git |
| `lib/engine/priorities.ts` | service | transform | Greenfield — no TS source tracked in git |
| `lib/engine/errors.ts` | utility | sync throw | Greenfield — no TS source tracked in git |
| `lib/engine/seeds.ts` | test fixture | batch | Greenfield — no TS source tracked in git |
| `lib/engine/*.test.ts` | test | batch | Greenfield — no test runner or tests exist yet |
| `lib/contracts.ts` (compat) | model | type-only | Pending Phase 1 — may not exist; shim inside `lib/engine/` if missing |

## Metadata

**Analog search scope:** repo root (`Glob("**/*.ts")` → zero hits; `Glob` for
`package.json`/`tsconfig.json`/`vitest.config.*`/`jest.config.*`/`next.config.*` →
zero hits); `git ls-files` → only README, docs, `.planning/`, AGENTS.md, LICENSE.
No `.claude/skills/`, `.agents/skills/`, or other skill dirs exist. No
`.planning/codebase/` maps exist. Tracked-source gate: satisfied vacuously —
no analog paths are named because no tracked source files exist.
**Files scanned:** 0 source files (nothing to scan).
**Pattern extraction date:** 2026-10-08
**Upstream inputs read:** `02-CONTEXT.md`, `.planning/PROJECT.md`,
`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `docs/TEAM.md`, `AGENTS.md`, `README.md`.
No RESEARCH.md exists for this phase (research disabled) — proceeded on CONTEXT.md only.
