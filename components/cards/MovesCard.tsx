/**
 * Recommended moves card — transfer action rows plus separate
 * emergency supplier order rows (D-07).
 */
import { Badge, Card } from "./ui";

export interface MovesCardTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  medicineName: string;
  qty: number;
  arrivesInDays: number;
}

export interface MovesCardOrder {
  hospitalId: string;
  hospitalName: string;
  medicineName: string;
  qty: number;
  leadDays: number;
}

export function MovesCard({
  transfers,
  orders,
  onSelectHospital,
}: {
  transfers: MovesCardTransfer[];
  orders: MovesCardOrder[];
  onSelectHospital: (id: string) => void;
}) {
  return (
    <Card title="Recommended moves" testId="card-moves">
      {transfers.length === 0 && orders.length === 0 ? (
        <p style={{ fontSize: 13, color: "#64748b" }}>
          No moves for this filter.
        </p>
      ) : (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {transfers.map((t, i) => (
              <li key={`t-${i}`} style={{ marginBottom: 8, fontSize: 13 }}>
                <span data-testid={`move-row-${t.fromId}-${t.toId}`}>
                  Send {t.qty.toLocaleString()} units {t.medicineName} from{" "}
                  <HospitalLink
                    id={t.fromId}
                    name={t.fromName}
                    onSelect={onSelectHospital}
                  />{" "}
                  to{" "}
                  <HospitalLink
                    id={t.toId}
                    name={t.toName}
                    onSelect={onSelectHospital}
                  />
                  , arrives in {t.arrivesInDays}{" "}
                  {t.arrivesInDays === 1 ? "day" : "days"}
                </span>
              </li>
            ))}
          </ul>
          {orders.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#475569",
                  margin: "0 0 6px",
                }}
              >
                Emergency supplier orders
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {orders.map((o, i) => (
                  <li
                    key={`o-${i}`}
                    data-testid={`order-row-${o.hospitalId}`}
                    style={{ marginBottom: 8, fontSize: 13 }}
                  >
                    Order {o.qty.toLocaleString()} units {o.medicineName} for{" "}
                    <HospitalLink
                      id={o.hospitalId}
                      name={o.hospitalName}
                      onSelect={onSelectHospital}
                    />{" "}
                    <Badge level="warning">lead time {o.leadDays}d</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function HospitalLink({
  id,
  name,
  onSelect,
}: {
  id: string;
  name: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "#2563eb",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        textDecoration: "underline",
      }}
    >
      {name}
    </button>
  );
}
