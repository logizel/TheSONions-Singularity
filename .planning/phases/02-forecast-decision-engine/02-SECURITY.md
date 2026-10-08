---
phase: "02"
slug: "forecast-decision-engine"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-08"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| caller→engine | Phase 3 API/tests pass risk signals and network positions into pure functions | Aggregate demand/stock numbers only — no PHI, no secrets |
| engine→results | Engine returns forecasts, warnings, moves, rankings as plain data | 1-decimal floats, 0–100 scores, reason sentences |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | lib/engine/*.ts input validation | low | mitigate | Guard-clauses throw typed EngineInputError on negative stock, wrong history length, gaps (D-20); verified present in all 6 modules (forecast 10, stockout 6, outbreak 4, waste 6, moves 2, priorities 2 refs) | closed |
| T-02-02 | Tampering | lib/engine/outbreak.ts, lib/engine/waste.ts input validation | low | mitigate | Both modules guard-clause with EngineInputError on short/gappy/negative history, malformed forecast arrays, negative stock/expiry; verified in code, 02-02-SUMMARY threat flags confirm | closed |
| T-02-03 | Tampering | lib/engine/moves.ts, lib/engine/priorities.ts input validation | low | mitigate | Both modules guard-clause with EngineInputError on negative/NaN/missing inputs and empty sender pools; exact-need math keeps outputs auditable | closed |
| T-02-04 | Tampering | lib/engine/moves.ts sender identity validation | medium | mitigate | validateRequest rejects self-send and duplicate sender IDs via seen-set (moves.ts:89-100) with typed EngineInputError; verifier runtime-proved duplicate H-S and self-send H-R→H-R both throw — D-09 buffer unbypassable | closed |
| T-02-05 | Tampering | lib/engine/waste.ts output precision | low | mitigate | Waste difference rounded to 1 decimal (waste.ts:66), warns decided on rounded value; verifier runtime-proved wasteRisk(21, 30×0.7, 30) → {0, warns:false} and stock-1119 dust case clean | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Engine-wide: pure functions only — no I/O, no secrets, no network calls (grep-verified; `networkMean`/`cross-network` matches are domain vocabulary, not sockets). No exfiltration or injection surface in this phase.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*No accepted risks.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-08 | 5 | 5 | 0 | gsd-secure-phase (L1 grep-depth + verifier runtime proofs, ASVS L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-08
