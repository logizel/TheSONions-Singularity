/**
 * Expiry risk card — stock at risk of expiring unused, with
 * red/amber badges (D-02). Clicking a hospital filters all cards (D-04).
 * Redesigned (D-23-ext): RowButton lift, CSS vars, tabular-nums.
 */
import type { CSSProperties } from "react";
import { Badge, Card, RowButton } from "./ui";
import type { Severity } from "@/app/data/results";

export interface ExpiryCardRow {
  hospitalId: string;
  hospitalName: string;
  medicineName: string;
  qty: number;
  expiryDate: string;
  severity: Severity;
}

export function ExpiryCard({
  rows,
  onSelectHospital,
}: {
  rows: ExpiryCardRow[];
  onSelectHospital: (id: string) => void;
}) {
  const criticalCount = rows.filter((r) => r.severity === "critical").length;
  return (
    <Card
      title="Expiry risk"
      testId="card-expiry"
      action={
        criticalCount > 0 ? (
          <Badge level="critical">{criticalCount} expiring</Badge>
        ) : rows.length > 0 ? (
          <Badge level="warning">{rows.length} at risk</Badge>
        ) : (
          <Badge level="ok">no waste risk</Badge>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState>No expiry risks for this filter.</EmptyState>
      ) : (
        <ul style={listStyle}>
          {rows.map((row) => (
            <li
              key={`${row.hospitalId}-${row.medicineName}`}
              style={{ margin: 0 }}
            >
              <RowButton
                testId={`expiry-row-${row.hospitalId}`}
                onClick={() => onSelectHospital(row.hospitalId)}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={nameStyle} className="text-ellipsis">
                    {row.medicineName} · {row.hospitalName}
                  </span>
                  <span style={subStyle}>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.qty.toLocaleString()}
                    </span>
                    {" units expire "}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.expiryDate}
                    </span>
                  </span>
                </span>
                <Badge level={row.severity}>
                  {row.severity === "critical" ? "critical" : "low"}
                </Badge>
              </RowButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, padding: "8px 0" }}>
      {children}
    </p>
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
const nameStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const subStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-secondary)",
  marginTop: 1,
  fontVariantNumeric: "tabular-nums",
};
