# 01-02 SUMMARY: Seed + CSV + Excel

**Status:** Complete (3/3 tasks, all verifications green)
**Commits:** `cfdab3e` seed, `71950c9` csv+fixture, `f20aef6` excel

## What was built
- `scripts/seed.ts`: 3 hospitals, 5-medicine coded master (para/ibu substitutes linked, amox/ors/ins), 2 users, 17 batches (one near-expiry 2026-10-25, one archived 2026-09-01), 900 daily_usage rows with weekday pattern + 45 NULL gaps, 9 transport legs, 15 leads. Deterministic (seeded PRNG); two runs print identical counts.
- `scripts/csv-import.ts`: long rows, full pre-write validation (ISO date, coded-master IDs, ranges), per-row errors with line numbers, duplicate-key overwrite. Fixture `scripts/fixtures/sample-60d.csv` (60 good + 2 bad rows): `imported 60, rejected 2` with reasons; re-import idempotent.
- `scripts/excel-export.ts`: 6 sheets (hospitals, medicines, stock_batches, daily_usage, transport_days, supplier_leads), self-verified row counts match DB (3/5/17/900/9/15). No risk/moves columns.

## Verification
- `npx tsc --noEmit` clean; seed twice identical; CSV fixture exact 2 rejections; export counts match

## Notes / deviations
- Used `xlsx` (^0.18.5) instead of exceljs — exceljs tarball unreachable on this network. Acceptance criteria unchanged (sheet names + counts). Swap back later if the team prefers exceljs; interface (CLI arg path) is stable.
- Schema and contracts untouched (frozen in 01-01).
