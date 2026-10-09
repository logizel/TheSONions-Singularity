"use client";

import { useId, useState } from "react";

import type { TransferSuggestion } from "@/lib/contracts";
import { fmtUnits } from "@/lib/dashboard/view";
import { STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { Glyph } from "../icons/Glyph";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { Tag } from "../ui/Tag";

export function OrderStatusTag({ status }: { status: OrderStatus | "suggested" }) {
  const tone = status === "in_transit" ? "accent" : status === "delivered" ? "ink" : status === "cancelled" ? "muted" : "outline";
  return <Tag tone={tone}>{STATUS_LABEL[status]}</Tag>;
}

/** "{k} checks passed" disclosure listing checksPassed verbatim. */
export function ChecksDisclosure({ checks }: { checks: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button type="button" className={rows.disclosure} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Glyph name={open ? "chevron-up" : "chevron-down"} size={12} />
        {checks.length} {checks.length === 1 ? "check" : "checks"} passed
      </button>
      {open ? (
        <ul id={id} className={rows.checks}>
          {checks.map((c) => (
            <li key={c}>
              <span className={rows.checkGlyph}>
                <Glyph name="check" size={14} />
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** Transfer row (panel Moves + drill-in): engine numbers verbatim, order status when one exists. */
export function TransferRow({ t, direction }: { t: TransferSuggestion; direction?: "IN" | "OUT" }) {
  const { medName, hospName, unit, selectHospital, orderFor, track } = useDash();
  const match = orderFor(t);
  return (
    <li className={rows.row} data-testid={`transfer-row-${t.fromHospital}-${t.toHospital}-${t.medicineId}`}>
      <span className={rows.tagCell}>
        {direction ? <Tag tone={direction === "IN" ? "ink" : "outline"}>{direction}</Tag> : <OrderStatusTag status={match?.order.status ?? "suggested"} />}
      </span>
      <span className={rows.main}>
        <span className={rows.line1}>
          <span className={rows.strong}>{medName(t.medicineId)}</span> {fmtUnits(t.qty)} {unit(t.medicineId, t.qty)}
        </span>
        <span className={rows.line2}>
          <button type="button" className={rows.hospitalLink} onClick={() => selectHospital(t.fromHospital)}>
            {hospName(t.fromHospital)}
          </button>{" "}
          →{" "}
          <button type="button" className={rows.hospitalLink} onClick={() => selectHospital(t.toHospital)}>
            {hospName(t.toHospital)}
          </button>
        </span>
        <span className={rows.line2}>Engine delivery window: {days(t.transportDays)}</span>
        <ChecksDisclosure checks={t.checksPassed} />
      </span>
      <span className={rows.right}>
        {direction && match ? <OrderStatusTag status={match.order.status} /> : null}
        {match ? (
          <>
            {" "}
            <button type="button" className={rows.outlineButton} onClick={() => track(match.order.id)} data-testid={`track-${match.order.id}`}>
              Track
            </button>
          </>
        ) : null}
      </span>
    </li>
  );
}
