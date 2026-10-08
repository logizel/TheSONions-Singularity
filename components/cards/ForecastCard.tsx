/**
 * Forecast card — base demand numbers with MAPE badge and advisory tag.
 * Days 15-30 grey treatment arrives in Plan 03; this card consumes the
 * fixture MAPE/advisory fields only (D-05).
 */
import { Badge, Card, Sparkline } from "./ui";

export interface ForecastCardRow {
  hospitalId: string;
  hospitalName: string;
  medicineName: string;
  mode: "base" | "trend";
  next7: number[];
  avgDaily: number;
}

export function ForecastCard({
  rows,
  mape,
  advisoryLabel,
  onSelectHospital,
}: {
  rows: ForecastCardRow[];
  mape: number;
  advisoryLabel: string;
  onSelectHospital: (id: string) => void;
}) {
  return (
    <Card
      title="Forecast"
      testId="card-forecast"
      action={<Badge level="neutral">MAPE {mape}%</Badge>}
    >
      {rows.length === 0 ? (
        <p style={mutedStyle}>No forecast rows for this filter.</p>
      ) : (
        <ul style={listStyle}>
          {rows.map((row) => (
            <li
              key={`${row.hospitalId}-${row.medicineName}`}
              style={{ marginBottom: 8 }}
            >
              <button
                data-testid={`forecast-row-${row.hospitalId}`}
                type="button"
                onClick={() => onSelectHospital(row.hospitalId)}
                style={rowButtonStyle}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={nameStyle}>
                    {row.medicineName} · {row.hospitalName}
                  </span>
                  <span style={subStyle}>
                    avg {row.avgDaily}/day · days 15–30{" "}
                    <Badge level="advisory">{advisoryLabel}</Badge>
                  </span>
                </span>
                <Sparkline values={row.next7} />
                <Badge level={row.mode === "trend" ? "critical" : "neutral"}>
                  {row.mode === "trend" ? "trend mode" : "base"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const listStyle: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0 };
const mutedStyle: React.CSSProperties = { fontSize: 13, color: "#64748b" };
const rowButtonStyle: React.CSSProperties = {
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
};
const nameStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#0f172a",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const subStyle: React.CSSProperties = { fontSize: 12, color: "#475569" };
