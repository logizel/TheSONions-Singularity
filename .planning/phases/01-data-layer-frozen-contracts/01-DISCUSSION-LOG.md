# Phase 1: Data Layer + Frozen Contracts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 1-Data Layer + Frozen Contracts
**Areas discussed:** Stock & expiry model, Usage & load entry, Transport & lead times, CSV upload & Excel export, Frozen contracts scope, Roles scope, Entry UI ownership

---

## Stock & expiry model

| Option | Description | Selected |
|--------|-------------|----------|
| Batch rows | hospital+medicine+qty+expiry per batch; waste engine needs per-batch expiry | ✓ |
| Single row + expiry | One qty + one date per medicine; fails on mixed expiries | |
| Single qty, batches optional | Aggregate + optional breakdown; needs rollup rule | |

**User's choice:** Batch rows
**Notes:** Waste calc (WASTE-01) needs per-batch expiry fidelity.

| Option | Description | Selected |
|--------|-------------|----------|
| Always new batch | Each delivery = new row; preserves expiry fidelity | ✓ |
| Merge same-month expiry | Fewer rows; needs month-bucketing rule | |
| Admin chooses | Add-or-merge toggle; more UI + contract complexity | |

**User's choice:** Always new batch

| Option | Description | Selected |
|--------|-------------|----------|
| FIFO auto | Deduct earliest-expiry first; matches waste logic | ✓ |
| Admin picks batch | Precise control; more clicks | |
| You decide | Planner discretion | |

**User's choice:** FIFO auto

| Option | Description | Selected |
|--------|-------------|----------|
| Keep archived | Flag expired rows, exclude from available; audit trail | ✓ |
| Hard delete | Simplest tables; loses expiry history | |
| You decide | Planner discretion | |

**User's choice:** Keep archived

| Option | Description | Selected |
|--------|-------------|----------|
| Base unit + substitutes now | base_unit + substitute_ids; PRIOR-01 needs it, cheap to freeze now | ✓ |
| Units only, no substitutes | Minimal; risks contract change in Phase 2 | |
| You decide | Planner discretion | |

**User's choice:** Base unit + substitutes now

| Option | Description | Selected |
|--------|-------------|----------|
| Buffer field now | buffer_days per hospital/medicine, admin-editable | ✓ |
| Engine constant | Hardcoded buffer; not configurable | |
| You decide | Planner discretion | |

**User's choice:** Buffer field now (MOVE-01 "sender keeps buffer" needs it)

| Option | Description | Selected |
|--------|-------------|----------|
| Coded master | medicines table: id, name, category, is_critical; consistent names | ✓ |
| Free-text name | Fastest entry; mismatched spellings break transfers | |
| You decide | Planner discretion | |

**User's choice:** Coded master

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory | No stock without expiry; waste calc always valid | ✓ |
| Optional + default | Faster entry; placeholder dates pollute warnings | |
| You decide | Planner discretion | |

**User's choice:** Mandatory

---

## Usage & load entry

| Option | Description | Selected |
|--------|-------------|----------|
| Combined daily row | date+hospital+medicine+used_qty+patient_load+emergency_pct in one row | ✓ |
| Separate tables | Usage per medicine + load per hospital/day; double entry | |
| You decide | Planner discretion | |

**User's choice:** Combined daily row

| Option | Description | Selected |
|--------|-------------|----------|
| Percent field | Single emergency_pct 0-100 per row; matches DATA-03 wording | ✓ |
| Counts derived | Emergency + total counts, compute share; more fields | |
| You decide | Planner discretion | |

**User's choice:** Percent field

| Option | Description | Selected |
|--------|-------------|----------|
| Flag missing | NULL = missing, engine interpolates; zeros only when explicit | ✓ |
| Zeros | Simplest; forgotten entries under-forecast | |
| Block/require | Strict completeness; burdens admins | |

**User's choice:** Flag missing

| Option | Description | Selected |
|--------|-------------|----------|
| Form + script | Manual form plus scripts/seed path for bulk corrections | ✓ |
| Form only | Dashboard entry only; scripts seed demo data | |
| You decide | Planner discretion | |

**User's choice:** Form + script (no API in Phase 1 — Phase 3 owns it)

---

## Transport & lead times

| Option | Description | Selected |
|--------|-------------|----------|
| Pairwise directed | Transport days from→to per pair; handles asymmetric routes | ✓ |
| Symmetric pair | One value per pair; assumes same both ways | |
| You decide | Planner discretion | |

**User's choice:** Pairwise directed (engine arrival checks need it)

| Option | Description | Selected |
|--------|-------------|----------|
| Per hospital+medicine | lead_days varies by medicine supply chain | ✓ |
| Per hospital only | One lead time per hospital; coarser warnings | |
| You decide | Planner discretion | |

**User's choice:** Per hospital+medicine (RISK-02 precision)

| Option | Description | Selected |
|--------|-------------|----------|
| Network only + defaults | Matches DATA-04; seed 1–2 day defaults | ✓ |
| Hospitals edit own | Flexible; inconsistent matrix risk, contradicts DATA-04 | |
| You decide | Planner discretion | |

**User's choice:** Network only + defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Capped integers | 0–30 whole days, self-pair 0 | ✓ |
| Free-form | Decimals/any range; engine edge cases | |
| You decide | Planner discretion | |

**User's choice:** Capped integers

---

## CSV upload & Excel export

| Option | Description | Selected |
|--------|-------------|----------|
| Long rows | One row per day/medicine; matches schema, easy validation | ✓ |
| Wide matrix | Medicines × dates grid; harder to validate | |
| You decide | Planner discretion | |

**User's choice:** Long rows (date,hospital,medicine,used_qty,patient_load,emergency_pct)

| Option | Description | Selected |
|--------|-------------|----------|
| Partial + report | Import valid rows, per-row error list | ✓ |
| All-or-nothing | Atomic; one typo blocks 60 days | |
| You decide | Planner discretion | |

**User's choice:** Partial + report

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite | Re-upload corrects prior data; idempotent | ✓ |
| Skip duplicates | First write wins; corrections need manual delete | |
| Error on dup | Strictest; annoys re-uploads | |

**User's choice:** Overwrite

| Option | Description | Selected |
|--------|-------------|----------|
| Raw data dump | Sheets per table; matches DATA-05, no engine dependency | ✓ |
| Formatted report | Styled risk/moves report; needs Phase 2, scope creep | |
| You decide | Planner discretion | |

**User's choice:** Raw data dump

---

## Frozen contracts scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full types now | Complete engine I/O + ResultsJSON shape day 1 | ✓ |
| Minimal mirrors | Only DB row types; shapes evolve later (rework risk) | |
| You decide | Planner discretion | |

**User's choice:** Full types now

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, seeded | scripts/seed demo network ~3 hospitals × 5 medicines × 60 days | ✓ |
| Empty schema only | Each track makes own fixtures (divergence risk) | |
| You decide | Planner discretion | |

**User's choice:** Yes, seeded

| Option | Description | Selected |
|--------|-------------|----------|
| Neon pooled only | Single Neon source of truth, pooled, cold-start tolerant | ✓ |
| Neon + local fallback | Local PG for offline dev; setup + drift risk | |
| You decide | Planner discretion | |

**User's choice:** Neon pooled only (matches PROJECT.md constraints)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stub | Placeholder tokens.ts; P1 finalizes in Phase 4 | ✓ |
| Skip stub | Leave theme/ to P1 entirely | |
| You decide | Planner discretion | |

**User's choice:** Minimal stub

---

## Roles scope (extra)

| Option | Description | Selected |
|--------|-------------|----------|
| Schema now, enforce later | Ownership columns in Phase 1; P4 enforces in Phase 3 | ✓ |
| Full enforcement now | Auth in Phase 1; cross-track scope creep into P4 dirs | |
| Defer entirely | No role fields; P4 migrates later | |

**User's choice:** Schema now, enforce later

---

## Entry UI ownership (extra)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal entry UI in Phase 1 | Basic stock/usage/config forms now; P1 finalizes Phase 4 | ✓ |
| CSV + scripts only | Strict ownership; DATA-01..04 usability waits for Phase 4 | |
| You decide | Planner discretion | |

**User's choice:** Minimal entry UI in Phase 1 (needs P1 agreement for `app/` touch)

---

## Claude's Discretion

None — user selected a concrete option for every question.

## Deferred Ideas

- Formatted Excel risk/moves report → Phase 2+ (needs engine outputs)
- Full role enforcement (AUTH-01/02) → Phase 3 (P4)
- Real supplier ordering, EHR pull, mobile, LLM chat swap → v2 / out of scope (per REQUIREMENTS.md)
