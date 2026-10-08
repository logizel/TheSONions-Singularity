# Phase 2: Forecast & Decision Engine - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

## Phase Boundary

Pure-TypeScript statistical engine in `lib/engine/` (Track P3, tests only — no DB, no UI). Turns 60 days of demand history + current stock into 30-day forecasts, outbreak flags, stock-out and waste warnings, transfer suggestions with emergency orders, and ranked priorities. Verified by unit tests against seeded data. Consumes contracts frozen in Phase 1 (`lib/contracts.ts`, ResultsJSON shape); if Phase 1 contracts are not yet frozen, define engine I/O compatibly with the shapes below.

## Implementation Decisions

### Forecast output & error
- **D-01:** Forecast granularity is a daily 30-day array per hospital/medicine (not weekly buckets, not daily+weekly rollups) — downstream stock-out math needs daily depletion and UI drill-in needs a daily curve.
- **D-02:** Forecast values are 1-decimal floats through the engine; rounding to integers happens at consumption (transfer math, chat quotes).
- **D-03:** Days 15–30 carry a per-day `advisory: true` confidence flag inside the single array (not split arrays, not a UI-only rule).
- **D-04:** MAPE is computed per hospital/medicine series ignoring zero-demand days, plus a network mean; the 3–11% target band is checked against these values.

### Outbreak enter/exit
- **D-05:** Baseline for mean/σ is the full 60-day history (not trailing 14/28d) — stable, less jitter from recent spikes.
- **D-06:** Flag exits after 2 consecutive days back inside the normal band (not 1, not 3) — avoids oscillation without delaying return.
- **D-07:** Rising-trend forecast during outbreak is the last-7-day average (not linear slope projection, not weighted recent-3d) — stable, no overshoot on spikes.
- **D-08:** Flag granularity is per hospital/medicine (not whole-hospital switch) — only the spiking medicine switches to trend forecast.

### Transfer feasibility
- **D-09:** Sender must keep 7 days of cover after sending (not lead-time cover, not zero buffer).
- **D-10:** Split shipments are allowed — multiple surplus hospitals may combine to cover one receiver's need (not single-sender-only).
- **D-11:** When multiple senders pass all 5 checks, order waste-first then nearest: prefer the sender with most expiring-unused stock, break ties by fewest transport days (not nearest-first, not a blended score).
- **D-12:** Quantities are exact need — send `min(need, sendable surplus)`; emergency supplier order covers the exact uncovered remainder (no pack rounding, no safety margin).

### Priority scoring
- **D-13:** Factor weights are soonness-first: soonness of stock-out dominates, then emergency share, then patient load, then substitute existence (not equal weights, not load-first).
- **D-14:** Output is a 0–100 score per hospital/medicine (not rank-only, not severity bands) — sortable and quotable in chat.
- **D-15:** Ranking scope is global across all hospitals/medicines (not per-medicine lists) — admin sees worst first.
- **D-16:** Justification is a factor breakdown plus one human sentence (e.g. stockout in 6d, emergency 40%) — machine-readable and quotable by dashboard/chat, not score-only or long text.

### Stock-out / waste edges
- **D-17:** Zero forecast demand → report days-until-stockout capped at 90+ days cover (not infinity/null).
- **D-18:** Waste quantity = stock minus forecast demand to expiry, capped at 90 days; use the 30d forecast when expiry is near, the full window to expiry otherwise.

### Engine function shape
- **D-19:** One pure function per concern — `forecast()`, `detectOutbreak()`, `stockoutRisk()`, `wasteRisk()`, `suggestMoves()`, `rankPriorities()` — each independently unit-testable (not a single `runEngine` entry).
- **D-20:** Bad input (negative stock, gaps in history) → throw typed errors (not warning accumulation) — keeps the engine pure and auditable.

### Test seeding
- **D-21:** Deterministic committed seeds; MAPE asserted in the 3–11% band deterministically (not randomized data).
- **D-22:** Seeds must cover all four scenarios: normal demand, outbreak spike, expiry waste, multi-sender competition (not happy-path only).

### the agent's Discretion
None — user decided every area directly. No "you decide" options were taken.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project contracts
- `.planning/PROJECT.md` — stack (Next.js + TS + Drizzle + Neon), 60/30/90 windows, pure-TS statistical engine, chatbot quote-only constraint, strict track ownership (P3 owns `lib/engine/`)
- `.planning/REQUIREMENTS.md` — FCAST-01/02, OUTBK-01/02, RISK-01/02, WASTE-01/02, MOVE-01/02, PRIOR-01/02 (all 12 Phase 2 requirements)
- `.planning/ROADMAP.md` — Phase 2 goal, 5 success criteria, P3 ownership, dependency on Phase 1 frozen contracts (`db/schema.ts`, `lib/contracts.ts`)

### Pending contracts (Phase 1 not yet executed)
- `lib/contracts.ts` (pending Phase 1) — engine in/out + ResultsJSON shape; planner must check for its existence and define engine I/O compatibly if it does not exist yet

## Existing Code Insights

### Reusable Assets
- None — greenfield repo (README only). No existing engine code, components, or utilities to reuse.

### Established Patterns
- None yet — no codebase maps (`.planning/codebase/` does not exist). Planner follows standard TypeScript pure-function patterns.

### Integration Points
- Phase 1 (upstream): `db/schema.ts` types and `lib/contracts.ts` engine in/out + ResultsJSON shape — engine input/output shapes must match once frozen.
- Phase 3 (downstream): `app/api/` + `lib/chat/` consume precomputed ResultsJSON — every number the engine emits must be quotable (hence D-14, D-16).
- Phase 4 (downstream): dashboard drill-in consumes daily forecast arrays and priority ranking (hence D-01, D-15).

## Specific Ideas

No specific references — open to standard approaches for weekday-average forecasting, σ-based detection, and pure-function engine design.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 2-Forecast & Decision Engine*
*Context gathered: 2026-10-08*
