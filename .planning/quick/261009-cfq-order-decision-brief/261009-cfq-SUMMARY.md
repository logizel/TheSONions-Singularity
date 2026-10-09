---
phase: quick-261009-cfq
plan: 01
status: complete
subsystem: orders-ui
tags: [orders, checkout, tracking, decision-brief, insights-chart]
requires: [ResultsJSON v2, lib/insights/view runDown, components/insights/charts DemandChart]
provides: [lib/orders/brief.ts buildDecisionBrief, components/orders/DecisionBrief.tsx DecisionBriefBlock]
affects: [components/orders/Cart.tsx, components/orders/Tracking.tsx, components/insights/charts.tsx, components/orders/OrderBits.tsx]
key-files:
  created:
    - lib/orders/brief.ts
    - lib/orders/brief.test.ts
    - components/orders/DecisionBrief.tsx
  modified:
    - lib/insights/view.ts
    - components/insights/charts.tsx
    - components/orders/OrderBits.tsx
    - components/orders/Cart.tsx
    - components/orders/Tracking.tsx
    - components/orders/orders.module.css
decisions:
  - "with.day is anchored to the engine's daysUntilStockout (without.day + (zWith - zNo)), so derived and engine day counts stay consistent"
  - "Brief grid uses repeat(auto-fit, minmax(220px, 1fr)): Receiver | Sender stacks to one column in the narrow sheet, with no media query"
  - "Browser check for supplier rows ran against a second next start (:3101) with DATABASE_URL pointed at an unreachable host, so it served the data/results.json snapshot. The live DB currently has 0 supplier orders"
metrics:
  completed: 2026-10-09
  commits: [2f47464, 69a5913, e43f957]
---

# Quick 261009-cfq: Order decision brief

Every approval screen now has a collapsible "Decision brief" that starts open. It appears on checkout transfer lines, supplier order rows and each line of the tracking sheet. The brief shows the receiver's situation and, for transfers, the sender's. It also shows the stock-out date without the order and the date with the order once it arrives (after transportDays or leadDays), and a 7-day + 30-day demand chart linking to /insights/<receiver>. All of it is derived purely from ResultsJSON.

## What was built

- **`runDown` arrival** (lib/insights/view.ts): new optional 4th argument `{ day, qty }`. The units are available at the start of that day, and the series runs through the zero stretch before arrival. Calls without the argument behave exactly as before, and all insights tests still pass.
- **`lib/orders/brief.ts`**: pure `buildDecisionBrief(results, input)` plus `BRIEF_HORIZON_DAYS = 90`.
  - Receiver: engine values verbatim, with needDays = lead + buffer, priority `{rank, score, reasons, of}`, event reasons, outbreak, the 7-day trend dated back from historyWindow.to, and the forecast.
  - Sender: stock now (engine), plus derived values for stock after, cover days after and waste after. Waste units and earliest expiry come from wasteWarnings.
  - without/with: `without` is the engine's day verbatim. `with` is anchored to the engine via runDown zero offsets, with `lastsPast` and `gapDays`.
- **`lib/orders/brief.test.ts`**: 14 vitest tests covering arrival run-down, the fixture transfer, the supplier order (no sender, gap > 0), sender waste via a cloned synthetic warning, and a missing pair.
- **`DecisionBriefBlock`** (components/orders/DecisionBrief.tsx):
  - Disclosure button, open by default, with aria-expanded/aria-controls.
  - Receiver and Sender `<dl>` columns. Severity shows RiskGlyph + riskLabel; priority reasons and event reasons are quoted verbatim.
  - The without/with line. Supplier orders say "supplier lead time". A critical gap note appears when there is a gap.
  - DemandChart with "Last 7 days", height 180, which keeps its DataTable fallback and sr-only sentence.
  - Insights link. Delivered orders show a caption in place of without/with and hide the "after" rows; a null receiver gets a caption.
- **Wiring:**
  - Cart transfer lines: the brief sits between the cells and the checks list, above Accept, and the checks list now opens by default.
  - Cart supplier rows: the brief appears after SupplierTimeline.
  - Tracking: a "Decision brief" subhead, then one brief per order line.
- **DemandChart:** new optional `pastLabel` (default "Last 60 days") and `height` (default 240) props. The hatch pattern id now comes from `useId`, so several charts on one page no longer share an id.

## Verification

- `npm test`: 24 files, 236 tests passed. The brief tests and the unchanged insights tests are included.
- `npm run typecheck` (non-incremental): clean.
- `npm run build`: compiled successfully.
- Playwright (`/usr/bin/chromium`, `next start`; scratchpad `verify-brief.mjs`): **101/101 checks passed**, exit 0.
  - (a) Live :3100, all 5 checkout transfer lines: each brief is open (aria-expanded=true) and the receiver and sender figures are present. The without/with line, chart svg and `/insights/...` link are present. The brief collapses and re-opens, the checks list is open by default, the brief sits above Accept, and no line overflows horizontally.
  - (b) Snapshot :3101, both supplier rows: the receiver is present, there is no sender, the line says "supplier lead time", and the gap note shows (e.g. "About 10 days with no stock before it arrives."). The fixture transfer shows "(day 10)".
  - (c) Read-only tracking of an existing delivered order (ord-396fbfc08005) shows the "Delivered. The figures above already include these units." caption and hides the sender "after" rows. Then the script accepted one live transfer, opened Track (all brief checks passed) and cancelled the order through the UI.
  - (d) No pageerrors and no console errors, and no 5xx on the live instance. One 503 on the snapshot instance (`/api/route`) was expected, because its DB was deliberately unreachable.
- Screenshots were reviewed: the checkout, supplier row and delivered tracking views are readable, and Receiver | Sender stacks in the ~440px sheet.

## Deviations from Plan

1. **[Rule 1 - Bug] The chart widened checkout lines.** useWidth starts at 640px, and inside the `.line` grid (auto track) that width stuck and pushed the sender column and road cell off-screen. Fixed by adding `min-width: 0` to `.brief`, `.briefBody`, `.briefCol`, `.briefChart` and `.briefItem`. Commit e43f957.
2. **[Rule 1 - Bug] Overlapping chart x-axis labels.** With only 7 days of history, the "1 Oct 2026" and "7 Oct 2026" labels drew on top of each other. DemandChart now drops the first date label when it is within 110px of today's. The /insights 60-day charts are unaffected, because that gap is always wider. Commit e43f957.
3. **Supplier rows were checked on a snapshot instance.** The live DB results have `emergencyOrders = []`, so a second `next start -p 3101` ran with DATABASE_URL set to an unreachable host and served data/results.json. Both instances were stopped afterwards.
4. **TDD order.** Task 1's implementation and tests were written together and landed in one commit, not as separate RED and GREEN commits.
5. **Not pushed.** The orchestrator's instruction overrides the plan's "push" step.

## DB writes made by the Playwright run (live Neon)

- Accepted, then cancelled through the UI: order **ord-a52053ea4871**, ORS 238.6 sachets, St Mary Clinic (h-stmary) → City Civil Hospital (h-civil), line `h-stmary-h-civil-m-ors`. Cancelling does not change stock, and the line can be accepted again (accept.ts lets a re-accept go through after a cancel).
- Two activity-log entries: `order_accept` and `order_cancelled` for that order.
- **Reset demo was NOT used.** The DB already held 5 delivered orders and the user's activity log, and a reset would have reversed those stock movements and wiped the log. One cancelled order row and two log entries remain.

## Known Stubs

None.

## Deferred / observations (out of scope)

- On the tracking sheet, the Stepper dots (`z-index: 1`) can draw over the sticky sheet header while scrolling. This was seen in screenshots, predates this task and was not changed.

## Self-Check: PASSED

- FOUND: lib/orders/brief.ts, lib/orders/brief.test.ts, components/orders/DecisionBrief.tsx
- FOUND commits: 2f47464, 69a5913, e43f957
