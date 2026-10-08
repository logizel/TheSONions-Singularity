---
phase: 04-dashboard-ui
source: 04-REVIEW.md
created: 2026-10-08T13:00:00Z
open: 17 of 17
fixed: 0
skipped: 0
deferred: 0
---

# Code Review Disposition — Phase 04 Dashboard UI

Advisory review (code-review capability). All findings recorded as `open`; none block phase completion. Triage deferred to a follow-up fix pass or Phase 5 integration.

| Finding | Title | Severity | Disposition | Source |
|---------|-------|----------|-------------|--------|
| H-01 | Inventory card ignores the hospital cross-filter (D-04 breach) | high | open | 04-REVIEW.md |
| H-02 | Risk badge for the same stock disagrees between dashboard and drill-in | high | open | 04-REVIEW.md |
| M-01 | Chat intents 1–3 ignore the active hospital filter | medium | open | 04-REVIEW.md |
| M-02 | answerMostAtRisk pairs entities across hospitals and hardcodes flag vocabulary | medium | open | 04-REVIEW.md |
| M-03 | Numeric quote gate is token-presence-only and its token set is polluted | medium | open | 04-REVIEW.md |
| M-04 | isOwnHospital(null) fails open, granting actions on a misconfigured panel | medium | open | 04-REVIEW.md |
| L-01 | Inventory sparkline shows the first medicine's trend as the hospital's trend | low | open | 04-REVIEW.md |
| L-02 | Free-text transfer intent misses sentences starting with "move" | low | open | 04-REVIEW.md |
| L-03 | formatUpdatedAgo renders "Updated NaN hours ago" on an invalid timestamp | low | open | 04-REVIEW.md |
| L-04 | Unknown-id cleanup and filter navigation discard unrelated query params | low | open | 04-REVIEW.md |
| L-05 | Rapid double-send can duplicate chat message keys | low | open | 04-REVIEW.md |
| L-06 | Drill-in renders as a stacked section, not a side panel | low | open | 04-REVIEW.md |
| L-07 | Chat never auto-restores when the drill-in closes | low | open | 04-REVIEW.md |
| L-08 | Any trend-mode forecast gets a red badge, outbreak or not | low | open | 04-REVIEW.md |
| L-09 | No-forecast fallback still draws a sparkline that looks like a forecast | low | open | 04-REVIEW.md |
| L-10 | orderRows memo omits medicineNameById from deps | low | open | 04-REVIEW.md |
| L-11 | Dead label field on every badge token | low | open | 04-REVIEW.md |
