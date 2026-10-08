/**
 * Priority hospitals card — ranked 1..N list with reason chips from the
 * fixed vocabulary: high load / emergency share / N days to stockout /
 * no substitute (D-06). Clicking a hospital filters all cards (D-04).
 */
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
    <Card title="Priority hospitals" testId="card-priorities">
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "#64748b" }}>
          No priorities for this filter.
        </p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((row) => (
            <li key={row.hospitalId} style={{ marginBottom: 8 }}>
              <button
                data-testid={`priority-row-${row.hospitalId}`}
                type="button"
                onClick={() => onSelectHospital(row.hospitalId)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  textAlign: "left",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 8,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#0f172a",
                    minWidth: 20,
                  }}
                >
                  {row.rank}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    {row.hospitalName}{" "}
                    <span style={{ fontWeight: 400, color: "#475569" }}>
                      · score {row.score}
                    </span>
                  </span>
                  <span
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
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
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
