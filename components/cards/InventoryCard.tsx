/**
 * Inventory card — per-hospital stock totals with the worst
 * days-to-stockout badge plus a small usage trend line (D-02).
 * Clicking a hospital row cross-filters every card (D-04).
 * Redesigned (D-23-ext): RowButton lift, tabular-nums, improved density.
 */
import type { CSSProperties } from "react";
import { riskForDaysToStockout } from "@/theme/tokens";
import { Badge, Card, RowButton, Sparkline } from "./ui";

export interface InventoryCardRow {
  hospitalId: string;
  hospitalName: string;
  totalStock: number;
  minDaysToStockout: number;
  leadDays: number;
  bufferDays: number;
  trend: number[];
  selected: boolean;
}

export function InventoryCard({
  rows,
  onSelectHospital,
  scope,
}: {
  rows: InventoryCardRow[];
  onSelectHospital: (id: string | null) => void;
  /** Filtered hospital name, or null when unfiltered (G-04-1: T-4-15). */
  scope?: string | null;
}) {
  const networkTotal = rows.reduce((sum, r) => sum + r.totalStock, 0);
  return (
    <Card
      title="Inventory"
      testId="card-inventory"
      action={
        <span style={actionLabelStyle}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {networkTotal.toLocaleString()}
          </span>
          {" units "}
          {scope ? `at ${scope}` : "network-wide"}
        </span>
      }
    >
      <ul style={listStyle}>
        {rows.map((row) => {
          const level = riskForDaysToStockout(
            row.minDaysToStockout,
            row.leadDays,
            row.bufferDays,
          );
          return (
            <li key={row.hospitalId} style={{ margin: 0 }}>
              <RowButton
                testId={`inventory-row-${row.hospitalId}`}
                onClick={() => onSelectHospital(row.hospitalId)}
                selected={row.selected}
                ariaPressed={row.selected}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={nameStyle} className="text-ellipsis">
                    {row.hospitalName}
                  </span>
                  <span style={subStyle}>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.totalStock.toLocaleString()}
                    </span>
                    {" units · "}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.minDaysToStockout}
                    </span>
                    d to stockout
                  </span>
                </span>
                <Sparkline values={row.trend} width={72} height={22} />
                <Badge level={level}>
                  {level === "ok"
                    ? "healthy"
                    : `${row.minDaysToStockout}d left`}
                </Badge>
              </RowButton>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const actionLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  fontVariantNumeric: "tabular-nums",
};
const nameStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
  lineHeight: 1.3,
};
const subStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-secondary)",
  marginTop: 1,
  fontVariantNumeric: "tabular-nums",
};
