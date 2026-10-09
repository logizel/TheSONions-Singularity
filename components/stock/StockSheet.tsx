"use client";

/**
 * Manual stock entry sheet (`stock-sheet`, ?stock=1, DATA-01/DATA-02): one
 * hospital + medicine, three actions — add a batch with a mandatory expiry
 * date (D-07), remove damaged units (D-03, earliest expiry first server-side)
 * and record the day's usage with patient load and emergency share (D-08).
 * Writes go through POST /api/inventory, which re-checks the role, so a
 * hospital admin's form never offers another hospital: the disabled select is
 * the affordance and the route's 403 is the backstop. On success the parent
 * refreshes the server results so forecasts, stock-out and waste pick the
 * write up, and logActivity lists it under the hospital involved.
 */
import { useCallback, useState } from "react";

import { dShort, fmtDate } from "@/lib/dashboard/panel";
import { fmtUnits } from "@/lib/dashboard/view";
import { STOCK_ACTIONS, buildStockBody, type StockAction, type StockForm } from "@/lib/stock/form";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { SheetHeader } from "../dashboard/SheetHeader";
import logs from "../logs/logs.module.css";
import styles from "./stock.module.css";

const ACTION_LABEL: Record<StockAction, string> = {
  add: "Add stock",
  remove: "Remove / damaged",
  usage: "Record usage",
};

const SUBMIT_LABEL: Record<StockAction, string> = {
  add: "Add stock",
  remove: "Remove units",
  usage: "Record usage",
};

export function StockSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { results, role, ownHospitalId, medName, hospName, unit, selectedId } = useDash();
  const network = role === "network_admin";

  // A hospital admin starts on its own hospital; the network admin on the
  // drilled-in hospital (the sheet can be opened from a hospital panel).
  const blank = useCallback(
    (): StockForm => ({
      action: "add",
      hospitalId: network ? (selectedId ?? results.hospitals[0]?.hospitalId ?? "") : (ownHospitalId ?? ""),
      medicineId: results.medicines[0]?.medicineId ?? "",
      qty: "",
      expiryDate: results.asOf,
      usageDate: results.asOf,
      usedQty: "",
      patientLoad: "",
      emergencyPct: "",
    }),
    [network, ownHospitalId, results, selectedId],
  );

  const [form, setForm] = useState<StockForm>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const set = (patch: Partial<StockForm>) => setForm((f) => ({ ...f, ...patch }));

  // Current position of the chosen pair, so the admin sees what the write does.
  const entry = results.inventory.find((e) => e.hospitalId === form.hospitalId && e.medicineId === form.medicineId) ?? null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    setConfirm(null);
    try {
      const r = await fetch("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildStockBody(form, { hospitalName: hospName(form.hospitalId), medicineName: medName(form.medicineId) }),
        ),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status !== 201) throw new Error(j.error ?? `Could not record the entry (${r.status})`);
      const med = medName(form.medicineId);
      const hosp = hospName(form.hospitalId);
      const qty = form.qty.trim();
      const u = unit(form.medicineId, Number(qty) || 2);
      setConfirm(
        form.action === "add"
          ? `Added ${qty} ${u} of ${med} at ${hosp}, expiry ${form.expiryDate}.`
          : form.action === "remove"
            ? `Removed ${qty} ${u} of ${med} at ${hosp}.`
            : `Recorded usage for ${med} at ${hosp} on ${form.usageDate}.`,
      );
      // Value fields clear; the pair and the dates stay for repeat entries.
      setForm((f) => ({ ...f, qty: "", usedQty: "", patientLoad: "", emergencyPct: "" }));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="stock-sheet">
      <SheetHeader title="Enter stock" onClose={onClose} closeLabel="Close stock entry" closeTestId="stock-close">
        <p className={rows.caption}>
          {network
            ? "As the network admin, pick any hospital and record stock: add a batch with its expiry date, remove damaged units, or record the day's usage."
            : "As a hospital admin, record stock and usage for your own hospital only. The nearest expiry batch is used first when you remove units."}
        </p>
      </SheetHeader>

      <form className={styles.form} onSubmit={submit} data-testid="stock-form" aria-label="Enter stock">
        <label className={styles.field}>
          <span className={rows.label}>Hospital</span>
          <select
            className={logs.select}
            value={form.hospitalId}
            disabled={!network}
            onChange={(e) => set({ hospitalId: e.target.value })}
            data-testid="stock-hospital"
          >
            {network ? (
              results.hospitals.map((h) => (
                <option key={h.hospitalId} value={h.hospitalId}>
                  {h.hospitalName}
                </option>
              ))
            ) : (
              <option value={form.hospitalId}>{hospName(form.hospitalId)}</option>
            )}
          </select>
        </label>
        <label className={styles.field}>
          <span className={rows.label}>Medicine</span>
          <select
            className={logs.select}
            value={form.medicineId}
            onChange={(e) => set({ medicineId: e.target.value })}
            data-testid="stock-medicine"
          >
            {results.medicines.map((m) => (
              <option key={m.medicineId} value={m.medicineId}>
                {m.medicineName}
              </option>
            ))}
          </select>
        </label>
        <p className={`${rows.caption} ${styles.wide}`} data-testid="stock-current">
          {entry
            ? `${fmtUnits(entry.stock)} ${unit(entry.medicineId, entry.stock)} on file · ${dShort(entry.daysUntilStockout)} cover · nearest expiry ${
                entry.nearestExpiry ? fmtDate(entry.nearestExpiry) : "none"
              }`
            : "No stock on file for this medicine yet."}
        </p>

        <div className={styles.toggle} role="group" aria-label="Stock entry action">
          {STOCK_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className={rows.outlineButton}
              aria-pressed={form.action === a}
              onClick={() => set({ action: a })}
              data-testid={`stock-action-${a}`}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>

        {form.action === "add" ? (
          <>
            <label className={styles.field}>
              <span className={rows.label}>Units</span>
              <input
                className={logs.select}
                type="number"
                min={1}
                required
                value={form.qty}
                onChange={(e) => set({ qty: e.target.value })}
                data-testid="stock-qty"
              />
            </label>
            <label className={styles.field}>
              <span className={rows.label}>Expiry date (mandatory)</span>
              <input
                className={logs.select}
                type="date"
                required
                value={form.expiryDate}
                onChange={(e) => set({ expiryDate: e.target.value })}
                data-testid="stock-expiry"
              />
            </label>
          </>
        ) : null}

        {form.action === "remove" ? (
          <label className={styles.field}>
            <span className={rows.label}>Units (earliest expiry goes first)</span>
            <input
              className={logs.select}
              type="number"
              min={1}
              required
              value={form.qty}
              onChange={(e) => set({ qty: e.target.value })}
              data-testid="stock-qty"
            />
          </label>
        ) : null}

        {form.action === "usage" ? (
          <>
            <label className={styles.field}>
              <span className={rows.label}>Usage date</span>
              <input
                className={logs.select}
                type="date"
                required
                value={form.usageDate}
                onChange={(e) => set({ usageDate: e.target.value })}
                data-testid="stock-usage-date"
              />
            </label>
            <label className={styles.field}>
              <span className={rows.label}>Patient load</span>
              <input
                className={logs.select}
                type="number"
                min={0}
                required
                value={form.patientLoad}
                onChange={(e) => set({ patientLoad: e.target.value })}
                data-testid="stock-patient-load"
              />
            </label>
            <label className={styles.field}>
              <span className={rows.label}>Used units (blank = missing day)</span>
              <input
                className={logs.select}
                type="number"
                min={0}
                value={form.usedQty}
                onChange={(e) => set({ usedQty: e.target.value })}
                data-testid="stock-used-qty"
              />
            </label>
            <label className={styles.field}>
              <span className={rows.label}>Emergency share %</span>
              <input
                className={logs.select}
                type="number"
                min={0}
                max={100}
                required
                value={form.emergencyPct}
                onChange={(e) => set({ emergencyPct: e.target.value })}
                data-testid="stock-emergency-pct"
              />
            </label>
          </>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={rows.accentButton} disabled={busy} data-testid="stock-submit">
            {busy ? "Saving" : SUBMIT_LABEL[form.action]}
          </button>
        </div>
      </form>

      {error ? (
        <p className={rows.error} role="alert" data-testid="stock-error">
          {error}
        </p>
      ) : null}

      {confirm ? (
        <p className={rows.note} role="status" data-testid="stock-confirm">
          {confirm}
        </p>
      ) : null}
    </div>
  );
}
