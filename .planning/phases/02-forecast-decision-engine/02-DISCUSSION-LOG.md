# Phase 2: Forecast & Decision Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 2-Forecast & Decision Engine
**Areas discussed:** Forecast output & error, Outbreak enter/exit, Transfer feasibility, Priority scoring, Stock-out/waste edges, Engine function shape, Test seeding strategy

---

## Forecast output & error

| Option | Description | Selected |
|--------|-------------|----------|
| Daily 30-day array | 30 numbers per hospital/medicine, UI and stock-out math use daily depletion | ✓ |
| Weekly buckets | 4 weekly totals, simpler but can't compute exact stock-out day | |
| Daily + weekly | Both daily detail plus weekly rollups precomputed | |

**User's choice:** Daily 30-day array

| Option | Description | Selected |
|--------|-------------|----------|
| Round to integers | Discrete pills/vials, clean for chat quotes and transfer math | |
| 1-decimal floats | Keep fractional precision through engine, round only at display | ✓ |

**User's choice:** 1-decimal floats (against recommendation — planner must note rounding at consumption)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-day confidence flag | Each day 15-30 gets advisory:true flag, single array stays simple | ✓ |
| Split arrays | Days 1-14 actionable array plus days 15-30 advisory array | |
| No flag, UI rule | No structural marking, UI hardcodes day-15 cutoff | |

**User's choice:** Per-day confidence flag

| Option | Description | Selected |
|--------|-------------|----------|
| Per-series + mean | MAPE per hospital/medicine ignoring zero-demand days, plus network mean | ✓ |
| Single global MAPE | One MAPE over all history points pooled together | |
| Weekly MAPE | Weekly-aggregated MAPE to smooth daily noise | |

**User's choice:** Per-series + mean

---

## Outbreak enter/exit

| Option | Description | Selected |
|--------|-------------|----------|
| Full 60-day baseline | Stable baseline from full 60d history, less jitter | ✓ |
| Trailing 14-day | Adapts faster to recent level shifts, but noisier sigma | |
| Trailing 28-day | Middle ground between stability and adaptivity | |

**User's choice:** Full 60-day baseline

| Option | Description | Selected |
|--------|-------------|----------|
| 1 day back inside | Exits fast, but risks flip-flopping | |
| 2 days back inside | Avoids oscillation, confirms trend is truly over | ✓ |
| 3 days back inside | Most conservative, delays return to normal forecast | |

**User's choice:** 2 days back inside

| Option | Description | Selected |
|--------|-------------|----------|
| Last-7-day average | Simple, stable, matches rising demand without overshooting | ✓ |
| Linear slope projection | Extrapolates growth, more responsive but can overshoot | |
| Weighted recent-3d | Heavily weights most recent 3 days for fastest reaction | |

**User's choice:** Last-7-day average

| Option | Description | Selected |
|--------|-------------|----------|
| Per hospital/medicine | Only spiking medicine switches to trend forecast | ✓ |
| Per hospital only | Whole hospital switches when any signal fires | |

**User's choice:** Per hospital/medicine

---

## Transfer feasibility

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 7 days cover | Sender keeps 7 days cover after sending; safe for lead-time shocks | ✓ |
| Keep lead-time cover | Sender keeps exactly lead-time days cover, leaner but riskier | |
| Zero buffer | No fixed buffer, any computed surplus is sendable | |

**User's choice:** Keep 7 days cover

| Option | Description | Selected |
|--------|-------------|----------|
| Single sender only | One sender per receiver need, simplest to execute and justify | |
| Allow split shipments | Combine multiple surplus hospitals when one can't cover need | ✓ |

**User's choice:** Allow split shipments

| Option | Description | Selected |
|--------|-------------|----------|
| Waste-first, then nearest | Prefer sender with most expiring-unused stock first, then nearest | ✓ |
| Nearest-first, then waste | Prefer fewest transport days first, then most waste | |
| Blended score | Score combining waste quantity and distance into one rank | |

**User's choice:** Waste-first, then nearest

| Option | Description | Selected |
|--------|-------------|----------|
| Exact need + remainder | Send min(need, sendable surplus); order exact uncovered remainder | ✓ |
| Round to packs | Round transfers and orders up to whole pack sizes | |
| Need plus margin | Add safety margin on top of computed need | |

**User's choice:** Exact need + remainder

---

## Priority scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Soonness-first weights | Soonness dominates, then emergency share, then load, then substitute | ✓ |
| Equal weights | All four factors contribute equally | |
| Load/emergency first | Patient impact dominates over timing | |

**User's choice:** Soonness-first weights

| Option | Description | Selected |
|--------|-------------|----------|
| 0-100 score | 0-100 score per hospital/medicine, sortable and quotable in chat | ✓ |
| Rank only | Simple 1..N rank order with no numeric gaps shown | |
| Severity bands | Critical / High / Medium / Low bands for dashboard | |

**User's choice:** 0-100 score

| Option | Description | Selected |
|--------|-------------|----------|
| Global ranking | One global list across all hospitals/medicines, admin sees worst first | ✓ |
| Per-medicine ranking | Separate ranking per medicine, avoids comparing unlike drugs | |

**User's choice:** Global ranking

| Option | Description | Selected |
|--------|-------------|----------|
| Factors + sentence | Machine-readable factor breakdown plus one human sentence | ✓ |
| Score only | Only the numeric score, no explanation | |
| Long text | Full paragraph explanation per ranked item | |

**User's choice:** Factors + sentence

---

## Stock-out/waste edges

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 90+ days | Zero forecast means no depletion; cap display at 90+ days | ✓ |
| Return infinity | Return null/infinity to distinguish no-consumption case | |

**User's choice:** Cap at 90+ days

| Option | Description | Selected |
|--------|-------------|----------|
| Forecast to expiry | Stock minus 30d forecast when expiry within 30d, else minus forecast to expiry capped 90d | ✓ |
| Always 90d cap | Always use full capped window regardless of forecast horizon | |

**User's choice:** Forecast to expiry

---

## Engine function shape

| Option | Description | Selected |
|--------|-------------|----------|
| One function per concern | forecast(), detectOutbreak(), stockoutRisk(), wasteRisk(), suggestMoves(), rankPriorities() — each unit-testable | ✓ |
| Single runEngine | Single runEngine(history, stock) returning full ResultsJSON in one call | |

**User's choice:** One function per concern

| Option | Description | Selected |
|--------|-------------|----------|
| Throw on bad input | Bad rows fail fast with typed errors; keeps engine pure and auditable | ✓ |
| Return warnings | Skip bad rows and collect warnings array in output | |

**User's choice:** Throw on bad input

---

## Test seeding strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic seeds | Fixed seeds committed in repo, MAPE asserted in 3-11% band deterministically | ✓ |
| Randomized data | Random data generated per run with statistical assertions | |

**User's choice:** Deterministic seeds

| Option | Description | Selected |
|--------|-------------|----------|
| All four scenarios | Normal + outbreak spike + expiry waste + multi-sender competition scenarios | ✓ |
| Happy path only | Only normal forecast accuracy, edge scenarios later | |

**User's choice:** All four scenarios

---

## the agent's Discretion

None — user decided every area directly.

## Deferred Ideas

None — discussion stayed within phase scope. (Extra areas for edges, engine shape, and test seeds were raised by the agent after the initial four and all selected by the user.)
