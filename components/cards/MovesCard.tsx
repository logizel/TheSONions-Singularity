/**
 * Recommended moves card — transfer action rows plus separate
 * emergency supplier order rows (D-07). Hero card treatment.
 * Redesigned (D-23-ext): hero card with accent bar, sectioned layout
 * (transfers separated from emergency orders), ActionButton CTAs,
 * tabular-nums, CSS vars for dark mode.
 *
 * Action affordances are display-only and role-gated (D-26): network_admin
 * sees Approve/Order actions everywhere, hospital_admin only where the
 * row touches the own hospital. Real enforcement belongs to the Phase 3
 * server-side auth layer with final wiring in Phase 5 (see
 * components/roles.tsx, T-4-06).
 */
import type { CSSProperties } from "react";
import { ActionButton, Badge, Card, SectionLabel } from "./ui";
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
  const totalActions = transfers.length + orders.length;
  return (
    <Card
      title="Recommended moves"
      testId="card-moves"
      hero
      accentBar
      action={
        totalActions > 0 ? (
          <Badge level={orders.length > 0 ? "critical" : "warning"}>
            {totalActions} action{totalActions !== 1 ? "s" : ""}
          </Badge>
        ) : (
          <Badge level="ok">no actions</Badge>
        )
      }
    >
      {transfers.length === 0 && orders.length === 0 ? (
        <EmptyState icon="✓">
          No moves for this filter. Network is balanced.
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Transfers */}
          {transfers.length > 0 && (
            <div>
              <SectionLabel>Transfers</SectionLabel>
              <ul style={listStyle}>
                {transfers.map((t, i) => {
                  const showAction =
                    canSeeMoveActions(role, ownHospitalId, t.fromId) ||
                    canSeeMoveActions(role, ownHospitalId, t.toId);
                  return (
                    <li key={`t-${i}`} style={rowStyle}>
                      <div style={rowInnerStyle}>
                        {/* Arrow direction indicator */}
                        <div style={directionDotStyle} aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </div>
                        <span
                          data-testid={`move-row-${t.fromId}-${t.toId}`}
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <span style={rowLabelStyle}>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                              {t.qty.toLocaleString()}
                            </span>
                            {" units "}
                            <strong style={{ color: "var(--text-primary)" }}>{t.medicineName}</strong>
                          </span>
                          <span style={rowSubStyle}>
                            <HospitalLink
                              id={t.fromId}
                              name={t.fromName}
                              onSelect={onSelectHospital}
                            />
                            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>→</span>
                            <HospitalLink
                              id={t.toId}
                              name={t.toName}
                              onSelect={onSelectHospital}
                            />
                            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>·</span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>
                              {t.arrivesInDays}
                            </span>
                            {" "}
                            {t.arrivesInDays === 1 ? "day" : "days"} transit
                          </span>
                        </span>
                        <div style={actionAreaStyle}>
                          {showAction ? (
                            <ActionButton
                              testId={`move-approve-${t.fromId}-${t.toId}`}
                              onClick={() => {}}
                              title="Prototype display-only action — approval wires up in Phase 5"
                              variant="default"
                            >
                              Approve
                            </ActionButton>
                          ) : (
                            <ActionButton variant="ghost">read-only</ActionButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Emergency orders */}
          {orders.length > 0 && (
            <div>
              <SectionLabel>Emergency supplier orders</SectionLabel>
              <ul style={listStyle}>
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
                      style={rowStyle}
                    >
                      <div style={rowInnerStyle}>
                        {/* Urgency indicator */}
                        <div style={{ ...directionDotStyle, "--dot-color": "#ef4444" } as CSSProperties} aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--risk-critical-dot)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                          </svg>
                        </div>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={rowLabelStyle}>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                              {o.qty.toLocaleString()}
                            </span>
                            {" units "}
                            <strong style={{ color: "var(--text-primary)" }}>{o.medicineName}</strong>
                            {" for "}
                            <HospitalLink
                              id={o.hospitalId}
                              name={o.hospitalName}
                              onSelect={onSelectHospital}
                            />
                          </span>
                          <span style={rowSubStyle}>
                            <Badge level="warning">
                              lead time {o.leadDays}d
                            </Badge>
                          </span>
                        </span>
                        <div style={actionAreaStyle}>
                          {showAction ? (
                            <ActionButton
                              testId={`order-approve-${o.hospitalId}`}
                              onClick={() => {}}
                              title="Prototype display-only action — ordering wires up in Phase 5"
                              variant="primary"
                            >
                              Order
                            </ActionButton>
                          ) : (
                            <ActionButton variant="ghost">read-only</ActionButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EmptyState({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        gap: 8,
        textAlign: "center",
      }}
    >
      {icon && (
        <span
          style={{
            fontSize: 24,
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--risk-ok-bg)",
            borderRadius: "50%",
            color: "var(--risk-ok-dot)",
          }}
        >
          {icon}
        </span>
      )}
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        {children}
      </p>
    </div>
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
      style={linkStyle}
    >
      {name}
    </button>
  );
}

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const rowStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--card-border)",
  overflow: "hidden",
};
const rowInnerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 12px",
  background: "var(--card-surface)",
};
const directionDotStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "var(--accent-subtle)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  marginTop: 2,
};
const rowLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--text-secondary)",
  fontVariantNumeric: "tabular-nums",
};
const rowSubStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 0,
  fontSize: 12,
  color: "var(--text-secondary)",
  marginTop: 2,
  fontVariantNumeric: "tabular-nums",
};
const actionAreaStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  paddingTop: 2,
  flexShrink: 0,
};
const linkStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};
