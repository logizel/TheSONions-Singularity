---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-08T11:59:39.968Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | deviation | lib/contracts.ts |  | Phase 1 frozen contract missing; local ResultsJSON stub created so 03-01 compiles — P2 must replace when Phase 1 runs | open |  | 2026-10-08T11:59:39.968Z |  |

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
  }
]
````
