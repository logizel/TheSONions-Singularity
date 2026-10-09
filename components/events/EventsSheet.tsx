"use client";

/**
 * Local events sheet (`events-sheet`, ?events=1, EVT-04). Lists every event
 * from GET /api/events. The network admin can add one (POST /api/events) and
 * end one (POST /api/events/<id>/end); hospital admins read only. After a
 * change the parent refreshes the server results so forecasts, badges and
 * transfers pick the event up. The status column is display only: the
 * engine applies its own window.
 */
import { useCallback, useEffect, useState } from "react";

import { LOCAL_EVENT_TYPES, type LocalEventRow, type LocalEventType } from "@/lib/contracts";
import { fmtDate } from "@/lib/dashboard/panel";
import { EVENT_LABEL } from "@/lib/engine/events";
import type { HospitalLocation } from "@/lib/hospital-locations";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { SheetHeader } from "../dashboard/SheetHeader";
import logs from "../logs/logs.module.css";
import { Tag } from "../ui/Tag";
import styles from "./events.module.css";

const SEVERITY_LABEL: Record<number, string> = { 1: "Minor", 2: "Moderate", 3: "Severe" };
const DAY_MS = 86_400_000;
const plusDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

type Status = "Active" | "Upcoming" | "Ended";
function statusOf(e: LocalEventRow, asOf: string): Status {
  if (e.endsOn < asOf) return "Ended";
  if (e.startsOn > asOf) return "Upcoming";
  return "Active";
}

type ListState = { status: "loading" } | { status: "ok"; events: LocalEventRow[] } | { status: "error" };

interface FormState {
  type: LocalEventType;
  severity: string;
  near: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  startsOn: string;
  endsOn: string;
  note: string;
}

export function EventsSheet({
  onClose,
  locations,
  onChanged,
}: {
  onClose: () => void;
  locations: HospitalLocation[];
  onChanged: () => void;
}) {
  const { role, results } = useDash();
  const network = role === "network_admin";
  const asOf = results.asOf;
  const blank = useCallback(
    (): FormState => ({
      type: "flood",
      severity: "2",
      near: "",
      latitude: "",
      longitude: "",
      radiusKm: "5",
      startsOn: asOf,
      endsOn: plusDays(asOf, 7),
      note: "",
    }),
    [asOf],
  );
  const [form, setForm] = useState<FormState>(blank);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/events", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { events: LocalEventRow[] }) : Promise.reject(r.status)))
      .then((j) => alive && setList({ status: "ok", events: j.events }))
      .catch(() => alive && setList({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [tick]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const pickNear = (id: string) => {
    const h = locations.find((l) => l.id === id);
    set(h ? { near: id, latitude: String(h.lat), longitude: String(h.lng) } : { near: "" });
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy("add");
    setError(null);
    try {
      const r = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          severity: Number(form.severity),
          latitude: form.latitude === "" ? null : Number(form.latitude),
          longitude: form.longitude === "" ? null : Number(form.longitude),
          radiusKm: form.radiusKm === "" ? null : Number(form.radiusKm),
          startsOn: form.startsOn,
          endsOn: form.endsOn,
          note: form.note,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status !== 201) throw new Error(j.error ?? `Could not add the event (${r.status})`);
      setForm(blank());
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the event");
    } finally {
      setBusy(null);
    }
  };

  const end = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const r = await fetch(`/api/events/${encodeURIComponent(id)}/end`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Could not end the event (${r.status})`);
      setTick((t) => t + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not end the event");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="events-sheet">
      <SheetHeader title="Local events" onClose={onClose} closeLabel="Close local events" closeTestId="events-close">
        <p className={rows.caption}>
          Floods, heat waves, epidemics and other events near a hospital raise its forecast for the medicines they
          affect, only on the days they cover.
        </p>
      </SheetHeader>

      {network ? (
        <form className={styles.form} onSubmit={submit} data-testid="event-form" aria-label="Add a local event">
          <label className={styles.field}>
            <span className={rows.label}>Type</span>
            <select className={logs.select} value={form.type} onChange={(e) => set({ type: e.target.value as LocalEventType })} data-testid="event-type">
              {LOCAL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={rows.label}>Severity</span>
            <select className={logs.select} value={form.severity} onChange={(e) => set({ severity: e.target.value })} data-testid="event-severity">
              {[1, 2, 3].map((s) => (
                <option key={s} value={String(s)}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span className={rows.label}>Near hospital (fills the position)</span>
            <select className={logs.select} value={form.near} onChange={(e) => pickNear(e.target.value)} data-testid="event-near">
              <option value="">Choose a hospital or type a position</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={rows.label}>Latitude</span>
            <input className={logs.select} type="number" step="any" min={-90} max={90} required value={form.latitude} onChange={(e) => set({ latitude: e.target.value, near: "" })} data-testid="event-lat" />
          </label>
          <label className={styles.field}>
            <span className={rows.label}>Longitude</span>
            <input className={logs.select} type="number" step="any" min={-180} max={180} required value={form.longitude} onChange={(e) => set({ longitude: e.target.value, near: "" })} data-testid="event-lng" />
          </label>
          <label className={styles.field}>
            <span className={rows.label}>Radius km</span>
            <input className={logs.select} type="number" step="any" min={0.1} max={200} required value={form.radiusKm} onChange={(e) => set({ radiusKm: e.target.value })} data-testid="event-radius" />
          </label>
          <span className={styles.field} aria-hidden="true" />
          <label className={styles.field}>
            <span className={rows.label}>Starts on</span>
            <input className={logs.select} type="date" required value={form.startsOn} onChange={(e) => set({ startsOn: e.target.value })} data-testid="event-starts" />
          </label>
          <label className={styles.field}>
            <span className={rows.label}>Ends on</span>
            <input className={logs.select} type="date" required value={form.endsOn} onChange={(e) => set({ endsOn: e.target.value })} data-testid="event-ends" />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span className={rows.label}>Note (optional)</span>
            <input className={logs.select} type="text" maxLength={200} value={form.note} onChange={(e) => set({ note: e.target.value })} data-testid="event-note" />
          </label>
          <div className={styles.actions}>
            <button type="submit" className={rows.accentButton} disabled={busy !== null} data-testid="event-submit">
              {busy === "add" ? "Adding" : "Add event"}
            </button>
          </div>
        </form>
      ) : (
        <p className={rows.note} role="note">
          Only the network admin can add events.
        </p>
      )}

      {error ? (
        <p className={rows.error} role="alert" data-testid="event-error">
          {error}
        </p>
      ) : null}

      {list.status === "loading" ? <p className={rows.empty}>Loading events</p> : null}
      {list.status === "error" ? <p className={rows.error}>Events unavailable. Close and open the sheet to retry.</p> : null}
      {list.status === "ok" && list.events.length === 0 ? <p className={rows.empty}>No local events.</p> : null}
      {list.status === "ok" && list.events.length > 0 ? (
        <ul className={rows.rows} data-testid="events-list">
          {list.events.map((e) => {
            const status = statusOf(e, asOf);
            return (
              <li key={e.id} className={`${rows.row} ${rows.rowNoTag}`} data-testid={`event-row-${e.id}`}>
                <div className={rows.main}>
                  <span className={rows.line1}>
                    <span className={rows.strong}>{EVENT_LABEL[e.type]}</span> · {SEVERITY_LABEL[e.severity] ?? e.severity} ·{" "}
                    {e.radiusKm} km radius{" "}
                    <Tag tone={status === "Active" ? "ink" : status === "Upcoming" ? "outline" : "muted"}>{status}</Tag>
                  </span>
                  <span className={rows.line2}>
                    {fmtDate(e.startsOn)} to {fmtDate(e.endsOn)}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </div>
                {network && status !== "Ended" ? (
                  <button
                    type="button"
                    className={rows.outlineButton}
                    onClick={() => end(e.id)}
                    disabled={busy !== null}
                    data-testid={`end-event-${e.id}`}
                  >
                    {busy === e.id ? "Ending" : "End"}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
