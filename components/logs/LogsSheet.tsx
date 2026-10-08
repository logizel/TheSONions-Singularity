"use client";

import { useState } from "react";

import { ACTION_LABEL, LOG_ACTIONS } from "@/lib/logs";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { SheetHeader } from "../dashboard/SheetHeader";
import { LogList } from "./LogList";
import styles from "./logs.module.css";
import { useLogs } from "./useLogs";

/** Activity log (`logs-sheet`, ?logs=1): everything for network admin, own hospital for hospital admin. */
export function LogsSheet({ onClose, bump }: { onClose: () => void; bump: unknown }) {
  const { role, ownHospitalId, hospName, results } = useDash();
  const [action, setAction] = useState("");
  const [hospital, setHospital] = useState("");
  const { state, reload } = useLogs({ action: action || null, hospital: hospital || null, limit: 200 }, bump);
  const network = role === "network_admin";

  return (
    <div data-testid="logs-sheet">
      <SheetHeader title="Activity log" onClose={onClose} closeLabel="Close activity log" closeTestId="logs-close">
        <p className={rows.caption}>
          {network ? "Every action by every admin, newest first." : `Activity for ${ownHospitalId ? hospName(ownHospitalId) : "your hospital"}: your actions and transfers involving it.`}
        </p>
      </SheetHeader>
      <div className={styles.filters}>
        <select className={styles.select} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" data-testid="logs-filter-action">
          <option value="">All actions</option>
          {LOG_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
        {network ? (
          <select className={styles.select} value={hospital} onChange={(e) => setHospital(e.target.value)} aria-label="Filter by hospital" data-testid="logs-filter-hospital">
            <option value="">All hospitals</option>
            {results.hospitals.map((h) => (
              <option key={h.hospitalId} value={h.hospitalId}>
                {h.hospitalName}
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" className={rows.outlineButton} onClick={reload}>
          Reload
        </button>
      </div>
      {state.status === "loading" ? <p className={rows.empty}>Loading activity</p> : null}
      {state.status === "error" ? <p className={rows.error}>Activity log unavailable. Try Reload.</p> : null}
      {state.status === "ok" && state.logs.length === 0 ? <p className={rows.empty}>No activity yet.</p> : null}
      {state.status === "ok" && state.logs.length > 0 ? <LogList logs={state.logs} testId="logs-list" /> : null}
    </div>
  );
}

/** Last few entries for one hospital (drill-in). */
export function RecentActivity({ hospitalId, bump }: { hospitalId: string; bump: unknown }) {
  const { state } = useLogs({ hospital: hospitalId, limit: 5 }, bump);
  return (
    <div data-testid="hospital-panel-activity">
      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Recent activity</span>
      </h3>
      {state.status === "ok" && state.logs.length > 0 ? (
        <LogList logs={state.logs} />
      ) : (
        <p className={rows.empty}>{state.status === "loading" ? "Loading activity" : state.status === "error" ? "Activity log unavailable." : "No activity yet."}</p>
      )}
    </div>
  );
}
