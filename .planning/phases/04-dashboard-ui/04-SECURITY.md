---
phase: "04-dashboard-ui"
slug: "04-dashboard-ui"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-08"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> P1 UI-only phase: static mock fixture, no app/api, no DB, no middleware. Role gating display-only by design; server enforcement deferred to Phase 3 / verified in Phase 5.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser -> static fixture | Untrusted hospital id enters via ?hospital=id URL param | hospital id string (untrusted) |
| fixture file -> card render | Fixture strings (names, chips) render as UI text | display strings (escaped) |
| role prop -> action visibility | Caller-supplied role/owner crosses into visibility decisions | role + ownHospitalId (display-only) |
| panel switcher -> shared filter | Switcher input flows into dashboard-wide filter state | fixture hospital ids only |
| user question -> mock matcher | Free-text input flows into canned intent matching | question text (untrusted) |
| fixture numbers -> chat answer | Answer text must contain only fixture-present numbers | numeric tokens (gated) |
| filter param -> chat engine | User-controlled ?hospital=id crosses into answer scoping | hospital id (validated) |
| answer text -> rendered chat | Answer strings cross into the UI readers trust for medical numbers | answer text (quote-checked) |
| card slice -> rendered total | Filtered rows cross into the header caption readers trust | totals + scope label |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-4-01 | Spoofing | ?hospital=id deep link | low | mitigate | Validate id against fixture hospital list; unknown ids fall back to unfiltered and drop the param | closed |
| T-4-02 | Tampering | app/data/mock-results.json | low | accept | Prototype mock data ships with the client by design; real API trust arrives in Phase 5 wiring | closed |
| T-4-03 | Information Disclosure | Dashboard rendering | low | mitigate | Render aggregates only, never patient-level fields; fixture review rejects any PHI-like keys | closed |
| T-4-04 | XSS (Tampering) | Card text rendering | medium | mitigate | React default escaping everywhere; forbid dangerouslySetInnerHTML in P1 components | closed |
| T-4-05 | DoS | Static fixture load | low | mitigate | Single bounded fixture (~3x5 network); one in-memory load, no refetch loops | closed |
| T-4-06 | Elevation of Privilege | components/roles.tsx | high | transfer | Display-only gating with code comments; true enforcement transfers to Phase 3 middleware and Phase 5 verification | closed |
| T-4-07 | Tampering | Hospital switcher input | low | mitigate | Switcher offers fixture hospital list only; free-text ids validate against fixture before applying | closed |
| T-4-08 | Information Disclosure | Read-only panel for other hospitals | medium | mitigate | hospital_admin hides moves/order actions on non-own hospitals; no PHI fields exist to leak | closed |
| T-4-09 | XSS (Tampering) | MedicineRow expanded text | medium | mitigate | No dangerouslySetInnerHTML; move rationale strings render as escaped text | closed |
| T-4-10 | XSS (Tampering) | Chat answer rendering | medium | mitigate | Answers render as escaped text; forbid dangerouslySetInnerHTML in chat components | closed |
| T-4-11 | Information Disclosure | Mock answer fallback | high | mitigate | Quote post-check blocks any answer with non-fixture numbers; fallback shown instead | closed |
| T-4-12 | Spoofing | Advisory/outbreak display | medium | mitigate | Advisory tag, MAPE badge, Outbreak chip render only from envelope flags; days 15-30 never actionable | closed |
| T-4-13 | Tampering | Composer free-text input | low | mitigate | Single-shot matching with no persistence and no matcher-state writes; history display-only | closed |
| T-4-14 | Tampering | buildInventoryRows filter (app/page.tsx) | low | mitigate | selectedId already validated by isKnownHospitalId; unknown ids drop the param (T-4-01 path unchanged) | closed |
| T-4-15 | Information Disclosure | inventory total caption (InventoryCard.tsx) | low | mitigate | Caption reflects filtered scope so a single-hospital sum is never misread as network-wide | closed |
| T-4-16 | Spoofing | chat hospital scope (mock-answers.ts) | medium | mitigate | Scope validated by knownHospitalId; scoped answers name the hospital; empty slices fall back | closed |
| T-4-17 | Information Disclosure | numeric quote gate (mock-answers.ts) | high | mitigate | Per-answer allow-set from cited rows only; checked() single enforcement; dosage/date stripped | closed |
| T-4-18 | Elevation of Privilege | isOwnHospital null owner (roles.tsx, HospitalPanel.tsx) | medium | mitigate | Null owner fails closed (hides actions); display-only unchanged; enforcement to Phase 3/5 | closed |
| T-4-SC | Tampering | npm installs | high | mitigate | Install from lockfile; no new packages (Next/React/TS only); blocking human checkpoint before any package add | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Evidence (ASVS L1, grep-verified 2026-10-08)

- T-4-01 / T-4-14: `app/page.tsx:112` `selectedId = isKnownHospitalId(fixture, rawParam) ? rawParam : null`; `:115-119` unknown-id `router.replace(pathname)` drop-param; `:125` `selectHospital` guard rejects unknown ids; `app/data/results.ts:111-117` validator def; `components/panel/HospitalPanel.tsx:62` second-layer unknown-id guided copy; `buildInventoryRows` filter `app/page.tsx:52-53`.
- T-4-03: `app/data/results.ts:7` aggregates-only comment; `patientLoad`/`emergencyPct` exist in `app/data/mock-results.json:6-8` + type def only — zero render sites (grep clean outside JSON/type); `components/panel/HospitalPanel.tsx:154` stock-only header; `components/roles.tsx:43` aggregates-only note.
- T-4-04 / T-4-09 / T-4-10: `dangerouslySetInnerHTML|__html|innerHTML` grep over `app/ components/ theme/` ABSENT; `components/panel/MedicineRow.tsx:11-12`, `components/panel/HospitalPanel.tsx:19-20` no-raw-HTML notes.
- T-4-05: single static `import fixtureJson` `app/page.tsx:13`, `useMemo` slices, Refresh = `window.location.reload()` only (`:274,303`); no `setInterval`/`fetch` polling (grep clean).
- T-4-06 (transfer): `components/roles.tsx:11-17` DISPLAY-ONLY GATING block transfers to Phase 3 middleware + Phase 5 wiring; mirrored `components/cards/MovesCard.tsx:5-9`, `components/panel/MedicineRow.tsx:151-153`, `app/page.tsx:101-102`; no server-enforcement claims anywhere (fail gate clean).
- T-4-07: `components/panel/HospitalPanel.tsx:287-288,303-317` switcher buttons from `fixture.hospitals` only + `:316` `isKnownHospitalId` guard.
- T-4-08: `components/roles.tsx:45-61` `canSeeMoveActions`/`canSeeOrderActions` (network_admin short-circuit else `isOwnHospital`); `components/cards/MovesCard.tsx:59-61,111-115` gating with `(read-only)` fallback; `components/panel/HospitalPanel.tsx:137-138` `isOwn`/`showMoveActions`.
- T-4-11 / T-4-17: `components/chat/mock-answers.ts:331-337` `checked()` on every return path (`:282,284,286,294,304,315,324`); `SAFE_FALLBACK :35`; `citedAllowSet :74-82`, `passesQuoteCheck :92-103`, `DOSAGE_FRAGMENT_RE :61`, `ISO_DATE_RE :63`; `FIXTURE_NUMERIC_TOKENS` ABSENT; hardcoded `high load and emergency share` clause ABSENT.
- T-4-12: `components/cards/ForecastCard.tsx:41` MAPE badge from envelope `mape` prop; `:73-80` greyed advisory band + `advisoryLabel`; `:62-64` `OutbreakBanner` only when `row.outbreak`; `:88-91` trend-mode note while flagged; `components/chat/mock-answers.ts:261` advisory-only sentence.
- T-4-13: `answerQuestion(question, contextHospitalId)` `:274-277` — no history param; `components/chat/ChatPanel.tsx:76` passes text+filter only; history `useState :49` display-only; `localStorage|sessionStorage|IndexedDB` grep over `components/chat/ + app/page.tsx` ABSENT; no `fetch` in chat.
- T-4-15: `components/cards/InventoryCard.tsx:23,28` `scope` prop + `:37-39` caption branch (`units at {scope}` vs `units network-wide`); call site `app/page.tsx:357` wires `selectedHospital?.name ?? null`.
- T-4-16: `knownHospitalId :114-117` validates; all four intents accept `contextHospitalId` (`:168,181,213,247`); scoped prefix `At ${hospitalName}` (`answerWaste :202`, `answerTransfers :236`; `riskAnswer :146` names hospital); empty slices degrade to global or `fallback()` (`:173,187,219,255`, `:176`: no-shortage → SAFE_FALLBACK).
- T-4-18: `components/roles.tsx:36` `return false` on null; `components/panel/HospitalPanel.tsx:137` `ownHospitalId !== null && ownHospitalId === hospitalId` same fail-closed shape; display-only docs unchanged (see T-4-06).
- T-4-SC: `package.json` deps only `next 16.4.0 / react / react-dom / typescript / @types/*`; `package-lock.json` present; BeautifulUI copy-paste vendored, nothing hotlinked/installed.
- Scope gates: `app/api/`, `db/`, `lib/`, `scripts/`, `middleware.ts` — none exist; gap commits touch only `app/page.tsx`, `components/cards/InventoryCard.tsx`, `components/chat/mock-answers.ts`, `components/roles.tsx`, `components/panel/HospitalPanel.tsx`. Panel read-only: no `input/select/textarea/contentEditable` in panel files. `git status` clean of implementation edits (only `.gsd/`, `.planning/milestone.lock`, `.planning/state.json` untracked).
- Build: `npm run typecheck` + `npm run build` PASS per 04-VERIFICATION.md (29/29 must-haves, gaps G-04-1..G-04-6 closed).

### Unregistered Flags

None. All plan SUMMARies report `## Threat Flags: None` (04-02, 04-03, 04-04, 04-05); no new attack surface appeared during implementation.

### Advisory (non-blocking, not in threat register)

Lows L-01..L-11 from 04-REVIEW.md remain `open` per 04-REVIEW-DISPOSITION.md and were explicitly out of scope for 04-04/04-05 (disposition unchanged — no silent absorption). They do not breach any must-have truth and do not count toward `threats_open`. Recommend triage in Phase 5 or a polish pass.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| A-04-01 | T-4-02 | Prototype mock ResultsJSON ships statically with the client by design (P1-owned `app/data/mock-results.json`); no real patient or production data involved; real API trust boundary arrives with Phase 5 wiring. | Phase 4 plan (04-01-PLAN.md disposition: accept) | 2026-10-08 |
| A-04-02 | T-4-06 | Role gating is display-only (hidden buttons are not a security boundary); true authentication/authorization enforcement is transferred to Phase 3 server-side middleware with final verification in Phase 5. Documented in `components/roles.tsx:11-17` and mirrored in MovesCard/MedicineRow/page comments. | Phase 4 plan (04-02-PLAN.md disposition: transfer) | 2026-10-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-08 | 19 | 19 | 0 | gsd-security-auditor (Phase 04 audit) |

### Security Audit 2026-10-08

| Metric | Count |
|--------|-------|
| Threats found | 19 |
| Closed | 19 |
| Open | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-08
