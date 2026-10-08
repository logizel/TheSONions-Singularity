---
phase: 03-api-chat-access
plan: 01
subsystem: api, auth, chat
tags: [nextjs, middleware, hmac, session, quote-only-chatbot, validator]

# Dependency graph
requires: []
provides:
  - "middleware.ts — HMAC-SHA256 session verification, role extraction, hospital_admin RW-own/RO-others scoping"
  - "app/api/chat/route.ts — POST {question} -> {answer}"
  - "lib/chat/index.ts — chat(question, resultsJson) orchestrator"
  - "lib/chat/intents.ts — matchIntent(question) keyword scoring (most-at-risk)"
  - "lib/chat/templates.ts — fillTemplate(intent, params, resultsJson), REJECTION_SENTENCE"
  - "lib/chat/validator.ts — validateAnswer(answer, resultsJson) exact-match numeric validator"
affects: [03-02-PLAN.md, 03-03-PLAN.md, Phase 1 contracts freeze]

# Actuals (#2632) — same estimateTokens scale (chars/4 over realized diff).
actuals:
  tokens: 12081
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: [next@16.4.0, react@19.3.0, react-dom@19.3.0, typescript@5.9.3, @types/node, @types/react, @types/react-dom]
  patterns: [edge middleware with Web Crypto HMAC, quote-only chat pipeline, exact-match number validator]

key-files:
  created:
    - middleware.ts
    - app/api/chat/route.ts
    - lib/chat/index.ts
    - lib/chat/intents.ts
    - lib/chat/templates.ts
    - lib/chat/validator.ts
    - lib/contracts.ts
    - package.json
    - package-lock.json
    - tsconfig.json
    - next.config.ts
    - .gitignore
  modified: []

key-decisions:
  - "Local lib/contracts.ts ResultsJSON stub created because Phase 1 has not produced the frozen contract (documented deviation)"
  - "Session cookie format: base64url(payloadJSON) + '.' + base64url(HMAC-SHA256), verified with Web Crypto API per D-06 agent-discretion"
  - "Validator extracts dates > percentages > integers/decimals/day-counts, exact string-match against JSON.stringify(resultsJson), no float comparison"
  - "Chat route reads precomputed blob from RESULTS_BLOB_PATH (default /tmp/results.json), 503 when missing"
  - "Unknown intents, missing ResultsJSON fields, and validator failures all return the fixed REJECTION_SENTENCE (D-11, D-15)"

patterns-established:
  - "Pattern: chat pipeline = matchIntent -> fillTemplate -> validateAnswer, rejection sentence on any failure"
  - "Pattern: middleware owns all auth for /api/*; route handlers contain no session logic (D-05)"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, AUTH-01, AUTH-02]

coverage:
  - id: D1
    description: "Chat orchestrator answers most-at-risk with exact ResultsJSON numbers; unknown questions get fixed rejection sentence"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "node --input-type=module -e smoke of lib/chat/intents.ts+templates.ts+validator.ts — intent matched, answer valid, unknown -> rejection, validator rejects 42"
        status: pass
    human_judgment: false
  - id: D2
    description: "Any answer containing a number not present in ResultsJSON is rejected by the validator"
    requirement: "CHAT-03"
    verification:
      - kind: unit
        ref: "node smoke — validateAnswer('Risk score is 42', results) === false; validateAnswer(exact numbers) === true"
        status: pass
    human_judgment: false
  - id: D3
    description: "Middleware verifies HMAC sessions and returns 401 for invalid sessions; 403 for hospital_admin writes to other hospitals"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npm run build — middleware compiles/typechecks; runtime 401/403 gating not exercised in this plan"
        status: unknown
    human_judgment: true
    rationale: "Runtime auth-gate behavior needs a running Next server with SESSION_SECRET; deferred to Phase 5 integration UAT"
  - id: D4
    description: "POST /api/chat accepts {question} and returns {answer}, serving precomputed ResultsJSON numbers"
    requirement: "CHAT-02"
    verification:
      - kind: other
        ref: "npm run build — route handler compiles/typechecks; live POST not exercised in this plan"
        status: unknown
    human_judgment: true
    rationale: "Live POST requires SESSION_SECRET, blob fixture, and dev server; deferred to Phase 5 integration UAT"
  - id: D5
    description: "Network admin full access including moves/orders role gate"
    requirement: "AUTH-02"
    verification:
      - kind: other
        ref: "middleware.ts code path (network_admin pass-through) compiles via npm run build; runtime access matrix exercised in 03-02 and Phase 5"
        status: unknown
    human_judgment: true
    rationale: "Full access matrix is proven in plan 03-02 and Phase 5 integration, not in this tracer"

# Metrics
duration: ~2min
completed: 2026-10-08
status: complete
plan_head_before: d184e6e316b7426e028da431a43296a365632d95
plan_head_after: 94d9e47
commits: 2
---

# Phase 3: API, Chat & Access — Plan 01 Summary

**HMAC-signed session middleware plus one quote-only chat path (most-at-risk) wired end-to-end through intent matcher, template filler, and exact-match number validator; Next.js 16 + TS scaffold added so `npm run build` passes from a greenfield repo.**

## Performance

- **Duration:** ~2 min (post-scaffold exploration excluded)
- **Started:** 2026-10-08T11:58:53Z
- **Completed:** 2026-10-08T12:00:04Z
- **Tasks:** 1/1
- **Files modified:** 12 created, 0 modified

## Accomplishments

- Middleware gates all `/api/*`: HMAC-SHA256 session verification via Web Crypto API, role extraction, 401 on missing/invalid, 403 on hospital_admin write to another hospitalId
- Chat pipeline tracer: `matchIntent` (keyword scoring) -> `fillTemplate` (quotes exact ResultsJSON numbers, no arithmetic) -> `validateAnswer` (exact-match numeric tokens, all numbers incl. decimals, percentages, dates, day-counts)
- Unknown questions, missing ResultsJSON fields, and validator failures all return the fixed rejection sentence; valid answers return 1-sentence quote
- Greenfield repo scaffolded to a building Next.js 16 app so the plan's `npm run build` verify runs green

## Task Commits

Each task was committed atomically:

1. **Scaffold Next.js build config** — `cb9742c` (chore)
2. **End-to-end chat pipeline tracer** — `94d9e47` (feat)

**Plan metadata:** docs commit follows (SUMMARY.md)

## Files Created/Modified

- `middleware.ts` - HMAC session verify, role extraction, hospital scoping, 401/403
- `app/api/chat/route.ts` - POST {question} -> {answer}, blob via RESULTS_BLOB_PATH, 503 on missing
- `lib/chat/index.ts` - chat() orchestrator, rejection sentence on any failure
- `lib/chat/intents.ts` - keyword scoring for most-at-risk ("risk", "at risk", "most at risk", "danger", "critical")
- `lib/chat/templates.ts` - most-at-risk template quoting hospitalName/riskScore/daysUntilStockout
- `lib/chat/validator.ts` - exact-match tokens: dates, percentages, integers, decimals, day-counts
- `lib/contracts.ts` - minimal ResultsJSON type stub (flagged below)
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.gitignore` - build scaffold

## Decisions Made

- Local `lib/contracts.ts` ResultsJSON stub stands in for the Phase 1 frozen contract (P2 owns that file; Phase 1 has not executed in this checkout). P2 can drop in the frozen version without changing lib/chat consumers (D-04).
- Session format `base64url(payload).base64url(hmac)` with SESSION_SECRET env var; Web Crypto API for Edge compatibility (plan-sanctioned agent discretion).
- Validator compares token substrings against `JSON.stringify(resultsJson)` — substring-verbatim, no float normalization (D-13, D-14).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No build system existed — `npm run build` could not run**
- **Found during:** Task 1 (tracer)
- **Issue:** Repo is greenfield: no package.json, tsconfig, Next.js config, or .gitignore; Phase 1/2 artifacts (`lib/contracts.ts`, `db/schema.ts`) do not exist in this checkout
- **Fix:** Added minimal Next.js 16 + TypeScript scaffold (package.json, tsconfig, next.config.ts, .gitignore) and installed next/react/typescript
- **Files modified:** package.json, package-lock.json, tsconfig.json, next.config.ts, .gitignore
- **Verification:** `npm run build` exits 0, TypeScript passes with no errors
- **Committed in:** cb9742c

**2. [Rule 3 - Blocking] `lib/contracts.ts` referenced by the plan did not exist**
- **Found during:** Task 1 (tracer)
- **Issue:** `lib/chat/*` imports `ResultsJSON` from `../contracts`; Phase 1 output absent, so nothing compiled
- **Fix:** Created minimal `lib/contracts.ts` stub defining `ResultsJSON` (hospitals[] with riskScore/daysUntilStockout) with a comment marking it as a stub for P2 to replace
- **Files modified:** lib/contracts.ts
- **Verification:** TypeScript compile + node smoke test of all three chat modules
- **Committed in:** 94d9e47

**3. [Note] Next.js 16 deprecation warning for `middleware` file convention**
- **Found during:** Task 1 build
- **Issue:** Build warns middleware.ts convention deprecated in favor of `proxy.ts`
- **Fix:** Kept middleware.ts per plan artifact requirement (acceptance criteria name it verbatim); warning is non-blocking
- **Files modified:** none
- **Verification:** Build compiles, middleware is registered ("Proxy (Middleware)" in route table)
- **Committed in:** n/a (accepted warning)

---

**Total deviations:** 2 auto-fixed (blocking), 1 warning accepted
**Impact on plan:** Both fixes were required to make the plan's verify (`npm run build`) runnable at all in a greenfield repo. No scope creep into other tracks' logic.

## Issues Encountered

- Turbopack warns that dynamic `readFile(blobPath)` in `app/api/chat/route.ts` traces the whole project into server output. Functionally correct; a deploy-size concern only. Left as-is (warning, not error).

## Known Stubs

- `lib/contracts.ts` — minimal `ResultsJSON` shape stub standing in for the Phase 1 frozen contract. It flows into `lib/chat/*` types. Owner: P2 (Phase 1) replaces it with the frozen version; tracked in `.planning/WINDOWS.md` as a deviation entry.

## User Setup Required

None — env vars (`SESSION_SECRET`, `RESULTS_BLOB_PATH`) have code defaults/fallbacks; live UAT requires values but no external service signup.

## Next Phase Readiness

- 03-02 can consume `middleware.ts` + add `app/api/results/route.ts` and extend scoping
- 03-03 can extend `lib/chat/intents.ts`, `templates.ts`, `validator.ts` from the tracer's one-intent wiring
- Blocker for real runtime UAT: Phase 1 must produce the frozen `lib/contracts.ts` + `db/schema.ts`, and a precomputed blob at `RESULTS_BLOB_PATH`

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file_access | app/api/chat/route.ts | Server-side `readFile` of an env-var path (`RESULTS_BLOB_PATH`); not user-controllable, so no traversal vector — flagged for awareness |

---
*Phase: 03-api-chat-access*
*Completed: 2026-10-08*

## Self-Check: PASSED

- FOUND: middleware.ts, app/api/chat/route.ts, lib/chat/intents.ts, lib/chat/templates.ts, lib/chat/validator.ts, lib/chat/index.ts, lib/contracts.ts, package.json, tsconfig.json, next.config.ts, .gitignore
- FOUND commit: cb9742c (chore scaffold)
- FOUND commit: 94d9e47 (feat tracer)
- `npm run build` exited 0 with no TypeScript errors
