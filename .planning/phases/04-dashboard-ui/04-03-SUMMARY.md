---
phase: 04-dashboard-ui
plan: "03"
subsystem: ui
tags: [nextjs, react, typescript, chat, mock-fixture, advisory, outbreak]

# Dependency graph
requires:
  - phase: 04-dashboard-ui plan 01
    provides: stable ChatPanelProps mount interface, base ForecastCard with MAPE/advisory fields, static fixture import pattern
  - phase: 04-dashboard-ui plan 02
    provides: drill-in open state (?hospital=id selection) the chat dock coordinates with, role-layer precedent
  - phase: 03-api-chat-access
    provides: 4 v1 chat intents, 1-2 sentence answer contract, exact-match validator spirit, single-shot matching rule
provides:
  - Right-docked quote-only chat (Chat + Prompt Bar primitives) with session-only history and collapse-to-button drill-in coordination
  - Canned four-intent mock answer engine with numeric quote post-check and safe fallback
  - Advisory grey-band + MAPE badge + red Outbreak chip + trend-mode note treatments on the forecast
affects: [phase 5 integration wiring, phase 3 chat API swap (Phase 3 owns exact rejection wording, matcher survives behind same interface)]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6461
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [fixed right-dock chat with display-none collapse (state survives without unmount), fixture-derived answer templates with runtime numeric post-check, envelope-flag-driven advisory/outbreak rendering]

key-files:
  created: [components/chat/PromptBar.tsx, components/chat/mock-answers.ts, components/OutbreakBanner.tsx]
  modified: [components/chat/ChatPanel.tsx, components/cards/ForecastCard.tsx, app/page.tsx]

key-decisions:
  - "Chat dock stays mounted and hides via display:none so scroll, draft, and history survive collapse without persistence APIs"
  - "Answers embed fixture-looked-up numbers (never literals) plus a runtime post-check, so fabrication is blocked by construction and by gate"
  - "Chat renders no Approve/Order affordances under any role, so D-26 holds trivially in v1 with no role prop needed"
  - "UI-01 and UI-02 flip Complete: 04-03 is the last declaring plan for both (shared-ID gate clears)"

patterns-established:
  - "Quote gate: JSON.stringify(fixture) numeric-token set vs answer scan with identical regex; mismatch renders SAFE_FALLBACK"
  - "Drill-in coordination via optional drillInOpen prop (defaults false, Plan 01 mount stays compatible); page passes selectedId !== null"

requirements-completed: [UI-01, UI-02]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Right-docked chat with Chat/Chips + Prompt Bar primitives, collapse-to-floating-button on drill-in open, session-only in-memory history"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "npm run build (pass) + persistence/XSS/hotlink grep gate (pass: SESSION-ONLY-OK/THREAT-GATES-OK)"
        status: pass
    human_judgment: true
    rationale: "Dock placement, collapse/restore interaction, and scroll/draft retention are visual/interactive; needs a human browser look"
  - id: D2
    description: "Canned four-intent mock Q&A (3 chips + composer stockout timing) with 1-2 sentence plain answers, numeric quote post-check, safe fallback"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "node quote-check harness (pass: 12 intent/fallback + 3 sentence-count + 4 no-source-tags checks, zero non-fixture numbers) + npm run build (pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Forecast greyed days 15-30 band with advisory tag, MAPE badge, actionable 1-14 window; red Outbreak chip + trend-mode note on flagged rows only"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "npm run build + npm run typecheck (pass) + advisory/MAPE/Outbreak grep (pass: 15 + 3 hits)"
        status: pass
    human_judgment: true
    rationale: "Grey-band contrast, badge/chip visual weight, and flagged-vs-clean row distinction need a human browser look"

# Metrics
duration: 6min
completed: 2026-10-08
status: complete
---

# Phase 04 Plan 03: Quote-only chat panel Summary

**Right-docked quote-only chat with canned four-intent mock answers under a numeric post-check, plus advisory-grey/MAPE and red-outbreak treatments on the forecast — no persistence, no fabrication, no panel collision**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-08T12:33:03Z
- **Completed:** 2026-10-08T12:39:12Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Chat dock with vendored Chat (message list + risk chips) and Prompt Bar composer primitives only — no streaming-text/sources, no hotlinked code, no storage or network calls; auto-collapses to a floating restore button when the drill-in opens, keeping scroll, draft, and history in memory
- Canned mock answer engine covering all four v1 intents (three risk chips resolve exactly, stockout timing via composer with cross-filter scoping): 1–2 sentence plain answers quoting exact fixture numbers with reason, numeric quote post-check, safe fallback sentence for anything unanswerable
- Forecast card extended with greyed days 15–30 band carrying the envelope advisory tag, MAPE badge beside the forecast, days 1–14 marked actionable; red Outbreak banner chip plus trend-mode note render only on outbreak-flagged rows
- Chat dock state coordinated with HospitalPanel open state via an optional `drillInOpen` prop (Plan 01 mount stays compatible) without touching sibling plan files

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat dock plus primitives plus session history** - `f6c2b24` (feat)
2. **Task 2: Canned mock Q&A plus risk chips plus safe fallback** - `8971479` (feat)
3. **Task 3: Advisory MAPE plus outbreak treatments** - `5956def` (feat)

**Plan metadata:** docs commit follows STATE/ROADMAP updates below

## Files Created/Modified

- `components/chat/PromptBar.tsx` - Adapted Prompt Bar composer primitive (input + Send, no sources/model-picker/dictation wiring) (created)
- `components/chat/mock-answers.ts` - RISK_CHIPS, SAFE_FALLBACK, four-intent single-shot matcher, fixture-token quote post-check (created)
- `components/chat/ChatPanel.tsx` - Right dock, collapse-to-FAB with drillInOpen auto-collapse, session-only history, chips, empty copy (modified Plan 01 shell, prop interface extended optionally)
- `components/OutbreakBanner.tsx` - Red Outbreak banner chip rendering envelope-flagged hospital identity (created)
- `components/cards/ForecastCard.tsx` - Greyed 15–30 advisory band, actionable 1–14 window, MAPE badge, outbreak chip + trend-mode note (modified Plan 01 card)
- `app/page.tsx` - Envelope outbreak flag threaded into forecast rows; `drillInOpen={selectedId !== null}` passed to chat (supporting edit beyond plan `<files>`, P1-owned)

## Decisions Made

- Dock stays mounted and hides with `display:none` instead of unmounting: scroll position, composer draft, and message history survive collapse with zero persistence APIs (simplest correct D-17/D-22 implementation)
- Answer templates interpolate fixture lookups rather than numeric literals, and every answer passes the runtime post-check — fabrication is blocked by construction (authoring) and by gate (runtime), satisfying T-4-11 twice over
- Chat never renders Approve/Order affordances under any role, so D-26 (hide move-approval actions under hospital_admin) holds trivially in v1 with no role prop or Phase 3 dependency
- 1–2 sentence contract enforced after first harness run showed 3-sentence risk/waste answers: risk answer folds flags into one second sentence, waste answer joins both expiries with "and" (re-verified, harness updated to ≤2)
- UI-01 and UI-02 flip to Complete: this plan is the last SUMMARY for both requirement IDs (shared-ID gate clears — 04-01/04-02/04-03 all landed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment literals tripped the plan's grep gates**
- **Found during:** Tasks 1 and 3 (threat-gate verification)
- **Issue:** Doc comments mentioning the forbidden terms failed the no-persistence/no-hotlink grep gates with no actual usage present (same precedent as 04-01 deviation 2, 04-02 deviation 1)
- **Fix:** Reworded the ChatPanel comment to avoid the literal while keeping the meaning
- **Files modified:** components/chat/ChatPanel.tsx
- **Verification:** SESSION-ONLY-OK / THREAT-GATES-OK gates pass
- **Committed in:** f6c2b24 (within task commit)

**2. [Rule 3 - Blocking] mock-answers.ts created one task early as a fallback stub**
- **Found during:** Task 1 (per-task build-green requirement)
- **Issue:** ChatPanel imports the answer engine; creating it only in Task 2 would leave the Task 1 commit unbuildable
- **Fix:** Task 1 created the module with chips/fallback/post-check plus a fallback-only matcher; Task 2 filled in the four-intent engine behind the same signature
- **Files modified:** components/chat/mock-answers.ts
- **Verification:** `npm run build` passes on both task commits
- **Committed in:** f6c2b24, 8971479

**3. Supporting edits beyond the plan's `<files>` list (informational)**
- `app/page.tsx` (outbreak flag threading + `drillInOpen` prop) — P1-owned, directly required by the Task 3 acceptance criterion "flagged hospitals show the red Outbreak chip" and the D-17 dock coordination truth. No scope creep.

---

**Total deviations:** 3 tracked (1 bug auto-fix, 1 blocking auto-fix, 1 informational)
**Impact on plan:** No scope creep; all changes serve the plan's must-haves and threat mitigations.

## Issues Encountered

- No `gsd_run` CLI in this environment, so STATE.md/ROADMAP.md/REQUIREMENTS.md updates are applied by direct file edit (same content the state verbs would write) — same as 04-01/04-02
- No E2E runner in the repo (adding one would trip the T-4-SC blocking checkpoint), so dock/collapse/chip/advisory/outbreak behavior is build- plus harness-verified only, flagged `human_judgment: true` for browser verification

## Known Stubs

- `app/page.tsx` empty state links to `/data-entry` (Phase 1 screens do not exist yet) — carried over from 04-01, resolves when Phase 1 lands
- `components/roles.tsx` stub role values until the Phase 3 server-side auth layer lands — carried over from 04-02; chat intentionally takes no role prop (D-26 holds trivially, see Decisions)
- D-23 fallback copy and exact-match post-check live in P1 `components/chat/` as the Phase 4 mock; the canonical rejection wording and `lib/chat/` validator land with Phase 3 and the final wiring in Phase 5

## Threat Flags

None — no new security surface beyond the plan's threat register. Chat answers render as escaped text (T-4-10, grep-verified); post-check blocks non-fixture numbers with fallback instead (T-4-11, harness-verified on 12 intent/fallback cases); advisory/MAPE/Outbreak render only from envelope flags with days 15–30 never actionable (T-4-12); matching is single-shot with history never passed in (T-4-13); zero new packages, zero hotlinked code (T-4-SC, package.json untouched); no P4-owned paths created or edited.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 complete (3/3 plans): dashboard tracer, drill-in panel, and quote-only chat all landed on the static fixture; UI-01 and UI-02 are Complete
- Ready for Phase 5 integration wiring (live ResultsJSON API replaces the static fixture import; Phase 3 chat API replaces the canned engine behind the same quote-only interface)
- Browser verification wanted: chat dock/collapse/chip flow, composer stockout scoping under cross-filter, advisory grey band and Outbreak chip visuals, `?hospital=id` interplay between drill-in and chat
- No blockers

## Self-Check: PASSED

- All 6 changed files verified present on disk (`components/chat/PromptBar.tsx`, `components/chat/mock-answers.ts`, `components/chat/ChatPanel.tsx`, `components/OutbreakBanner.tsx`, `components/cards/ForecastCard.tsx`, `app/page.tsx`)
- All 3 task commits (`f6c2b24`, `8971479`, `5956def`) verified in `git log`
- `npm run build` + `npm run typecheck` pass; session-only, XSS, no-hotlink gates pass; quote harness ALL-QUOTE-CHECKS-PASS (12 intent/fallback + 3 sentence-count + 4 no-source-tags)

---
*Phase: 04-dashboard-ui*
*Completed: 2026-10-08*
