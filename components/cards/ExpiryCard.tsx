/**
 * Expiry risk card — stock at risk of expiring unused, with
 * red/amber badges (D-02). Clicking a hospital filters all cards (D-04).
 */
import { Badge, Card } from "./ui";
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
  return (
    <Card title="Expiry risk" testId="card-expiry">
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "#64748b" }}>
          No expiry risks for this filter.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <li
              key={`${row.hospitalId}-${row.medicineName}`}
              style={{ marginBottom: 8 }}
            >
              <button
                data-testid={`expiry-row-${row.hospitalId}`}
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
                    {row.qty.toLocaleString()} units expire {row.expiryDate}
                  </span>
                </span>
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
