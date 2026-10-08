# 01-REVIEW-FIX: fix report (Critical + Warning scope)

**Scope:** WR-01..WR-05 (no Critical existed; Info findings untouched per default scope).
**Applied inline** — no `gsd-code-fixer` agent in this runtime. Each fix re-verified below.

## WR-01 — archive-expired before FIFO (was HIGH) → FIXED
- `adjustStockDown` now calls `archiveExpired()` first (`scripts/entry.ts`); expired-but-unarchived batches can never cover demand.
- Self-test extended: expired 2020 batch is archived untouched while live stock deducts correctly. Green.

## WR-02 — quote-aware CSV splitter → FIXED
- `splitRow()` in `scripts/csv-import.ts` handles quoted commas and `""` escapes; unquoted path unchanged.
- Fixture gains a quoted row: import now `61 imported, 2 rejected` (same 2 bad rows). Green.

## WR-03 — buffer_days ambiguity → FIXED without breaking the freeze
- No schema/contract change (freeze holds). Rule now deterministic: new batches inherit the pair's live buffer via `pairBufferDays()`; `setBuffer()` changes it pair-wide (`scripts/entry.ts`). Self-test covers inherit-after-set. Green.
- Note for all tracks: engine reads "the buffer" as any live batch's `bufferDays` for the pair — they are now always consistent.

## WR-04 — seed data-loss guard → FIXED
- `scripts/seed.ts` refuses (exit 3) when non-seed rows exist unless `--force`; proven live: inserted `h-real`, seed refused, data intact (900/17/3), foreign row removed after.
- Seed-over-seed re-runs still pass (identical counts twice).

## WR-05 — tracer scoped assertions → FIXED
- All `tracer-check.ts` assertions scoped to `__tracer_h`; proven by running green on the fully seeded DB (previously would have failed spuriously), with cleanup verified.

## Verification (all green 2026-10-08)
- `npx tsc --noEmit` clean
- `entry.ts --self-test`: all assertions passed (incl. new WR-01/WR-03 cases)
- CSV fixture: 61/2 with reasons; re-import idempotent
- `tracer-check.ts`: all assertions passed on seeded DB
- `seed.ts` twice: identical counts; guard refusal proven with exit 3
- Final DB: 900 usage / 17 batches / 3 hospitals / 5 medicines; `.env` never staged

## Left for later (Info, out of scope)
- IN-01..IN-07 unchanged: `_role` enforcement (Phase 3), import-time env throw, stale neon-http comment, dead gitignore pattern, `Number()` strictness, future-date usage, seed-only admins. Fold into Phase 3 or a polish pass.
- Bonus (was Info, fixed opportunistically): batch ids now `randomUUID()` instead of `Date.now()` counter.
