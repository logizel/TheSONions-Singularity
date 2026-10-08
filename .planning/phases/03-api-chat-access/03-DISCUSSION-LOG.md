# Phase 3: API, Chat & Access - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 3-API, Chat & Access
**Areas discussed:** ResultsJSON API shape, Auth enforcement, Chat intents, Validator strictness

---

## ResultsJSON API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single /api/results | One GET returning full network payload; dashboard + chat filter client-side | ✓ |
| Split endpoints | Separate routes per concern; smaller payloads but risk of drift | |

**User's choice:** Single /api/results
**Notes:** User selected recommended option without hesitation.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Precomputed blob | Engine output written to DB/artifact on schedule; API reads precomputed blob | ✓ |
| Live assembly | API queries DB and assembles ResultsJSON per request | |

**User's choice:** Precomputed blob
**Notes:** Matches quote-only spec; auditable.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rich envelope | Include generatedAt, MAPE 3-11%, advisory flags for 15-30d, outbreak markers | ✓ |
| Bare numbers | Only raw numbers; clients infer freshness and error themselves | |

**User's choice:** Rich envelope
**Notes:** Chat quotes these directly.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen as-is | Use Phase 1 lib/contracts.ts ResultsJSON shape verbatim; no P4-side extensions | ✓ |
| Extend with extras | P4 may add chat-friendly derived fields alongside frozen core | |

**User's choice:** Frozen as-is (after plain-text explanation of what "frozen contract" means)
**Notes:** User initially didn't understand the question; after explanation chose option A (frozen as-is).

---

## Auth Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware gate | Single guard in middleware.ts checking role + hospital scope for all /api/* and pages | ✓ |
| Per-route checks | Each API route checks role itself; flexible but easy to forget one | |

**User's choice:** Middleware gate
**Notes:** One place, hard to bypass.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Signed session | Minimal signed session carrying role + hospitalId; no extra user tables in v1 | ✓ |
| Auth library | Full auth library with providers and sessions | |

**User's choice:** Signed session
**Notes:** Matches prototype scale.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scope by session | hospital_admin writes scoped by session hospitalId, reads others; network_admin unrestricted. API returns 403 on violation | ✓ |
| Hide others | UI hides other hospitals entirely for hospital_admin | |

**User's choice:** Scope by session (after plain-text explanation of what "RW-own / RO-others" means)
**Notes:** User initially didn't understand; after explanation chose option A (scope by session with 403s).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Role gate only | Only network_admin can confirm moves/orders; hospital_admin attempts get 403. No audit trail in v1 | ✓ |
| Gate + audit log | Role gate plus append-only log of who confirmed what, when | |

**User's choice:** Role gate only (interpreted from "option A" response)
**Notes:** User asked "who is the network admin" — explained it's a role, not a named person; team decision on credential holder noted as deferred.

---

## Chat Intents

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 intents | Most-at-risk hospital, when X runs out, what expires unused, why this transfer | ✓ |
| Start with 2 | Only most-at-risk + stockout timing; waste and moves come later | |

**User's choice:** All 4 intents
**Notes:** Covers all 4 success criteria.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Short + quoted | One or two sentences quoting exact numbers from ResultsJSON plus the reason | ✓ |
| Long form | Paragraph-style explanation with context and caveats | |

**User's choice:** Short + quoted
**Notes:** Easy to validate.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed rejection | Fixed sentence like 'I can only answer from system results ...' whenever asked anything else | ✓ |
| Best effort | Try to answer partially from ResultsJSON anyway | |

**User's choice:** Fixed rejection (after explicit warning about medical-safety risk)
**Notes:** User initially chose "best effort"; after explanation of CHAT-02/CHAT-03 conflict and medical-safety risk, user switched to fixed rejection.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single-shot | Each question answered fresh; no follow-up memory | ✓ |
| One follow-up | Remembers the last hospital/medicine across one follow-up | |

**User's choice:** Single-shot
**Notes:** Simplest matcher.

---

## Validator Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Exact match | Every numeric token in answer must appear verbatim in ResultsJSON; anything else rejected | ✓ |
| Normalized match | Allow rounding and unit conversions | |

**User's choice:** Exact match
**Notes:** Strictest, matches CHAT-03 exactly.

---

| Option | Description | Selected |
|--------|-------------|----------|
| All numbers | Validator scans final answer text including dates and day-counts | ✓ |
| Quantities only | Only medicine quantities and day-counts checked; dates and years exempt | |

**User's choice:** All numbers
**Notes:** Templates must pull all values from ResultsJSON.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reject + fallback | Rejected answer never shown; user gets fixed rejection sentence | ✓ |
| Flag but show | Show answer flagged with a warning | |

**User's choice:** Reject + fallback
**Notes:** Nothing unvalidated reaches the screen.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In-chat post-check | Validator is a pure function in lib/chat/ run on every answer before responding | ✓ |
| API middleware | Validator runs as API-layer middleware inspecting chat responses | |

**User's choice:** In-chat post-check (after challenging the recommendation and accepting the reasoning)
**Notes:** User asked "why did u recommend 1 over 2??" — provided 4-point reasoning (cohesive unit, pure function testable, survives CHAT-04 swap, blast radius). User then asked "which one is actually better" — gave direct answer. User said "proceed."

---

## the agent's Discretion

- Exact rejection sentence wording
- Session signing mechanism (HMAC vs JWT)
- API response caching strategy
- Chat intent matcher implementation details

## Deferred Ideas

- Audit log for moves/orders — belongs in its own phase
- Conversation memory for chat follow-ups — requires session state management
- CHAT-04 LLM swap — already deferred to v2; validator design survives
- Network admin credential assignment — team decision
