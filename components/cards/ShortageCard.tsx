/**
 * Shortage risk card — red/amber badges plus small trend lines,
 * no heavy charts (D-02). Clicking a hospital filters all cards (D-04).
 */
import { Badge, Card, Sparkline } from "./ui";
import type { Severity } from "@/app/data/results";

export interface ShortageCardRow {
  hospitalId: string;
  hospitalName: string;
  medicineName: string;
  daysToStockout: number;
  severity: Severity;
  trend: number[];
}

export function ShortageCard({
  rows,
  onSelectHospital,
}: {
  rows: ShortageCardRow[];
  onSelectHospital: (id: string) => void;
}) {
  return (
    <Card title="Shortage risk" testId="card-shortage">
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "#64748b" }}>
          No shortages for this filter.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <li
              key={`${row.hospitalId}-${row.medicineName}`}
              style={{ marginBottom: 8 }}
            >
              <button
                data-testid={`shortage-row-${row.hospitalId}`}
                type="button"
                onClick={() => onSelectHospital(row.hospitalId)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 8,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.medicineName} · {row.hospitalName}
                  </span>
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    {row.daysToStockout} days to stockout
                  </span>
                </span>
                <Sparkline values={row.trend} />
                <Badge level={row.severity}>
                  {row.severity === "critical" ? "critical" : "low"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
