# Quick Task 261009-dqq: manual stock entry panel for hospital admins - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Task Boundary

There is no panel for manual inventory entry for a hospital's admin. Build one: a sheet opened from the dashboard where a hospital admin (and the network admin) can write stock and usage through the existing `scripts/entry.ts` write path and `POST /api/inventory`.

</domain>

<decisions>
## Implementation Decisions

### Panel scope
- One sheet with three actions: **Add stock** (qty + mandatory expiry date), **Remove / damaged** (qty, FIFO handled server-side), **Record usage** (date + used qty + patient load + emergency %). Matches Phase 1 success criteria DATA-01/DATA-02 and the existing `addBatch` / `adjustStockDown` / `recordUsage` helpers.

### Entry points
- Top bar gets an "Enter stock" button (both roles), plus an XS-menu item, matching the Logs/Events pattern.
- The hospital drill-in gets an "Enter stock" button when the viewer may write to that hospital (network admin, or the hospital's own admin), pre-selecting it.
- Add `openStock(hospitalId?)` to `DashboardCtx`; `?stock=1` drives the sheet.

### the agent's Discretion
- URL param: reuse the `?stock=1` param already added to `components/dashboard/useUrlState.ts`.
- Hospital field: network admin picks any hospital; hospital admin is locked to its own hospital (server enforces this too).
- `POST /api/inventory`: a blank used qty maps to `null` (missing day) rather than a validation error; everything else stays as written.
- Activity-log summaries use hospital/medicine **display names** supplied by the client for readability; ids remain the only values used for writes.
- Styling: reuse the grid layout pattern from `components/events/events.module.css` in a new `components/stock/stock.module.css`.

</decisions>

<specifics>
## Specific Ideas

- The form should show the selected hospital+medicine's current stock from `results.inventory` so the admin sees the effect.
- After a successful write: reset the form, show a confirmation, call `router.refresh()` so forecasts / stock-out / waste update, and let the activity log show the new row.
- Pattern to copy: `components/events/EventsSheet.tsx` (SheetHeader, grid form, `data-testid`s, inline `role="alert"` error).

### Existing partial work (must be finished, not redone)
- `app/api/inventory/route.ts` (untracked): `POST` for `add` / `remove` / `usage`, role-scoped.
- `components/dashboard/useUrlState.ts`: `?stock` param added.
- `lib/logs/types.ts`: `stock_added`, `stock_removed`, `usage_recorded` added.
- **Build is currently broken**: `components/logs/LogList.tsx` `TONE` map (`Record<LogEntry["action"], TagTone>`) is missing the 3 new actions, so `npm run typecheck` fails. Fix it as part of this task.

</specifics>

<canonical_refs>
## Canonical References

- `scripts/entry.ts` — the shared write path (`addBatch`, `adjustStockDown`, `recordUsage`, `pairBufferDays`).
- `components/events/EventsSheet.tsx` + `components/events/events.module.css` — the sheet pattern to mirror.
- `components/dashboard/Dashboard.tsx` — URL-driven sheet modes and `closeDetail`.
- `components/dashboard/TopBar.tsx`, `context.tsx`, `HospitalDetail.tsx` — entry points.
- `middleware.ts` — role-scope rules for `/api/*` writes.

</canonical_refs>
