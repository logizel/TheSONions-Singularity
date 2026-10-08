---
phase: 04-dashboard-ui
reviewed: 2026-10-08T12:55:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - package.json
  - tsconfig.json
  - next.config.mjs
  - app/layout.tsx
  - app/globals.css
  - app/page.tsx
  - app/data/mock-results.json
  - app/data/results.ts
  - theme/tokens.ts
  - components/Header.tsx
  - components/cards/DashboardGrid.tsx
  - components/cards/DashboardGrid.module.css
  - components/cards/ui.tsx
  - components/cards/InventoryCard.tsx
  - components/cards/ForecastCard.tsx
  - components/cards/ShortageCard.tsx
  - components/cards/ExpiryCard.tsx
  - components/cards/MovesCard.tsx
  - components/cards/PrioritiesCard.tsx
  - components/panel/HospitalPanel.tsx
  - components/panel/MedicineRow.tsx
  - components/roles.tsx
  - components/OutbreakBanner.tsx
  - components/chat/ChatPanel.tsx
  - components/chat/mock-answers.ts
  - components/chat/PromptBar.tsx
findings:
  critical: 0
  high: 2
  medium: 4
  low: 11
  total: 17
status: issues_found
advisory_only: true
---

# Phase 04 (Dashboard UI) — Code Review

**Reviewed:** 2026-10-08T12:55:00Z · **Depth:** standard · **Files:** 26 · **Status:** issues_found (advisory only, never blocks)
**Scope:** plans 04-01/04-02/04-03 — P1-owned `app/` (no `app/api/`), `components/`, `theme/`, root scaffolding. Intent sourced from the three PLAN.md + three SUMMARY.md files.
**Build:** `npm run build` passes, `npm run typecheck` passes (re-verified during review).

## Pass notes (verified clean)

- **XSS:** no `dangerouslySetInnerHTML` / `__html` / `innerHTML` anywhere in `app/`, `components/`, `theme/`. All fixture strings render via JSX interpolation (React escaping). The earlier SUMMARY-noted grep-gate trips were comment literals only.
- **Chat fabrication barrier exists:** `mock-answers.ts` builds answers from fixture lookups (no numeric literals) plus a runtime `checked()` post-check with `SAFE_FALLBACK`. No fake-data path renders directly.
- **Chat persistence:** no `localStorage` / `sessionStorage` / `IndexedDB` / `fetch` / XHR / beacon in `components/chat/` or `app/page.tsx`. History is `useState`-only; collapse uses `display:none` without unmounting, so scroll/draft survive without storage APIs.
- **Out-of-scope edits:** none. `app/api/`, `db/`, `lib/`, `scripts/`, `middleware.ts` do not exist and no phase-04 commit touches them. `package.json` gained only `next`/`react`/`react-dom`/types (per 04-01 plan); 04-02/04-03 added zero dependencies.
- **Role gating:** honestly labeled display-only everywhere (`roles.tsx`, `MovesCard.tsx`, `HospitalPanel.tsx`, `MedicineRow.tsx`); no copy claims server enforcement. The single grep hit for "enforced" is a comment warning *against* treating hidden buttons as a boundary.
- **Secrets / debug artifacts / dangerous functions:** none found.

## High

### H-01 — Inventory card ignores the hospital cross-filter (D-04 breach)

**Severity:** high · **File:** `app/page.tsx:46-80` (plus `app/page.tsx:27,143-146,341-345`)

**Description:** Every card except Inventory scopes its rows through `inScope`/`selectedId`, but `buildInventoryRows` maps over *all* `data.hospitals` and marks `selected` only as a highlight flag. When `?hospital=h-north` is active, forecast/shortage/expiry/moves/priorities show one hospital while Inventory still lists all three hospitals and `networkTotal` (`InventoryCard.tsx:27`) still sums the whole network. "Clicking a hospital anywhere filters all six cards" (D-04) does not hold for the inventory card, and the dashboard contradicts its own filter banner.

**Suggested fix:**

```tsx
function buildInventoryRows(data: ResultsFixture, selectedId: string | null) {
  return data.hospitals
    .filter((h) => selectedId === null || h.id === selectedId)
    .map((h) => { /* ...same body... */ });
}
```

### H-02 — Risk badge for the same stock disagrees between dashboard and drill-in

**Severity:** high · **File:** `app/page.tsx:57-66` vs `components/panel/HospitalPanel.tsx:107-120`

**Description:** The dashboard computes each inventory row with `leadDays = max(all leadDays for the hospital)` and `bufferDays = max(all bufferDays across medicines)` (global max = 14), while the panel computes per-row with that medicine's own lead/buffer. Concrete divergence on the shipped fixture: `h-city`/`m-cefix`, 16d to stockout — dashboard threshold is 4+14=18 → `warning`; panel threshold is 4+10=14 → `ok`, so the panel's critical/warning counts exclude a row the dashboard flags. An admin sees a warning badge on the card and a "stocks healthy"-leaning count in the panel for the same snapshot.

**Suggested fix:** Make `buildInventoryRows` use the same per-medicine inputs as the panel — i.e. compute the row's risk from the minimum `daysToStockout` paired with *that* medicine's lead/buffer (or move `riskForDaysToStockout` evaluation into `InventoryCard` per underlying row) so both surfaces share one function of the same arguments.

## Medium

### M-01 — Chat intents 1–3 ignore the active hospital filter

**Severity:** medium · **File:** `components/chat/mock-answers.ts:69-122,147-156`

**Description:** Only `answerStockoutTiming` accepts `contextHospitalId`; `answerMostAtRisk()`, `answerWaste()`, and `answerTransfers()` take no scope and always answer network-globally. With `?hospital=h-city` active, tapping "Most at risk next week?" answers about `h-north`, and "What expires unused?" quotes `h-city` + `h-river` rows without acknowledging the filter. The 04-03 plan's decision table claims "Chat respects active cross-filter when quoting hospital numbers" (D-04); only 1 of 4 intents does.

**Suggested fix:** Thread the validated scope into all four intents (reuse `knownHospitalId`), e.g. scope shortages/expiries/moves to the selected hospital when set and prefix the answer with the hospital name; fall back to the global answer (or the safe fallback when the scoped slice is empty) explicitly.

### M-02 — `answerMostAtRisk` pairs entities across hospitals and hardcodes flag vocabulary

**Severity:** medium · **File:** `components/chat/mock-answers.ts:69-86`

**Description:** The answer joins the top-ranked priority hospital with the globally lowest `daysToStockout` shortage, which may belong to a *different* hospital (today both happen to be `h-north`, so the shipped output reads correctly by coincidence). The flag clause is also hardcoded — "high load and emergency share" / "...and outbreak" — rather than drawn from that hospital's actual `priorities[].reasons`. If the fixture ever ranks a hospital whose reasons differ (e.g. `h-city`: `["16 days to stockout"]`), the answer asserts flags that hospital does not have while the numeric post-check still passes.

**Suggested fix:**

```ts
const topShortageForHospital = fixture.shortages
  .filter((s) => s.hospitalId === top.hospitalId)
  .sort((a, b) => a.daysToStockout - b.daysToStockout)[0];
if (!topShortageForHospital) return SAFE_FALLBACK;
// quote top.reasons (the fixture vocabulary) instead of hardcoded flags
```

### M-03 — Numeric quote gate is token-presence-only and its token set is polluted

**Severity:** medium · **File:** `components/chat/mock-answers.ts:44-52`

**Description:** `FIXTURE_NUMERIC_TOKENS` is every `\d+` substring of the stringified fixture, so dosage fragments (`500`/`250`/`200`/`100` inside medicine names), date parts (`2026`, `11`, `02`), patient loads, and transport days are all "quotable". An answer stating a wrong quantity (e.g. "500 units") passes as long as `500` appears *anywhere* (it does — both as a dosage and as the emergency-order qty). Presence ≠ correct attribution; T-4-11's runtime gate catches invented magnitudes only when the digits are novel, which a small fixture rarely produces.

**Suggested fix (defense in depth, prototype-scale):** keep `checked()` but build the allow-set per answer from the exact source fields used (e.g. collect the numbers off the rows the answer cites) rather than the whole-fixture bag; at minimum strip medicine-name dosage fragments and date parts from the token set so quantities must match quantity fields.

### M-04 — `isOwnHospital(null, …)` fails open, granting actions on a misconfigured panel

**Severity:** medium · **File:** `components/roles.tsx:30-36` (default `ownHospitalId = null` in `components/panel/HospitalPanel.tsx:56`, `components/cards/MovesCard.tsx:41`)

**Description:** A `null` own-hospital means "no scoping info", yet `isOwnHospital` returns `true`, so `<HospitalPanel role="hospital_admin">` rendered without `ownHospitalId` (or any future caller defaulting it) shows Approve/Order affordances on *every* hospital. `app/page.tsx` always passes the stub correctly today, so this is latent — but the default points the wrong way for a visibility gate: missing identity should hide actions, not reveal them. (Display-only per T-4-06, hence medium, not high.)

**Suggested fix:**

```tsx
export function isOwnHospital(ownHospitalId: string | null, hospitalId: string): boolean {
  if (ownHospitalId === null) return false; // unknown owner → hide actions
  return ownHospitalId === hospitalId;
}
```

and pass `ownHospitalId` explicitly (non-null) for the `network_admin` path instead of relying on the null-means-all shortcut.

## Low

### L-01 — Inventory sparkline shows the first medicine's trend as the hospital's trend

**Severity:** low · **File:** `app/page.tsx:67` (`const trend = rows[0]?.trend ?? []`)

**Description:** Each inventory row's sparkline is `m-para`'s usage trend (first inventory row per hospital), presented unlabeled as the hospital-level trend. For `h-north` the card implies the whole hospital is surging 150→195 when that is one medicine's curve. Either aggregate (e.g. per-day totals) or label it "Paracetamol trend".

### L-02 — Free-text transfer intent misses sentences starting with "move"

**Severity:** low · **File:** `components/chat/mock-answers.ts:166-175`

**Description:** The matcher tests `q.includes(" move")` (leading space), so `"move 400 units from city…"` at string start matches nothing and falls through to the safe fallback, while `"please move…"` works. Add a start-anchored alternative: `q.startsWith("move") || q.includes(" move") …`.

### L-03 — `formatUpdatedAgo` renders "Updated NaN hours ago" on an invalid timestamp

**Severity:** low · **File:** `components/Header.tsx:8-17`

**Description:** `Math.max(0, NaN)` is `NaN`, so every comparison fails through to the hours branch. The shipped fixture date is valid, but a malformed `generatedAt` (prototype hand-edited fixture) produces a nonsense timestamp instead of a fallback. Guard: `if (!Number.isFinite(diffMs)) return "Updated recently";` (or "timestamp unavailable").

### L-04 — Unknown-id cleanup and filter navigation discard unrelated query params

**Severity:** low · **File:** `app/page.tsx:103-118`

**Description:** Both `router.replace(pathname)` and the `selectHospital` push rebuild the URL from `pathname` plus only `?hospital=`, wiping any other query params (analytics tags, future Phase 5 params). Preserve them: clone `searchParams`, set/delete `hospital`, and push `pathname + "?" + params`.

### L-05 — Rapid double-send can duplicate chat message keys

**Severity:** low · **File:** `components/chat/ChatPanel.tsx:72-85`

**Description:** `send` reads `seq` from closure and advances with `setSeq(n => n + 2)`; two submits before re-render mint the same `userId`/`userId+1` pair → duplicate React keys and mislabeled history. Use a `useRef` counter (`const idRef = useRef(1); const userId = idRef.current; idRef.current += 2;`) instead of state for id generation.

### L-06 — Drill-in renders as a stacked section, not a side panel

**Severity:** low · **File:** `app/page.tsx:379-386`, `components/panel/HospitalPanel.tsx:338-347`

**Description:** D-09 says "side panel … opens beside the dashboard"; the `<aside>` sits in normal flow *below* the card grid (full-width, `marginTop`). Functionally complete (detail + switcher + URL sync all work), but on 1280px+ it reads as a page section rather than the specified side/beside placement. Either adjust the decision wording or lay the grid + panel out in a two-column flex row at the desktop breakpoint.

### L-07 — Chat never auto-restores when the drill-in closes

**Severity:** low · **File:** `components/chat/ChatPanel.tsx:57-59`

**Description:** The `drillInOpen` effect only collapses (`if (drillInOpen) setOpen(false)`); clearing the filter leaves chat hidden behind the FAB until the user clicks it. State (scroll/draft/history) is preserved, so D-17's letter is met, but the round trip costs an extra click every time. Track user-initiated collapse separately (e.g. `dismissedRef`) and re-open on `drillInOpen: true → false` only when the collapse was automatic.

### L-08 — Any `trend`-mode forecast gets a red badge, outbreak or not

**Severity:** low · **File:** `components/cards/ForecastCard.tsx:83-87`

**Description:** `level={row.mode === "trend" ? "critical" : "neutral"}` couples forecast *mode* to *severity*. Today every `trend` row belongs to the outbreak hospital, so it reads correctly; a future non-outbreak `trend` row would render a red "trend mode" badge indistinguishable from a shortage critical. Derive severity from the outbreak flag (or use a neutral badge for mode and reserve red for the outbreak chip).

### L-09 — No-forecast fallback still draws a sparkline that looks like a forecast

**Severity:** low · **File:** `components/panel/MedicineRow.tsx:230,269-282`

**Description:** When no forecast row exists, `forecastNext7` falls back to `inv.trend` and the sparkline renders above copy saying "No forecast row for this medicine in the fixture" — the line visually parses as the missing forecast. Either suppress the sparkline when `forecastMode === null` or caption it "recent usage trend (no forecast row)".

### L-10 — `orderRows` memo omits `medicineNameById` from deps

**Severity:** low · **File:** `app/page.tsx:222-235`

**Description:** The memo maps `medicineNameById[o.medicineId]` but deps list only `[selectedId, hospitalNameById]` (silenced with `eslint-disable-next-line`). Harmless with a static import, but the first fixture edit that renames a medicine leaves order rows stale while sibling cards update. Add `medicineNameById` to the dep array like the other memos.

### L-11 — Dead `label` field on every badge token

**Severity:** low · **File:** `theme/tokens.ts:22-56`, `components/cards/ui.tsx:65-82`

**Description:** Each badge token carries a `label` (`"critical"`, `"low"`, …) that nothing reads — `Badge` uses only `background`/`text`/`border` and takes visible text from children. It invites a future caller to render `token.label` and show "low" for a `warning` level. Remove the field or use it as the single source of badge copy.

---

_Reviewer: the agent (gsd-code-reviewer) · Depth: standard · Advisory only — nothing here blocks landing._
