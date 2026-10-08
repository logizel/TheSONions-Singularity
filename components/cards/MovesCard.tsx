/**
 * Recommended moves card — transfer action rows plus separate
 * emergency supplier order rows (D-07).
 *
 * Action affordances are display-only and role-gated (D-26): network_admin
 * sees Approve/Order actions everywhere, hospital_admin only where the
 * row touches the own hospital. Real enforcement belongs to the Phase 3
 * server-side auth layer with final wiring in Phase 5 (see
 * components/roles.tsx, T-4-06).
 */
import { Badge, Card } from "./ui";
import {
  canSeeMoveActions,
  canSeeOrderActions,
  type Role,
} from "../roles";

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
  role = "network_admin",
  ownHospitalId = null,
}: {
  transfers: MovesCardTransfer[];
  orders: MovesCardOrder[];
  onSelectHospital: (id: string) => void;
  role?: Role;
  ownHospitalId?: string | null;
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
            {transfers.map((t, i) => {
              const showAction =
                canSeeMoveActions(role, ownHospitalId, t.fromId) ||
                canSeeMoveActions(role, ownHospitalId, t.toId);
              return (
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
                  </span>{" "}
                  {showAction ? (
                    <button
                      data-testid={`move-approve-${t.fromId}-${t.toId}`}
                      type="button"
                      onClick={() => {}}
                      title="Prototype display-only action — approval wires up in Phase 5"
                      style={actionButtonStyle}
                    >
                      Approve
                    </button>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>(read-only)</span>
                  )}
                </li>
              );
            })}
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
                {orders.map((o, i) => {
                  const showAction = canSeeOrderActions(
                    role,
                    ownHospitalId,
                    o.hospitalId,
                  );
                  return (
                    <li
                      key={`o-${i}`}
                      data-testid={`order-row-${o.hospitalId}`}
                      style={{ marginBottom: 8, fontSize: 13 }}
                    >
                      Order {o.qty.toLocaleString()} units {o.medicineName}{" "}
                      for{" "}
                      <HospitalLink
                        id={o.hospitalId}
                        name={o.hospitalName}
                        onSelect={onSelectHospital}
                      />{" "}
                      <Badge level="warning">lead time {o.leadDays}d</Badge>{" "}
                      {showAction ? (
                        <button
                          data-testid={`order-approve-${o.hospitalId}`}
                          type="button"
                          onClick={() => {}}
                          title="Prototype display-only action — ordering wires up in Phase 5"
                          style={actionButtonStyle}
                        >
                          Order
                        </button>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>(read-only)</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

const actionButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "1px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

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
