"use client";

/**
 * Delivery-style tracking sheet (`tracking-sheet`, ?order=<id>). Big ETA on
 * the demo clock, distance left, the two separate time facts (engine window
 * vs road drive), the status stepper, demo-clock controls and the admin
 * actions. The vehicle is simulated and labelled so; no driver, phone,
 * plate or company data exists anywhere.
 */
import { useEffect, useRef, useState } from "react";

import { fmtDistance, fmtDuration, fmtUnits } from "@/lib/dashboard/view";
import { DEMO_SPEEDS, fmtSimDuration, nextAction, type Order, type OrderStatus } from "@/lib/orders";
import type { RouteResult } from "@/lib/routing";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { SheetHeader } from "../dashboard/SheetHeader";
import { LocalTime } from "../ui/LocalTime";
import { Tag } from "../ui/Tag";
import { DecisionBriefBlock } from "./DecisionBrief";
import { OrderStatusTag, days } from "./OrderBits";
import styles from "./orders.module.css";
import { Stepper } from "./Stepper";

export interface TrackingProps {
  order: Order;
  route: { status: "loading" } | { status: "ok"; route: RouteResult } | { status: "error" };
  /** Route length used for the simulation (road, or straight-line fallback), metres. */
  totalM: number;
  progress: number;
  remainingMs: number;
  tripMs: number;
  clock: { speed: number; setSpeed: (n: number) => void; paused: boolean; togglePause: () => void };
  onAdvance: (to: OrderStatus) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onBack?: () => void;
}

export function Tracking(p: TrackingProps) {
  const { medName, hospName, unit, role, ownHospitalId } = useDash();
  const { order } = p;
  const [confirming, setConfirming] = useState(false);
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  // Network admin, or the admin of the sending hospital.
  const isAdmin = role === "network_admin" || ownHospitalId === order.fromHospital;
  const next = nextAction(order.status);
  const arrived = p.progress >= 1;
  const approximate = p.route.status !== "ok" || p.route.route.approximate;
  const road = p.route.status === "ok" ? p.route.route : null;
  const lineSummary = order.lines.map((l) => `${medName(l.medicineId)} ${fmtUnits(l.qty)} ${unit(l.medicineId, l.qty)}`).join(", ");

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  let etaLabel = "ETA";
  let eta = fmtSimDuration(p.remainingMs);
  if (order.status === "accepted" || order.status === "packed") {
    etaLabel = "Trip once dispatched";
    eta = fmtSimDuration(p.tripMs);
  } else if (order.status === "delivered") {
    etaLabel = "Delivered";
    eta = "";
  } else if (order.status === "cancelled") {
    etaLabel = "Cancelled";
    eta = "—";
  }

  return (
    <div data-testid="tracking-sheet">
      <SheetHeader title={`Transfer · ${lineSummary}`} onClose={p.onClose} onBack={p.onBack} closeLabel="Close tracking" closeTestId="tracking-close">
        <p>
          {hospName(order.fromHospital)} → {hospName(order.toHospital)}
        </p>
        <div className={rows.inlineRow}>
          <OrderStatusTag status={order.status} />
          <span className={rows.caption}>Order {order.id}</span>
        </div>
      </SheetHeader>

      <div className={styles.readout}>
        <div className={styles.readoutTop}>
          <span className={rows.label}>{etaLabel}</span>
          {order.status !== "cancelled" && order.status !== "delivered" ? (
            <Tag tone="dashed" testId="sim-label">
              Simulated
            </Tag>
          ) : null}
        </div>
        <p className={rows.display} data-testid="tracking-eta">
          {order.status === "delivered" && order.deliveredAt ? <LocalTime iso={order.deliveredAt} format="clock" /> : eta}
        </p>
        <p className={rows.monoHeading} data-testid="tracking-distance">
          {fmtDistance(order.status === "delivered" ? 0 : order.status === "in_transit" ? (1 - p.progress) * p.totalM : p.totalM)} left
        </p>
        <p className={rows.caption}>
          of {approximate ? "≈ " : ""}
          {fmtDistance(p.totalM)} {approximate ? "straight line" : "road route"}
          {p.route.status === "error" ? ". Road route unavailable. The engine delivery window still applies." : ""}
        </p>
      </div>

      <div className={styles.facts}>
        <div className={styles.fact} data-testid="tracking-engine-window">
          <span className={rows.label}>Engine delivery window</span>
          <span className={rows.strong}>{days(order.transportDays)}</span>
          <span className={rows.caption}>Planning window used by the stock engine.</span>
        </div>
        <div className={styles.fact} data-testid="tracking-road-time">
          <span className={rows.label}>Road drive time / distance</span>
          <span className={rows.strong}>
            {road && !road.approximate ? `${fmtDuration(road.durationS)} · ${fmtDistance(road.distanceM)}` : road ? `Not available · ≈ ${fmtDistance(road.distanceM)}` : p.route.status === "loading" ? "Loading route" : "Not available"}
          </span>
          <span className={rows.caption}>
            {road && !road.approximate ? "From the road route (OSRM). Vehicle movement below is simulated." : "Straight-line estimate. Road route unavailable."}
          </span>
        </div>
      </div>

      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Status</span>
      </h3>
      <Stepper order={order} />

      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Decision brief</span>
      </h3>
      <div className={styles.briefWrap}>
        {order.lines.map((l) => (
          <div key={l.id}>
            {order.lines.length > 1 ? <p className={rows.strong}>{medName(l.medicineId)}</p> : null}
            <DecisionBriefBlock
              input={{ kind: "transfer", fromHospital: order.fromHospital, toHospital: order.toHospital, medicineId: l.medicineId, qty: l.qty, arriveDays: order.transportDays }}
              status={order.status}
              testId={`brief-${order.id}-${l.medicineId}`}
            />
          </div>
        ))}
      </div>

      {order.status !== "cancelled" && order.status !== "delivered" ? (
        <div className={styles.clock} data-testid="sim-speed">
          <span className={rows.label}>Demo clock</span>
          <div className={styles.clockRow}>
            <div className={styles.speeds} role="group" aria-label="Demo clock speed">
              {DEMO_SPEEDS.map((s) => (
                <button key={s.factor} type="button" aria-pressed={p.clock.speed === s.factor} onClick={() => p.clock.setSpeed(s.factor)}>
                  <span className={styles.speedFactor}>{s.factor}×</span>
                  <span className={styles.speedCaption}>{s.caption}</span>
                </button>
              ))}
            </div>
            <button type="button" className={rows.outlineButton} onClick={p.clock.togglePause} aria-pressed={p.clock.paused}>
              {p.clock.paused ? "Resume" : "Pause"}
            </button>
          </div>
          <p className={rows.caption}>Simulated vehicle on a demo clock. No real vehicle is tracked.</p>
        </div>
      ) : null}

      {p.error ? (
        <p className={rows.error} role="alert">
          {p.error}
        </p>
      ) : null}

      {isAdmin && order.status === "in_transit" && confirmDeliver ? (
        <div className={styles.confirmDeliver} data-testid="deliver-confirm">
          <p className={rows.strong}>Deliver and update stock?</p>
          <ul className={rows.checks}>
            {order.lines.map((l) => (
              <li key={l.id}>
                <span />
                <span>
                  {medName(l.medicineId)} {Math.round(l.qty)} {unit(l.medicineId, Math.round(l.qty))}: out of {hospName(order.fromHospital)}, into{" "}
                  {hospName(order.toHospital)} (earliest expiry first).
                </span>
              </li>
            ))}
          </ul>
          <p className={rows.caption}>The engine recalculates both hospitals right after. A network admin can undo it with Reset demo.</p>
          <div className={styles.lineActions}>
            <button
              type="button"
              className={rows.accentButton}
              onClick={() => {
                setConfirmDeliver(false);
                p.onAdvance("delivered");
              }}
              data-testid="confirm-deliver"
            >
              Deliver and update stock
            </button>
            <button type="button" className={rows.outlineButton} onClick={() => setConfirmDeliver(false)}>
              Not yet
            </button>
          </div>
        </div>
      ) : isAdmin && order.status !== "delivered" && order.status !== "cancelled" ? (
        confirming ? (
          <div className={styles.confirm}>
            <p>Cancel this transfer? Stock records do not change.</p>
            <div className={styles.lineActions}>
              <button
                type="button"
                className={rows.criticalButton}
                onClick={() => {
                  setConfirming(false);
                  p.onAdvance("cancelled");
                }}
                data-testid="confirm-cancel"
              >
                Cancel transfer
              </button>
              <button ref={keepRef} type="button" className={rows.outlineButton} onClick={() => setConfirming(false)}>
                Keep transfer
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            {next ? (
              <button
                type="button"
                className={next.to === "delivered" && arrived ? rows.accentButton : rows.outlineButton}
                onClick={() => (next.to === "delivered" ? setConfirmDeliver(true) : p.onAdvance(next.to))}
                disabled={p.busy}
                data-testid={`advance-${next.to}`}
              >
                {p.busy ? "Saving" : next.label}
              </button>
            ) : null}
            <button type="button" className={rows.textButton} onClick={() => setConfirming(true)} data-testid="cancel-transfer">
              Cancel transfer
            </button>
          </div>
        )
      ) : !isAdmin ? (
        <p className={rows.note}>Read only. The sending hospital or a network admin updates this transfer.</p>
      ) : null}
      {order.status === "delivered" && order.stockAppliedAt ? (
        <div className={styles.stockDone} data-testid="stock-applied">
          <span className={rows.label}>Stock records updated</span>
          {order.lines.map((l) => (
            <span key={l.id}>
              {hospName(order.fromHospital)} <span className={rows.strong}>−{Math.round(l.qty)}</span> · {hospName(order.toHospital)}{" "}
              <span className={rows.strong}>+{Math.round(l.qty)}</span> {unit(l.medicineId, Math.round(l.qty))} of {medName(l.medicineId)}
            </span>
          ))}
        </div>
      ) : null}
      <p className={`${rows.sectionHead} ${rows.caption}`}>
        {order.status === "delivered" ? "Both hospitals now show the recalculated cover." : "Confirming delivery moves the units between the two hospitals' stock records."}
      </p>
    </div>
  );
}
