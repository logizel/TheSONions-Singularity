# Phase 4: Dashboard UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 4-Dashboard UI
**Areas discussed:** Single-screen layout, Hospital drill-in, Chat panel, Freshness/states/roles

---

## Single-screen layout

| Option | Description | Selected |
|--------|-------------|----------|
| Priority-first | At-risk hospitals top, then moves/orders, then inventory/forecast tables below | |
| Equal 6-card grid | Inventory, forecast, shortage, expiry, moves, priorities side by side | ✓ |
| Table-first overview | Network table first with risk flags per hospital/medicine | |

**User's choice:** Equal 6-card grid
**Notes:** UI-01 needs all six blocks on one screen; user preferred equal weight over priority-first.

| Option | Description | Selected |
|--------|-------------|----------|
| Numbers + badges | Big numbers + red/amber badges, small trend line; fast to scan, simple on mock ResultsJSON | ✓ |
| Mini charts | Mini bar/line charts per card for 30-day forecast and stock-out curve | |
| You decide | Let planner decide based on BeautifulUI Insight Cards pattern | |

**User's choice:** Numbers + badges
**Notes:** Kept cards scannable rather than chart-heavy.

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop-first stack | 1280px+ shows all 6 cards at once; smaller screens stack vertically with scroll | ✓ |
| Strict one-screen all sizes | One-screen-no-scroll with collapsing sections on all sizes | |

**User's choice:** Desktop-first stack
**Notes:** Prototype simplification; mobile app is out of scope.

| Option | Description | Selected |
|--------|-------------|----------|
| Risk-first order | Priorities and shortage first row, moves/orders second, inventory below | |
| Data-first order | Inventory and forecast first, risks and moves after | |
| Cards + cross-filter | Fixed order but clicking a hospital anywhere filters all 6 cards to it | ✓ |

**User's choice:** Cards + cross-filter
**Notes:** Interactivity chosen over static ordering.

| Option | Description | Selected |
|--------|-------------|----------|
| Advisory shading | Days 1–14 solid, 15–30 greyed with "advisory" tag; MAPE badge beside forecast | ✓ |
| Uniform 30-day | Full 30 days equal weight, no visual difference | |

**User's choice:** Advisory shading
**Notes:** Matches the out-of-scope rule that 15–30d is advisory only.

| Option | Description | Selected |
|--------|-------------|----------|
| Ranked + reasons | Ranked list 1..N with score and reason chips (load, emergency share, days to stockout, substitute) | ✓ |
| Score only | Score only, reasons hidden until hover/click | |

**User's choice:** Ranked + reasons
**Notes:** Visible justification required per PRIOR-02.

| Option | Description | Selected |
|--------|-------------|----------|
| Action rows | "Send X units Med Y from A → B (arrives in N days)" rows plus separate emergency-order rows | ✓ |
| Compact table | From/to/qty only, details on click | |

**User's choice:** Action rows
**Notes:** Clear action language preferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Banner chip | Red "Outbreak" banner chip on hospital + "trend mode" note on forecast card | ✓ |
| Subtle flag | Small dot/flag only, details in drill-in | |

**User's choice:** Banner chip
**Notes:** Outbreak must be impossible to miss.

---

## Hospital drill-in

| Option | Description | Selected |
|--------|-------------|----------|
| Side panel | Stays on one screen, closes back to dashboard | ✓ |
| Modal | Popup focused view per hospital | |
| Separate route | Full page at /hospitals/[id] | |

**User's choice:** Side panel
**Notes:** Keeps the one-screen dashboard context. Later reconciled with chat dock (chat collapses to floating button when panel opens).

| Option | Description | Selected |
|--------|-------------|----------|
| Full detail | Stock table per medicine + expiry, 30-day forecast line, warnings, moves in/out, priority reasons | ✓ |
| Stock only | Stock table only, risks stay on main screen | |

**User's choice:** Full detail

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable rows | Click medicine row expands forecast, days-to-stockout, waste qty, moves for that medicine | ✓ |
| Hospital only | Hospital-level aggregates only, no per-medicine expand | |

**User's choice:** Expandable rows

| Option | Description | Selected |
|--------|-------------|----------|
| Switcher + filter | Panel has hospital switcher dropdown; changing it refilters main cards too | ✓ |
| Close to switch | Close panel to pick another hospital on main screen | |

**User's choice:** Switcher + filter

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only | Panel is read-only; edits happen in Phase 1 data-entry screens | ✓ |
| Inline edit own | Hospital admin can edit own hospital stock/usage inline; others read-only | |

**User's choice:** Read-only
**Notes:** Keeps P1/P2 directory ownership clean.

| Option | Description | Selected |
|--------|-------------|----------|
| Show transit | Each move row shows transit days and shelf-life-on-arrival check | ✓ |
| Hide logistics | Moves show from/to/qty only; logistics hidden | |

**User's choice:** Show transit
**Notes:** Explains why a given sender was chosen.

| Option | Description | Selected |
|--------|-------------|----------|
| Header stats | Header shows beds/load, emergency %, days-to-stockout summary | |
| Stock only | Clinical load hidden; stock numbers only | ✓ |

**User's choice:** Stock only
**Notes:** Priority reasons already carry load/emergency context on the main screen.

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-link | Opening panel updates URL (?hospital=id); refresh/back/shared links keep context | ✓ |
| In-memory only | Panel state in-memory; refresh resets to full dashboard | |

**User's choice:** Deep-link

---

## Chat panel

| Option | Description | Selected |
|--------|-------------|----------|
| Chat docks right | Chat docks right; hospital drill-in opens as center modal to avoid collision | ✓ |
| Floating chat | Chat floats bottom-right over dashboard; drill-in keeps side panel | |

**User's choice:** Chat docks right
**Notes:** Superseded in follow-up: drill-in stays a side panel and chat collapses to a floating button instead (see collision resolution below). User locked BeautifulUI (https://www.beautifului.dev/) as the component source for the chat interface.

| Option | Description | Selected |
|--------|-------------|----------|
| Chat+PromptBar | Tabbed panel + composer with quoted numbers and follow-up suggestions | ✓ |
| Full BeautifulUI set | Streaming text with inline sources + context cards showing quoted ResultsJSON | |

**User's choice:** Chat+PromptBar
**Notes:** Minimal v1; full set deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Canned mock Q&A | Hardcoded Q&A (e.g. "most at risk?", "expiry waste?") answered from mock ResultsJSON | ✓ |
| Free-text stub | Free-text box calling mock API stub echoing quoted numbers | |

**User's choice:** Canned mock Q&A
**Notes:** Proves the quote-only pattern early while Phase 3 API doesn't exist.

| Option | Description | Selected |
|--------|-------------|----------|
| Quoted + source | Each answer lists quoted figures with source tag (hospital · medicine · days) | |
| Plain answers | Plain answer text, no source tags in v1 UI | ✓ |

**User's choice:** Plain answers

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse chat | Drill-in stays side panel; opening it collapses chat to a floating button | ✓ |
| Drill-in to modal | Drill-in becomes center modal whenever chat is docked (revises side-panel call) | |

**User's choice:** Collapse chat
**Notes:** Resolved the side-panel collision while keeping both prior decisions intact.

| Option | Description | Selected |
|--------|-------------|----------|
| 3 risk chips | "Most at risk next week?", "What expires unused?", "Which transfers first?" | ✓ |
| No chips | Empty composer only, no suggestions | |

**User's choice:** 3 risk chips
**Notes:** Matches CHAT-01 risk-question intent.

| Option | Description | Selected |
|--------|-------------|----------|
| Session only | History in-memory per session; refresh clears; no storage | ✓ |
| Persist history | Persist chat history per user in DB | |

**User's choice:** Session only

| Option | Description | Selected |
|--------|-------------|----------|
| Safe fallback | "I can only answer from system results" when mock has no numbers | ✓ |
| Always answer | Hide errors; panel always shows an answer | |

**User's choice:** Safe fallback
**Notes:** Honest failure, no fake data — consistent with quote-only medical safety.

---

## Freshness, states, roles

| Option | Description | Selected |
|--------|-------------|----------|
| Static + refresh | Load mock ResultsJSON once per page load; manual refresh button; no polling | ✓ |
| Polling | Poll mock/API every 30s for live numbers | |

**User's choice:** Static + refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton + guided | Skeleton cards while loading; "No hospitals seeded yet — upload CSV in data entry" empty state | ✓ |
| Spinner only | Simple spinner; blank cards when empty | |

**User's choice:** Skeleton + guided
**Notes:** Empty state links to Phase 1 data-entry screens.

| Option | Description | Selected |
|--------|-------------|----------|
| Role-filtered | Hospital admin sees own hospital full, others read-only; moves actions hidden — only network admin sees approve/order | ✓ |
| Same for all | Same full dashboard for both roles; enforcement comes in Phase 5 | |

**User's choice:** Role-filtered
**Notes:** UI enforces AUTH-01/AUTH-02 directly.

| Option | Description | Selected |
|--------|-------------|----------|
| Timestamp | "Updated X min ago" + manual Refresh button on dashboard header | ✓ |
| No stamp | No timestamp; numbers assumed current | |

**User's choice:** Timestamp
**Notes:** Transparent staleness for static-load model.

---

## the agent's Discretion

None — the user decided every item. One "You decide" option was offered (card density via BeautifulUI Insight Cards) but the user chose "Numbers + badges" directly.

## Deferred Ideas

None — discussion stayed within phase scope. No scope-creep suggestions arose.
