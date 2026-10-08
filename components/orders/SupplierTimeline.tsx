"use client";

import type { EmergencyOrderSuggestion } from "@/lib/contracts";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";

/**
 * Lead-time timeline for an emergency supplier order (06-03): no route, no
 * map line. Axis 0 -> max(lead, stockout) + 2 days; a critical diamond where
 * stock runs out, an ink bar to the supplier delivery day.
 */
export function SupplierTimeline({ order }: { order: EmergencyOrderSuggestion }) {
  const { results, hospName } = useDash();
  const inv = results.inventory.find((e) => e.hospitalId === order.hospitalId && e.medicineId === order.medicineId);
  const out = inv?.daysUntilStockout ?? null;
  const maxDay = Math.max(order.leadDays, out ?? 0) + 2;
  const W = 240;
  const x = (d: number) => 4 + (d / maxDay) * (W - 8);
  const late = out !== null && out < order.leadDays;
  return (
    <div data-testid={`supplier-timeline-${order.hospitalId}-${order.medicineId}`}>
      <svg width={W} height={42} viewBox={`0 0 ${W} 42`} aria-hidden="true" focusable="false" className={rows.bar}>
        <line x1={4} x2={W - 4} y1={12} y2={12} stroke="var(--color-rule-strong)" strokeWidth={1} />
        <rect x={x(0)} y={9} width={x(order.leadDays) - x(0)} height={6} fill="var(--color-ink)" />
        <line x1={x(0)} x2={x(0)} y1={4} y2={20} stroke="var(--color-ink)" strokeWidth={2} />
        {out !== null ? (
          <path
            d={`M${x(out)} 5 L${x(out) + 7} 12 L${x(out)} 19 L${x(out) - 7} 12 Z`}
            fill="var(--risk-critical)"
            stroke="var(--color-ink)"
            strokeWidth={1.5}
          />
        ) : null}
        <text x={x(0)} y={36} fontSize={12} fill="var(--color-ink-2)" fontFamily="var(--font-body)">
          Today
        </text>
        <text x={x(order.leadDays)} y={36} fontSize={12} fill="var(--color-ink)" fontFamily="var(--font-body)" textAnchor="end" fontWeight={600}>
          Supplier day {order.leadDays}
        </text>
      </svg>
      <p className={rows.caption}>
        Supplier lead time {order.leadDays} days.
        {out !== null ? ` Stock at ${hospName(order.hospitalId)} runs out in ${out} days at current demand${late ? ", before the supplier delivers" : ""}.` : ""}
      </p>
    </div>
  );
}
