# Phase 3: API, Chat & Access - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Delivers three capabilities for the hospital network prototype: (1) a single ResultsJSON API endpoint that serves precomputed engine output to both dashboard and chat clients, (2) role-based access enforcement via middleware ensuring hospital_admin RW-own/RO-others and network_admin full access, and (3) a rule-based quote-only chatbot with a strict number validator that answers risk questions using only ResultsJSON numbers.

</domain>

<decisions>
## Implementation Decisions

### ResultsJSON API Shape
- **D-01:** Single GET `/api/results` serving the full network payload; dashboard and chat filter client-side — **Reversibility:** reversible — route shape can be refactored without data migration
- **D-02:** Precomputed blob written by engine job; API reads blob, no live assembly — **Reversibility:** costly — switching to live assembly requires reworking the engine output pipeline and all consumers
- **D-03:** Rich envelope including `generatedAt`, MAPE, advisory flags (15-30d), outbreak markers — **Reversibility:** reversible — envelope fields can be added/removed without breaking consumers
- **D-04:** Consume Phase 1 frozen `lib/contracts.ts` ResultsJSON shape verbatim; gaps raised as GitHub issue to owning track — **Reversibility:** one-way — once Phase 5 integration verifies matching numbers, changing the shape breaks the frozen contract

### Auth Enforcement
- **D-05:** Central `middleware.ts` gate for all `/api/*` routes and pages; no per-route checks — **Reversibility:** costly — moving to per-route checks requires auditing every route
- **D-06:** Minimal signed session carrying `role` + `hospitalId`; no auth library in v1 — **Reversibility:** costly — migrating to a full auth library requires session format change and re-login for all users
- **D-07:** Hospital scoping: hospital_admin RW-own / RO-others with 403 on violation — **Reversibility:** reversible — scoping logic can be tightened or loosened without schema changes
- **D-08:** Moves/orders: network_admin-only role gate, no audit log in v1 — **Reversibility:** costly — adding audit log later requires new table in P2 schema and UI in P1

### Chat Intents
- **D-09:** All 4 intents in v1: most-at-risk hospital, stockout timing, waste quantities, transfer reasons — **Reversibility:** reversible — intents can be added/removed independently
- **D-10:** Short answers: 1-2 sentences quoting exact ResultsJSON numbers + reason (e.g. outbreak flag) — **Reversibility:** reversible — template wording is a config change
- **D-11:** Out-of-scope questions get a fixed rejection sentence; best-effort explicitly rejected — **Reversibility:** reversible — rejection text is a constant
- **D-12:** Single-shot only; no follow-up memory — each question standalone — **Reversibility:** costly — adding conversation memory requires session state management

### Validator Strictness
- **D-13:** Exact match: every numeric token in answer must appear verbatim in ResultsJSON; no rounding or unit conversion — **Reversibility:** costly — relaxing to normalized match requires re-validating all existing templates
- **D-14:** Scope: all numbers including dates and day-counts, not just quantities — **Reversibility:** reversible — scope can be narrowed if false positives emerge
- **D-15:** On failure: answer never shown; user receives fixed rejection sentence — **Reversibility:** reversible — fallback behavior is a policy choice
- **D-16:** Validator is a pure post-check function in `lib/chat/` (not API middleware) — survives CHAT-04 LLM swap — **Reversibility:** costly — moving to middleware requires refactoring all chat routes

### the agent's Discretion
- Exact rejection sentence wording (within quote-only constraint)
- Session signing mechanism (HMAC vs JWT) as long as it carries role + hospitalId
- API response caching strategy (as long as freshness metadata is preserved)
- Chat intent matcher implementation details (keyword scoring, fuzzy matching)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` §Phase 3 — Goal, Track, Depends on, Requirements, Success Criteria
- `.planning/REQUIREMENTS.md` §Chatbot — CHAT-01, CHAT-02, CHAT-03
- `.planning/REQUIREMENTS.md` §Access — AUTH-01, AUTH-02

### Project Constraints
- `.planning/PROJECT.md` §Constraints — Chatbot: rule-based + templates + validator, no DB, swappable later
- `.planning/PROJECT.md` §Context — Chatbot is rule-based tiny intent matcher + templates + number validator in v1
- `.planning/PROJECT.md` §Key Decisions — Rule-based chatbot vs whole LLM decision

### Team Ownership
- `docs/TEAM.md` §Tracks — P4 owns `app/api/`, `lib/chat/`, `middleware.ts`
- `docs/TEAM.md` §Workflow — PR rule: only touch track's dirs

### Frozen Contracts (Phase 1 output)
- `lib/contracts.ts` — ResultsJSON shape (frozen in Phase 1, consumed verbatim in Phase 3)
- `db/schema.ts` — database tables (frozen in Phase 1)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield codebase; no `app/`, `lib/`, `db/`, `components/`, `theme/`, or `scripts/` directories exist yet

### Established Patterns
- None — Phase 1 (P2) will establish `db/schema.ts` and `lib/contracts.ts` patterns that Phase 3 consumes

### Integration Points
- `lib/contracts.ts` (Phase 1 frozen) — ResultsJSON type definition that `/api/results` must serve verbatim
- `db/schema.ts` (Phase 1 frozen) — hospital/medicine/usage tables that engine writes to and API reads from
- `theme/tokens.ts` (Phase 1 stub) — UI theme tokens for P1 dashboard consumption of ResultsJSON

</code_context>

<specifics>
## Specific Ideas

- User confirmed all 4 chat intents are in scope for v1 (not a subset)
- User explicitly rejected "best-effort" out-of-scope handling after understanding the medical-safety risk
- User challenged the validator placement recommendation and accepted the reasoning (post-check in `lib/chat/` over API middleware)
- Network admin identity is a team decision, not an implementation lock — noted for team discussion

</specifics>

<deferred>
## Deferred Ideas

- **Audit log for moves/orders** — would require new table in P2 schema and UI in P1; belongs in its own phase if needed
- **Conversation memory for chat follow-ups** — requires session state management; v1 is single-shot by design
- **CHAT-04: LLM swap** — already deferred to v2 per PROJECT.md; validator post-check design survives this swap
- **Network admin credential assignment** — team decision on who holds the demo login; not an implementation concern

</deferred>

---
*Phase: 3-API, Chat & Access*
*Context gathered: 2026-10-08*
