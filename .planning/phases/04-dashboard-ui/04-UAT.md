---
status: complete
phase: 04-dashboard-ui
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-10-08T18:40:00Z
updated: 2026-10-08T20:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold start smoke test
expected: Dev server boots without errors; http://localhost:3000 loads all six dashboard cards with fixture numbers (no blank page, no error overlay).
result: pass
evidence: "npm run dev booted, HTTP 200; live headless-Chrome DOM shows all 6 cards with fixture numbers (14,280 units, MAPE 6.2%, score 87); npm run typecheck + build green"

### 2. Six-card grid layout
expected: One screen shows six equal cards — inventory, forecast, shortage risk, expiry risk, recommended moves, priority hospitals — with red/amber badges, small trend lines, ranked 1..N priorities with reason chips, and move action rows ("Send X units Med Y from A to B, arrives in N days") plus emergency order rows. At 1280px+ a full grid; on a narrow window a vertical stack with scroll.
result: pass
evidence: "Live DOM: all 6 cards with red/amber badges (9 badge nodes), 15 SVG sparklines, ranked priorities with reason chips, move action rows with transit days + emergency order rows; DashboardGrid CSS module provides 1280px grid/stack"

### 3. Hospital cross-filter and deep link
expected: Clicking a hospital in any card filters ALL SIX cards to it with a visible clear control. Reloading /?hospital=<id> restores the filter; back/forward navigates selection history; a pasted link opens pre-filtered; an unknown id falls back to the unfiltered dashboard with the param dropped.
result: pass
evidence: "Live CDP: clicked inventory-row-h-river -> URL ?hospital=h-river + 'Filtered to Riverside Clinic' banner + Clear; Clear restores '/' + network-wide; ?hospital=nope-unknown loads unfiltered with param dropped; h-city inventory reads '8,060 units at City Central Hospital' (scope-honest, G-04-1)"

### 4. Header timestamp, Refresh, loading and empty states
expected: Header shows "Updated X min ago" plus a manual Refresh button; Refresh reloads data once with no auto-polling. While loading, skeleton cards show. (Empty state only when the fixture holds zero hospitals: guided copy "No hospitals seeded yet - upload CSV in data entry" linking to data entry.)
result: pass
evidence: "Live DOM: 'Updated 3 hours ago' + Refresh button (click reloads dashboard cleanly, no polling in source); SkeletonCard loading path with data-testid loading-skeletons/page-suspense-fallback; empty-state copy 'No hospitals seeded yet' at app/page.tsx:286"

### 5. Drill-in side panel and hospital switcher
expected: Clicking a hospital opens a side panel without leaving the dashboard, showing per-medicine stock with expiry dates, 30-day forecast line, shortage/expiry warnings, its moves in/out, and priority score reasons. Panel header is stock-only (no patient load or emergency share stats). Panel contains no editable fields. The hospital switcher refilters the main cards and updates ?hospital=id exactly like card clicks.
result: pass
evidence: "Live CDP: ?hospital=h-north opens <aside> panel with per-medicine stock, 5 medicine toggles, moves in/out, priority #1 score 87 with reasons; header '3,450 units, 5 medicines' stock-only; switcher click -> URL ?hospital=h-city + banner (same onSelectHospital path as card clicks)"

### 6. Expandable medicine rows and move rationale
expected: Every medicine row expands to forecast, days-to-stockout, waste quantity, and suggested moves for that medicine. Every move row states transit days and the shelf-life-on-arrival check plus a short sender rationale (buffer, need cap, waste-first, or nearest-sender preference).
result: pass
evidence: "Live CDP: medicine toggle aria-expanded false->true, detail shows days-to-stockout, transit days, shelf-life OK, rationale 'why this sender: nearest sender (1d transit); sender keeps 21d cushion above 10d buffer; covers ~2d of demand (need-cap)'"

### 7. Role-filtered views
expected: Flipping the role toggle changes visible actions in both dashboard and panel: hospital_admin sees own hospital full and other hospitals read-only with moves actions hidden; network_admin sees the full dashboard with approve/order actions visible. (Display-only prototype gating; server enforcement belongs to Phase 3.)
result: pass
evidence: "Live CDP: network_admin 5 actions (3 Approve + 2 Order) -> hospital_admin 2 Approve, both own-hospital (h-city) outgoing sends; all Order buttons + other-hospital moves hidden; null-owner fails closed per roles.tsx:36 + HospitalPanel.tsx:137 (G-04-6, code-verified unchanged)"

### 8. Chat dock, risk chips, answers, fallback
expected: Chat docks right; opening the drill-in collapses chat to a floating button that restores it with scroll and draft intact. Three risk-question chips ("Most at risk next week?", "What expires unused?", "Which transfers first?") each return a plain 1-2 sentence answer quoting system numbers with a reason and no source tags; stockout timing is reachable via the composer. Unanswerable questions return "I can only answer from system results". History survives panel toggles but clears on refresh with nothing persisted.
result: pass
evidence: "Live CDP: 3 chips render; drill-in open shows data-testid chat-fab; chip answer: 'Northside Community Hospital is most at risk — Amoxicillin 250mg ... 3 days ... score 87. Reasons: ...' (same-hospital pairing, G-04-4); h-river scoped names Riverside with own reasons (G-04-3); h-city scoped -> safe fallback by design; gibberish -> 'I can only answer from system results'; no source tags; session-only (persistence grep clean)"

### 9. Advisory horizon, MAPE badge, Outbreak chip
expected: Forecast card greys days 15-30 with an advisory tag plus a MAPE badge (e.g. 6%) beside the forecast; days 1-14 read as the actionable window. Outbreak-flagged hospitals carry a red Outbreak banner chip and the forecast card notes trend mode while flagged; non-flagged hospitals show neither.
result: pass
evidence: "Live DOM: MAPE 6.2% badge, 7 advisory mentions with days 15-30 advisory / 1-14 actionable split, 4 Outbreak mentions on h-north rows with 'trend mode' notes; h-city/h-river rows show neither"

### 10. App shell, theme tokens, mock fixture (auto)
expected: Next.js app shell with P1 theme tokens and mock ResultsJSON fixture (3 hospitals x 5 medicines, envelope with generatedAt/MAPE/advisory/outbreak) — build plus fixture-shape check passed.
result: pass
source: automated
coverage_id: 04-01/D1

### 11. Stable panel and chat shells (auto)
expected: HospitalPanel and ChatPanel mount behind stable prop interfaces — build passed with module paths resolving.
result: pass
source: automated
coverage_id: 04-01/D5

### 12. Mock Q&A engine quote post-check (auto)
expected: Canned four-intent answers with numeric quote post-check and safe fallback — quote harness passed (12 intent/fallback + sentence-count + no-source-tags checks, zero non-fixture numbers).
result: pass
source: automated
coverage_id: 04-03/D2

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-04-1
  truth: "Clicking a hospital filters ALL SIX cards to it (04-01 must-have #4)"
  status: resolved
  resolved_by: 04-04-PLAN.md
  resolved_at: 2026-10-08
  reason: "User: fix them all (confirms 04-VERIFICATION.md G-01, source 04-REVIEW.md H-01)"
  severity: blocker
  test: 3
  root_cause: "buildInventoryRows (app/page.tsx:46-80) never filters by selectedId; networkTotal (InventoryCard.tsx:27) stays global"
  artifacts:
    - path: "app/page.tsx"
      issue: "buildInventoryRows ignores selectedId"
    - path: "components/cards/InventoryCard.tsx"
      issue: "networkTotal unscoped when filtered"
  missing:
    - "Filter hospitals by selectedId in buildInventoryRows; scope or relabel networkTotal when filtered"
- gap_id: G-04-2
  truth: "Dashboard and drill-in show consistent risk badges for the same stock (04-02 must-have #2)"
  status: resolved
  resolved_by: 04-04-PLAN.md
  resolved_at: 2026-10-08
  reason: "User: fix them all (confirms 04-VERIFICATION.md G-02, source 04-REVIEW.md H-02)"
  severity: major
  test: 5
  root_cause: "Page uses global-max lead/buffer for row risk (app/page.tsx:53-66) while panel uses per-medicine inputs (HospitalPanel.tsx:107-120); h-city/m-cefix 16d renders warning vs ok"
  artifacts:
    - path: "app/page.tsx"
      issue: "global-max risk derivation diverges from panel"
  missing:
    - "Single shared per-row risk derivation (panel logic) used by both surfaces"
- gap_id: G-04-3
  truth: "Chat respects the active hospital cross-filter (04-03 D-04 claim)"
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: 2026-10-08
  reason: "User: fix them all (confirms 04-VERIFICATION.md G-03, source 04-REVIEW.md M-01)"
  severity: major
  test: 8
  root_cause: "answerMostAtRisk/answerWaste/answerTransfers (mock-answers.ts:69-122) take no scope; only answerStockoutTiming accepts contextHospitalId (:125)"
  artifacts:
    - path: "components/chat/mock-answers.ts"
      issue: "3 of 4 intents answer network-globally under ?hospital filter"
  missing:
    - "Thread validated knownHospitalId scope into all four intents; prefix scoped answers with hospital name"
- gap_id: G-04-4
  truth: "Most-at-risk answer pairs the worst shortage with its own hospital and quotes actual priority reasons"
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: 2026-10-08
  reason: "User: fix them all (confirms 04-VERIFICATION.md G-04, source 04-REVIEW.md M-02)"
  severity: minor
  test: 8
  root_cause: "answerMostAtRisk (mock-answers.ts:69-86) pairs entities across hospitals and hardcodes flag vocabulary instead of quoting priorities[].reasons"
  artifacts:
    - path: "components/chat/mock-answers.ts"
      issue: "cross-hospital pairing + hardcoded flags"
  missing:
    - "Pick worst shortage for top.hospitalId; quote top.reasons vocabulary"
- gap_id: G-04-5
  truth: "Chat quote gate rejects answers containing non-fixture numbers"
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: 2026-10-08
  reason: "User: fix them all (confirms 04-VERIFICATION.md G-05, source 04-REVIEW.md M-03)"
  severity: minor
  test: 8
  root_cause: "Token-presence gate over polluted FIXTURE_NUMERIC_TOKENS (mock-answers.ts:44-52): dosage fragments, date parts, loads, transport days all quotable"
  artifacts:
    - path: "components/chat/mock-answers.ts"
      issue: "gate passes wrong-quantity answers when digits coincide"
  missing:
    - "Per-answer allow-set from cited rows; at minimum strip name-dosage fragments and date parts"
- gap_id: G-04-6
  truth: "Unknown-owner panel hides move/order actions (fail closed)"
  status: resolved
  resolved_by: 04-05-PLAN.md
  resolved_at: 2026-10-08
  reason: "User: fix them all (confirms 04-VERIFICATION.md G-06, source 04-REVIEW.md M-04)"
  severity: minor
  test: 7
  root_cause: "isOwnHospital(null) returns true (roles.tsx:30-36) with panel default ownHospitalId=null (HospitalPanel.tsx:56, MovesCard.tsx:41); inline copy at HospitalPanel.tsx:136 same shape"
  artifacts:
    - path: "components/roles.tsx"
      issue: "fail-open on null owner"
    - path: "components/panel/HospitalPanel.tsx"
      issue: "inline fail-open copy at :136"
  missing:
    - "Return false on null; pass explicit non-null ownHospitalId on network_admin path; fix inline copy"

## Phase 6 test-id changes (2026-10-09, map-first redesign)

The six-card grid was replaced by one ruled network panel + Leaflet map (06-UI-SPEC). Behaviour from tests 1-9 survives; these ids changed:

| Old | New | Why |
|-----|-----|-----|
| `empty-state-data-entry-link` | retired | `/data-entry` never existed; empty state now says to seed the DB and Refresh |
| `role-switcher-hospital_admin` | `role-switcher-hospital_admin-{hospitalId}` | role switch re-issues the signed session cookie for a chosen hospital |
| `inventory-row-{h}`, `forecast-row-{h}`, `shortage-row-{h}`, `expiry-row-{h}`, `priority-row-{h}` | `stock-row-{h}-{m}`, `forecast-row-{h}-{m}`, `shortage-row-{h}-{m}`, `waste-row-{h}-{m}`, `priority-row-{h}-{m}` | rows are hospital x medicine |
| `move-row-{from}-{to}`, `order-row-{h}` | `transfer-row-{from}-{to}-{m}`, `supplier-order-row-{h}-{m}` | unique per medicine |
| `move-approve-*`, `order-approve-*` | `cart-accept-{from}-{to}-{m}`, `cart-accept-all` | dead-end buttons replaced by the transfer checkout |
| `forecast-advisory-{h}` | `forecast-advisory-{h}-{m}` | per series |
| `page-suspense-fallback` | `loading-skeletons` (app/loading.tsx) | server-rendered page |

Kept: `dashboard-header`, `header-timestamp`, `refresh-button`, `role-switcher`, `outbreak-banner`, `filter-banner`, `clear-filter`, `dashboard-grid`, `loading-skeletons`, `empty-state`, `hospital-panel`, `hospital-panel-close`, `hospital-panel-switcher`, `hospital-panel-header-stock`, `hospital-panel-moves`, `hospital-panel-priority`, `chat-panel`, `chat-fab`, `chat-collapse`, `chat-history`, `chat-empty`, `chat-welcome`, `chat-chips`, `prompt-bar`, `prompt-bar-input`, `prompt-bar-send`.
