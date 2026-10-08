---
phase: 04-dashboard-ui
plan: "05"
subsystem: ui
tags: [nextjs, react, typescript, chat, quote-gate, role-gating, mock-fixture]

# Dependency graph
requires:
  - phase: 04-dashboard-ui plan 03
    provides: canned four-intent mock answer engine with fixture-token quote post-check and safe fallback
  - phase: 04-dashboard-ui plan 02
    provides: HospitalPanel drill-in with inline role gate and shared isOwnHospital helper precedent
provides:
  - Hospital-scoped chat intents with per-answer quote allow-sets and same-hospital risk pairing
  - Fail-closed isOwnHospital on null owner, matched in the panel inline gate
affects: [phase 5 integration wiring, phase 3 chat API swap (Phase 3 owns exact rejection wording; per-answer gate shape survives behind the same checked() interface)]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3504
  tasks: 3
  commits: 3

# Measured commit ledger (#3968)
plan_head_before: 480523c
plan_head_after: 21e32a2
commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: [per-answer quote allow-set from cited rows with dosage/date stripping, same-hospital shortage pairing off the priority entry, fail-closed null-owner gating]

key-files:
  created: []
  modified: [components/chat/mock-answers.ts, components/roles.tsx, components/panel/HospitalPanel.tsx]

key-decisions:
  - "Scoped risk answers pair within the filtered hospital (its priority entry + its own worst shortage); a priority with no shortage row returns SAFE_FALLBACK rather than a cross-hospital join"
  - "Empty scoped waste/transfers slices degrade to the global answer; bogus filter ids validate to null and answer globally"
  - "Quote gate strips medicine-name dosage fragments and verifies ISO dates as whole cited strings, so dosage-coincident and date-swapped fabrications fail"
  - "Null owner fails closed everywhere; network_admin short-circuit and the page own-hospital stub verified untouched rather than edited"

patterns-established:
  - "Per-answer quote gate: citedAllowSet collects quantity numbers plus whole cited date strings off the exact cited rows; passesQuoteCheck(text, allowed) strips dates then dosage fragments before scanning; checked() stays the single enforcement point"
  - "Scoped chat prefix: 'At {hospital}, ' + lcfirst(body) for waste/transfers; risk and stockout-timing name the hospital in-body"

requirements-completed: [UI-01, UI-02]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Hospital-scoped chat intents with same-hospital risk pairing and per-answer quote gate"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "node ad-hoc harness (20 intent/scope cases + 5 adversarial gate cases, all pass) + npm run typecheck (pass) + npm run build (pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fail-closed move/order action visibility for null owner under hospital_admin"
    requirement: "UI-02"
    verification:
      - kind: other
        ref: "npm run typecheck (pass) + npm run build (pass) + grep gate (return false present)"
        status: pass
    human_judgment: true
    rationale: "Button visibility across role/owner combinations needs a human browser look (RoleSwitcher flip + null-owner panel render)"

# Metrics
duration: 8min
completed: 2026-10-08
status: complete
---

# Phase 04 Plan 05: Chat scoping plus fail-closed roles Summary

**Hospital-scoped four-intent chat with same-hospital risk pairing under a per-answer quote gate, plus null-owner-means-hidden role gating on panel and moves**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-08T14:04:59Z
- **Completed:** 2026-10-08T14:12:35Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- All four chat intents honor the `?hospital=` cross-filter: validated scope threads through `answerMostAtRisk`, `answerWaste`, `answerTransfers` (plus the already-scoped `answerStockoutTiming`), scoped waste/transfers answers carry an "At {hospital}," prefix, and every return path still passes `checked()` (G-04-3)
- Most-at-risk answers pair the worst shortage of the top-ranked priority hospital itself and quote that entry's own `reasons` vocabulary; the hardcoded flag clause is gone and a hospital with no shortage row yields `SAFE_FALLBACK` (G-04-4)
- Whole-fixture numeric token bag replaced by a per-answer allow-set from the exact cited rows; dosage fragments stripped from the scan, ISO dates verified as whole cited strings, `checked()` retained as the single enforcement point (G-04-5)
- `isOwnHospital` returns `false` on null owner and the `HospitalPanel` inline gate matches that fail-closed shape; `MovesCard.tsx` and `app/page.tsx` verified untouched (G-04-6)

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread hospital scope into all four chat intents** - `eaebbc5` (feat)
2. **Task 2: Same-hospital pairing plus per-answer quote gate** - `d94412d` (feat)
3. **Task 3: Fail-closed role gating on null owner** - `21e32a2` (fix)

**Plan metadata:** summary commit follows below

## Files Created/Modified

- `components/chat/mock-answers.ts` - scoped intents with hospital-name prefixes, same-hospital risk pairing over `top.hospitalId`, per-answer `citedAllowSet` quote gate with dosage/date handling (modified)
- `components/roles.tsx` - `isOwnHospital` returns `false` on null owner (modified)
- `components/panel/HospitalPanel.tsx` - inline gate is now `ownHospitalId !== null && ownHospitalId === hospitalId`, matching the shared helper (modified)

## Decisions Made

- Scoped risk path uses the filtered hospital's own priority entry (not rank 1) paired with its own worst shortage; no priority entry degrades to the global answer, priority-without-shortage returns `SAFE_FALLBACK` (h-city scoped risk hits this: rank-3 priority exists, no shortage row)
- Empty scoped waste/transfers slices (e.g. h-north expiries) degrade to the global answer per the plan's primary fallback; bogus filter ids validate to null via `knownHospitalId` and answer globally without ever trusting the raw param (T-4-16)
- Gate keeps advisory bounds (15/30) and reason-embedded numbers (e.g. "3 days to stockout") quotable by collecting them from cited fields, while dosage-shaped numbers are stripped from the scan entirely
- `MovesCard.tsx` and `app/page.tsx` left unedited as instructed: `canSeeMoveActions` short-circuits `true` for `network_admin` before consulting the owner (roles.tsx:49), and the page stub already passes an explicit own hospital on the hospital_admin path (`PROTOTYPE_OWN_HOSPITAL_ID`, page.tsx:104-105) — so network_admin views are unchanged and hospital_admin scoping flows through the fixed helper

## Gaps Closed

- **G-04-3** (chat intents 1-3 ignored the filter): all four intents now accept and honor `contextHospitalId`; scoped answers name the hospital; verified across 20 intent/scope harness cases (5 scopes x 4 intents + fallback/gibberish)
- **G-04-4** (cross-hospital pairing + hardcoded flags): `worstShortageFor(top.hospitalId)` pairs within one hospital; reasons quoted from the entry (e.g. h-river scoped risk now reads score 54 with "5 days to stockout, no substitute"); `high load and emergency share` clause removed from source
- **G-04-5** (polluted token-presence gate): `FIXTURE_NUMERIC_TOKENS` removed; adversarial harness confirms a dosage-coincident qty (500), a novel qty (999), and a swapped expiry date all fail while legitimate waste/risk answers pass
- **G-04-6** (`isOwnHospital(null, …)` failed open): null owner now hides move/order actions on panel and moves card under hospital_admin; network_admin unchanged via short-circuit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `/tmp` (tmpfs) reported 100% full so the scratch compile harness could not live there; ran it under `~/tmp-verify-0405` instead and removed the directory after verification. No repo impact.

## Known Stubs

None introduced by this plan. Pre-existing prototype stubs (roles stub values until Phase 3 auth, `/data-entry` empty-state link until Phase 1) are unchanged and remain tracked by their owning plans.

## Threat Flags

None — no new security surface beyond the plan's threat register. Changes implement the registered mitigations directly: T-4-16 (scope validated by `knownHospitalId`, scoped answers name the hospital, empty slices fall back instead of fabricating), T-4-17 (per-answer allow-set from cited rows, `checked()` single enforcement point, dosage/date fragments stripped), T-4-18 (null owner fails closed; display-only character unchanged). Zero new packages (T-4-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-04-3 through G-04-6 closed; G-04-1/G-04-2 were closed by Plan 04-04 in the same wave
- Remaining Phase 4 follow-ups per 04-VERIFICATION.md: browser human checks (cross-filter, drill-in, chat dock, role views) and the 11 low advisories L-01..L-11, explicitly out of scope here — 04-REVIEW-DISPOSITION.md untouched
- Ready for Phase 5 integration wiring (live ResultsJSON API replaces the static fixture; Phase 3 chat API replaces the canned engine behind the same quote-only interface)

## Self-Check: PASSED

- All 3 modified files verified present on disk (`components/chat/mock-answers.ts`, `components/roles.tsx`, `components/panel/HospitalPanel.tsx`)
- All 3 task commits verified in `git log` (`eaebbc5`, `d94412d`, `21e32a2`)
- `npm run typecheck` + `npm run build` pass; all six plan grep gates pass (contextHospitalId x16, top.hospitalId x1, fixture bag gone, allow/cited present, hardcoded clause gone, return false x1)

---
*Phase: 04-dashboard-ui*
*Completed: 2026-10-08*
