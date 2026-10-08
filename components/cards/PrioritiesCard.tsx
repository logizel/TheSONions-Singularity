/**
 * Priority hospitals card — ranked 1..N list with reason chips from the
 * fixed vocabulary: high load / emergency share / N days to stockout /
 * no substitute (D-06). Clicking a hospital filters all cards (D-04).
 * Redesigned (D-23-ext): hero card treatment, rank medals, cleaner reason
 * chips, tabular-nums on score, outbreak badge prominent.
 */
import type { CSSProperties } from "react";
import { Badge, Card } from "./ui";

export interface PrioritiesCardRow {
  rank: number;
  hospitalId: string;
  hospitalName: string;
  score: number;
  reasons: string[];
  outbreak: boolean;
}

export function PrioritiesCard({
  rows,
  onSelectHospital,
}: {
  rows: PrioritiesCardRow[];
  onSelectHospital: (id: string) => void;
}) {
  return (
    <Card
      title="Priority hospitals"
      testId="card-priorities"
      hero
      accentBar
      action={
        rows.length > 0 ? (
          <Badge level={rows.some((r) => r.outbreak) ? "critical" : "warning"}>
            {rows.length} ranked
          </Badge>
        ) : (
          <Badge level="ok">all balanced</Badge>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState>No priorities for this filter.</EmptyState>
      ) : (
        <ol style={listStyle}>
          {rows.map((row) => (
            <li key={row.hospitalId} style={{ margin: 0 }}>
              <button
                data-testid={`priority-row-${row.hospitalId}`}
                type="button"
                onClick={() => onSelectHospital(row.hospitalId)}
                style={rowBtnStyle}
                className="row-interactive"
              >
                {/* Rank medal */}
                <span style={getMedalStyle(row.rank)}>
                  {row.rank}
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  {/* Hospital name + score */}
                  <span style={nameRowStyle}>
                    <span style={nameStyle} className="text-ellipsis">
                      {row.hospitalName}
                    </span>
                    <span style={scoreStyle}>
                      score{" "}
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {row.score}
                      </span>
                    </span>
                  </span>

                  {/* Reason chips */}
                  <span style={chipsStyle}>
                    {row.outbreak ? (
                      <Badge level="critical">Outbreak</Badge>
                    ) : null}
                    {row.reasons.map((reason) => (
                      <Badge key={reason} level="neutral">
                        {reason}
                      </Badge>
                    ))}
                  </span>
                </span>

                {/* Chevron hint */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function getMedalStyle(rank: number): CSSProperties {
  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  };
  if (rank === 1) return { ...base, background: "#fef3c7", color: "#b45309" };
  if (rank === 2) return { ...base, background: "#f1f5f9", color: "#475569" };
  if (rank === 3) return { ...base, background: "#fef3c7", color: "#92400e" };
  return { ...base, background: "var(--risk-neutral-bg)", color: "var(--text-muted)" };
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
const rowBtnStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 10,
  padding: "10px 10px",
  cursor: "pointer",
  fontVariantNumeric: "tabular-nums",
};
const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  flexWrap: "wrap",
};
const nameStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "60%",
};
const scoreStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
};
const chipsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginTop: 5,
};
