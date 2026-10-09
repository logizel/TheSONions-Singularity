---
phase: quick-261009-dqq
plan: 01
subsystem: ui
tags: [nextjs-16, react-19, inventory, admin-panel, vitest, drizzle, role-scoping]

requires:
  - phase: 01-foundation
    provides: scripts/entry.ts write helpers (addBatch / adjustStockDown / recordUsage) and the lib/logs activity log
  - phase: 03-api-auth
    provides: session cookie + role scoping, lib/network results cache, logActivity
  - phase: 04-dashboard-ui
    provides: DashboardCtx, URL-driven sheet modes (?logs / ?events), SheetHeader, events sheet pattern
provides:
  - Role-scoped manual stock entry sheet (add batch with mandatory expiry, remove damaged FIFO, record usage with blank-qty missing day)
  - lib/stock/form.ts buildStockBody + lib/stock/form.test.ts covering the request-body contract
  - Finished POST /api/inventory with display-name log summaries and the D-18 blank-used-qty rule
  - openStock(hospitalId?) on DashboardCtx, ?stock=1 sheet mode, top-bar and drill-in entry points
  - stock_added / stock_removed / usage_recorded log actions with tone labels
affects: [dashboard-ui, inventory-writes, activity-log]

actuals:
  tokens: 8231
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - Sheet pattern mirror of components/events/EventsSheet (SheetHeader + grid form + data-testids + inline role="alert")
    - Pure request-body builder in lib/** with vitest coverage; the route stays a thin auth + validation shell
    - URL (?stock=1) as the cross-sheet source of truth, precedence after events and before hospital

key-files:
  created:
    - lib/stock/form.ts
    - lib/stock/form.test.ts
    - components/stock/StockSheet.tsx
    - components/stock/stock.module.css
  modified:
    - app/api/inventory/route.ts
    - components/logs/LogList.tsx
    - components/dashboard/context.tsx
    - components/dashboard/Dashboard.tsx
    - components/dashboard/TopBar.tsx
    - components/dashboard/HospitalDetail.tsx
    - components/dashboard/useUrlState.ts
    - lib/logs/types.ts
    - .gitignore

key-decisions:
  - "Blank used qty maps to null (D-18 missing day) in both the body builder and the route, so a skipped day is stored rather than rejected"
  - "Client-supplied hospital/medicine display names are capped at 120 chars with an id fallback and are used only in the log summary; ids remain the only write values"
  - "A hospital admin's hospital select is rendered disabled with a single own-hospital option: the UI affordance enforces scope and the route's 403 is the backstop"
  - "On a successful write only the value fields reset (qty / usedQty / patientLoad / emergencyPct); action, hospital, medicine and both dates stay for repeat entries"
  - "The sheet precedence sits after events and before hospital, so opening it from a drill-in and closing it returns to that drill-in (?hospital kept)"

patterns-established:
  - "Stock entry sheet: STOCK_ACTIONS toggle row + per-action fields, current-stock line from results.inventory"
  - "New log actions must be added to LogList's Record<LogAction, TagTone> map in the same change as lib/logs/types.ts"

requirements-completed: [DATA-01, DATA-02]

coverage:
  - id: D1
    description: "LogList tone map covers stock_added / stock_removed / usage_recorded, so the tree typechecks"
    requirement: DATA-01
    verification:
      - kind: automated
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildStockBody produces the add/remove/usage body shapes, blanks used qty -> null, throws on an unknown action"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "lib/stock/form.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /api/inventory: 401 without a session, 403 for a foreign hospital, 400 on a non-numeric usedQty and on an unknown action"
    requirement: DATA-01
    verification:
      - kind: integration
        ref: "curl against a local next start on :3100 with minted hospital_admin / network_admin cookies"
        status: pass
    human_judgment: false
  - id: D4
    description: "The three-action sheet with role-scoped hospital field, current-stock line, action toggles and per-action required fields"
    requirement: DATA-02
    verification:
      - kind: automated_ui
        ref: "playwright against :3100 (network admin + hospital admin of h-civil)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sheet opens from the top-bar button, from the XS menu and from the drill-in (pre-selected hospital), and closes on Escape and the close button"
    requirement: DATA-01
    verification:
      - kind: automated_ui
        ref: "playwright against :3100 (click + Escape + deep link ?stock=1&hospital=h-civil)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A successful write resets the value fields, shows the confirmation sentence and refreshes the dashboard numbers, and the write appears in the activity log under the hospital"
    requirement: DATA-01
    verification: []
    human_judgment: true
    rationale: "A live write would insert rows into the shared dev database (stock batches / daily usage upsert and an activity-log row), which was out of scope for an automated run; the read-only paths (401/403/400) were exercised instead."

duration: 55min
completed: 2026-10-09
status: complete
plan_head_before: ca17f0a
plan_head_after: 1165a9e
---

# Quick 261009-dqq: manual stock entry panel for hospital admins — Summary

**Role-scoped stock entry sheet (add a batch with a mandatory expiry, remove damaged units FIFO, record the day's usage with a blank-qty missing day) on the frozen `POST /api/inventory` write path, opened from the dashboard top bar and pre-selected from a hospital drill-in**

## Performance

- **Duration:** ~55 min (10:11 → 11:06 local)
- **Tasks:** 3/3
- **Files modified:** 13 (641 insertions, 8 deletions)

## Accomplishments

- Unbroke the tree: `LogList.tsx`'s `Record<LogAction, TagTone>` map now carries `stock_added` (accent), `stock_removed` (dashed) and `usage_recorded` (outline); `npm run typecheck` went from red to green in Task 1.
- `lib/stock/form.ts` + `lib/stock/form.test.ts`: one pure `buildStockBody` that owns the add/remove/usage body shapes, number coercion, `usedQty: null` for a blank field (D-18) and the `unknown stock action` throw — 6 vitest tests, RED before the implementation existed.
- Finished `POST /api/inventory`: display-name log summaries (`Added 20 units of Paracetamol at City Civil Hospital, expiry 2027-01-31`), names capped at 120 chars with an id fallback, and the missing-day rule duplicated in the usage branch so a non-numeric `usedQty` still 400s.
- `components/stock/StockSheet.tsx` + `stock.module.css`: three action toggle, role-scoped hospital field (disabled single option for a hospital admin, full select for the network admin), current-stock line from `results.inventory`, inline `role="alert"` error and `role="status"` confirmation.
- Entry points wired through `DashboardCtx.openStock(hospitalId?)` and `?stock=1` — top-bar button + XS menu item for both roles, and a drill-in "Enter stock" button rendered only when the viewer may write to that hospital, pre-selecting it.
- Suite (228 tests), typecheck and `next build` all green; the threat-model mitigations T-dqq-01..05 are present (session re-check 401, 403 scope, entry.ts validation + DB CHECKs, capped display names, best-effort `logActivity` after `resetResultsCache`).

## Task Commits

1. **Task 1: Unbreak the build — add the three stock actions to the LogList tone map** - `a31f16f` (fix)
2. **Task 2: Shared request-body contract with tests, and the route that consumes it** - `175d1bd` (feat) — TDD: `lib/stock/form.test.ts` written first and run RED (module missing) before `lib/stock/form.ts`
3. **Task 3: Stock entry sheet plus top-bar and drill-in entry points** - `acbb3b0` (feat) — also lands the earlier pass's `?stock` param and the three log actions
4. **Chore: ignore playwright-mcp verification artifacts** - `1165a9e` (chore)

**Plan metadata:** not committed here — the orchestrator owns the docs commit (SUMMARY/PLAN/CONTEXT), per the quick-task contract.

## Files Created/Modified

- `components/logs/LogList.tsx` — TONE entries for the three stock log actions
- `lib/stock/form.ts` — `STOCK_ACTIONS`, `StockForm`, `StockDisplayNames`, `buildStockBody` (pure)
- `lib/stock/form.test.ts` — vitest coverage of the body contract (add/remove/usage, blank used qty, unknown action)
- `app/api/inventory/route.ts` — `hospitalName` / `medicineName` in Body, `nameOrId`, display-name summaries, D-18 missing-day rule, header comment
- `components/stock/StockSheet.tsx` — the three-action sheet, role-scoped, `POST /api/inventory`
- `components/stock/stock.module.css` — events-form grid + `.toggle` for the action row
- `components/dashboard/context.tsx` — `openStock(hospitalId?)` on `DashboardCtx`
- `components/dashboard/Dashboard.tsx` — `stockOpen`, `"stock"` mode (after events, before hospital), `closeDetail`, sheet handle label, TopBar props, `StockSheet` render
- `components/dashboard/TopBar.tsx` — `onStock` / `stockOpen` props, top-bar button and XS menu item
- `components/dashboard/HospitalDetail.tsx` — `hospital-enter-stock` button inside the write-permission block
- `components/dashboard/useUrlState.ts` — `?stock` param (partial work from the earlier pass, finished here)
- `lib/logs/types.ts` — the three stock actions and labels (partial work, finished here)
- `.gitignore` — `.playwright-mcp/` (browser verification output)

## Decisions Made

- The blank-used-qty rule lives in two places on purpose: `buildStockBody` (tested) and the route (trust boundary). The unit test pins the builder; the route's ternary is the backstop for any other caller.
- Display names are trimmed and capped at 120 characters with the id as fallback, so a hostile or absurd client string cannot bloat a log row and the summary always names the pair.
- The hospital field for a hospital admin is a **disabled** select rather than static text, so the disabled control announces the locked hospital and the server 403 remains the enforcement.
- Only value fields reset after a write — the pair and both dates persist so an admin recording a morning of usage for the same medicine does not re-pick everything.
- The sheet placeholder is the earlier pass's `?stock` param, positioned after `events` and before `hospital` in the precedence chain so opening it from a drill-in and closing it returns to that drill-in.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.playwright-mcp/` verification artifacts were untracked in the repo root**
- **Found during:** Task 3 verification (browser checks against a local server on :3100)
- **Issue:** the Playwright MCP server writes page snapshots and console logs into `.playwright-mcp/` in the working directory, leaving generated output untracked in the repo.
- **Fix:** removed the generated directory and added `.playwright-mcp/` to `.gitignore`.
- **Files modified:** `.gitignore` (committed as `1165a9e`, separate chore commit)

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Repo hygiene only; no functional scope change. All other task instructions were followed as written.

### Verification not run (recorded, not a code deviation)

- The plan's browser items (b)/(c)/(f) — a successful write resetting the form, showing the confirmation and refreshing the dashboard, plus the activity-log row — were **not executed live**, because a real write inserts rows into the shared dev database (a stock batch, a `daily_usage` upsert and an activity-log row). Everything up to the write was exercised in the browser instead (see below), and the write contract itself was proved by the unit tests and by the read-only curl cases.

## Issues Encountered

- **The user's dev server on :3000 served a page with no working client-side React.** Clicks on the new "Enter stock" button, the action toggles, Escape and *pre-existing* controls (Logs, panel tabs) all did nothing, and the HMR websocket was failing (`ERR_INVALID_HTTP_RESPONSE`). Verified the sheet renders through a `?stock=1` deep link on that server and then re-ran the interactive checks against a fresh `next start` on :3100, where every interaction behaved correctly — so this is a stale/broken dev-server state for the user to refresh, not a code defect.
- **Browser cookies ignore ports**, so the demo session cookie from :3000 also applied to :3100; the role switch was done through the TopBar demo role switcher instead of the sign-in form.

## User Setup Required

None - no external service configuration required. Manual browser verification needs `DEMO_AUTH=true` (already set in `.env`) and the TopBar demo role switcher.

## Verification Evidence

| Check | Command / method | Result |
|-------|------------------|--------|
| Typecheck (Task 1 turns it green) | `npm run typecheck` | pass |
| Unit: body contract | `npx vitest run lib/stock` | pass (6 tests) |
| Full suite | `npm test` | pass (228 tests, 24 files) |
| Production build | `npm run build` | pass (`/api/inventory` route registered) |
| Route: no session | `POST /api/inventory` without a cookie | 401 `{"error":"Unauthorized"}` |
| Route: foreign hospital | hospital_admin cookie, `hospitalId: "h-north"` | 403 `You can only enter stock for your own hospital` |
| Route: non-numeric usedQty | hospital_admin cookie, `usedQty: "abc"` | 400 `bad usedQty "NaN" (integer 0-1000000000)` |
| Route: unknown action | network_admin cookie, `action: "transfer"` | 400 `action must be "add", "remove" or "usage"` |
| Sheet (network admin) | `?stock=1` on :3100 | hospital select enabled with all 13 hospitals, pre-selected from `?hospital`; 5 medicines; current-stock line `679 capsules on file · 42 d cover · nearest expiry 30 Jun 2027`; submit "Add stock" with required qty + expiry |
| Action toggles | click on :3100 | usage → usage-date / patient-load / used-qty / emergency-pct + "Record usage"; remove → qty only + "Remove units"; `aria-pressed` follows |
| Sheet (hospital admin, h-civil) | role switch + `?stock=1` on :3100 | hospital select disabled with the single option `h-civil|City Civil Hospital`; medicine list still the network's 5 |
| Drill-in entry | `?hospital=h-civil` as its own admin | `hospital-enter-stock` rendered; click opens `?hospital=h-civil&stock=1` with the sheet pre-selected; close returns to the drill-in |
| Foreign drill-in | `?hospital=h-north` as h-civil admin | no `hospital-enter-stock`, read-only note shown |
| Close paths | close button, Escape | both close the sheet, top-bar `aria-pressed` back to false, focus returns to the invoker |

## Next Phase Readiness

- DATA-01 and DATA-02 now have a UI on the frozen `scripts/entry.ts` path; `lib/contracts.ts`, `db/schema.ts`, `lib/engine/**` and `middleware.ts` are untouched and no packages were added.
- Nothing blocks the next quick task or Phase 05. The one open item is the human sign-off on the successful-write path (confirmation + refresh + activity-log row), listed above.
- Housekeeping for the user: the dev server on :3000 needs a restart — its client bundle is stale, so no client-side interaction works there until it recompiles.

## Self-Check

- PASSED — files exist: `lib/stock/form.ts`, `lib/stock/form.test.ts`, `components/stock/StockSheet.tsx`, `components/stock/stock.module.css`, `app/api/inventory/route.ts`
- PASSED — commits exist: `a31f16f`, `175d1bd`, `acbb3b0`, `1165a9e` (all on `main`, base `ca17f0a`, 4 commits, 13 files, no deletions)
