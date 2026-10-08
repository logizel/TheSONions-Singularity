---
phase: 01-data-layer-frozen-contracts
status: issues-found
depth: standard
files_reviewed: 18
critical: 0
warning: 5
info: 7
total: 12
reviewed_at: 2026-10-08
reviewer: inline (no gsd-code-reviewer agent in this runtime; standard-depth manual pass with file:line evidence)
---

# Code Review — Phase 1: Data Layer + Frozen Contracts

Scope: 18 files from the phase evaluation scope (degraded mode — full phase file set): `db/schema.ts`, `db/client.ts`, `db/migrations/0000_sour_maggott.sql`, `lib/contracts.ts`, `theme/tokens.ts`, `scripts/seed.ts`, `scripts/csv-import.ts`, `scripts/excel-export.ts`, `scripts/entry.ts`, `scripts/tracer-check.ts`, `scripts/fixtures/sample-60d.csv`, `drizzle.config.ts`, `tsconfig.json`, `package.json`, `.env.example`, `.gitignore`. Verified live against Neon where behavior was in doubt. `.env` (real credentials) confirmed never staged or committed.

## Warnings

### WR-01 — `archiveExpired` is dead code, so FIFO deducts expired stock (HIGH)
`scripts/entry.ts:102-112` defines `archiveExpired`, but nothing calls it — not the seed, not the self-test, not CSV import, not `adjustStockDown` (`scripts/entry.ts:74-99`). Meanwhile `adjustStockDown` filters only `archived = false` with no expiry check. Net effect: an expired-but-unarchived batch is treated as available and FIFO will deduct from it, and any Phase 2 engine query for "available stock" that mirrors this filter will count expired units. This silently violates the intent of D-04 (expired batches excluded from available stock).
**Fix:** call `archiveExpired()` at the top of `adjustStockDown`, or add an `expiryDate > today` predicate to the FIFO select. Either is a 3-line change; add a self-test case with an expired unarchived batch.

### WR-02 — CSV parser breaks on quoted commas (MEDIUM)
`scripts/csv-import.ts:46` splits rows with naive `raw.split(",")`. Any Excel-produced CSV containing a quoted comma (e.g. a hospital name like `"St Mary, North"`) parses into 7 columns and is rejected with a confusing "expected 6 columns" error — or worse, shifts fields if quotes balance out. Hospital admins will hand you Excel CSVs.
**Fix:** use a minimal quote-aware splitter (semicolon-safe state machine, ~15 lines) or add a small CSV dependency; add a quoted-comma row to `scripts/fixtures/sample-60d.csv`.

### WR-03 — `buffer_days` lives on the batch, D-06 says per hospital+medicine (MEDIUM)
`db/schema.ts:51` puts `bufferDays` on every `stock_batches` row, but D-06 locks it as an admin-editable per-hospital+medicine field feeding MOVE-01. When batches for the same pair disagree, the engine has no defined "the buffer" to read. `lib/contracts.ts:37` mirrors the misplacement, so it is now frozen in.
**Fix (needs all-track agreement — contract is frozen):** move to a `(hospital_id, medicine_id)`-keyed home (own table or a medicine-config table) and drop it from the batch row; or formally amend D-06 to "first-live-batch-wins" and document it in CONTEXT.md.

### WR-04 — `seed.ts` wipes all Phase-1 tables unconditionally (MEDIUM)
`scripts/seed.ts:63-69` deletes every row (including real admin-entered stock, usage, and users) with no confirmation, backup, or `--force` flag. Re-running the seed after go-live destroys production data.
**Fix:** refuse when non-`seed-` rows exist unless `--force` is passed; print what would be deleted first.

### WR-05 — `tracer-check.ts` asserts global counts, fails on any seeded DB (MEDIUM)
`scripts/tracer-check.ts:60` (`live.length === 2`) and `:78` (`leftovers.length === 0`) assume an empty database, but the script's own cleanup is scoped by hospital id while the assertions are global. Run it after seeding and it fails spuriously — the exact class of bug the entry self-test already hit and had to be fixed for.
**Fix:** scope all assertions to `__tracer_h` rows (as the cleanup already does), or document "run only on an empty DB" and exit early with that message when other rows exist.

## Info

### IN-01 — `_role` accepted but never enforced (`scripts/entry.ts:115,129`)
Documented Phase 3 deferral (D-24); harmless while only scripts call these helpers, but any Phase 4 page calling them inherits the hole silently. Ensure P4 middleware does not trust the flag.

### IN-02 — `neon()` throws at import time without `DATABASE_URL` (`db/client.ts:9`)
Fail-fast is acceptable for scripts, but every future test/import of `db/*` needs env present. Consider lazy init if Phase 2 unit tests import schema-adjacent helpers.

### IN-03 — Stale "cached across invocations" comment (`db/client.ts:6-8`)
`neon-http` is stateless per query; there is no pooled connection to cache. Comment misdescribes the driver — harmless, fix the wording.

### IN-04 — Dead `.gitignore` pattern (`drizzle/*.sql`)
Migrations live in `db/migrations/`, so the pattern matches nothing. Harmless; point it at `db/migrations/*.sql` only if generated SQL should be untracked (it is currently committed — keep it that way).

### IN-05 — `Number()` accepts hex/scientific ints (`scripts/csv-import.ts:67,74,79`)
`Number("0x10")` and `Number("1e3")` pass the integer checks. Admins will not do this, but `/^\d+$/` (plus empty-check for `used_qty`) is stricter for free.

### IN-06 — `recordUsage` accepts future dates (`scripts/entry.ts:54-71`)
Nothing rejects `usageDate` after today; the Phase 2 forecast baseline could ingest future "history". Consider a `<= today` check or leave to engine validation — decide in Phase 2.

### IN-07 — No admin/user management path
Admins exist only via seed (`scripts/seed.ts:50-53`); no entry helper creates users. Fine for Phase 1 (auth is Phase 3), but Phase 3 must not assume a user-provisioning flow exists.

## Verified clean (no finding)
- `.env` with the real `DATABASE_URL` never staged/committed (checked `git status` at every commit); `.env.example` is placeholder-only.
- Migration SQL matches `db/schema.ts` CHECKs/PKs/FKs one-for-one; `tsc --noEmit` clean.
- CSV: BOM strip, blank-line skip, empty-`used_qty`→NULL, duplicate-overwrite, per-row errors with line numbers — all as specified; fixture proves 60/2 split and idempotent re-import.
- Excel: 6 sheets, counts match DB; no risk/moves columns (scope fence holds).
- Contract freeze honored: schema changes would require migration + all-track agreement; nothing in Wave 2 touched `lib/contracts.ts`.
- `substituteIds` array default `'{}'`, user role CHECK, self-pair transport rule, 0–30/0–100 ranges — all present in both schema and helpers.

## Suggested fix order
WR-01 (correctness) → WR-04 (data-loss guard) → WR-02 (real-world CSVs) → WR-05 (test reliability) → WR-03 (contract amendment with all tracks).
