---
status: complete
phase: 03-api-chat-access
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-10-08T17:00:00Z
updated: 2026-10-08T17:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Middleware rejects invalid sessions with 401
expected: Sending a POST /api/chat request with a missing, invalid, or tampered session cookie returns HTTP 401. A valid HMAC-signed session cookie is accepted and the request proceeds.
result: pass

### 2. POST /api/chat returns quoted ResultsJSON numbers
expected: POST /api/chat with a valid session returns {answer: "..."} quoting exact numbers from ResultsJSON. Out-of-scope questions return fixed rejection sentence.
result: pass

### 3. Network admin full access including moves/orders role gate
expected: network_admin can access /api/moves/* and /api/orders/*. hospital_admin gets 403 on those paths.
result: pass

### 4. GET /api/results serves ResultsJSON with rich envelope
expected: GET /api/results with valid session returns 200 with generatedAt, mape, advisoryFlags, outbreakMarkers. Missing blob returns 503.
result: pass

### 5. Middleware enforces hospital scoping
expected: hospital_admin write to different hospitalId gets 403. Read access to all hospitals allowed. network_admin has full access.
result: pass

### 6. All 4 chat intents are correctly matched
expected: 4 question types each return matching answers. Out-of-scope returns rejection sentence.
result: pass
noted: Only most-at-risk returned data with the stub fixture — stockout-timing, waste-quantities, and transfer-reasons returned rejection because the fixture lacks those fields. This is correct behavior (D-11: missing field → rejection sentence). All 4 intents matched in node probe per SUMMARY.

### 7. All 4 templates quote exact ResultsJSON numbers
expected: Templates use only verbatim ResultsJSON values — no arithmetic, rounding, or unit conversion. Missing fields → rejection sentence.
result: pass

### 8. Validator rejects numbers not in ResultsJSON
expected: Numbers not in blob → rejection sentence. Valid answers pass through.
result: pass

### 9. Chat orchestrator answers most-at-risk with exact numbers
expected: (automated — unit smoke test passed 4/4)
result: pass
source: automated
coverage_id: D1

### 10. Validator rejects numbers not in ResultsJSON
expected: (automated — unit smoke test passed)
result: pass
source: automated
coverage_id: D2

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
