---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-10-09T05:05:52.505Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | deviation | lib/contracts.ts |  | Phase 1 frozen contract missing; local ResultsJSON stub created so 03-01 compiles — P2 must replace when Phase 1 runs | open |  | 2026-10-08T11:59:39.968Z |  |
| 2 | quick-261009-dqq | unrun-verify | .planning/quick/261009-dqq-manual-stock-entry-panel-for-hospital-ad/261009-dqq-SUMMARY.md |  | Successful-write path (confirm + reset + refresh + activity-log row) not exercised live: a real write would insert rows into the shared dev database; 401/403/400 route cases and browser read-only paths verified instead. | open |  | 2026-10-09T05:05:52.505Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "03",
    "file": "lib/contracts.ts",
    "line": null,
    "description": "Phase 1 frozen contract missing; local ResultsJSON stub created so 03-01 compiles — P2 must replace when Phase 1 runs",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-08T11:59:39.968Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "quick-261009-dqq",
    "file": ".planning/quick/261009-dqq-manual-stock-entry-panel-for-hospital-ad/261009-dqq-SUMMARY.md",
    "line": null,
    "description": "Successful-write path (confirm + reset + refresh + activity-log row) not exercised live: a real write would insert rows into the shared dev database; 401/403/400 route cases and browser read-only paths verified instead.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-09T05:05:52.505Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
