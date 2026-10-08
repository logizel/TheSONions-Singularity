/**
 * Forecast card — demand outlook with advisory horizon and outbreak
 * signaling (D-05, D-08).
 * Redesigned (D-23-ext): RowButton lift, cleaner advisory band,
 * tabular-nums, dark mode via CSS vars.
 *
 * Days 1-14 are the actionable window (per-row forecast line). Days 15-30
 * render as a greyed band carrying the envelope advisory tag — never
 * presented as actionable (T-4-12). The MAPE badge beside the forecast
 * quotes the envelope MAPE verbatim. Outbreak-flagged hospitals show the
 * red OutbreakBanner chip plus a trend-mode note; non-flagged hospitals
 * show neither.
 */
import type { CSSProperties } from "react";
import { OutbreakBanner } from "../OutbreakBanner";
import { Badge, Card, RowButton, Sparkline } from "./ui";

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
      action={
        <Badge level="neutral">
          MAPE {mape}%
        </Badge>
      }
    >
      {rows.length === 0 ? (
        <EmptyState>No forecast rows for this filter.</EmptyState>
      ) : (
        <ul style={listStyle}>
          {rows.map((row) => (
            <li
              key={`${row.hospitalId}-${row.medicineName}`}
              style={{ margin: 0 }}
            >
              <RowButton
                testId={`forecast-row-${row.hospitalId}`}
                onClick={() => onSelectHospital(row.hospitalId)}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={nameStyle} className="text-ellipsis">
                    {row.medicineName} · {row.hospitalName}
                  </span>
                  {row.outbreak ? (
                    <span style={{ display: "block", marginTop: 3 }}>
                      <OutbreakBanner hospitalName={row.hospitalName} />
                    </span>
                  ) : null}
                  <span style={subStyle}>
                    avg{" "}
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.avgDaily}
                    </span>
                    /day · days 1–14 actionable
                  </span>
                  <span style={{ display: "block", marginTop: 4 }}>
                    <Sparkline values={row.next7} width={72} height={20} />
                  </span>
                  {/* Greyed advisory band (D-05): days 15-30 not actionable */}
                  <span
                    data-testid={`forecast-advisory-${row.hospitalId}`}
                    title="Days 15 to 30, advisory only"
                    style={advisoryBandStyle}
                  >
                    15–30d
                    <Badge level="advisory">{advisoryLabel}</Badge>
                  </span>
                  <span style={{ display: "flex", gap: 4, marginTop: 3 }}>
                    <Badge
                      level={row.mode === "trend" ? "critical" : "neutral"}
                    >
                      {row.mode === "trend" ? "trend mode" : "base"}
                    </Badge>
                    {row.outbreak && row.mode === "trend" ? (
                      <span style={trendNoteStyle}>
                        trend while outbreak flagged
                      </span>
                    ) : null}
                  </span>
                </span>
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

const listStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 };
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
  marginTop: 2,
  fontVariantNumeric: "tabular-nums",
};
const advisoryBandStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 4,
  background: "var(--risk-advisory-bg)",
  color: "var(--text-muted)",
  borderRadius: 8,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 600,
};
const trendNoteStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--risk-critical-text)",
  fontWeight: 600,
  alignSelf: "center",
};
