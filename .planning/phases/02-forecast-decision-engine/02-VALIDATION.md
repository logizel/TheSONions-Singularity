---
phase: "02"
slug: "forecast-decision-engine"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-08"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed post-execution (State B): all suites green, 13/13 must-haves verified.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run lib/engine/<module>.test.ts` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~1 second (56 tests, 385ms suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/engine/<module>.test.ts`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | FCAST-01, FCAST-02 | T-02-01 | EngineInputError on bad history; no I/O | unit | `npx vitest run lib/engine/forecast.test.ts` | ✅ | ✅ green (14 tests, MAPE 3–11%) |
| 02-01-02 | 02-01 | 1 | RISK-01, RISK-02 | T-02-01 | EngineInputError on negative stock | unit | `npx vitest run lib/engine/stockout.test.ts lib/engine/forecast.test.ts` | ✅ | ✅ green |
| 02-01-03 | 02-01 | 1 | — (D-22 fixtures) | T-02-01 | Deterministic seeds, no randomness | unit | `npx vitest run && ls lib/engine/*.test.ts` | ✅ | ✅ green (exactly 2 suites) |
| 02-02-01 | 02-02 | 2 | OUTBK-01, OUTBK-02 | T-02-02 | EngineInputError on short/gappy history | unit | `npx vitest run lib/engine/outbreak.test.ts` | ✅ | ✅ green |
| 02-02-02 | 02-02 | 2 | WASTE-01, WASTE-02 | T-02-02 | EngineInputError on negative stock/expiry | unit | `npx vitest run lib/engine/waste.test.ts` | ✅ | ✅ green |
| 02-03-01 | 02-03 | 2 | MOVE-01, MOVE-02 | T-02-03 | Exact-need math, auditable outputs | unit | `npx vitest run lib/engine/moves.test.ts` | ✅ | ✅ green (7 tests) |
| 02-03-02 | 02-03 | 2 | PRIOR-01, PRIOR-02 | T-02-03 | Deterministic global ordering | unit | `npx vitest run lib/engine/priorities.test.ts` | ✅ | ✅ green |
| 02-04-01 | 02-04 | 3 | WASTE-01, WASTE-02 | T-02-05 | Rounded quotable waste, no false warn | unit | `npx vitest run lib/engine/waste.test.ts` | ✅ | ✅ green (stock-21 zero + stock-1119 dust repros) |
| 02-04-02 | 02-04 | 3 | MOVE-01 | T-02-04 | Self-send/duplicates throw, D-09 holds | unit | `npx vitest run lib/engine/moves.test.ts` | ✅ | ✅ green (duplicate/self-send throw repros) |
| 02-04-03 | 02-04 | 3 | PRIOR-02 | T-02-03 | Soonness tiebreak, deterministic fallback | unit | `npx vitest run lib/engine/priorities.test.ts && npx vitest run && npx tsc --noEmit` | ✅ | ✅ green (tied-50/50 repro + full suite + typecheck) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` + `tsconfig.json` + `package.json` devDeps — installed by 02-01 (Wave 1 tracer)
- [x] `lib/engine/seeds.ts` — deterministic fixtures for all 4 scenarios (02-01)

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification — pure functions, every failure reproduced programmatically, no human testing needed.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-08
