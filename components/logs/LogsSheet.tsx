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
export function LogsSheet({ onClose, bump, onReset }: { onClose: () => void; bump: unknown; onReset: (message: string) => void }) {
  const { role, ownHospitalId, hospName, results } = useDash();
  const [action, setAction] = useState("");
  const [hospital, setHospital] = useState("");
  const { state, reload } = useLogs({ action: action || null, hospital: hospital || null, limit: 200 }, bump);
  const network = role === "network_admin";
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const doReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const r = await fetch("/api/admin/demo-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      const j = (await r.json()) as { error?: string; orders?: number; movements?: number };
      if (!r.ok) throw new Error(j.error ?? `Reset failed (${r.status})`);
      setConfirmReset(false);
      onReset(`Demo reset. ${j.orders ?? 0} orders removed, ${j.movements ?? 0} stock movements reversed.`);
      reload();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

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
        {network && !confirmReset ? (
          <button type="button" className={rows.textButton} onClick={() => setConfirmReset(true)} data-testid="reset-demo">
            Reset demo data
          </button>
        ) : null}
      </div>
      {network && confirmReset ? (
        <div className={rows.error} role="alertdialog" aria-label="Confirm demo reset">
          <p>Put back every unit moved by deliveries and delete all orders and log entries? This cannot be undone.</p>
          <div className={styles.filters}>
            <button type="button" className={rows.criticalButton} onClick={doReset} disabled={resetting} data-testid="confirm-reset">
              {resetting ? "Resetting" : "Reset demo"}
            </button>
            <button type="button" className={rows.outlineButton} onClick={() => setConfirmReset(false)}>
              Keep data
            </button>
          </div>
        </div>
      ) : null}
      {resetError ? <p className={rows.error}>{resetError}</p> : null}
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
