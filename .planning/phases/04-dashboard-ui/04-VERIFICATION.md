---
phase: 04-dashboard-ui
verified: 2026-10-08T14:00:00Z
status: gaps_found
score: 21/23 must-haves verified
must_haves_verified: 21
must_haves_total: 23
gaps_count: 6
advisory_count: 11
build: pass
---

# Phase 04 Dashboard UI — Verification Report

**Phase goal:** The administrator runs the whole network from one screen and can drill into any hospital.
**Requirements in scope:** UI-01, UI-02 (both declared by 04-01/04-02/04-03; REQUIREMENTS.md already marks both Complete).
**Plans verified:** 04-01-PLAN.md (7 truths), 04-02-PLAN.md (7 truths), 04-03-PLAN.md (9 truths) = 23 must-have truths.
**Code review input:** 04-REVIEW.md (2 high / 4 medium / 11 low, all `open` per 04-REVIEW-DISPOSITION.md) — factored below honestly.
**Build:** `npm run build` re-run during verification — PASS (Next.js 16.4.0, all routes static).

## Must-have verification

### Plan 04-01 — Dashboard tracer (UI-01)

| # | Truth | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Six equal cards on one screen at 1280px+, stacked with scroll below | PASS | `app/page.tsx:339-377` passes 6 cards into `DashboardGrid`; `components/cards/DashboardGrid.module.css:9-13` — 3-col grid at min-width 1280px, single column below |
| 2 | Each card shows numbers with red/amber badges plus a small trend line, no heavy per-card charts | PASS | `Badge` + `Sparkline` in Inventory/Shortage/Forecast cards; `package.json` has no chart library; `theme/tokens.ts:83-91` `riskForDaysToStockout` maps to critical/warning/ok |
| 3 | Priorities ranked 1..N with reason chips; moves uses action rows + emergency order rows | PASS | `components/cards/PrioritiesCard.tsx:31-96` ranked `<ol>` with `reasons` badges from fixed vocabulary (`app/data/mock-results.json:88-92`); `components/cards/MovesCard.tsx:57-148` transfer action rows + `Emergency supplier orders` section |
| 4 | Clicking a hospital filters all six cards; `?hospital=id` survives refresh/back/share | **FAIL (H-01)** | Five cards filter via `inScope` (`app/page.tsx:140-141,150,171,187,204,224,240`), but `buildInventoryRows` (`app/page.tsx:46-80`) maps over ALL hospitals with no `selectedId` filter — inventory still lists 3 hospitals and `networkTotal` sums the whole network under an active filter. URL sync itself works (`app/page.tsx:99-119`, unknown-id fallback drops param) |
| 5 | Header shows "Updated X min ago" + Refresh; static load per page load, no polling | PASS | `components/Header.tsx:8-17` `formatUpdatedAgo` + Refresh button (`:56-72`); `app/page.tsx:13,44` static fixture import; `onRefresh={() => window.location.reload()}` (`:262,:291`); no setInterval/polling/fetch in `app/` (grep: only a comment mentions "polling") |
| 6 | Loading skeleton cards; empty network guided empty state linking to Phase 1 data entry | PASS | `SkeletonCard` while `!mounted` (`app/page.tsx:332-337`); zero-hospital empty state with `/data-entry` link (`app/page.tsx:257-285`, `data-testid="empty-state"`) |
| 7 | Drill-in and chat shells mount behind stable prop interfaces | PASS | `HospitalPanel` (`app/page.tsx:379-386`) and `ChatPanel` (`:389-392`) mounted with compatible props; full implementations landed behind them in 04-02/04-03 |

### Plan 04-02 — Drill-in panel (UI-02)

| # | Truth | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Clicking a hospital opens a side panel without leaving the dashboard | PASS (with deviation L-06) | `HospitalPanel` returns `null` when `!hospitalId` and renders `<aside>` otherwise (`components/panel/HospitalPanel.tsx:58,140`); no route change, only `?hospital=id` changes. Deviation: panel lays out BELOW the grid in normal flow (`panelStyle` has `marginTop`, `app/page.tsx:379` renders after grid) — reads as a section, not a beside-the-grid side panel on 1280px+. Functional, placement differs from D-09 wording |
| 2 | Panel shows per-medicine stock with expiry dates, 30-day forecast line, shortage/expiry warnings, moves in/out, priority score reasons | **FAIL partial (H-02)** | All content present: stock + expiry via `MedicineRow` waste (`HospitalPanel.tsx:196-243`), forecast line (`MedicineRow.tsx:269-280`), warnings via badges, moves in/out (`HospitalPanel.tsx:245-280`), priority reasons (`:181-194`). BUT risk derivation disagrees with the dashboard: `app/page.tsx:57-66` uses hospital-global max leadDays/max bufferDays (threshold 4+14=18 → `warning` for h-city/m-cefix 16d), panel uses per-medicine lead/buffer (`HospitalPanel.tsx:107-120`, threshold 4+10=14 → `ok`). Same snapshot shows warning badge on card, healthy-leaning counts in panel |
| 3 | Medicine rows expand to forecast, days-to-stockout, waste, suggested moves | PASS | `MedicineRow` `useState` expand toggle (`MedicineRow.tsx:217-257`); expanded block shows forecast outlook, days-to-stockout vs lead, waste qty + expiry (`:259-280+`), per-medicine moves |
| 4 | Panel switcher changes hospital and refilters main cards; opening updates `?hospital=id` | PASS | `HospitalSwitcher` fixture-id buttons call shared `onSelectHospital` (`HospitalPanel.tsx:291-336`), the same state + URL sync as card clicks (`app/page.tsx:112-119`); T-4-07 validated against fixture |
| 5 | Panel read-only; move rows show transit days + shelf-life-on-arrival with sender rationale | PASS | No `input`/`select`/`textarea`/`contentEditable` in panel (grep clean); `buildMoveDetail` computes transit from directed matrix + shelf-life-from-arrival + rationale (`MedicineRow.tsx:66-147`); `MoveRow` renders transit/shelf/rationale as escaped text (`:155-215`) |
| 6 | Panel header stock-only, no patient load / emergency share | PASS | Header renders units + medicine count + risk counts only (`HospitalPanel.tsx:154-173`); grep for `patientLoad|patient_load|emergencyShare|emergency_share` in `components/panel/` — zero matches |
| 7 | hospital_admin own-full/others-read-only with moves hidden; network_admin full with approve/order | PASS (with latent gap M-04) | `components/roles.tsx:43-59` `canSeeMoveActions/canSeeOrderActions`; threaded into `MovesCard` (`MovesCard.tsx:59-61,111-115`) and panel (`HospitalPanel.tsx:136-137`); `RoleSwitcher` prototype toggle defaults network_admin (`app/page.tsx:91-93`); display-only documented in code. Latent: `isOwnHospital(null,…)` returns `true` (`roles.tsx:34`) — a panel rendered without `ownHospitalId` under hospital_admin would show actions everywhere; `app/page.tsx:92-93` always passes the stub correctly today |

### Plan 04-03 — Chat + advisory/outbreak (UI-01, UI-02)

| # | Truth | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Chat docks right; drill-in collapses chat to floating button, both keep place | PASS (minor deviation L-07) | Fixed right dock (`ChatPanel.tsx:195-209`); stays mounted, hides via `display:none` so scroll/draft/history survive (`:91-97`); `drillInOpen` auto-collapses (`:57-59`); FAB restores (`:180-190`); page passes `drillInOpen={selectedId !== null}` (`app/page.tsx:389-392`). Deviation: collapse is one-way — closing drill-in leaves chat hidden until FAB click (extra click, state preserved, D-17 letter met) |
| 2 | Chat + Prompt Bar primitives only, no streaming/sources | PASS | `ChatPanel.tsx` (message list + chips) + `PromptBar.tsx` (composer only, no sources/model-picker/dictation — `PromptBar.tsx:1-9` documents exclusion); no streaming/sources components, nothing hotlinked |
| 3 | Canned mock Q&A from mock ResultsJSON (with deviation M-01) | PASS (with gap M-01) | `mock-answers.ts:18,37` imports fixture; all four intents build answers from fixture lookups + `checked()` post-check (`:200-203`). Deviation (medium, recorded as gap G-03): only `answerStockoutTiming` accepts `contextHospitalId` (`:125`); `answerMostAtRisk/answerWaste/answerTransfers` (`:69,89,106`) answer network-globally even under `?hospital=h-city` — plan decision table claim "chat respects cross-filter" holds for 1 of 4 intents |
| 4 | Plain answers, no source tags | PASS | Answers are plain template strings (`mock-answers.ts:80-85,98-102,116-121,135-140`); no source-tag rendering in `ChatPanel.tsx` |
| 5 | Three risk chips; stockout timing via composer | PASS | `RISK_CHIPS` has exactly 3 entries (`mock-answers.ts:25-29`); chips render (`ChatPanel.tsx:129-140`); stockout timing reachable via composer keywords (`mock-answers.ts:176-186`) and scoped to filter (`:125-141`) |
| 6 | Session-only in-memory history, refresh clears, no DB, display-only never feeds matching | PASS | History is `useState` (`ChatPanel.tsx:49`); grep `localStorage|sessionStorage|IndexedDB|fetch(` in `components/chat/` + `app/page.tsx` — zero matches; `answerQuestion(question, contextHospitalId)` takes no history param (`mock-answers.ts:147-150`, documented `:143-146`) |
| 7 | Safe fallback for unanswerable questions | PASS | `SAFE_FALLBACK = "I can only answer from system results"` (`mock-answers.ts:22`); unmatched questions return it (`:197`); `checked()` substitutes it when quote check fails (`:200-203`) |
| 8 | Forecast greys days 15-30 with advisory tag + MAPE badge | PASS | Greyed band with advisory tag (`ForecastCard.tsx:75-81`, `advisoryBandStyle:143-154`); MAPE badge from envelope (`:41`, `mape={fixture.mape}` at `app/page.tsx:349`); days 1-14 labeled actionable (`ForecastCard.tsx:68`) |
| 9 | Outbreak hospitals carry red Outbreak chip + forecast notes trend mode while flagged | PASS | `OutbreakBanner` red chip (`OutbreakBanner.tsx:12-28`, `colors.outbreak` `#dc2626`); rendered only when `row.outbreak` (`ForecastCard.tsx:62-66`) sourced from envelope flag (`app/page.tsx:160-162`); trend-mode note only while flagged (`ForecastCard.tsx:88-93`); priorities card also shows Outbreak badge (`PrioritiesCard.tsx:83-85`) |

### Security / scope gates (all PASS)

| Gate | Result |
|------|--------|
| `dangerouslySetInnerHTML` / `__html` / `innerHTML` in `app/ components/ theme/` | ABSENT (matches only in `.planning/` docs) |
| Chat persistence (`localStorage`/`sessionStorage`/`IndexedDB`/`fetch(`) in `components/chat/` + `app/page.tsx` | ABSENT |
| Out-of-scope edits (`app/api/`, `db/`, `lib/`, `scripts/`, `middleware.ts`) | UNTOUCHED — none exist; no phase-04 commit touches them |
| Role gating claims server enforcement | None — display-only documented (`roles.tsx:11-16`, `MovesCard.tsx:5-9`) |

## Requirement traceability

| Requirement | Declared in | Status | Evidence |
|-------------|-------------|--------|----------|
| UI-01 — six risks on one screen | 04-01, 04-03 | SATISFIED with gap | Six-card grid renders from one static fixture load (`app/page.tsx:339-377`); header/refresh/skeleton/empty/chat/advisory all present. Gap: cross-filter does not cover the inventory card (H-01), so "runs the whole network from one screen" holds except filtered-inventory consistency |
| UI-02 — click into any hospital for detail | 04-02, 04-03 | SATISFIED with gap | Panel opens per hospital with full detail + switcher + URL sync (`HospitalPanel.tsx`). Gap: dashboard/panel risk badges can disagree for the same stock (H-02) |
| Every PLAN frontmatter ID accounted for | 04-01→UI-01, 04-02→UI-02, 04-03→UI-01+UI-02 | YES | Union = {UI-01, UI-02}; both in REQUIREMENTS.md Phase 4 scope; no orphaned IDs in either direction |

REQUIREMENTS.md already marks UI-01/UI-02 Complete (04-03 flipped them via the shared-ID gate). This verification says the Complete flag is premature until G-01 (and ideally G-02) are closed — see disposition note below.

## Gaps

### G-01 — Inventory card ignores the hospital cross-filter (HIGH, blocks phase goal)

- **Source:** 04-REVIEW.md H-01, confirmed in code.
- **Failed truth:** 04-01 #4 ("filters all six cards").
- **Fix:** Filter in `buildInventoryRows` (`app/page.tsx:46-80`):
  `data.hospitals.filter((h) => selectedId === null || h.id === selectedId).map(…)`.
  Also scope `networkTotal` (`InventoryCard.tsx:27`) or relabel it when filtered.
- **Suggested plan:** 1-task fix plan (P1-owned `app/page.tsx` + `components/cards/InventoryCard.tsx` only), verify by build + browser click/refresh check.

### G-02 — Dashboard/panel risk badge disagreement for the same stock (HIGH)

- **Source:** 04-REVIEW.md H-02, confirmed in code.
- **Failed truth:** 04-02 #2 (partial — content present, derived risk inconsistent).
- **Fix:** Single shared derivation: compute inventory-row risk from the row's own medicine lead/buffer (panel logic, `HospitalPanel.tsx:107-120`) in `buildInventoryRows` (`app/page.tsx:53-66`), or move `riskForDaysToStockout` evaluation per underlying row inside `InventoryCard`. Concrete divergence on shipped fixture: h-city/m-cefix 16d → dashboard `warning` vs panel `ok`.
- **Suggested plan:** Same or follow-up fix plan as G-01 (same files plus `theme/tokens.ts` untouched); verify by unit-checking both surfaces on the h-city/m-cefix row.

### G-03 — Chat intents 1–3 ignore the active hospital filter (MEDIUM)

- **Source:** 04-REVIEW.md M-01, confirmed: `answerMostAtRisk/answerWaste/answerTransfers` (`mock-answers.ts:69-122`) take no scope; only intent 4 does.
- **Breached claim:** 04-03 decision-table D-04 ("chat respects cross-filter"), not a must-have truth — truths still pass narrowly.
- **Fix:** Thread validated scope (`knownHospitalId`, `mock-answers.ts:63-66`) into all four intents; scope shortages/expiries/moves to the selected hospital when set, prefix answer with hospital name; fall back to global answer (or SAFE_FALLBACK on empty scoped slice).

### G-04 — `answerMostAtRisk` cross-hospital pairing + hardcoded flag vocabulary (MEDIUM)

- **Source:** 04-REVIEW.md M-02 (`mock-answers.ts:69-86`). Today coincidentally correct (top priority and worst shortage are both h-north); breaks on any fixture where they differ. Hardcoded "high load and emergency share" flags vs actual `priorities[].reasons` (e.g. h-city's reason is `["16 days to stockout"]`).
- **Fix:** Pick worst shortage for `top.hospitalId`; quote `top.reasons` vocabulary instead of hardcoded flags.

### G-05 — Numeric quote gate is token-presence-only over a polluted token set (MEDIUM)

- **Source:** 04-REVIEW.md M-03 (`mock-answers.ts:44-52`). Dosage fragments (500/250/200/100 in medicine names), date parts, loads, transport days are all "quotable" — wrong-quantity answers pass when digits coincide.
- **Fix (prototype-scale defense in depth):** Per-answer allow-set from the exact cited rows' fields; at minimum strip medicine-name dosage fragments and date parts from `FIXTURE_NUMERIC_TOKENS`.

### G-06 — `isOwnHospital(null, …)` fails open (MEDIUM, latent)

- **Source:** 04-REVIEW.md M-04 (`roles.tsx:30-36`; panel default `ownHospitalId = null` at `HospitalPanel.tsx:56`, `MovesCard.tsx:41`). Display-only (T-4-06) so medium, not high.
- **Fix:** Return `false` on `null` (unknown owner → hide actions); pass explicit non-null `ownHospitalId` on the network_admin path instead of relying on null-means-all. Note `HospitalPanel.tsx:136` has its own inline `ownHospitalId === null || …` with the same fail-open shape — fix both.

### Advisory — 11 low findings (non-blocking, tracked open)

L-01 (inventory sparkline = first medicine's trend, `app/page.tsx:67`) through L-11 (dead badge `label` field, `theme/tokens.ts:22-56`) per 04-REVIEW.md:135-201. All remain `open` in 04-REVIEW-DISPOSITION.md. Not re-litigated here; recommend triage in the same fix pass as G-01/G-02 (several are one-line: L-02 `startsWith("move")`, L-03 NaN guard, L-10 missing memo dep) or deferral to Phase 5 with explicit disposition updates. L-06 (panel placement) and L-07 (no chat auto-restore) touch must-have wording fidelity and deserve an accept-or-fix decision each.

## Human verification

Browser checks no static verification can cover (no E2E runner in repo; all three SUMMARYs already flag `human_judgment: true` on these):

1. **Cross-filter (post-fix):** click a hospital in each card → all six cards refilter + filter banner appears + Clear restores. **Expected:** inventory included after G-01 fix.
2. **Deep-link refresh/back/share:** open `?hospital=h-north`, refresh (filter persists), back/forward (selection history navigates), paste link in fresh tab (pre-filtered), unknown id (unfiltered, param dropped).
3. **Panel open/switch:** click hospital → panel appears with full detail; switcher buttons refilter cards + update URL; Close clears filter.
4. **Chat dock collapse/restore:** open drill-in → chat collapses to FAB; FAB restores with scroll/draft/history intact; manual Hide works when no drill-in.
5. **Chips + composer answers:** tap all 3 chips → plain 1–2 sentence quoted-number answers; composer stockout question under active filter → scoped answer; gibberish question → "I can only answer from system results".
6. **Fallback:** ask for data outside the fixture (e.g. a medicine not seeded) → safe fallback, never a fabricated number.
7. **Advisory/outbreak rendering:** forecast rows show greyed 15–30 band + advisory tag + MAPE badge; h-north rows show red Outbreak chip + trend-mode note; h-city/h-river show neither.
8. **Role views:** flip RoleSwitcher to hospital_admin → move/order Approve/Order buttons hidden off h-city, visible on h-city; network_admin → visible everywhere.

## Disposition

- **Status rationale:** 21/23 must-have truths verified in code with build green and all security/scope gates clean. Two HIGH review findings reproduce as genuine must-have breaches (G-01 fails 04-01 #4 outright; G-02 partially fails 04-02 #2), so the phase goal — "runs the whole network from one screen" with consistent drill-in — is not yet fully achieved. Status is `gaps_found`, not `passed`.
- **On REQUIREMENTS.md:** UI-01/UI-02 were flipped Complete by the 04-03 shared-ID gate. Recommend leaving the flags but treating them as provisional until G-01 is closed (G-02..G-06 + lows can follow in the same fix pass or Phase 5 with disposition updates to 04-REVIEW-DISPOSITION.md).
- **Suggested next command:** `/gsd-plan-phase --gaps` against this report (G-01+G-02 one-task P1 fix; G-03..G-06 second pass), then re-verify with browser human checks above.
