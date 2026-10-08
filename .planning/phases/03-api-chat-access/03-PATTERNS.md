# Phase 3: API, Chat & Access - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** 7 new files
**Analogs found:** 0 / 7 (greenfield codebase — no source files exist)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/results/route.ts` | route | request-response | None (greenfield) | N/A |
| `app/api/chat/route.ts` | route | request-response | None (greenfield) | N/A |
| `middleware.ts` | middleware | request-response | None (greenfield) | N/A |
| `lib/chat/intents.ts` | utility | transform | None (greenfield) | N/A |
| `lib/chat/templates.ts` | utility | transform | None (greenfield) | N/A |
| `lib/chat/validator.ts` | utility | transform | None (greenfield) | N/A |
| `lib/chat/index.ts` | service | transform | None (greenfield) | N/A |

## Pattern Assignments

### `app/api/results/route.ts` (route, request-response)

**Analog:** None — greenfield codebase. No `app/` directory exists.

**Pattern source:** Next.js App Router route handler convention + CONTEXT.md decisions D-01 through D-04.

**Expected shape (from decisions):**
- GET handler returning the full ResultsJSON payload verbatim from `lib/contracts.ts`
- Reads precomputed blob (D-02) — no live assembly
- Rich envelope: `generatedAt`, MAPE, advisory flags (15-30d), outbreak markers (D-03)
- Consumes Phase 1 frozen `lib/contracts.ts` ResultsJSON type verbatim (D-04)
- No authentication logic in route itself — middleware handles auth (D-05)

**Build against (Phase 1 output):**
- `lib/contracts.ts` — ResultsJSON type definition (frozen)
- `db/schema.ts` — database tables the engine writes to

---

### `app/api/chat/route.ts` (route, request-response)

**Analog:** None — greenfield codebase. No `app/` directory exists.

**Pattern source:** Next.js App Router route handler convention + CONTEXT.md decisions D-09 through D-16.

**Expected shape (from decisions):**
- POST handler accepting chat query
- Delegates to `lib/chat/index.ts` orchestrator
- Returns chat response or fixed rejection sentence
- No DB access, no calculation — quote-only (D-10, D-11)
- Single-shot only; no follow-up memory (D-12)

**Build against (Phase 1 output):**
- `lib/contracts.ts` — ResultsJSON type for extracting numbers to quote

---

### `middleware.ts` (middleware, request-response)

**Analog:** None — greenfield codebase. No `middleware.ts` exists.

**Pattern source:** Next.js middleware convention + CONTEXT.md decisions D-05 through D-08.

**Expected shape (from decisions):**
- Central gate for all `/api/*` routes and pages (D-05)
- Minimal signed session carrying `role` + `hospitalId` (D-06)
- Hospital scoping: hospital_admin RW-own / RO-others with 403 on violation (D-07)
- Moves/orders: network_admin-only role gate (D-08)
- No auth library in v1 — HMAC or JWT session signing (agent's discretion)

**Build against (Phase 1 output):**
- `db/schema.ts` — user/hospital/role columns for ownership checks

---

### `lib/chat/intents.ts` (utility, transform)

**Analog:** None — greenfield codebase. No `lib/` directory exists.

**Pattern source:** CONTEXT.md decisions D-09, D-10.

**Expected shape (from decisions):**
- Rule-based intent matcher for 4 intents (D-09):
  1. Most-at-risk hospital
  2. Stockout timing
  3. Waste quantities
  4. Transfer reasons
- Keyword scoring / fuzzy matching (agent's discretion)
- Returns matched intent + extracted parameters for template filling

**Build against (Phase 1 output):**
- `lib/contracts.ts` — ResultsJSON shape to know what data is available to match against

---

### `lib/chat/templates.ts` (utility, transform)

**Analog:** None — greenfield codebase. No `lib/` directory exists.

**Pattern source:** CONTEXT.md decisions D-10, D-11.

**Expected shape (from decisions):**
- Answer templates for each intent (D-10)
- Short answers: 1-2 sentences quoting exact ResultsJSON numbers + reason (e.g. outbreak flag)
- Fixed rejection sentence for out-of-scope questions (D-11)
- Best-effort explicitly rejected — no fallback answers

**Build against (Phase 1 output):**
- `lib/contracts.ts` — ResultsJSON shape to know what fields exist for template interpolation

---

### `lib/chat/validator.ts` (utility, transform)

**Analog:** None — greenfield codebase. No `lib/` directory exists.

**Pattern source:** CONTEXT.md decisions D-13 through D-16.

**Expected shape (from decisions):**
- Pure post-check function (D-16) — not API middleware
- Exact match: every numeric token in answer must appear verbatim in ResultsJSON (D-13)
- No rounding or unit conversion
- Scope: all numbers including dates and day-counts (D-14)
- On failure: answer never shown; user receives fixed rejection sentence (D-15)
- Survives CHAT-04 LLM swap (D-16)

**Build against (Phase 1 output):**
- `lib/contracts.ts` — ResultsJSON shape to extract all valid numeric tokens for validation

---

### `lib/chat/index.ts` (service, transform)

**Analog:** None — greenfield codebase. No `lib/` directory exists.

**Pattern source:** CONTEXT.md decisions D-09 through D-16 (orchestrator).

**Expected shape (from decisions):**
- Main chat orchestrator called by `app/api/chat/route.ts`
- Pipeline: intent match → template fill → validator check → response
- No DB access, no calculation — pure transform of ResultsJSON → answer
- Returns fixed rejection sentence on any failure

**Build against (Phase 1 output):**
- `lib/contracts.ts` — ResultsJSON type for type-safe data access

---

## Shared Patterns

### No Existing Patterns to Share

This is a greenfield codebase. No source files exist. There are no shared patterns to extract from existing code.

### Patterns Phase 1 Will Establish (Phase 3 Builds Against)

Phase 1 (P2, Jovian Wilson Simon) will create the following files that Phase 3 consumes:

| Phase 1 File | What It Establishes | How Phase 3 Uses It |
|--------------|---------------------|---------------------|
| `lib/contracts.ts` | ResultsJSON type shape (frozen) | `/api/results` serves it verbatim; chat templates interpolate its fields; validator extracts its numbers |
| `db/schema.ts` | Database tables + ownership columns | Middleware checks `hospital_id` + `role` for access control |
| `theme/tokens.ts` | UI theme tokens (stub) | Not directly used by Phase 3 (P1 finalizes in Phase 4) |
| `scripts/seed` | Demo network data | Provides realistic data for API and chat to serve |

### Tech Stack Patterns (from PROJECT.md)

| Concern | Stack Choice | Implication for Phase 3 |
|---------|--------------|------------------------|
| Framework | Next.js + TypeScript | App Router route handlers (`app/api/*/route.ts`), middleware at root |
| ORM | Drizzle ORM | Type-safe schema in `db/schema.ts`; Phase 3 reads via Drizzle |
| Database | Neon Postgres (free tier) | Pooled connections (`neon-http`/serverless), `DATABASE_URL` env |
| Auth | None in v1 (D-06) | Minimal signed session — HMAC or JWT carrying `role` + `hospitalId` |
| Chatbot | Rule-based (D-09) | Intent matcher + templates + validator; no LLM in v1 |

## No Analog Found

All 7 files have no close match in the codebase. The planner should use:

1. **CONTEXT.md decisions** — each file has detailed decision specs (D-01 through D-16)
2. **Phase 1 frozen contracts** — `lib/contracts.ts` and `db/schema.ts` define the data shapes
3. **Next.js App Router conventions** — standard route handler and middleware patterns
4. **PROJECT.md constraints** — tech stack, directory ownership, chatbot safety rules

## Metadata

**Analog search scope:** Entire repository (greenfield — only README.md, LICENSE, AGENTS.md, .planning/, docs/ exist)
**Files scanned:** 0 source files (no .ts, .tsx, .js, .jsx files in repo)
**Pattern extraction date:** 2026-10-08

---

*Phase: 3-API, Chat & Access*
*Pattern mapping completed: 2026-10-08*
