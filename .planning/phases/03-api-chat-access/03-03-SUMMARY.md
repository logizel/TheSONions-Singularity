---
phase: 03-api-chat-access
plan: 03
subsystem: chat
tags: [chatbot, intent-matcher, templates, validator, quote-only]

# Dependency graph
requires: [03-01]
provides:
  - "lib/chat/intents.ts — all 4 intents with keyword scoring + entity extraction"
  - "lib/chat/templates.ts — all 4 templates quoting exact ResultsJSON numbers"
  - "lib/chat/validator.ts — exact-match validator covering dates, percentages, decimals, day-counts"
affects: [Phase 5 integration UAT]

actuals:
  tokens: 4200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: [keyword scoring with min confidence, exact-match number validator, quote-only templates]

key-files:
  created: []
  modified:
    - lib/chat/intents.ts
    - lib/chat/templates.ts
    - lib/chat/validator.ts

key-decisions:
  - "Intent matching is case-insensitive keyword scoring; unknown below MIN_CONFIDENCE=1"
  - "Hospital/medicine params extracted from the question only; templates fall back to first matching row"
  - "Template values interpolated verbatim from ResultsJSON — no arithmetic, rounding, or unit conversion"
  - "Validator extracts ISO dates, month-name dates, percentages, then bare numbers; all must appear verbatim in JSON.stringify(resultsJson)"

patterns-established:
  - "Chat failure modes (unknown intent, missing field, validator rejection) all return the fixed REJECTION_SENTENCE"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03]

plan_head_before: 1a36622
plan_head_after: 8e15253
commits: 3

duration: ~8min
completed: 2026-10-08
status: complete
---

# Phase 3: API, Chat & Access — Plan 03 Summary

**All 4 chat intents (most-at-risk, stockout-timing, waste-quantities, transfer-reasons), all 4 exact-quote templates, and a hardened exact-match number validator covering decimals, percentages, ISO and month-name dates, and day-counts.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments

- `matchIntent` now covers all 4 D-09 intents with case-insensitive keyword scoring, regex keywords (`when.*out`, `why.*transfer`), MIN_CONFIDENCE threshold returning `{intent: "unknown"}`, and hospital/medicine entity extraction into `params`.
- `fillTemplate` fills all 4 templates (most-at-risk, stockout-timing, waste-quantities, transfer-reasons) with exact ResultsJSON values via unknown-safe row scanning, and returns the fixed rejection sentence for missing fields or unknown intents.
- `validateAnswer` extracts ISO dates, month-name dates ("8 Oct 2026"), percentages ("15%"), decimals ("10.5"), and day-counts ("14 days"), requiring every token to appear verbatim in `JSON.stringify(resultsJson)` — no float comparison, pure function.
- `npm run build` exits 0 (only the pre-existing Turbopack file-trace warning); node smoke test passed 22/22 assertions across all intents, all templates, and validator accept/reject cases.

## Task Commits

1. **All 4 intents — keyword scoring matcher** — `3bfadd2` (feat)
2. **All templates — exact number quoting** — `d566325` (feat)
3. **Validator edge cases — decimals, percentages, dates** — `8e15253` (feat)

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

None.

## Known Stubs

- `lib/contracts.ts` (pre-existing, from 03-01) — minimal ResultsJSON stub; templates read fields via unknown-safe access so the Phase 1 frozen contract can drop in without consumer changes. Tracked in `.planning/WINDOWS.md`.

## Self-Check: PASSED
