---
phase: 03-api-chat-access
verified: 2026-10-08T12:20:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - middleware.ts
  - app/api/chat/route.ts
  - app/api/results/route.ts
  - lib/chat/index.ts
  - lib/chat/intents.ts
  - lib/chat/templates.ts
  - lib/chat/validator.ts
  - lib/contracts.ts
  - .planning/phases/03-api-chat-access/03-01-PLAN.md
  - .planning/phases/03-api-chat-access/03-02-PLAN.md
  - .planning/phases/03-api-chat-access/03-03-PLAN.md
  - .planning/phases/03-api-chat-access/03-01-SUMMARY.md
  - .planning/phases/03-api-chat-access/03-02-SUMMARY.md
  - .planning/phases/03-api-chat-access/03-03-SUMMARY.md
  - .planning/phases/03-api-chat-access/03-CONTEXT.md
  - .planning/REQUIREMENTS.md
covered_digest: "v2:sha256:8fc433375ebb52743c83cefea9f8b0d7cedbd2461efffdc42a8fc420c5ffbbc0"
behavior_unverified: 0
overrides_applied: 0
advisory:
  - finding: "Validator substring-collision: '14' passes when ResultsJSON contains 140, because matching is JSON.stringify substring inclusion rather than token-boundary equality"
    category: architectural
    reason: "An answer token can validate against a coincidental substring of a larger number; matches D-13's literal substring spec but weakens CHAT-03 edge semantics; templates never emit such values today, but the CHAT-04 LLM swap could"
    evidence_status: "probed at runtime: validateAnswer('It will last 14 days', {wasteUnits:140}) === true"
  - finding: "Hospital-scoping falls open when target hospitalId is indeterminable (e.g. POST /api/hospitals with no path/query hospitalId)"
    category: security
    reason: "middleware.ts:108 scopes writes only when target !== null; requests whose target cannot be derived bypass the 403 gate (observed 404 pass-through instead of 403)"
    evidence_status: "probed at runtime against next start: hospital_admin POST /api/hospitals reached router (404), not rejected"
  - finding: "lib/contracts.ts is a documented Phase-3 stub standing in for the Phase 1 frozen contract (Phase 1 not executed in this checkout)"
    category: other
    reason: "Envelope/ResultsJSON shape consumed by /api/results and chat is the stub shape; Phase 5 must re-verify against the frozen contract per D-04"
    evidence_status: "file header + 03-01/03-02 SUMMARY known-stubs"
  - finding: "middleware matcher covers only /api/:path*; D-05 mentions pages as well, but no pages exist yet in this checkout"
    category: architectural
    reason: "Page-level auth (Phase 4 UI) will need matcher extension"
    evidence_status: "middleware.ts config.matcher"
coincidental_reliance_items:
  - truth: "Hospital admin can read/write own hospital details and read only other hospitals"
    reason: undeclared-precondition
    harden: "Declare that write-scope enforcement requires the target hospitalId to be derivable from the request path or ?hospitalId=; reject (403) hospital_admin writes when it is not"
---

# Phase 3: API, Chat & Access Verification Report

**Phase Goal:** Roles are enforced on every path, engine results are servable as ResultsJSON, and the administrator can ask risk questions answered only with quoted system numbers
**Verified:** 2026-10-08T12:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hospital admin can read/write own hospital details and read only other hospitals, while network admin has full read/write access including moves and orders | ✓ VERIFIED (coincidental-reliance) | Runtime curl matrix against `next start`: hospital_admin GET other hospital → 200 path open (middleware allows reads); POST to own hospitalId → passed gate (404, no route conflict); POST to other hospitalId → 403; GET /api/moves → 403; network_admin POST /api/orders → passed gate (404); no/garbage/tampered session → 401. Write-scope relies on hospitalId being derivable from path/query — flagged in coincidental_reliance_items. |
| 2 | Administrator can ask risk questions and receive answers built only by quoting precomputed ResultsJSON, never calculated by the chatbot | ✓ VERIFIED | Runtime: POST /api/chat `{"question":"Which hospital is most at risk?"}` → `{"answer":"Hospital General is most at risk with a risk score of 82 and 6 days until stockout."}` — 82 and 6 quoted verbatim from the blob; templates.ts interpolates only ResultsJSON fields, no arithmetic/rounding/conversion; unknown questions → fixed rejection sentence. All 4 intents (most-at-risk, stockout-timing, waste-quantities, transfer-reasons) matched in node probe. |
| 3 | Any chatbot answer containing a number not present in ResultsJSON is rejected by the validator | ✓ VERIFIED (edge-case advisory) | Node probe: `validateAnswer('Risk score is 42', results) === false`; `validateAnswer('...82...') === true`; runtime chat answers pass through validateAnswer. Substring-collision edge (`14` passing via `140`) recorded as advisory — D-13 literally specifies substring-verbatim, so not a contract violation, but noted for the CHAT-04 swap. |
| 4 | Precomputed ResultsJSON is servable over API so dashboard and chat clients consume the same numbers | ✓ VERIFIED | Runtime: GET /api/results → 200 `application/json` serving the blob verbatim (generatedAt, mape, advisoryFlags, outbreakMarkers present); POST /api/chat read the same `RESULTS_BLOB_PATH` file and quoted 82/6 from it. Missing-blob 503 path read in code (not exercised at runtime). |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `middleware.ts` | HMAC session verify, role extraction, hospital scoping, moves/orders gate | ✓ VERIFIED | Read + runtime-tested: 401/403 matrix correct, timing-safe compare, role validated |
| `app/api/chat/route.ts` | POST {question} → {answer} | ✓ VERIFIED | Runtime-tested 200 + rejection path; 503 on missing blob (code-read) |
| `app/api/results/route.ts` | GET serving blob verbatim with envelope | ✓ VERIFIED | Runtime-tested 200 + verbatim body |
| `lib/chat/index.ts` | chat() orchestrator | ✓ VERIFIED | Intent → template → validator; rejection sentence on any failure |
| `lib/chat/intents.ts` | matchIntent keyword scoring, 4 intents, case-insensitive, unknown below threshold | ✓ VERIFIED | Node probe: all 4 intents + unknown case pass |
| `lib/chat/templates.ts` | fillTemplate quoting exact numbers, no arithmetic | ✓ VERIFIED | Code read: interpolation-only; runtime answer matched blob values |
| `lib/chat/validator.ts` | validateAnswer exact-match, dates/percentages/decimals/day-counts, pure | ✓ VERIFIED | Node probe; pure function, no I/O |
| `lib/contracts.ts` | Frozen ResultsJSON shape | ⚠️ STUB | Documented deviation: minimal stub until Phase 1 runs; tracked as advisory |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| middleware.ts | /api/* routes | matcher config `["/api/:path*"]` | WIRED | Runtime: all API responses reflect middleware decisions |
| app/api/chat/route.ts | lib/chat/index.ts | import `chat` | WIRED | Runtime answer produced |
| lib/chat/index.ts | intents/templates/validator | imports | WIRED | Orchestration exercised in probe |
| lib/chat/templates.ts | ResultsJSON | candidateRows over blob | WIRED | Runtime answer quotes blob numbers |
| lib/chat/validator.ts | templates output | chat() post-check | WIRED | Runtime path: validateAnswer gates the answer |
| app/api/results/route.ts | RESULTS_BLOB_PATH blob | readFile | WIRED | Runtime 200 with blob body |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| app/api/results/route.ts | resultsJson | readFile(RESULTS_BLOB_PATH) | Yes — same fixture consumed by chat | ✓ FLOWING |
| app/api/chat/route.ts | resultsJson → chat() answer | readFile(RESULTS_BLOB_PATH) | Yes — answer numbers match blob | ✓ FLOWING |
| lib/chat/templates.ts | riskScore/daysUntilStockout/etc | ResultsJSON rows | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Valid session → results 200 | curl -H Cookie: session=sig localhost:3123/api/results | 200 + blob JSON | ✓ PASS |
| Missing/invalid/tampered session → 401 | curl variants | 401 | ✓ PASS |
| hospital_admin write other hospital → 403 | curl -X POST /api/hospitals/h2 | 403 | ✓ PASS |
| hospital_admin moves/orders → 403 | curl GET /api/moves | 403 | ✓ PASS |
| network_admin passes gate on orders | curl -X POST /api/orders | 404 (reached router) | ✓ PASS |
| Chat risk question → quoted answer | curl POST /api/chat | exact-quoted answer | ✓ PASS |
| Chat out-of-scope → rejection sentence | curl POST /api/chat | fixed rejection | ✓ PASS |
| Validator rejects foreign number | node probe | 42 rejected | ✓ PASS |
| All 4 intents match | node probe | 4/4 | ✓ PASS |
| `npm run build` | npm run build | exit 0, no TS errors | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared for this phase; step skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CHAT-01 | 03-01, 03-03 | Rule-based intent matcher for risk questions | ✓ SATISFIED | 4 intents + unknown threshold, node probe |
| CHAT-02 | 03-01, 03-03 | Answers only by quoting precomputed ResultsJSON | ✓ SATISFIED | Runtime answer + template interpolation-only code |
| CHAT-03 | 03-01, 03-03 | Validator rejects numbers not in ResultsJSON | ✓ SATISFIED | Node probe + runtime path; substring-collision documented |
| AUTH-01 | 03-01, 03-02 | Hospital admin RW-own / RO-others | ✓ SATISFIED | Runtime curl matrix (403 cross-hospital write, reads open) |
| AUTH-02 | 03-01, 03-02 | Network admin full RW incl. moves/orders | ✓ SATISFIED | Runtime: orders gate let network_admin through; hospital_admin 403 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| lib/contracts.ts | 1-8 | Documented stub for frozen Phase 1 contract | ℹ️ Info | Shape drift risk when Phase 1 runs; tracked |
| middleware.ts | 108 | Scoping passes when target hospitalId is null | ⚠️ Warning | Unscoped hospital_admin writes to target-less routes not 403'd |
| lib/chat/validator.ts | 31 | Substring inclusion instead of token-boundary match | ℹ️ Info | Edge-case false accepts (14 vs 140); matches D-13 literal spec |

### Human Verification Required

None blocking. All four success criteria were exercised at runtime (live server, real HMAC sessions, real blob) rather than by presence checks alone.

### Gaps Summary

No goal-blocking gaps. Advisory items recorded: (1) validator substring-collision edge case, (2) write-scope falls open when hospitalId is indeterminable, (3) lib/contracts.ts remains a stub pending Phase 1, (4) middleware matcher currently covers only /api/* paths.

---

_Verified: 2026-10-08T12:20:00Z_
_Verifier: the agent (gsd-verifier)_
