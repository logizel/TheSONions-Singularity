---
phase: 04-dashboard-ui
plan: "01"
subsystem: ui
tags: [nextjs, react, typescript, dashboard, mock-fixture]

# Dependency graph
requires:
  - phase: 01-data-layer-frozen-contracts
    provides: seed network scale (~3 hospitals x 5 medicines), buffer/substitute/transport/lead fields, theme-tokens stub handoff
  - phase: 03-api-chat-access
    provides: ResultsJSON envelope shape (generatedAt, MAPE, advisory, outbreak) consumed by the mock fixture
provides:
  - Runnable one-screen dashboard (6-card grid) rendering real mock numbers from a P1-owned static fixture
  - Finalized P1 theme tokens bound to all cards
  - Stable HospitalPanel and ChatPanel mount interfaces for Plans 02/03
affects: [04-dashboard-ui plan 02 drill-in, 04-dashboard-ui plan 03 chat, phase 5 integration wiring]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 23484
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: [next 16.4.0, react 19, react-dom 19, typescript 5.9]
  patterns: [static JSON fixture import per page load, URL-as-source-of-truth cross-filter, inline styles bound to theme tokens, inline SVG sparklines]

key-files:
  created: [app/page.tsx, app/layout.tsx, app/globals.css, app/data/mock-results.json, app/data/results.ts, theme/tokens.ts, components/Header.tsx, components/cards/DashboardGrid.tsx, components/cards/DashboardGrid.module.css, components/cards/ui.tsx, components/cards/InventoryCard.tsx, components/cards/ForecastCard.tsx, components/cards/ShortageCard.tsx, components/cards/ExpiryCard.tsx, components/cards/MovesCard.tsx, components/cards/PrioritiesCard.tsx, components/panel/HospitalPanel.tsx, components/chat/ChatPanel.tsx]
  modified: [package.json, tsconfig.json, next.config.mjs]

key-decisions:
  - "Next.js 16 + React 19 via static JSON import: one in-memory fixture load per page load, manual window.location.reload() Refresh, no polling"
  - "URL (?hospital=id) is the selection source of truth via useSearchParams + router.push/replace, so refresh, back/forward and shared links restore context"
  - "Inline styles bound to theme/tokens.ts (plus one CSS module for the 1280px media query, impossible inline); no UI library added"
  - "Committed on main: branching_strategy is none and dispatch was sequential-on-main; no worktree/agent-branch flow in this repo"

patterns-established:
  - "Card contract: page owns the fixture, cards receive filtered slices + onSelectHospital, never fetch"
  - "Threat gates per plan: fixture-shape node check, dangerouslySetInnerHTML grep gate, no-fetch/no-poll grep gate"

requirements-completed: [UI-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "App shell + P1 theme tokens + mock ResultsJSON fixture (3 hospitals x 5 medicines, envelope with generatedAt/MAPE/advisory/outbreak)"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "npm run build (pass) + node fixture-shape check (pass: hospitals=3, medicines=5, mape=6.2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Six-card grid (inventory, forecast, shortage, expiry, moves, priorities) with red/amber badges, sparklines, ranked reasons, action rows"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "npm run build + npm run typecheck (pass) + card-file existence check (pass)"
        status: pass
    human_judgment: true
    rationale: "Visual adequacy of the equal 6-card grid at 1280px+ and stacked layout below needs a human browser look; no screenshots captured"
  - id: D3
    description: "Hospital cross-filter with ?hospital=id deep link (click, refresh, back button, shared URL, invalid-id fallback)"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "node cross-filter logic check (pass: validation semantics + every card slice hospital-scoped)"
        status: pass
    human_judgment: true
    rationale: "Click/back-button/shared-link behavior is client navigation; no E2E runner in repo (NO-E2E-RUNNER), needs browser verification"
  - id: D4
    description: "Header timestamp + Refresh, skeleton cards, guided empty state linking to data entry"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "npm run build (pass)"
        status: pass
    human_judgment: true
    rationale: "Loading shimmer, timestamp wording and empty-state copy are visual; needs a human browser look"
  - id: D5
    description: "Stable HospitalPanel and ChatPanel shells with prop interfaces for Plans 02/03"
    requirement: "UI-01"
    verification:
      - kind: other
        ref: "npm run build (pass — module paths resolve, imports typecheck)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-10-08
status: complete
---

# Phase 04 Plan 01: Dashboard tracer Summary

**One-screen Next.js dashboard rendering six fixture-backed cards with header timestamp, manual Refresh, skeleton/empty states, URL-synced hospital cross-filter, and stable drill-in/chat shells**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-08T12:01:46Z
- **Completed:** 2026-10-08T12:16:31Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- Next.js 16 + TypeScript app shell with P1-finalized theme tokens (colors, red/amber risk badges, spacing, surfaces) and a 3-hospital x 5-medicine mock ResultsJSON fixture with generatedAt/MAPE/advisory/outbreak envelope
- Full six-card grid (inventory, forecast, shortage, expiry, moves, priorities) from one static fixture load: badges + SVG sparklines, MAPE badge, ranked 1..N priorities with reason chips, transfer action rows plus emergency order rows
- Cross-filter + `?hospital=id` deep link: click any hospital to refilter all cards, toggle/clear control, refresh/back/share restore context, unknown ids fall back to unfiltered with the param dropped
- Header "Updated X min ago" + manual Refresh (no polling), skeleton cards while mounting, guided empty state linking to data entry; HospitalPanel/ChatPanel shells mount behind stable props for Plans 02/03

## Task Commits

Each task was committed atomically:

1. **Task 1: Tracer shell + theme + fixture + inventory + header** - `aaa1f06` (feat)
2. **Task 2: Remaining five cards + skeleton and empty states** - `273ecbc` (feat)
3. **Task 3: Cross-filter + hospital deep link** - `ec68a9d` (feat)

**Plan metadata:** docs commit follows STATE/ROADMAP updates below

## Files Created/Modified

- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore` - Next.js 16 + React 19 + TS scaffolding (tsconfig auto-adjusted by Next on first build: jsx react-jsx)
- `app/layout.tsx`, `app/globals.css` - App shell and document styles
- `app/page.tsx` - Dashboard: static fixture load, URL-synced filter state, card grid, panel/chat mounts
- `app/data/mock-results.json` - Mock ResultsJSON fixture (envelope + 3 hospitals + 5 medicines + inventory/forecast/shortages/expiries/moves/orders/priorities)
- `app/data/results.ts` - Fixture types + `isKnownHospitalId` deep-link validator (T-4-01)
- `theme/tokens.ts` - Finalized P1 theme tokens + `riskForDaysToStockout` badge mapping
- `components/Header.tsx` - Header with envelope-driven timestamp + manual Refresh (D-24, D-27)
- `components/cards/DashboardGrid.tsx` + `.module.css` - Equal 6-card grid (3 cols at 1280px+, stack below)
- `components/cards/ui.tsx` - Shared Card/Badge/Sparkline/SkeletonCard primitives
- `components/cards/InventoryCard.tsx`, `ForecastCard.tsx`, `ShortageCard.tsx`, `ExpiryCard.tsx`, `MovesCard.tsx`, `PrioritiesCard.tsx` - The six cards
- `components/panel/HospitalPanel.tsx` - Stable shell + `HospitalPanelProps` (Plan 02 implements behind it)
- `components/chat/ChatPanel.tsx` - Stable shell + `ChatPanelProps` (Plan 03 implements behind it)

## Decisions Made

- Next.js 16.4.0 + React 19 installed from the public registry (standard framework packages required by the plan; no [ASSUMED]/[SUS] package added, so no T-4-SC checkpoint tripped)
- No UI/chart library: badges and SVG sparklines hand-built on tokens, keeping the bundle dependency-free and the grep gates trivially satisfiable
- Page-level toggle + `scroll: false` on filter navigation so refiltering never yanks the one-screen scroll position
- UI-01 left Pending in REQUIREMENTS.md: the shared-ID gate applies (sibling plans 04-02/04-03 have no SUMMARY yet), so this plan does not flip it Complete alone
- Committed on `main`: repo `branching_strategy` is `none` and the dispatch ordered sequential execution on the main tree with normal commits, so the generic protected-branch guard was overridden by explicit instruction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js rewrote tsconfig.json on first build**
- **Found during:** Task 1 (tracer verify)
- **Issue:** `next build` mandatorily set `jsx: react-jsx` and extended `include`; build refused otherwise
- **Fix:** Accepted the framework-owned change and committed the resulting tsconfig.json
- **Files modified:** tsconfig.json
- **Verification:** `npm run build` + `npm run typecheck` pass
- **Committed in:** aaa1f06 (Task 1 commit)

**2. [Rule 1 - Bug] Code comment tripped the plan's XSS grep gate**
- **Found during:** Task 1 (threat-gate verification)
- **Issue:** A comment in `components/cards/ui.tsx` contained the literal string the plan forbids via `grep -rn "dangerouslySetInnerHTML"`, failing the gate with no actual usage present
- **Fix:** Reworded the comment to describe React default escaping without the literal
- **Files modified:** components/cards/ui.tsx
- **Verification:** XSS grep gate passes
- **Committed in:** aaa1f06 (Task 1 commit)

**3. Sequencing note (informational, not a rule fix): cross-filter URL sync landed in Task 1, hardened in Task 3**
- **Found during:** Task 1 tracer (InventoryCard needed a working selection to prove the click path end to end)
- **Issue:** Strictly, D-04/D-16 wiring belonged to Task 3; building selection without URL sync in the tracer would have been throwaway
- **Fix:** Implemented URL-as-source-of-truth selection in the tracer; Task 3 extended it to all six cards, verified logic per card slice, and added `scroll: false` hardening
- **Files modified:** app/page.tsx (Tasks 1-3)
- **Verification:** Cross-filter logic node check passes; `npm run build` passes
- **Committed in:** aaa1f06, 273ecbc, ec68a9d

**4. Supporting files beyond the plan's `<files>` list (informational)**
- `components/cards/ui.tsx` (shared Card/Badge/Sparkline/Skeleton primitives), `app/data/results.ts` (fixture types + id validator), `components/cards/DashboardGrid.module.css` (media query, impossible via inline styles), `.gitignore`, `package-lock.json` — all inside P1-owned dirs or root scaffolding, all directly required by task actions. No scope creep.

---

**Total deviations:** 4 tracked (1 blocking auto-fix, 1 bug auto-fix, 2 informational)
**Impact on plan:** No scope creep; all changes serve the plan's must-haves and threat mitigations.

## Issues Encountered

- No `gsd_run` CLI in this environment, so STATE.md/ROADMAP.md updates were applied by direct file edit (same content the state verbs would write)
- No E2E runner in the repo (no playwright config, and adding a test framework package would trip the T-4-SC blocking checkpoint), so cross-filter click/back-button behavior is logic-verified only and flagged `human_judgment: true` for browser verification

## Known Stubs

- `app/page.tsx` empty state links to `/data-entry` (Phase 1 data-entry screens do not exist yet; resolves when Phase 1 lands) — intentional per D-25 copy requirement
- `HospitalPanel` renders a "Plan 02" placeholder behind stable props — resolves in 04-02
- `ChatPanel` renders a "Plan 03" placeholder behind stable props — resolves in 04-03

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-02 (drill-in panel implements behind `HospitalPanelProps`) and 04-03 (chat implements behind `ChatPanelProps`, advisory grey + outbreak banner treatments)
- Browser verification wanted: six-card layout at 1280px+, cross-filter click/refresh/back/shared-link, skeleton flash, timestamp wording
- No blockers

## Self-Check: PASSED

- All 18 created files verified present on disk
- All 3 task commits (`aaa1f06`, `273ecbc`, `ec68a9d`) verified in `git log`
- `npm run build` + `npm run typecheck` pass; fixture-shape, XSS-grep, and no-fetch gates pass

---
*Phase: 04-dashboard-ui*
*Completed: 2026-10-08*
