# Phase 04 — UI Review

**Audited:** 2026-10-08
**Baseline:** abstract 6-pillar standards (no UI-SPEC.md exists for this project — confirmed: no `*SPEC*` file in `.planning/phases/04-dashboard-ui/`)
**Screenshots:** not captured (Playwright browser binaries not installed in this environment — `chrome-headless-shell` missing; audit is code-only, grounded in the live-DOM evidence already recorded in 04-UAT.md Tests 1–9 and 04-VERIFICATION.md 29/29)
**Interaction captures:** off (no `interaction_capture` config; interaction findings below are code-derived and marked as such)

**Must-have context (not re-litigated):** 04-VERIFICATION.md `passed` 29/29; 04-UAT.md 12/12 pass with live headless-Chrome DOM evidence (6 cards with fixture numbers, 9 badge nodes, 15 SVG sparklines, filter banner + Clear, deep-link + unknown-id fallback, scope-honest captions, h-city 16d `ok` agreement, chat-fab collapse, chips/composer/fallback, role views, MAPE 6.2% + advisory + Outbreak rendering). Nothing below contradicts those verdicts — findings are visual/quality-layer only.
**Carried advisories:** L-01..L-11 from 04-REVIEW.md remain open per 04-REVIEW-DISPOSITION.md and are referenced, not re-litigated, in each pillar.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Specific, guided copy throughout; badge vocabulary inconsistent across cards (`ok` vs `low` vs `Nd left`) |
| 2. Visuals | 3/4 | Clear hierarchy, labeled controls, no icon-only buttons; drill-in stacks below grid instead of beside it (carried L-06) |
| 3. Color | 2/4 | Coherent token system + restrained accent; two WCAG-AA text-contrast failures + widespread hardcoded hex duplicates |
| 4. Typography | 3/4 | Coherent size roles; 7 sizes / 6 weights with indistinguishable 600/650/700 cluster, untokenized |
| 5. Spacing | 3/4 | Token scale used consistently per role; ~20 off-scale one-off padding literals, single breakpoint only |
| 6. Experience Design | 3/4 | Excellent state coverage (skeleton, empty, fallback, fail-closed roles); Approve/Order are silent no-op dead ends; no error boundary |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **Fix failing text contrast on `(read-only)` and the advisory band** — low-vision users cannot read 12px `#94a3b8`-on-white (~2.6:1, fails even 3:1) or 11px semibold `#64748b`-on-`#e2e8f0` (~3.9:1, needs 4.5:1) — change `components/panel/MedicineRow.tsx:208` `colors.textMuted` → `colors.textSecondary`, `components/cards/MovesCard.tsx:91,141` hardcoded `#94a3b8` → `colors.textSecondary`, and darken `components/cards/ForecastCard.tsx:143-154` `advisoryBandStyle` text to `#475569` (or darken band bg).
2. **Give Approve/Order buttons honest non-dead-end behavior** — visible enabled buttons with `onClick={() => {}}` do nothing on activation for mouse, keyboard, and screen-reader users alike — add `aria-disabled="true"` + visible `(prototype — wires up in Phase 5)` caption (or convert to disabled buttons with the existing title text as adjacent copy) in `components/cards/MovesCard.tsx:80-92,130-142` and `components/panel/MedicineRow.tsx:197-207`.
3. **Bind hardcoded color/weight literals to `theme/tokens.ts`** — ~40 hex literals duplicate token values (`#0f172a`, `#475569`, `#64748b`, `#e2e8f0`, `#2563eb`, `#eff6ff`) across `InventoryCard.tsx:63-65`, `MovesCard.tsx:182`, `ui.tsx:119`, all card sub-copy; `fontWeight: 650/750/800` one-offs collapse to 600/700 — prevents visual drift before Phase 5 touches these files.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Method:** string audit over `app/` + `components/`; zero hits for generic `Submit`/`Click Here`/`OK` (only `onSubmit` prop identifiers in `PromptBar.tsx`).

**What holds up (verified against live-DOM evidence, not just existence):**
- CTA labels are specific: `Refresh` (`Header.tsx:71`), `Clear` (filter banner, `app/page.tsx:328-341`), `Close` (panel), `Approve`/`Order` (moves), `Send` (composer, `PromptBar.tsx:78`), `Chat`/`Hide` (dock/FAB). `Hide` carries `aria-label="Collapse chat"` (`ChatPanel.tsx:108`).
- Scope-honest captions per G-04-1 fix: `"N units at {hospital}"` vs `"N units network-wide"` (`InventoryCard.tsx:37-39`); move rows read `Send X units Med Y from A to B, arrives in N days` (`MovesCard.tsx:64-79`); sender rationale vocabulary present (`MedicineRow.tsx:100-135`).
- Empty states are guided and per-surface: `No hospitals seeded yet — upload CSV in data entry` with link (`app/page.tsx:286-293`); per-card `No <x> for this filter.` (`ForecastCard.tsx:44`, `ShortageCard.tsx:28`, `ExpiryCard.tsx:28`, `MovesCard.tsx:53`, `PrioritiesCard.tsx:28`); chat `No system results to quote yet.` (`ChatPanel.tsx:116-118`); safe fallback `I can only answer from system results` (`mock-answers.ts:35`).
- Unknown-id path names the problem and the next step: `Unknown hospital` + `No hospital with id … Pick one of the hospitals below.` (`HospitalPanel.tsx:69-82`).

**WARNING — badge vocabulary inconsistent across surfaces:**
- `InventoryCard.tsx:92-96` renders `ok` / `{N}d left`; `ShortageCard.tsx:73-75` and `ExpiryCard.tsx:72-74` render `critical` / `low`; `HospitalPanel.tsx:163-173` renders `{N} critical` / `{N} low` / `stocks healthy`. A `warning`-level row reads `low` in two cards while the token itself is named `warning` (`tokens.ts:32-37`, `label: "low"` — carried L-11). An admin comparing inventory (`3d left`) to shortage (`low`) must learn two vocabularies for one scale. **Fix:** single badge-copy source — e.g. always render `token.label` (L-11) or always `{N}d left` + level color.

### Pillar 2: Visuals (3/4)

**Method:** component-structure review + live-DOM facts from UAT (9 badge nodes, 15 sparklines, ranked priorities with reason chips, transit-day move rows).

- **Focal point / hierarchy:** present and legible. H1 22/700 (`Header.tsx:39-45`) → card titles 15/650 (`ui.tsx:41-47`) → row names 13/600 → sub-copy 12/secondary. Rank numerals 14/800 (`PrioritiesCard.tsx:51-60`) and red Outbreak/critical chips pull the eye to what matters (priorities, shortages) — correct for an ops dashboard. Six equal cards is the specified design (D-01), so the absence of a single dominant focal point is contract-conformant, not a defect.
- **Icon-only buttons:** none unlabeled. The `▾` chevron (`MedicineRow.tsx:245-255`) is `aria-hidden` inside a text-labeled toggle with `aria-expanded`; sparklines are `role="img"` with rising/falling labels (`ui.tsx:109-115`); `title` tooltips on Approve/Order and the advisory band (`ForecastCard.tsx:77`, `MovesCard.tsx:85,135`).
- **Card weight:** uniform surfaces (`cardRadius 12`, one shadow, 16px padding via `ui.tsx:19-32`) — badges/chips carry the differentiation, not chrome. Appropriate 60/30/10 read: light-gray page, white cards, pastel badge fills, accent reserved for actions.
- **WARNING — drill-in placement (carried L-06, referenced not re-litigated):** `<aside>` renders in normal flow *below* the grid (`app/page.tsx:392-399`, `HospitalPanel.tsx:339-348` `marginTop`) rather than beside it at 1280px+. Functionally complete per UAT Test 5; visually a section, not a side panel. Fix direction unchanged from L-06: two-column flex row at the desktop breakpoint, or amend the D-09 wording.
- **Minor (code-derived, no interaction capture):** sparkline color semantics — rising stroke `#dc2626` red vs falling `#2563eb` blue (`ui.tsx:119`) — red parses as *danger*, so a surging-usage (bad) line and the choice of red-for-up can mislead; consider neutral ink for both with direction in the existing `aria-label`. Related carried items: L-01 (first-medicine trend as hospital trend), L-08 (red `trend mode` badge), L-09 (fallback sparkline resembles a forecast).

### Pillar 3: Color (2/4)

**Method:** hex/token grep across `app/`, `components/`, `theme/`. 89 `colors./spacing./badges./surfaces.` token references vs ~40 hardcoded hex literals carrying token-identical values.

- **System is sound:** single source in `theme/tokens.ts:8-18`; accent `#2563eb` appears only on interactive elements (Refresh `Header.tsx:61`, Send `PromptBar.tsx:67`, FAB `ChatPanel.tsx:283`, active pills `roles.tsx:102`/`HospitalPanel.tsx:321`, hospital links). White-on-accent ≈ 5.2:1 passes AA; white-on-outbreak `#dc2626` ≈ 4.8:1 passes AA; `textSecondary #475569` on white ≈ 7.5:1 passes. Accent element count is within restraint (no >10-element spray). `globals.css` mirrors page bg/ink for the shell only — correct.
- **WARNING (contrast, measured):** two text pairs fail WCAG AA —
  1. `(read-only)` 12px `colors.textMuted #94a3b8` on white ≈ **2.6:1** (`MedicineRow.tsx:208`; same hardcoded `#94a3b8` at `MovesCard.tsx:91,141`) — fails even the 3:1 large-text floor. This labels the *action visibility* state, so the users who most need it (role-gated views) get the least legible text.
  2. Advisory band 11px semibold `#64748b` on `#e2e8f0` ≈ **3.9:1** (`ForecastCard.tsx:143-154`) — needs 4.5:1 at this size. Mitigating context (the `advisoryLabel` badge + `days 1–14 actionable` sub-copy) keeps this a WARNING, not a BLOCKER.
- **WARNING (consistency, no visual defect today):** hardcoded duplicates of token values in `InventoryCard.tsx:63-65` (`#eff6ff`, `#2563eb`), `MovesCard.tsx:182` (`#2563eb` link), `ui.tsx:119` (sparkline strokes), `#0f172a`/`#475569`/`#64748b`/`#e2e8f0` repeated across all five card files plus `HospitalPanel.tsx:371`, `ChatPanel.tsx:234,256-257`. Any token change now silently forks the palette. Fix per Top Fix 3.
- Not flagged: `warning` amber `#b45309` on `#fef3c7` and `ok` `#15803d` on `#dcfce7` both clear 4.5:1; `accentHover #1d4ed8` is defined but unused (dead token — trivial cleanup, polish only).

### Pillar 4: Typography (3/4)

**Method:** `fontSize`/`fontWeight` distribution grep over `app/` + `components/`.

- **Sizes in use (7):** 13px ×26, 12px ×21, 11px ×6, 14px ×3, 15px ×2, 22px ×1, 16px ×1. Roles are coherent — 13 body/rows, 12 sub-copy, 11 badges/meta, 14 rank numeral + FAB/Send, 15 card/dock titles, 16 panel title, 22 page H1 — and body copy never exceeds 13px outside titles. Exceeds the abstract >4-size flag, but each step earns its place; no readability defect found.
- **Weights in use (6):** 600 ×14, 700 ×6, 650 ×4, 800 ×1, 750 ×1, 400 ×1. The 600/650/700 cluster is visually indistinguishable at 11–13px and used interchangeably for the same role (row names 600 in cards vs 650 in `ui.tsx:45`/`MedicineRow.tsx:232`; badges 650 in `ui.tsx:76` vs 600 in `ForecastCard.tsx:152`).
- **WARNING:** consolidate `650 → 600`, `750/800 → 700` (or keep one display weight), and move sizes/weights into `theme/tokens.ts` alongside color/spacing so Phase 5 has a type scale to bind to. No system-font issue: stack in `globals.css` with antialiasing; `button { font: inherit }` correctly normalizes control type.

### Pillar 5: Spacing (3/4)

**Method:** spacing-literal distribution grep; layout-module review.

- **Grid correctness (code + UAT Test 2):** `DashboardGrid.module.css:3-13` — single column base, `repeat(3, minmax(0, 1fr))` at ≥1280px, `gap 16` (= `spacing.lg`), `fillStyle minWidth: 0` flex-column so cards equalize. Page `maxWidth 1440` + `padding xl 24` (`app/page.tsx:410-414`). Matches the specified 1280px breakpoint exactly (`tokens.ts:73-77`). No intermediate breakpoint: a 768–1279px tablet gets the single-column stack — verified acceptable stacking with scroll, but two-column at `md` would use tablet width better (polish advisory).
- **Token discipline is real:** `spacing.sm` ×19, `.lg` ×5, `.md` ×4; row buttons uniformly `6px 8px` across all five cards; switcher/chip pills uniformly `4px 12px`; card gap `spacing.sm`. Rhythms read as intentional, not accidental.
- **WARNING:** ~20 off-scale one-off literals outside the 4/8/12/16/24/32 scale — `6px` (row padding), `10px` (`1px 10px` badges/buttons, `6px 10px` bubble, `10px 20px` FAB), `14px` (`8px 14px` Send), `2px` badge/button verticals, `4px 2px` history padding (`ChatPanel.tsx:251`). None is visually broken and per-role consistency holds, but the scale is descriptive, not enforced. Fix: add `xxs: 2`, `pill-y`/`row` aliases to `theme/tokens.ts` and bind the literals.
- Skeleton grid (`app/page.tsx:416-419`) is single-column while the loaded grid is 3-column at desktop — skeleton-to-content layout shift on mount (minor; skeletons show pre-`mounted` only).

### Pillar 6: Experience Design (3/4 — code-derived; interaction capture off)

**Method:** state-path grep + prop-flow review. Live behaviors below are per UAT CDP evidence; feel-level claims (focus order, timing) are code-derived and labeled.

- **Loading:** `SkeletonCard` ×6 with `aria-busy` (`ui.tsx:129-133`) behind `mounted` gate + `Suspense` fallback (`app/page.tsx:344-350,423-425`). Present and labeled. ✓
- **Empty:** per-card filtered empties + guided zero-hospital state with data-entry link (`app/page.tsx:269-297`); chat `chat-empty`; panel `No moves for {display}`; unknown-id guided copy with switcher (`HospitalPanel.tsx:62-90`). ✓
- **Error/invalid input:** unknown `?hospital` dropped via `router.replace` + null-guard at every consumer (`app/page.tsx:111-119,125`, `HospitalPanel.tsx:62`); `formatUpdatedAgo` NaN-timestamp edge is carried L-04-adjacent/L-03 — referenced, not scored. No `ErrorBoundary`/`error.tsx` exists: a fixture-import or render throw blanks the whole screen with no recovery copy. Prototype risk is low (static local fixture) but the failure mode is total — WARNING, add a route-level `error.tsx` in Phase 5.
- **Disabled states:** `PromptBar` models it correctly (`disabled` → `not-allowed` + 0.6 opacity, `PromptBar.tsx:62-76`). **WARNING — silent no-op actions:** `Approve`/`Order` render as enabled buttons with `onClick={() => {}}` (`MovesCard.tsx:80-92,130-142`, `MedicineRow.tsx:197-207`); activation gives zero feedback to sighted, keyboard, or screen-reader users — only a hover `title` tooltip explains prototype status, which keyboard/AT users may never encounter. Display-only is the documented contract (roles stub, Phase 5 wiring), so this is a WARNING, not a must-have breach: make the prototype status perceivable on activation (Top Fix 2).
- **Destructive confirmations:** N/A — no destructive actions exist. **No polling:** verified clean; Refresh is a full reload (`Header.tsx` + `app/page.tsx:303`). ✓
- **Keyboard (code-derived):** all interactive elements are native `<button>`/`<input>` in logical DOM order; `aria-pressed` (inventory rows, switcher, role toggle), `aria-expanded` (medicine rows), `role="log"` + `aria-label="Conversation"` (chat history), `role="alert"` (outbreak) all present. No `outline: none` anywhere — native focus rings intact. Not verified live: no `:focus-visible` enhancement (focus ring is browser-default thin), chat FAB/dock tab order when `aria-hidden` collapsed section stays mounted with `display:none` (correctly unfocusable). Recommend one keyboard pass with visible-focus check in Phase 5 human verification.
- **Carried interaction items (referenced):** L-05 double-send duplicate keys (`ChatPanel.tsx:72-85`), L-07 no auto-restore after drill-in closes (`ChatPanel.tsx:57-59`), L-04 query-param clobbering (`app/page.tsx:115-131`), L-02 `move`-prefix matcher gap, L-10 `orderRows` memo deps.

---

## Registry Safety

Skipped — `components.json` absent (no shadcn initialization); no third-party registries in play. Nothing to audit.

---

## Files Audited

`app/page.tsx`, `app/globals.css`, `components/Header.tsx`, `components/cards/DashboardGrid.tsx`, `components/cards/DashboardGrid.module.css`, `components/cards/ui.tsx`, `components/cards/InventoryCard.tsx`, `components/cards/ForecastCard.tsx`, `components/cards/ShortageCard.tsx`, `components/cards/ExpiryCard.tsx`, `components/cards/MovesCard.tsx`, `components/cards/PrioritiesCard.tsx`, `components/panel/HospitalPanel.tsx`, `components/panel/MedicineRow.tsx`, `components/chat/ChatPanel.tsx`, `components/chat/PromptBar.tsx`, `components/chat/mock-answers.ts` (copy/quote surface only), `components/OutbreakBanner.tsx`, `components/roles.tsx`, `theme/tokens.ts` — plus `.planning/phases/04-dashboard-ui/04-VERIFICATION.md`, `04-UAT.md`, `04-REVIEW.md` (L-01..L-11), `04-REVIEW-DISPOSITION.md` as evidence baselines. Screenshots not captured (no Playwright browsers); interaction capture off.

## Verdict

No BLOCKERs. All 6 pillars sit at 2–3/4 with concrete WARNING-level fixes; none contradicts the earned 29/29 must-have `passed` status or the 12/12 UAT. Highest-weight item is the Color contrast pair (Pillar 3, 2/4) — small, mechanical, and fixable in minutes. Recommend folding Top Fixes 1–3 plus the L-series into the Phase 5 polish pass rather than a dedicated rework phase.
