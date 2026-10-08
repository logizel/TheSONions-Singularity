/**
 * Inventory card — per-hospital stock totals with the worst
 * days-to-stockout badge plus a small usage trend line (D-02).
 * Clicking a hospital row cross-filters every card (D-04).
 */
import { riskForDaysToStockout } from "@/theme/tokens";
import { Badge, Card, Sparkline } from "./ui";

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
}: {
  rows: InventoryCardRow[];
  onSelectHospital: (id: string | null) => void;
}) {
  const networkTotal = rows.reduce((sum, r) => sum + r.totalStock, 0);
  return (
    <Card
      title="Inventory"
      testId="card-inventory"
      action={
        <span style={{ fontSize: 12, color: "#475569" }}>
          {networkTotal.toLocaleString()} units network-wide
        </span>
      }
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((row) => {
          const level = riskForDaysToStockout(
            row.minDaysToStockout,
            row.leadDays,
            row.bufferDays,
          );
          return (
            <li key={row.hospitalId} style={{ marginBottom: 8 }}>
              <button
                data-testid={`inventory-row-${row.hospitalId}`}
                type="button"
                onClick={() => onSelectHospital(row.hospitalId)}
                aria-pressed={row.selected}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  background: row.selected ? "#eff6ff" : "transparent",
                  border: row.selected
                    ? "1px solid #2563eb"
                    : "1px solid transparent",
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
                    {row.hospitalName}
                  </span>
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    {row.totalStock.toLocaleString()} units ·{" "}
                    {row.minDaysToStockout}d to stockout
                  </span>
                </span>
                <Sparkline values={row.trend} />
                <Badge level={level}>
                  {level === "ok"
                    ? "ok"
                    : `${row.minDaysToStockout}d left`}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
