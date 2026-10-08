---
phase: 03-api-chat-access
plan: 02
subsystem: api, auth
tags: [nextjs, middleware, hospital-scoping, role-gate, results-api]

# Dependency graph
requires:
  - phase: 03-01
    provides: middleware.ts HMAC session verification, role extraction, hospital scoping tracer
provides:
  - "app/api/results/route.ts — GET serving precomputed ResultsJSON blob with rich envelope"
  - "middleware.ts — moves/orders network_admin-only gate (403 for hospital_admin)"
affects: [Phase 5 integration, dashboard clients]

# Actuals (#2632)
actuals:
  tokens: 2100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: [blob-verbatim ResultsJSON serving, role-gated route prefixes in middleware]

key-files:
  created:
    - app/api/results/route.ts
  modified:
    - middleware.ts

key-decisions:
  - "Results envelope fields (generatedAt, mape, advisoryFlags, outbreakMarkers) are served verbatim from the precomputed blob — the engine job is the single producer (D-02, D-03)"
  - "moves/orders gate applied to all non-network_admin roles via path-prefix check in middleware; hospital_admin write scoping (D-07) unchanged from 03-01"

patterns-established:
  - "Pattern: route handlers contain no auth logic — middleware owns all gates (D-05)"

requirements-completed: [AUTH-01, AUTH-02]

coverage:
  - id: D1
    description: "GET /api/results serves ResultsJSON with rich envelope from precomputed blob; 503 when missing"
    requirement: "AUTH-02"
    verification:
      - kind: other
        ref: "npm run build — route compiles/typechecks; runtime blob serving deferred to Phase 5 UAT"
        status: unknown
        human_judgment: true
  - id: D2
    description: "Middleware enforces hospital scoping + moves/orders network_admin gate"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npm run build — middleware compiles; runtime access matrix deferred to Phase 5"
        status: unknown
        human_judgment: true

metrics:
  duration: ~3min
  completed: 2026-10-08

status: complete
plan_head_before: b237d09
plan_head_after: 2b65c2c
commits: 2
---

# Phase 3: API, Chat & Access — Plan 02 Summary

**GET /api/results serves the precomputed ResultsJSON blob verbatim with its rich envelope, and middleware now gates /api/moves/* and /api/orders/* to network_admin only while hospital_admin retains RW-own / RO-others scoping.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-10-08T12:05:00Z
- **Completed:** 2026-10-08T12:08:00Z
- **Tasks:** 2/2
- **Files modified:** 1 created, 1 modified

## Accomplishments

- `app/api/results/route.ts` GET handler reads the precomputed blob from `RESULTS_BLOB_PATH` (default `/tmp/results.json`), returns it verbatim as `application/json`, and returns 503 `{error: "Results not available"}` when the blob is missing. No auth logic in the route (D-05).
- `middleware.ts` extended: `/api/moves/*` and `/api/orders/*` are network_admin-only — hospital_admin (any method) gets 403 `{error: "Forbidden"}`. Hospital scoping from 03-01 (hospital_admin writes only to own hospitalId, 403 otherwise; reads open) preserved. Network_admin retains full access.

## Task Commits

1. **GET /api/results route — serve precomputed ResultsJSON** — `fb76f59` (feat)
2. **Hospital scoping + moves/orders role gate** — `2b65c2c` (feat)

**Plan metadata:** docs commit follows (SUMMARY.md)

## Files Created/Modified

- `app/api/results/route.ts` — GET handler, blob read, 503 fallback, frozen ResultsJSON type import
- `middleware.ts` — moves/orders role gate added; hospital scoping retained

## Decisions Made

- Envelope fields (`generatedAt`, `mape`, `advisoryFlags`, `outbreakMarkers`) ride inside the precomputed blob rather than being reassembled at request time — the engine job is the single producer (D-02, D-03, D-04).
- Moves/orders gate is a path-prefix check applied to every non-network_admin role before the request passes through.

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

- Turbopack repeats the "dynamic readFile traces whole project" warning for the new results route (same as chat route in 03-01); warning only, deploy-size concern, left as-is.

## Known Stubs

- `lib/contracts.ts` — pre-existing minimal `ResultsJSON` stub from 03-01 stands in for the Phase 1 frozen contract; owner P2/Phase 1 (tracked in `.planning/WINDOWS.md` by 03-01).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file_access | app/api/results/route.ts | Server-side `readFile` of env-var path (`RESULTS_BLOB_PATH`); not user-controllable, no traversal vector — awareness only |

## Self-Check: PASSED

- FOUND: app/api/results/route.ts
- FOUND: middleware.ts (modified)
- FOUND commit: fb76f59
- FOUND commit: 2b65c2c
- `npm run build` exited 0, no TypeScript errors

---
*Phase: 03-api-chat-access*
*Completed: 2026-10-08*
