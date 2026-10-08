# 01-03 SUMMARY: Entry paths (scripts-only per checkpoint)

**Status:** Complete (checkpoint resolved scripts-only; helpers built + verified; pages task deferred)
**Commits:** (entry.ts commit, this summary commit)

## Checkpoint resolution
- **Decision:** scripts-only. Likith (P1) declined the Phase 1 `app/` touch on 2026-10-08.
- **Consequence:** Task 3 (entry pages) SKIPPED with deferral — entry UI pages move to Phase 4 (P1 dashboard). CONTEXT.md Deferred Ideas updated. Entry stays via `scripts/entry.ts` + CSV.

## What was built
- `scripts/entry.ts`: addBatch (new row always, mandatory expiry), recordUsage (combined row, NULL = missing, upsert-overwrite), adjustStockDown (FIFO earliest-expiry, archive-not-delete), archiveExpired, setTransport (directed, 0-30, self = 0), setLead (per hospital+medicine, 0-30). All helpers validate ranges + coded-master FKs and set ownership columns (D-24).
- Self-test (`--self-test`, isolated `__entry_*` rows, seed untouched): distinct batch rows, FIFO exhaust + archive, upsert-overwrite, 4 rejections (empty expiry, pct 101, self-transport 3, unknown hospital) — "all assertions passed".

## Verification
- `npx tsc --noEmit` clean; self-test green; no schema/contract changes; `app/` untouched.

## For Phase 4 (P1)
- Build `app/(entry)/` + `components/DataForm.tsx` calling these helpers server-side — no divergent write path. Helpers are the contract: same validation, same FIFO, same overwrite semantics.
