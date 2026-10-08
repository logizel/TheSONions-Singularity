"use client";

import { stepperView, type Order } from "@/lib/orders";
import { Glyph } from "../icons/Glyph";
import { LocalTime } from "../ui/LocalTime";
import styles from "./orders.module.css";

/** Status stepper (`order-stepper`): Suggested -> Accepted -> Packed -> In transit -> Delivered, + Cancelled. */
export function Stepper({ order }: { order: Order }) {
  const steps = stepperView(order);
  return (
    <ol className={styles.stepper} data-testid="order-stepper" aria-label="Transfer status">
      {steps.map((s) => (
        <li
          key={s.step}
          className={`${styles.step} ${s.state === "not-reached" ? styles.notReached : styles[s.state]}`}
          aria-current={s.state === "current" ? "step" : undefined}
          aria-label={s.state === "not-reached" ? `${s.label}, not reached` : undefined}
        >
          <span className={styles.dot} aria-hidden="true">
            <span className={styles.dotInner}>{s.state === "done" ? <Glyph name="check" size={10} /> : null}</span>
          </span>
          <span className={styles.stepLabel}>{s.label}</span>
          <span className={styles.stepTime}>{s.at ? <LocalTime iso={s.at} format="stamp" /> : "—"}</span>
        </li>
      ))}
      {order.status === "cancelled" && order.cancelledAt ? (
        <li className={styles.step}>
          <span className={styles.dot} aria-hidden="true">
            <span className={styles.cancelDot}>
              <Glyph name="close" size={10} />
            </span>
          </span>
          <span className={styles.stepLabel}>Cancelled</span>
          <span className={styles.stepTime}>
            <LocalTime iso={order.cancelledAt} format="stamp" />
          </span>
        </li>
      ) : null}
    </ol>
  );
}
