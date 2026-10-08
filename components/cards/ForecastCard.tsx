/**
 * Forecast card — demand outlook with advisory horizon and outbreak
 * signaling (D-05, D-08).
 *
 * Days 1-14 are the actionable window (per-row forecast line). Days 15-30
 * render as a greyed band carrying the envelope advisory tag — never
 * presented as actionable (T-4-12). The MAPE badge beside the forecast
 * quotes the envelope MAPE verbatim. Outbreak-flagged hospitals show the
 * red OutbreakBanner chip plus a trend-mode note; non-flagged hospitals
 * show neither.
 */
import { OutbreakBanner } from "../OutbreakBanner";
import { Badge, Card, Sparkline } from "./ui";

export interface ForecastCardRow {
  hospitalId: string;
  hospitalName: string;
  medicineName: string;
  mode: "base" | "trend";
  next7: number[];
  avgDaily: number;
  /** Envelope outbreak flag for this row's hospital (T-4-12). */
  outbreak: boolean;
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
                  {row.outbreak ? (
                    <span style={chipRowStyle}>
                      <OutbreakBanner hospitalName={row.hospitalName} />
                    </span>
                  ) : null}
                  <span style={subStyle}>
                    avg {row.avgDaily}/day · days 1–14 actionable
                  </span>
                  <span style={sparkRowStyle}>
                    <Sparkline values={row.next7} />
                  </span>
                  {/* Greyed advisory band (D-05): days 15-30 are not
                      actionable, whatever the forecast line says. */}
                  <span
                    data-testid={`forecast-advisory-${row.hospitalId}`}
                    title="Days 15 to 30, advisory only"
                    style={advisoryBandStyle}
                  >
                    days 15–30 <Badge level="advisory">{advisoryLabel}</Badge>
                  </span>
                  <span style={subStyle}>
                    <Badge
                      level={row.mode === "trend" ? "critical" : "neutral"}
                    >
                      {row.mode === "trend" ? "trend mode" : "base"}
                    </Badge>
                    {row.outbreak ? (
                      <span style={trendNoteStyle}>
                        {" "}
                        trend mode while outbreak flagged
                      </span>
                    ) : null}
                  </span>
                </span>
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
const subStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#475569",
  marginTop: 2,
};
const chipRowStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
};
const sparkRowStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
};
/** Greyed 15-30 day band: muted surface, never actionable (T-4-12). */
const advisoryBandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 4,
  background: "#e2e8f0",
  color: "#64748b",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 600,
};
const trendNoteStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#b91c1c",
  fontWeight: 600,
};
