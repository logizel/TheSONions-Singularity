# Phase 4: Dashboard UI - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The administrator runs the whole hospital network from one screen — inventory, forecast, shortage risk, expiry risk, recommended moves, and priority hospitals (UI-01) — and can click into any hospital for its detail (UI-02), with a chat panel alongside. Track P1 owns `app/` (except `app/api/`), `components/`, `theme/tokens.ts`. Builds against the Phase 1 frozen contracts and mock ResultsJSON, so UI work is independent of Phase 3 completion; final wiring happens in Phase 5. No new capabilities beyond this boundary.

</domain>

<decisions>
## Implementation Decisions

### Single-screen layout (UI-01)
- **D-01:** Equal 6-card grid — inventory, forecast, shortage risk, expiry risk, recommended moves, and priority hospitals share the screen as six equal cards
- **D-02:** Numbers + red/amber badges with small trend line inside each card — no heavy per-card charts; fast to scan, simple to build on mock ResultsJSON
- **D-03:** Desktop-first responsive — full 6-card grid at 1280px and above, vertical stack with scroll on smaller windows
- **D-04:** Cards cross-filter — clicking a hospital anywhere filters all 6 cards to it
- **D-05:** Forecast card marks days 15–30 greyed with an "advisory" tag plus a MAPE badge (e.g. 6%) beside the forecast
- **D-06:** Priorities card is a ranked list (1..N) with reason chips (high load, emergency share, N days to stockout, no substitute) so rankings are justifiable per PRIOR-02
- **D-07:** Moves card uses action rows ("Send X units Med Y from A → B, arrives in N days") plus separate emergency supplier order rows
- **D-08:** Outbreak-flagged hospitals get a red "Outbreak" banner chip, and the forecast card notes "trend mode" while flagged

### Hospital drill-in (UI-02)
- **D-09:** Side panel — clicking a hospital opens a side panel, staying on the one-screen dashboard
- **D-10:** Full detail in panel — per-medicine stock with expiry dates, 30-day forecast line, shortage/expiry warnings, its moves in/out, priority score reasons
- **D-11:** Expandable per-medicine rows — clicking a medicine row expands forecast, days-to-stockout, waste quantity, and suggested moves for that medicine
- **D-12:** Hospital switcher in panel — changing it refilters the main cards too
- **D-13:** Read-only panel — edits happen in the Phase 1 data-entry screens, keeping P1/P2 directory ownership clean
- **D-14:** Move rows show transit days and shelf-life-on-arrival check, explaining why that sender was chosen
- **D-15:** Panel header is stock-only — no patient load / emergency share stats in the header
- **D-16:** Deep-linked URL (`?hospital=id`) — opening a hospital updates the URL so refresh, back button, and shared links keep context

### Chat panel
- **D-17:** Chat docks right; opening the hospital drill-in temporarily collapses chat to a floating button — both keep their place, no panel collision
- **D-18:** BeautifulUI Chat (tabbed panel) + Prompt Bar primitives only — not the full BeautifulUI set (no streaming-text/sources in v1)
- **D-19:** Canned mock Q&A answered from the mock ResultsJSON file until the Phase 3 chat API exists
- **D-20:** Plain answers with no source tags in the v1 UI
- **D-21:** Three suggested risk-question chips: "Most at risk next week?", "What expires unused?", "Which transfers first?" (the 4th v1 intent, stockout timing, is reachable via the composer)
- **D-22:** Session-only history — in-memory per session, refresh clears, no DB storage in the prototype; display-only, never feeds the matcher (matching stays single-shot per Phase 3 D-12)
- **D-23:** Safe fallback ("I can only answer from system results") when no number can be quoted for a question — never show fake data

### Freshness, states, roles
- **D-24:** Static load of mock ResultsJSON per page load plus a manual Refresh button — no polling in the prototype
- **D-25:** Skeleton cards while loading; guided empty state ("No hospitals seeded yet — upload CSV in data entry") linking to the Phase 1 screens
- **D-26:** Role-filtered views — hospital admin sees own hospital full and others read-only with moves actions hidden; network admin sees full dashboard with approve/order actions (UI enforces AUTH-01/AUTH-02)
- **D-27:** "Updated X min ago" timestamp plus Refresh button in the dashboard header

### Carried forward from Phases 1 & 3 (pre-answered, not re-discussed)
- Theme finalization is P1's job in Phase 4 on top of the Phase 1 `theme/tokens.ts` stub (Phase 1 D-23; `docs/TEAM.md`) — no theme discussion needed here
- Dashboard scale assumes the Phase 1 seed demo network (~3 hospitals × 5 medicines × 60 days; Phase 1 D-21)
- Drill-in expiry display assumes per-batch stock rows with automatic FIFO deduction and archived (not deleted) expired batches (Phase 1 D-01..D-04); per-medicine `buffer_days`, `substitute_ids`, the directed transport matrix, and per-medicine `lead_days` feed the transit/shelf-life move rows (Phase 1 D-05/D-06, D-12/D-13)
- Dashboard fetches the full ResultsJSON payload once (single GET `/api/results`, client-side filtering; Phase 3 D-01); envelope `generatedAt` drives the header timestamp (D-27), and envelope MAPE / advisory / outbreak flags drive D-05 and D-08 (Phase 3 D-03)
- Role filtering mirrors Phase 3 middleware scoping: hospital_admin RW-own / RO-others, moves/orders network_admin-only with no v1 audit log (Phase 3 D-07/D-08)
- Mock chat answers must follow the Phase 3 answer contract: 1–2 sentences quoting exact ResultsJSON numbers plus reason (Phase 3 D-10), exact-match with no rounding or unit conversion (Phase 3 D-13); the exact rejection-sentence wording is owned by Phase 3, so the D-23 fallback copy is a placeholder

### the agent's Discretion
None — the user decided every item; no "You decide" selections were made.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — UI-01, UI-02 (this phase); CHAT-01..CHAT-03 (quote-only chat rules the panel must honor); AUTH-01/AUTH-02 (role filtering D-26); 15–30d advisory display rule
- `.planning/ROADMAP.md` Phase 4 entry — goal, success criteria, P1 track ownership, mock-ResultsJSON independence note

### Team & project context
- `docs/TEAM.md` — P1 (Likith M Shetty) owns `app/` except `app/api/`, `components/`, `theme/`; UI principal has final say on theme; MCP set (magicuidesign-mcp for P1 components, playwright for dashboard flow verification)
- `.planning/PROJECT.md` — aggregates-only (no PHI), prototype scale (handful of hospitals/medicines), web dashboard first (no mobile app), core value

### Chat component source (user-locked)
- `https://www.beautifului.dev/` — Chat (tabbed chat panel with reasoning replies and composer) + Prompt Bar (composer) primitives for the chat panel; v1 uses Chat + Prompt Bar only (D-18). MIT-licensed copy-paste components — adapt, don't hotlink.

### Prior phase contexts (locked decisions this phase builds on)
- `.planning/phases/01-data-layer-frozen-contracts/01-CONTEXT.md` — batch-row stock model, FIFO, buffer/substitute/transport/lead fields, seed network scale, theme-stub handoff, minimal data-entry pages
- `.planning/phases/03-api-chat-access/03-CONTEXT.md` — `/api/results` shape and envelope, auth scoping, 4 chat intents, answer contract, validator exact-match, single-shot matching

### Frozen contracts (Phase 1 — pending, build against mock until they land)
- `db/schema.ts` — tables (frozen in Phase 1; does not exist yet)
- `lib/contracts.ts` — engine in/out types + ResultsJSON shape (frozen in Phase 1; does not exist yet — planner defines the mock ResultsJSON fixture from this shape once available)
- `theme/tokens.ts` — UI theme tokens decided by P1 (stub frozen in Phase 1; does not exist yet)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo (README + docs + .planning only); no components, hooks, or utilities exist yet

### Established Patterns
- None yet — P1 establishes the first UI patterns in this phase (theme tokens, component choice via magicuidesign-mcp, dashboard conventions)

### Integration Points
- P1-owned `app/` pages (except `app/api/`), `components/`, `theme/` — all new code in this phase lives here
- Mock ResultsJSON fixture (planner defines shape from `lib/contracts.ts` once Phase 1 freezes it) — dashboard cards, drill-in panel, and canned chat Q&A all consume the same fixture so numbers match
- Phase 3 `app/api/` + `lib/chat/` (real ResultsJSON API and rule-based chat) and Phase 5 wiring consume this UI as-is

</code>

<specifics>
## Specific Ideas

- Chat primitives from BeautifulUI: "Chat — tabbed chat panel with reasoning replies and a composer" and "Prompt Bar — composer with @ sources, / commands, model picker, and dictation" (use Chat + Prompt Bar only in v1)
- Move action-row wording: "Send X units Med Y from A → B (arrives in N days)"
- Priority reason-chip vocabulary: high load, emergency share, "N days to stockout", no substitute
- Risk-question chips: "Most at risk next week?", "What expires unused?", "Which transfers first?"
- Advisory treatment: days 15–30 greyed with "advisory" tag; MAPE badge next to forecast (e.g. 6%)
- Deep link form: `?hospital=id`
- Empty state copy: "No hospitals seeded yet — upload CSV in data entry" (links to Phase 1 screens)
- Chat fallback copy (placeholder — exact rejection sentence owned by Phase 3): "I can only answer from system results"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Dashboard UI*
*Context gathered: 2026-10-08*
