---
phase: quick-261009-cfq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/insights/view.ts
  - lib/orders/brief.ts
  - lib/orders/brief.test.ts
  - components/insights/charts.tsx
  - components/orders/OrderBits.tsx
  - components/orders/DecisionBrief.tsx
  - components/orders/Cart.tsx
  - components/orders/Tracking.tsx
  - components/orders/orders.module.css
autonomous: true
requirements: [ORDER-BRIEF]

must_haves:
  truths:
    - "Every transfer line in the checkout shows, open by default, the receiver's situation (stock, daily use, days to stock-out vs lead + buffer, severity, priority rank + reasons, event reasons) and the sender's situation (stock now, about stock after, about days of cover after, nearest expiry, units that would expire unused)"
    - "Every transfer line shows 'Without this order: runs out <date> (day N)' and 'With it: ...' where the 'with' figure assumes arrival after the engine delivery window (transportDays)"
    - "Every supplier order row shows the same brief for the receiver only, with arrival after the supplier lead time (leadDays)"
    - "The tracking sheet shows the brief for each order line (receiver + sender) from the live snapshot; a delivered order says the figures already include the units instead of showing without/with"
    - "Each brief shows a demand chart (last 7 days of use + 30-day forecast) with a data-table fallback and a 'Full insights' link to /insights/<receiverId>"
    - "Engine numbers are shown verbatim; every derived number is labelled 'about' or '≈'"
    - "The brief is collapsible and starts open; the checkout's checks list also starts open"
  artifacts:
    - path: "lib/orders/brief.ts"
      provides: "Pure buildDecisionBrief(results, input) derived from ResultsJSON"
      exports: ["buildDecisionBrief", "DecisionBrief", "BriefInput"]
    - path: "lib/orders/brief.test.ts"
      provides: "vitest coverage: receiver/sender numbers, without vs with, supplier (no sender), runDown arrival"
    - path: "components/orders/DecisionBrief.tsx"
      provides: "Collapsible brief block (Receiver | Sender, without/with line, chart, insights link)"
      exports: ["DecisionBriefBlock"]
  key_links:
    - from: "lib/orders/brief.ts"
      to: "lib/insights/view.ts runDown"
      via: "import { runDown } (with the new optional arrival argument)"
      pattern: "runDown\\("
    - from: "components/orders/Cart.tsx"
      to: "components/orders/DecisionBrief.tsx"
      via: "<DecisionBriefBlock> on each transfer line and each supplier row"
      pattern: "DecisionBriefBlock"
    - from: "components/orders/Tracking.tsx"
      to: "components/orders/DecisionBrief.tsx"
      via: "<DecisionBriefBlock> per order line"
      pattern: "DecisionBriefBlock"
    - from: "components/orders/DecisionBrief.tsx"
      to: "components/insights/charts.tsx DemandChart"
      via: "DemandChart with 7-day dated trend as history"
      pattern: "DemandChart"
---

<objective>
Give the administrator enough data to approve an order on every approval screen: the transfer checkout lines, the supplier order rows (both in components/orders/Cart.tsx) and the tracking sheet (components/orders/Tracking.tsx). Each shows a "decision brief": the receiver's situation, the sender's situation (transfers only), what happens without vs with the order, and a demand trend chart.

Purpose: the user said there isn't enough data to approve an order. Everything needed is already in ResultsJSON, so no engine, DB or API changes are needed. This follows the user-directed design in /home/anirudh/.claude/plans/can-we-predict-what-cheerful-micali.md, which is locked.
Output: a pure, tested lib/orders/brief.ts, a DecisionBrief component, and the brief wired into all three screens.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./AGENTS.md
@/home/anirudh/.claude/plans/can-we-predict-what-cheerful-micali.md
@lib/contracts.ts
@lib/insights/view.ts
@components/orders/Cart.tsx
@components/orders/Tracking.tsx
@components/orders/OrderBits.tsx

Locked user answers: screens = ALL (checkout transfers, supplier orders, tracking). Data = the receiver situation, the sender situation, "what if I don't approve" (stock-out without vs with the order arriving after transportDays or leadDays), and a demand trend chart (last 7 days + 30-day forecast, linking to /insights/[hospitalId]). No engine/DB/API changes. Derived numbers are labelled "about"/"≈" and engine numbers are shown verbatim. The brief is open by default and collapsible, with an accessible data-table fallback. Solo dev: commit straight to main.

No Next-specific APIs are used. The insights link is a plain `<a href>`, like components/dashboard/HospitalDetail.tsx:110. If anything Next-specific does come up, read node_modules/next/dist/docs/ first (AGENTS.md).

<interfaces>
From lib/insights/view.ts (current):
  export interface RunDownPoint { day: number; stock: number }
  export function runDown(stock: number, forecast: readonly ForecastPoint[], horizon: number): RunDownPoint[]
    // point 0 = round1(stock); day d subtracts forecast[d-1].demand (past 30 days, the forecast mean); clamps at 0; BREAKS at the first 0.
    // Existing test: the first zero index z satisfies |z - 1 - inventory.daysUntilStockout| <= 1.

From lib/insights/explain.ts:
  export function niceDate(iso: string): string    // "8 Oct 2026"
  export function addDays(iso: string, n: number): string

From components/insights/charts.tsx:
  export function DataTable({ caption, head, rows })
  export function DemandChart({ history: HistoryPoint[], forecast: {date,demand,advisory}[], asOf, advisoryFromDay, unit })
    // H = 240 hardcoded; the axis text "Last 60 days" is hardcoded; the hatch pattern id "dm-hatch" is a fixed string (duplicate ids when there are many charts)
  HistoryPoint = { date: string; value: number; filled: boolean }

From components/orders/OrderBits.tsx:
  export function ChecksDisclosure({ checks }: { checks: readonly string[] })   // useState(false), rows.disclosure button, Glyph chevron
  export const days = (n: number) => `${n} day(s)`

From components/dashboard/context.tsx (useDash): results, medName, hospName, unit(medicineId, qty), role, ownHospitalId, orders, orderFor, track, routes
From lib/dashboard/view: fmtUnits
From theme/tokens: riskLabel: Record<Severity,string>;  components/icons/Glyph: RiskGlyph({ severity, size })

ResultsJSON fields used: asOf, historyWindow.to (the last history day, = trend's last date), advisory.fromDay, inventory[] (stock, dailyDemand, daysUntilStockout, leadDays, bufferDays, trend[7] oldest first, nearestExpiry, severity), forecasts[] (forecast[30], eventReasons?, outbreak, mode), priorities[] (rank, score, reasons), wasteWarnings[] (wasteUnits, expiryDate, expiryDays), transfers[], emergencyOrders[] (leadDays, reason).

Fixture data/results.json: asOf 2026-10-08, historyWindow.to 2026-10-07. transfers[0] = h-civil -> h-north m-para qty 521.4 transportDays 1. Receiver inventory h-north m-para: stock 399, daysUntilStockout 10, leadDays 21, bufferDays 7, dailyDemand 39.9, trend [41,43,23,25,32,39,49], severity critical. emergencyOrders[0] = h-north m-para qty 187.6 leadDays 21. wasteWarnings is EMPTY, so the waste tests must clone r and push a synthetic WasteWarning.

Order (lib/orders/types.ts): { id, fromHospital, toHospital, status, transportDays, lines: { id, medicineId, qty }[] , ... }
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure decision-brief model (runDown arrival + lib/orders/brief.ts) with tests</name>
  <files>lib/insights/view.ts, lib/orders/brief.ts, lib/orders/brief.test.ts</files>
  <behavior>
    - runDown(35, flat 10/day, 30) is unchanged: [35,25,15,5,0]. All existing lib/insights/insights.test.ts tests still pass.
    - runDown(35, flat 10/day, 30, { day: 5, qty: 40 }): days 1-4 = 25,15,5,0; it keeps going through the zero; day 5 = 0+40-10 = 30; then 20,10,0 (day 8) and stops.
    - runDown(35, flat 10, 30, { day: 0, qty: 40 }): point 0 = 75.
    - Transfer brief on the fixture (h-civil -> h-north m-para 521.4, arriveDays 1): receiver.stock 399, dailyDemand 39.9, daysUntilStockout 10, leadDays 21, bufferDays 7, needDays 28, severity 'critical', trend length 7 with dates 2026-10-01..2026-10-07 and values [41,43,23,25,32,39,49], forecast length 30; priority has the rank/score/reasons of the matching priorities entry and `of` = priorities.length; sender is non-null with stockNow equal to h-civil m-para inventory stock and stockAfter = round1(stockNow - 521.4).
    - without.day === 10 (engine verbatim), without.date === addDays(asOf, 10). with.day is greater than without.day, or with.date is null with lastsPast set (lasts past the horizon).
    - Supplier brief (emergencyOrders[0], kind 'supplier', arriveDays 21, no fromHospital): sender is null; with is computed with an arrival at day 21; gapDays > 0 (the receiver runs out at about day 10 and the order arrives on day 21).
    - Sender waste: on a clone of r with a pushed WasteWarning {h-civil, m-para, wasteUnits 100, expiryDate X}, sender.wasteUnits === 100, sender.wasteExpiry === X, and sender.wasteAfter === max(0, round1(100 - 521.4)) === 0. With no warning, wasteUnits is 0.
    - Missing inventory pair (unknown medicine id): receiver === null and the function does not throw.
  </behavior>
  <action>
1. In lib/insights/view.ts, extend `runDown` with an optional 4th argument `arrival?: { day: number; qty: number }`. Keep it backward compatible: existing callers and tests must not change. Semantics: the units are available at the START of day `arrival.day`. For day 0, point 0 becomes round1(stock + qty). For day d >= 1, when d === arrival.day, add qty to `left` before subtracting that day's use. Do not break at zero while d < arrival.day, so the zero stretch before arrival appears in the series. The mean past day 30 still comes from the full forecast passed in. Update the doc comment.

2. Create lib/orders/brief.ts. It is pure, with no React imports, and imports only from ../contracts, ../insights/view (runDown), and ../insights/explain (addDays). Export:
   - `BriefInput`: { kind: 'transfer' | 'supplier'; fromHospital?: string | null; toHospital: string; medicineId: string; qty: number; arriveDays: number }.
   - `DecisionBrief`: { kind, medicineId, qty, arriveDays, asOf, advisoryFromDay, horizon, receiver: ReceiverBrief | null, sender: SenderBrief | null, without: { day: number | null; date: string | null }, with: { day: number | null; date: string | null; lastsPast: string | null; gapDays: number } }.
   - `ReceiverBrief`: hospitalId, stock, dailyDemand, daysUntilStockout, leadDays, bufferDays, needDays (= leadDays + bufferDays), severity, priority ({ rank, score, reasons, of } | null), eventReasons (string[], from forecasts[].eventReasons ?? []), outbreak, trend ({ date, value, filled: false }[], dated so the last entry is historyWindow.to and each earlier one is one day before it, built with addDays), forecast (ForecastPoint[]).
   - `SenderBrief`: hospitalId, stockNow, stockAfter (round1(max(0, stockNow - qty))), dailyDemand, coverDaysAfter (dailyDemand > 0 ? Math.floor(stockAfter / dailyDemand) : null), nearestExpiry, wasteUnits (round1 of the sum of wasteWarnings for that pair), wasteExpiry (earliest expiryDate among them, or null), wasteAfter (round1(max(0, wasteUnits - qty))).
   - `buildDecisionBrief(r: ResultsJSON, input: BriefInput): DecisionBrief`.

   The without/with logic: use horizon = 90 (the engine's waste cap; export it as BRIEF_HORIZON_DAYS). Let zNo be the first zero index of runDown(stock, fc, 90) and zWith the first zero index at or after arriveDays of runDown(stock, fc, 90, { day: arriveDays, qty }), or null if there is none. `without.day` = the engine's daysUntilStockout verbatim when it is <= 90, otherwise null. `with.day` = without.day + (zWith - zNo) when both runDown zeros exist and without.day is not null, so it stays consistent with the engine's day count. If zWith is null, set with.day = null and lastsPast = addDays(asOf, 90). Dates use addDays(asOf, day). gapDays = the number of points with 1 <= day < arriveDays and stock === 0 in the with-series. With no receiver, return without/with as nulls and gapDays 0. The sender is only built when kind is 'transfer' and fromHospital has an inventory entry for the medicine.

3. Create lib/orders/brief.test.ts in vitest. Follow the lib/insights/insights.test.ts style: readFileSync data/results.json and use describe/it. Cover every behavior bullet above, including the runDown arrival tests.
  </action>
  <verify>
    <automated>npx vitest run lib/orders/brief.test.ts lib/insights/insights.test.ts</automated>
  </verify>
  <done>Both test files pass. runDown stays backward compatible. buildDecisionBrief returns the receiver, sender (transfers only), without and with values described above.</done>
</task>

<task type="auto">
  <name>Task 2: DecisionBrief component and wiring into checkout, supplier rows and tracking</name>
  <files>components/orders/DecisionBrief.tsx, components/insights/charts.tsx, components/orders/OrderBits.tsx, components/orders/Cart.tsx, components/orders/Tracking.tsx, components/orders/orders.module.css</files>
  <action>
1. In components/insights/charts.tsx, give DemandChart two optional props: `pastLabel?: string` (default "Last 60 days", used for the axis text that is hardcoded today) and `height?: number` (default 240, replacing the H constant). Replace the fixed pattern id "dm-hatch" with a `useId()`-based id, so several charts on one sheet don't share an id. The /insights pages must render exactly as before.

2. In components/orders/OrderBits.tsx, add `defaultOpen?: boolean` (default false) to ChecksDisclosure and use it as the initial state. TransferRow is unchanged.

3. Create components/orders/DecisionBrief.tsx ("use client"), exporting `DecisionBriefBlock({ input, status, testId }: { input: BriefInput; status?: OrderStatus | "suggested"; testId: string })`. It reads `results, medName, hospName, unit` from useDash and calls buildDecisionBrief inside useMemo. Render:
   - A disclosure button, styled with rows.disclosure and the Glyph chevron like ChecksDisclosure, labelled "Decision brief". It has aria-expanded and aria-controls, starts OPEN (useState(true)), and has data-testid `${testId}-toggle`. The wrapper has data-testid={testId}.
   - A two-column grid (new CSS class `briefGrid`; it stacks to one column in narrow sheets with a container or media query). Use a `<dl>` per column.
     - Receiver column (data-testid "brief-receiver"), headed "Receiver · {hospName}". Rows: Stock {fmtUnits(stock)} {unit}; Daily use {dailyDemand}/day; Runs out in {days(daysUntilStockout)}, shown against "needs lead {leadDays} + buffer {bufferDays} = {needDays} days" (needDays is a plain sum of two engine numbers, labelled as such); Severity with RiskGlyph + riskLabel (never colour alone); Priority "#{rank} of {of} · score {score}" plus the reasons as a small list (verbatim); event reasons as a verbatim list when there are any; an "Outbreak trend" tag when outbreak is set.
     - Sender column (data-testid "brief-sender"), transfers only, headed "Sender · {hospName}". Rows: Stock now {stockNow}; After sending "about {stockAfter}"; Cover after "about {coverDaysAfter} days" (or "not available" when it is null); Nearest expiry niceDate(nearestExpiry) or "no stock"; Expires unused "{wasteUnits} {unit} by {niceDate(wasteExpiry)}" (engine) plus "about {wasteAfter} after this transfer" when wasteUnits > 0, otherwise "none forecast".
   - The without/with line (data-testid "brief-without-with"):
     - "Without this order: runs out {niceDate(without.date)} (day {without.day})", or "no stock-out within 90 days".
     - " · With it (arrives in {days(arriveDays)}): about {niceDate(with.date)} (day ≈{with.day})", or "lasts past {niceDate(lastsPast)}".
     - When gapDays > 0, add a critical-styled note with a glyph: "About {gapDays} days with no stock before it arrives."
     - For a supplier order, the arrival wording says "supplier lead time" instead of "arrives in".
   - The chart (wrapper data-testid "brief-chart"): DemandChart with history = receiver.trend, forecast = receiver.forecast, asOf, advisoryFromDay, unit = unit(medicineId, 2), pastLabel "Last 7 days", height 180. DemandChart already has the DataTable fallback and an sr-only sentence.
   - A link `<a className={rows.linkButton} href={`/insights/${toHospital}`} data-testid="brief-insights-link">Full insights for {hospName}</a>`.
   - When status === "delivered", replace the without/with line with the caption "Delivered. The figures above already include these units." and hide the sender "after" rows. When the receiver is null, render the caption "No stock record for this medicine at {hospName}."
   - Label all derived numbers (stockAfter, coverDaysAfter, wasteAfter, with.day/date, gapDays) "about" or "≈". Show engine numbers as given.

4. Wire the brief in. Change only what is listed; keep the existing testids and behaviour.
   - Cart.tsx transfer lines: insert `<DecisionBriefBlock input={{ kind: "transfer", fromHospital: t.fromHospital, toHospital: t.toHospital, medicineId: t.medicineId, qty: t.qty, arriveDays: t.transportDays }} status={status} testId={`brief-${key}`} />` between the cells and the ChecksDisclosure, and pass `defaultOpen` to that ChecksDisclosure. The brief must sit above the Accept button.
   - Cart.tsx supplier rows: after SupplierTimeline, add `<DecisionBriefBlock input={{ kind: "supplier", toHospital: o.hospitalId, medicineId: o.medicineId, qty: o.qty, arriveDays: o.leadDays }} testId={`brief-supplier-${o.hospitalId}-${o.medicineId}`} />`.
   - Tracking.tsx: after the Stepper and before the demo clock, add an `<h3>` subhead "Decision brief". Then render one DecisionBriefBlock per order line, with kind "transfer", fromHospital/toHospital from the order, qty = l.qty, arriveDays = order.transportDays, status = order.status, testId `brief-${order.id}-${l.medicineId}`. Show medName above each block when there is more than one line.

5. In orders.module.css, add briefGrid, briefCol, briefLine, and briefGap (critical tone, using the existing risk tokens such as var(--risk-critical)). Follow the existing token use in the file and add no new colours. Keep it compact so the sheet still scrolls cleanly.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run</automated>
  </verify>
  <done>Typecheck is clean and the full suite passes. Cart transfer lines, supplier rows and the tracking sheet each render a DecisionBriefBlock, open by default, with receiver/sender/without-with/chart/link sections. The /insights DemandChart output is unchanged by default.</done>
</task>

<task type="auto">
  <name>Task 3: Build, browser-verify on :3100, commit to main and push</name>
  <files>(no source files; Playwright script in the session scratchpad only)</files>
  <action>
1. Run `npm test`, `npm run typecheck` (non-incremental on purpose) and `npm run build`. Fix any failures in the Task 1-2 files.

2. Start `DEMO_AUTH=true SESSION_SECRET=<throwaway> npx next start -p 3100` in the background. Do NOT touch the user's :3000 dev server. Write a node Playwright script in the scratchpad that loads `playwright` from ~/.npm/_npx/9833c18b2d85bc59/node_modules/ and uses `chromium.launch({ executablePath: '/usr/bin/chromium' })`. Sign in as network_admin through the demo sign-in (or a cookie from scripts/gen-cookie.ts). Then check:
   - (a) Open the transfer checkout. For each `cart-line-*`, `brief-*` is visible with its toggle aria-expanded="true". "brief-receiver" and "brief-sender" contain a stock figure. "brief-without-with" contains "Without this order" and "With it". "brief-chart" contains an svg. "brief-insights-link" has an href starting with /insights/. The checks list is visible without clicking. The toggle collapses and re-opens the brief.
   - (b) Each `supplier-order-row-*` contains a brief with "brief-receiver", no "brief-sender", and "supplier lead time" in the without/with line.
   - (c) Accept one transfer, open Track, and confirm the tracking sheet shows a brief per line. Then cancel that test order through the UI (or use Reset demo as network admin) so the demo state is restored.
   - (d) Collect pageerror/console errors across the run and require none. Save a screenshot of the checkout and the tracking sheet to the scratchpad and look at them to confirm the layout is readable.
   Stop the :3100 server afterwards.

3. Commit straight to main (solo dev; no branch or PR). Message: "feat(orders): decision brief on checkout, supplier orders and tracking", ending with the trailer line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Push to origin main after verification passes.
  </action>
  <verify>
    <automated>npm test && npm run typecheck && npm run build && node $SCRATCHPAD/verify-brief.mjs</automated>
  </verify>
  <done>Tests, typecheck and build are green. The Playwright run passes checks (a) to (d) with no page errors. Demo state is restored, :3100 is stopped, and the commit is on main and pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| server ResultsJSON -> client brief | The brief reads the already-delivered snapshot client-side; no new endpoint or DB access |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-cfq-01 | Information disclosure | DecisionBriefBlock | accept | Shows only aggregate stock/demand already visible to the same role in the dashboard and /insights; no PHI exists in ResultsJSON |
| T-cfq-02 | Elevation of privilege | Accept buttons near the brief | mitigate | The brief adds no actions; the existing canAcceptLine/role checks and the server 403 on accept are unchanged |
| T-cfq-03 | Tampering (misleading figures) | lib/orders/brief.ts derived numbers | mitigate | Pure function with vitest coverage; derived values are labelled "about"/"≈"; engine values are shown verbatim; with.day is anchored to the engine's daysUntilStockout |
</threat_model>

<verification>
- npx vitest run (includes lib/orders/brief.test.ts and the unchanged insights tests)
- npm run typecheck, npm run build
- Playwright on :3100 with /usr/bin/chromium: checkout lines, supplier rows and the tracking sheet each show the open brief, with no page errors
</verification>

<success_criteria>
- All three approval screens show the receiver situation, the sender situation (transfers), the without/with stock-out dates and the demand chart, open by default and collapsible
- No engine, DB or API files changed
- Derived numbers are labelled "about"/"≈"; engine numbers are verbatim
- Committed and pushed to main
</success_criteria>

<output>
Create `.planning/quick/261009-cfq-order-decision-brief/261009-cfq-SUMMARY.md` when done
</output>
