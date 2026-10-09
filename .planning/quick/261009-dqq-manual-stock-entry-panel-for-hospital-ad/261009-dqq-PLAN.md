---
phase: quick-261009-dqq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/logs/LogList.tsx
  - lib/stock/form.ts
  - lib/stock/form.test.ts
  - app/api/inventory/route.ts
  - components/stock/StockSheet.tsx
  - components/stock/stock.module.css
  - components/dashboard/context.tsx
  - components/dashboard/Dashboard.tsx
  - components/dashboard/TopBar.tsx
  - components/dashboard/HospitalDetail.tsx
autonomous: true
requirements: [DATA-01, DATA-02]

must_haves:
  truths:
    - "npm run typecheck and npm test pass"
    - "A hospital admin opening the sheet sees its own hospital fixed, chooses a medicine, and can add a batch with an expiry date, remove units, or record daily usage with patient load and emergency %"
    - "The network admin can pick any hospital in the same form"
    - "A hospital admin cannot write to another hospital — the server returns 403 (route check, and the form never offers other hospitals)"
    - "A successful write resets the form, shows a confirmation, and refreshes the dashboard numbers"
    - "The activity log lists the write under the hospital involved"
    - "The sheet is reachable from the top bar and from the hospital drill-in, and closes on Escape"
  artifacts:
    - path: "components/stock/StockSheet.tsx"
      provides: "Manual stock entry sheet: add batch / remove damaged / record usage, role-scoped hospital field, current-stock line, inline error and confirmation"
    - path: "components/stock/stock.module.css"
      provides: "Grid form layout for the sheet (mirror of events.module.css) plus the action-toggle row"
    - path: "lib/stock/form.ts"
      provides: "Pure buildStockBody shared by the sheet: per-action body shape, numbers, blank used qty -> null, display names"
    - path: "lib/stock/form.test.ts"
      provides: "Vitest coverage of the request-body contract"
    - path: "app/api/inventory/route.ts"
      provides: "POST add/remove/usage: 401/400/403/503, blank usedQty -> null, display-name log summaries"
    - path: "components/dashboard/context.tsx"
      provides: "openStock(hospitalId?) on DashboardCtx"
  key_links:
    - from: "components/dashboard/Dashboard.tsx"
      to: "components/stock/StockSheet.tsx"
      via: "url.stock === \"1\" adds mode \"stock\" (after events, before hospital)"
      pattern: "stockOpen"
    - from: "components/stock/StockSheet.tsx"
      to: "/api/inventory"
      via: "fetch POST, then onChanged() -> router.refresh() so forecasts/stock-out/waste update"
      pattern: "/api/inventory"
    - from: "components/dashboard/context.tsx"
      to: "components/dashboard/Dashboard.tsx"
      via: "openStock(hospitalId?) does url.update({ stock: \"1\", ... })"
      pattern: "openStock"
    - from: "components/stock/StockSheet.tsx"
      to: "results.inventory"
      via: "current-stock line looks up the hospital+medicine row so the admin sees the effect"
      pattern: "results.inventory"
    - from: "app/api/inventory/route.ts"
      to: "lib/logs"
      via: "logAction stock_added / stock_removed / usage_recorded with hospitals: [hospitalId], so LogsSheet and the drill-in RecentActivity show it"
      pattern: "logActivity"
    - from: "components/logs/LogList.tsx"
      to: "lib/logs/types.ts"
      via: "TONE is Record<LogEntry[\"action\"], TagTone>; the three stock actions must be present or typecheck fails"
      pattern: "stock_added"
---

<objective>
Build the manual stock entry panel for hospital admins: one sheet opened from the dashboard's top bar (and pre-selected from the hospital drill-in) where an admin writes through the existing `scripts/entry.ts` path and `POST /api/inventory` — add a batch with a mandatory expiry date (DATA-01), remove damaged units (FIFO server-side), or record the day's usage with patient load and emergency share (DATA-02). An earlier pass already added the untracked API route, the `?stock` URL param and the three log actions, but left `LogList.tsx`'s tone map incomplete, so the build is red; this plan finishes that work rather than restarting it.

Purpose: Phase 1's DATA-01/DATA-02 write helpers exist but there is no UI on them, so today's numbers can only change through scripts. The core value ("know before it happens") needs the admin to record stock and usage from the screen they already watch.

Output: a green build, `lib/stock/form.ts` + tests for the request-body contract, the finished route (display-name summaries, blank used qty -> null), `components/stock/StockSheet.tsx` + CSS, and the top-bar/drill-in entry points wired through `openStock(hospitalId?)` and `?stock=1`.
</objective>

<execution_context>
@/home/anirudh/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/anirudh/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261009-dqq-manual-stock-entry-panel-for-hospital-ad/261009-dqq-CONTEXT.md
@.planning/STATE.md
@components/events/EventsSheet.tsx
@components/dashboard/Dashboard.tsx
@components/dashboard/context.tsx
@components/dashboard/TopBar.tsx
@components/dashboard/HospitalDetail.tsx
@components/logs/LogList.tsx
@app/api/inventory/route.ts
@scripts/entry.ts
@components/logs/LogsSheet.tsx

Locked decisions from CONTEXT.md (do not revisit):
- One sheet, three actions: Add stock (qty + mandatory expiry date), Remove / damaged (qty, FIFO handled server-side), Record usage (date + used qty + patient load + emergency %).
- Entry points: a top-bar "Enter stock" button for both roles plus an XS-menu item, and a drill-in "Enter stock" button when the viewer may write to that hospital (network admin, or the hospital's own admin), pre-selecting it.
- `openStock(hospitalId?)` on `DashboardCtx`; `?stock=1` drives the sheet (reuse the param already in useUrlState).
- Network admin picks any hospital; a hospital admin is locked to its own hospital (the server enforces this too).
- Blank used qty maps to `null` (missing day), not a validation error.
- Activity-log summaries use hospital/medicine display names supplied by the client; ids remain the only values used for writes.
- Styling: reuse the grid layout pattern from components/events/events.module.css in a new components/stock/stock.module.css.

Repo notes:
- Existing partial work in the working tree (finish it, do not restart): app/api/inventory/route.ts (untracked), the `stock` key in components/dashboard/useUrlState.ts, and the three actions in lib/logs/types.ts. Build is currently red because LogList's TONE map lacks the new actions — Task 1 closes that first.
- Pattern to mirror: components/events/EventsSheet.tsx (SheetHeader, grid form, `className={logs.select}` controls, data-testids, inline role="alert" error) and the URL-driven sheet modes in Dashboard.tsx.
- Next.js 16 has breaking changes; read the relevant guide in node_modules/next/dist/docs/ before editing route handlers or client components.
- Do not change lib/contracts.ts, db/schema.ts, lib/engine/** or middleware.ts: the write contract and role rules already exist. No new npm packages.
- Role switching for manual verification is the TopBar demo role switcher (DEMO_AUTH); the user's dev server owns :3000, so any extra server must run on another port.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Unbreak the build — add the three stock actions to the LogList tone map</name>
  <files>components/logs/LogList.tsx</files>
  <action>
  components/logs/LogList.tsx declares `const TONE: Record<LogEntry["action"], TagTone>`, and lib/logs/types.ts (already edited in the working tree) adds `stock_added`, `stock_removed` and `usage_recorded` to LOG_ACTIONS with ACTION_LABEL "Stock added", "Stock removed" and "Usage recorded". A Record keyed by the full union needs one entry per action, so the three missing keys are the current `npm run typecheck` failure. Add them with tones that match the existing semantics: `stock_added: "accent"` (a write that raises stock, same family as event_added), `stock_removed: "dashed"` (a reduction, same family as order_cancelled), `usage_recorded: "outline"` (a routine daily record, same family as order_accept). Do not touch lib/logs/types.ts (actions and labels are already in place) and do not change any other tone. Nothing else in the file needs editing — it renders `TONE[e.action]` and `ACTION_LABEL[e.action]` generically.
  </action>
  <verify><automated>npm run typecheck</automated></verify>
  <done>The TONE map covers every LogAction, typecheck is clean, and a stock log row renders with its "Stock added" / "Stock removed" / "Usage recorded" label and tone.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared request-body contract (blank used qty -> null, display names) with tests, and the route that consumes it</name>
  <files>lib/stock/form.ts, lib/stock/form.test.ts, app/api/inventory/route.ts</files>
  <behavior>
    - buildStockBody with action "add" returns exactly { action, hospitalId, medicineId, hospitalName, medicineName, qty: 20 (number), expiryDate } and no usage keys.
    - buildStockBody with action "remove" returns qty as a number and carries neither expiryDate nor any usage key.
    - buildStockBody with action "usage" returns usageDate, patientLoad and emergencyPct as numbers, and usedQty: null when the field is blank or whitespace, usedQty: 7 when it is "7".
    - An action outside add/remove/usage throws instead of building a body.
    - The route's usage branch maps a blank or absent usedQty to null so recordUsage stores a NULL missing day, and still 400s on a non-numeric usedQty.
    - Log summaries use the client-supplied display names, e.g. "Added 20 units of Paracetamol at City Civil Hospital, expiry 2027-01-31", and fall back to the ids when a name is missing or over-long.
  </behavior>
  <action>
  1. lib/stock/form.ts (new, pure: no I/O, no clock, no DB import; vitest already covers lib/**). Export `const STOCK_ACTIONS = ["add", "remove", "usage"] as const` and `type StockAction`. Export `interface StockForm { action: StockAction; hospitalId: string; medicineId: string; qty: string; expiryDate: string; usageDate: string; usedQty: string; patientLoad: string; emergencyPct: string; }` (all values are raw input strings, matching the sheet's controlled inputs) and `interface StockDisplayNames { hospitalName: string; medicineName: string; }`. Export `buildStockBody(form: StockForm, names: StockDisplayNames): Record<string, unknown>`: the body always carries action, the trimmed hospitalId/medicineId (the only values used for writes) and the trimmed display names; "add" adds qty (Number of the trimmed string) and the trimmed expiryDate; "remove" adds qty only; "usage" adds the trimmed usageDate, usedQty (null when the trimmed string is empty, otherwise Number), and patientLoad/emergencyPct as numbers; any other action throws `unknown stock action "..."`. Header comment: the sheet builds the body here so the blank-used-qty rule is tested once, and the route stays a thin auth+validation shell.
  2. lib/stock/form.test.ts: vitest, node environment, styled like lib/logs/logs.test.ts (single quotes, describe/it). Cover every <behavior> bullet with a small factory form (h-civil / m-para / "20" / 2027-01-31 / usageDate 2026-10-09 / patientLoad "120" / emergencyPct "15") and display names City Civil Hospital / Paracetamol; assert the add and remove bodies with toEqual, the two usedQty cases, and the throw with toThrow(/unknown stock action/).
  3. app/api/inventory/route.ts (existing untracked file — finish it, keep its structure, 401/400/403/503 behaviour, NO_STORE headers, `runtime = "nodejs"`, resetResultsCache() and logActivity exactly as written): add `hospitalName?: unknown` and `medicineName?: unknown` to Body, and a helper `const nameOrId = (v: unknown, id: string) => str(v).slice(0, 120) || id;` (display-only text is capped so an absurd string cannot bloat the log row; the id is the fallback). After the hospitalId/medicineId validation, compute `const hospName = nameOrId(body.hospitalName, hospitalId);` and `const medName = nameOrId(body.medicineName, medicineId);`, and build the three summaries from those names: `Added ${qty} units of ${medName} at ${hospName}, expiry ${expiryDate}`, `Removed ${qty} units of ${medName} at ${hospName}`, and `Recorded ${usedQty === null ? "a missing day" : `${usedQty} units`} of ${medName} at ${hospName} on ${usageDate}`. In the usage branch replace the bare `int(body.usedQty)` with the missing-day rule: `const usedRaw = body.usedQty; const usedQty = usedRaw === null || usedRaw === undefined || (typeof usedRaw === "string" && usedRaw.trim() === "") ? null : int(usedRaw);` with a comment citing D-18 (empty qty = NULL missing day), so a blank field is stored as null by recordUsage while a non-numeric value still throws `bad usedQty` and returns 400. Update the file header comment to document the display-name and blank-used-qty behaviour.
  </action>
  <verify><automated>npx vitest run lib/stock && npm run typecheck</automated></verify>
  <done>The body-builder tests pass (including blank used qty -> null and the unknown-action throw), typecheck is clean, and POST /api/inventory compiles with display-name summaries and the missing-day rule while keeping its 401/400/403/503 contract.</done>
</task>

<task type="auto">
  <name>Task 3: Stock entry sheet plus top-bar and drill-in entry points</name>
  <files>components/stock/StockSheet.tsx, components/stock/stock.module.css, components/dashboard/context.tsx, components/dashboard/Dashboard.tsx, components/dashboard/TopBar.tsx, components/dashboard/HospitalDetail.tsx</files>
  <action>
  1. components/stock/stock.module.css: copy components/events/events.module.css (the .form 2-column grid with var(--space-2)/var(--space-3) gap and the 1-column fallback under 480px, .field, .wide, .actions) and add one extra class `.toggle { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2); }` for the action buttons row. Layout only; everything else reuses rows.module.css and logs.module.css classes, like the events sheet does.

  2. components/stock/StockSheet.tsx (new client component, modelled on EventsSheet): props `{ onClose: () => void; onChanged: () => void }`. Header comment: manual stock entry for one hospital+medicine (DATA-01/DATA-02), role-scoped, writes through POST /api/inventory.
     - State: a single `StockForm` from lib/stock/form (action, hospitalId, medicineId, qty, expiryDate, usageDate, usedQty, patientLoad, emergencyPct) plus `busy`, `error`, `confirm`. Seed it with useCallback/useState like EventsSheet's `blank()`: hospitalId = network_admin ? (selectedId ?? first hospital in results.hospitals) : ownHospitalId; medicineId = first medicine in results.medicines; action "add"; expiryDate and usageDate both default to `results.asOf` (an ISO date string, accepted by type="date"); value fields empty.
     - Read `results, role, ownHospitalId, medName, hospName, unit, selectedId` from useDash(); `network = role === "network_admin"`. Compute `const entry = results.inventory.find((e) => e.hospitalId === form.hospitalId && e.medicineId === form.medicineId) ?? null;` for the current-stock line.
     - Layout: `<div data-testid="stock-sheet">` with SheetHeader title "Enter stock", closeLabel "Close stock entry", closeTestId "stock-close" and a caption naming the role behaviour; then `<form className={styles.form} onSubmit={submit} data-testid="stock-form" aria-label="Enter stock">`.
     - Hospital field (data-testid "stock-hospital", className={logs.select}): network admin gets a select over results.hospitals (option value hospitalId, label hospitalName); hospital admin gets the same select rendered `disabled` with a single option for ownHospitalId showing hospName — the form never offers other hospitals (the server 403 is the backstop).
     - Medicine field (data-testid "stock-medicine"): select over results.medicines (value medicineId, label medicineName).
     - Current-stock line (data-testid "stock-current", `rows.caption`, grid-wide): when entry exists show `${fmtUnits(entry.stock)} ${unit(entry.medicineId, entry.stock)} on file · ${dShort(entry.daysUntilStockout)} cover · nearest expiry ${entry.nearestExpiry ? fmtDate(entry.nearestExpiry) : "none"}` (fmtUnits from lib/dashboard/view; dShort and fmtDate from lib/dashboard/panel), otherwise "No stock on file for this medicine yet."
     - Action toggle: a `role="group"` div (className={styles.toggle}) with one rows.outlineButton per STOCK_ACTIONS, `aria-pressed` set on the active one, onClick sets the action, data-testid `stock-action-add` / `stock-action-remove` / `stock-action-usage`, labelled "Add stock" / "Remove / damaged" / "Record usage".
     - Action-specific fields, all `className={logs.select}`: "add" -> units number input min 1 (required, data-testid "stock-qty") and an expiry date input (required, data-testid "stock-expiry", label mentions it is mandatory); "remove" -> units number input min 1 (required, data-testid "stock-qty", label mentions earliest expiry goes first); "usage" -> usage date (required, data-testid "stock-usage-date"), patient load number min 0 (required, data-testid "stock-patient-load"), used units number min 0 (optional, label "blank = missing day", data-testid "stock-used-qty"), emergency share number min 0 max 100 (required, data-testid "stock-emergency-pct").
     - submit(ev): preventDefault, set busy, clear error and confirm, POST JSON `buildStockBody(form, { hospitalName: hospName(form.hospitalId), medicineName: medName(form.medicineId) })` to /api/inventory with content-type application/json. On status 201: build a confirmation sentence from the submitted form (add -> `Added ${qty} ${unit} of ${medName} at ${hospName}, expiry ${expiryDate}.`; remove -> `Removed ${qty} ${unit} of ${medName} at ${hospName}.`; usage -> `Recorded usage for ${medName} at ${hospName} on ${usageDate}.`), reset only the value fields (qty, usedQty, patientLoad, emergencyPct back to empty; action, hospital, medicine, expiry and usage dates stay so repeated entries for the same medicine are easy), and call onChanged(). On any other status show `j.error ?? Could not record the entry (${r.status})` in a `rows.error` paragraph with role="alert" and data-testid "stock-error" (a 403 surfaces the route's own message). Show the confirmation in a `rows.note` paragraph with role="status" and data-testid "stock-confirm". busy clears in finally; the submit button (rows.accentButton, data-testid "stock-submit", disabled while busy) is labelled "Add stock" / "Remove units" / "Record usage" per action, "Saving" while busy.

  3. components/dashboard/context.tsx: add to the DashboardCtx interface, right after openCart, `/** Open the manual stock entry sheet, optionally pre-selecting a hospital. */ openStock: (hospitalId?: string) => void;`.

  4. components/dashboard/Dashboard.tsx: import StockSheet after the EventsSheet import. Add `const stockOpen = url.stock === "1";` next to logsOpen/eventsOpen, extend the mode union with "stock" and put it after events and before hospital in the precedence chain. In closeDetail add `else if (mode === "stock") url.update({ stock: null });`. In the sheet handle label chain add `mode === "stock" ? "Enter stock"` before the final "Hospital". In the ctx memo add openStock: `(hospitalId?: string) => { remember(); url.update({ stock: "1", order: null, cart: null, logs: null, events: null, ...(hospitalId ? { hospital: hospitalId } : {}) }); }` — spreading the hospital key only when one is given keeps any existing selection, so closing the sheet drops back into the drill-in it was opened from. Pass TopBar `onStock={() => { remember(); url.update({ stock: stockOpen ? null : "1", order: null, cart: null, logs: null, events: null }); }}` and `stockOpen={stockOpen}` (opening stock clears the other sheets, like onLogs/onEvents do). Render, after the events block inside the sheet section, `{mode === "stock" ? (<StockSheet onClose={closeDetail} onChanged={() => { router.refresh(); }} />) : null}`.

  5. components/dashboard/TopBar.tsx: add `onStock: () => void;` and `stockOpen: boolean;` to Props after onEvents/eventsOpen. Add an outline button between Events and Refresh: `onClick={p.onStock}` with `aria-pressed={p.stockOpen}` and data-testid "stock-button", label "Enter stock" (both roles, matching Logs/Events). In the XS menu, after the "Local events" item, add a role="menuitem" button "Enter stock" that closes the menu and calls p.onStock.

  6. components/dashboard/HospitalDetail.tsx: destructure openStock from useDash() alongside openCart. In the existing `role === "network_admin" || ownHospitalId === hospitalId` block that renders the "Open charts and forecasts" link, add before the link an accent button `onClick={() => openStock(hospitalId)}` with data-testid "hospital-enter-stock" and label "Enter stock" — this pre-selects the drilled-in hospital and is only rendered when the viewer may write to it.
  </action>
  <verify><automated>npm test && npm run typecheck && npm run build</automated></verify>
  <done>The sheet opens from the top bar and the drill-in (Escape and the close button both close it), a hospital admin sees only its own hospital, the network admin can pick any hospital, all three actions write through /api/inventory and then confirm + refresh, a foreign-hospital write returns 403, and the activity log lists the write under the hospital involved. Suite, typecheck and build are green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> POST /api/inventory | Untrusted JSON from an admin's browser becomes stock-batch and daily-usage rows that move every forecast, warning and transfer |
| route -> scripts/entry.ts | The handler forwards ids/numbers to the shared write path; malformed values must fail there, not corrupt data |
| client display names -> activity log | Client-supplied strings are stored in and rendered from the log summary |
| form state -> URL | `?stock=1` / `?hospital=` drive which sheet is shown; both are client-controlled |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-dqq-01 | Elevation of privilege | POST /api/inventory | high | mitigate | The handler re-verifies the session (401) and returns 403 unless network_admin or session.hospitalId === body.hospitalId; the sheet offers a hospital admin only its own (disabled) hospital, so the form never sends a foreign id |
| T-dqq-02 | Tampering | request body values | high | mitigate | buildStockBody coerces numbers and nulls blank used qty; the route validates ids, action allowlist and date/int rules, and scripts/entry.ts assertInt / ISO-date checks plus DB CHECK constraints reject bad rows with 400 |
| T-dqq-03 | Denial of service | store failure during a write | medium | mitigate | entry.ts failures that are not bad/unknown/insufficient return 503 with NO_STORE; logActivity is best-effort and never blocks the response; resetResultsCache only clears a memo |
| T-dqq-04 | Tampering (XSS) | display-name summaries in the log | medium | mitigate | React escapes the rendered summary; the route caps client-supplied names at 120 chars and falls back to ids; names are display-only and never used for writes |
| T-dqq-05 | Repudiation | stock writes | medium | mitigate | Every successful write logs stock_added / stock_removed / usage_recorded with hospitals: [hospitalId] after resetResultsCache, so the drill-in Recent activity and the log sheet both show it |
| T-dqq-06 | Information disclosure | inventory aggregates | low | accept | Only aggregate stock/usage numbers are written and shown; no PHI, consistent with the project constraint |
</threat_model>

<verification>
- Automated: `npm test && npm run typecheck && npm run build` all pass (Task 1 alone must take typecheck from red to green).
- Unit: lib/stock/form.test.ts covers add/remove/usage body shapes, blank used qty -> null, and the unknown-action throw.
- Route (curl or page.request with a hospital_admin cookie): `POST /api/inventory` with another hospital's id returns 403; with a blank usedQty the usage write succeeds (missing day); a non-numeric usedQty returns 400; no cookie returns 401.
- Browser (demo role switcher, DEMO_AUTH; a second server on :3100 if :3000 is taken):
  (a) hospital admin: the top-bar "Enter stock" opens stock-sheet; stock-hospital is a disabled select naming its own hospital; the medicine list is the network's medicines; the current-stock line matches the drill-in number.
  (b) add 20 units with expiry 2027-01-31 -> stock-confirm appears, the value fields clear, and after the refresh the dashboard stock number for that hospital+medicine is higher.
  (c) remove 5 units -> confirm; record usage with the used-units field blank -> confirm and no error (missing day stored, not rejected).
  (d) network admin: stock-hospital is an enabled select listing every hospital; switching it moves the current-stock line; the same three actions work for any hospital.
  (e) the drill-in shows "Enter stock" (hospital-enter-stock) only for the network admin and a hospital's own admin, opens the sheet pre-selected, and closing the sheet returns to the drill-in.
  (f) the activity log (Logs, and the drill-in "Recent activity") lists the write under the hospital involved with the display-name summary; Escape closes the sheet.
</verification>

<success_criteria>
- All seven must-have truths hold: green suite/typecheck, the role-scoped three-action sheet, network-any vs hospital-own hospital fields, the 403 backstop, reset + confirmation + refresh on success, the activity-log row, and both entry points with Escape closing.
- DATA-01 and DATA-02 finally have a UI on the frozen scripts/entry.ts write path; the engine, contracts, schema and middleware are untouched, and no packages were added.
</success_criteria>

<output>
Create `.planning/quick/261009-dqq-manual-stock-entry-panel-for-hospital-ad/261009-dqq-SUMMARY.md` when done
</output>
