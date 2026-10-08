# Phase 1: Data Layer + Frozen Contracts - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

## Phase Boundary

Hospital and network admins can record and configure the full per-hospital/medicine picture (stock with expiry, daily usage, patient load, emergency share, transport days, supplier lead times, CSV bulk upload, Excel export), and every track builds against contracts frozen in this phase (`db/schema.ts`, `lib/contracts.ts`, `theme/tokens.ts` stub). Requirements DATA-01..05 are fixed — this context clarifies HOW to implement them. Track P2, Jovian Wilson Simon (velo4705), branch `p2/data`.

## Implementation Decisions

### Stock & expiry model
- **D-01:** Stock stored as batch rows — one row per hospital + medicine + qty + expiry, not a single aggregate row — **Reversibility:** one-way — changing row granularity later needs a migration and breaks the waste engine's per-batch expiry inputs
- **D-02:** Each new delivery with a different expiry adds a new batch row; never merge same-month expiries
- **D-03:** Stock deductions (corrections, usage) apply FIFO by earliest expiry automatically; admin does not pick batches
- **D-04:** Expired batches are kept as archived/flagged rows excluded from available stock, not hard-deleted (audit trail for waste reporting)
- **D-05:** Medicines use a coded master (`id, name, category, is_critical`) plus `base_unit` and `substitute_ids` list — PRIOR-01 substitute scoring depends on it — **Reversibility:** one-way — renaming/rekeying medicines later breaks transfer matching across hospitals
- **D-06:** Per-hospital/medicine `buffer_days` field, admin-editable — MOVE-01 "sender keeps buffer" depends on it
- **D-07:** Expiry date is mandatory on every stock entry; no defaults or placeholder dates

### Usage & load entry
- **D-08:** Combined daily row: `date + hospital + medicine + used_qty + patient_load + emergency_pct` in one table, not separate usage/load tables
- **D-09:** Emergency share is a single `emergency_pct` 0–100 field per row, not derived from counts
- **D-10:** Missing days are NULL (engine interpolates weekday average); zero only when explicitly entered — **Reversibility:** costly — zero-vs-NULL semantics flow into the Phase 2 forecast baseline
- **D-11:** Entry via dashboard manual form plus `scripts/` seed/correction path; no API in Phase 1 (API is Phase 3, P4-owned)

### Transport & lead times
- **D-12:** Transport configured as a directed pairwise matrix (`from → to` days, asymmetric) — **Reversibility:** costly — engine arrival checks (`arrives before receiver runs out`) are built on directed legs
- **D-13:** Supplier lead times per hospital + medicine (`lead_days`), not a flat per-hospital value (RISK-02 warnings need per-medicine precision)
- **D-14:** Network admin only edits transport/lead config (per DATA-04); seed sensible defaults (1–2 days) so the engine works day 1
- **D-15:** Whole-day integers, 0–30 range, same-hospital pair = 0

### CSV upload & Excel export
- **D-16:** CSV uses long rows (`date,hospital,medicine,used_qty,patient_load,emergency_pct`) for the 60-day history, not a wide dates-as-columns matrix
- **D-17:** Partial import: valid rows land, per-row error report returned; one bad row never blocks the whole file
- **D-18:** Duplicate key (same date + hospital + medicine) overwrites on re-upload — re-upload is the correction path (idempotent)
- **D-19:** Excel export is a raw data dump, one sheet per table (stock batches, usage, transport, leads, medicines, hospitals); no formatted risk/moves report (needs Phase 2 outputs — out of scope)

### Frozen contracts scope
- **D-20:** `lib/contracts.ts` freezes full engine I/O + ResultsJSON shape on day 1, not minimal DB-row mirrors — **Reversibility:** one-way — P3/P4/P1 build against it; changes need all-track agreement per docs/TEAM.md
- **D-21:** Phase 1 ships a seed script (`scripts/seed`) with a demo network (~3 hospitals × 5 medicines × 60 days) so P3/P4/P1 build against realistic stubs
- **D-22:** Neon pooled only (`neon-http`/serverless, `DATABASE_URL` env, Drizzle migrations in `db/`); no local-Postgres fallback — **Reversibility:** costly — connection/client choice is load-bearing for every later track
- **D-23:** P2 creates a minimal placeholder `theme/tokens.ts` stub; P1 (Likith) finalizes the theme in Phase 4

### Roles & entry-UI ownership (extras)
- **D-24:** Schema carries ownership now (`hospital_id` on rows + user/hospital/role columns); enforcement deferred to Phase 3 middleware — no Phase-1 auth build, no later migration — **Reversibility:** one-way — adding ownership columns later would need a migration across seeded data
- **D-25:** Phase 1 includes minimal data-entry pages (stock/usage/config forms, unstyled) so DATA-01..04 are usable; touching `app/` needs P1 agreement per docs/TEAM.md, P1 finalizes in Phase 4. Fallback if refused: scripts/CSV-only, dashboard entry waits for Phase 4

### Claude's Discretion
None — user selected a concrete option for every question; no "you decide" answers.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, frozen-contracts note, track ownership (P2)
- `.planning/REQUIREMENTS.md` — DATA-01..05 (this phase); RISK-02, WASTE-01, MOVE-01, PRIOR-01 (downstream consumers of buffer, lead, substitute, batch-expiry fields)
- `.planning/PROJECT.md` — constraints (Next.js + TS + Drizzle + Neon pooled/free-tier, aggregates-only/no-PHI, 60d history / 30d forecast / 90-day expiry cap, strict directory ownership)

### Team & process
- `docs/TEAM.md` — track-to-person mapping (P2 Data: Jovian/velo4705, branch `p2/data`), frozen-contract change rule (all-track agreement), `docs/progress/` update duty, MCP set

## Existing Code Insights

### Reusable Assets
- None — greenfield repo (only `README.md`, `docs/TEAM.md`, `docs/progress/`, `.planning/`). No components, hooks, or utilities to reuse.

### Established Patterns
- Strict directory ownership (P1 `app/` minus `app/api/` + `components/` + `theme/`; P2 `db/` + `scripts/` + `lib/contracts.ts` freeze; P3 `lib/engine/`; P4 `app/api/` + `lib/chat/` + `middleware.ts`) — cross-track edits go via GitHub issue, owner edits. Phase 1 entry-UI pages need P1 sign-off.
- All changes merge via PR; merge `main` into track branch before opening PR; daily `git pull --rebase`.

### Integration Points
- `lib/contracts.ts` (new, P2-frozen) → consumed by P3 engine (Phase 2), P4 API/chat (Phase 3), P1 dashboard mocks (Phase 4); verified end-to-end in Phase 5.
- `db/schema.ts` (new, Neon Postgres source of truth) → seed script populates demo network for all tracks.
- `theme/tokens.ts` stub (new) → finalized by P1 in Phase 4.

## Specific Ideas

- FIFO auto-deduction by earliest expiry as the single stock-adjustment rule (matches waste-calc logic, least admin work).
- NULL-means-missing (not zero) for skipped daily entries so forgotten entries don't silently under-forecast.
- Long-row CSV mirroring the daily-row schema 1:1 for trivial validation.
- Idempotent re-upload (overwrite on duplicate key) as the bulk-correction path.
- No specific UI look/feel requests — P1 principal decides theme; Phase 1 forms stay unstyled.

## Deferred Ideas

- Formatted Excel risk/moves report (needs Phase 2 engine outputs) — Phase 2 or later, not Phase 1.
- Full role enforcement (AUTH-01/02 middleware) — Phase 3 (P4); Phase 1 only lays the ownership columns.
- Real supplier ordering integration — out of scope (v1 recommends order only).
- EHR pull / mobile / LLM chatbot swap — v2 (INTG-01/02, MOBL-01, CHAT-04).

---

*Phase: 1-Data Layer + Frozen Contracts*
*Context gathered: 2026-10-08*
