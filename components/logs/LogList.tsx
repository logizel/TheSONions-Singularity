"use client";

import { ACTION_LABEL, actorLabel, type LogEntry } from "@/lib/logs";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { LocalTime } from "../ui/LocalTime";
import { Tag, type TagTone } from "../ui/Tag";
import styles from "./logs.module.css";

const TONE: Record<LogEntry["action"], TagTone> = {
  sign_in: "muted",
  sign_out: "muted",
  role_switch: "muted",
  order_accept: "outline",
  order_packed: "outline",
  order_in_transit: "accent",
  order_delivered: "ink",
  order_cancelled: "dashed",
  action_rejected: "dashed",
  demo_reset: "ink",
  event_added: "accent",
  event_ended: "dashed",
};

export function LogList({ logs, testId }: { logs: LogEntry[]; testId?: string }) {
  const { hospName, track, orders } = useDash();
  return (
    <ul className={rows.rows} data-testid={testId}>
      {logs.map((e) => (
        <li key={e.id} className={styles.entry} data-testid="log-entry">
          <span className={styles.time}>
            <LocalTime iso={e.at} format="stamp" />
          </span>
          <span className={styles.body}>
            <span className={styles.top}>
              <Tag tone={TONE[e.action]}>{ACTION_LABEL[e.action]}</Tag>
              {e.orderId && orders?.some((o) => o.id === e.orderId) ? (
                <button type="button" className={rows.linkButton} onClick={() => track(e.orderId!)}>
                  Track
                </button>
              ) : null}
            </span>
            <span className={styles.summary}>{e.summary}</span>
            <span className={styles.actor}>{actorLabel(e.actorRole, e.actorHospital ? hospName(e.actorHospital) : null)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
