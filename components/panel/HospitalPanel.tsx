/**
 * HospitalPanel — drill-in side panel redesigned as a right slide-over
 * drawer (D-09, D-10, D-12, D-13, D-15, D-16, D-23-ext).
 *
 * Desktop: 440px slide-over drawer from the right with a scrim backdrop
 * and slide transition. Has its own scroll region. Doesn't collide with chat.
 * Smaller widths: full-width overlay sheet.
 *
 * The hospital switcher below calls the SAME onSelectHospital shared
 * cross-filter state the cards use, so switching refilters the main cards
 * and updates the URL identically to card clicks (D-12, D-16).
 *
 * Read-only by construction (D-13): no editable form fields.
 * Header is stock-only (D-15): no patient load / emergency share here.
 * NOTE (T-4-09): no raw-HTML injection; every string via React escaping.
 */
"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";
import fixtureJson from "@/app/data/mock-results.json";
import {
  isKnownHospitalId,
  type ResultsFixture,
} from "@/app/data/results";
import { Badge } from "@/components/cards/ui";
import {
  buildMoveDetail,
  MedicineRow,
  MoveRow,
  type MedicineRowDetail,
} from "./MedicineRow";
import { riskForDaysToStockout } from "@/theme/tokens";

const fixture = fixtureJson as ResultsFixture;

export interface HospitalPanelProps {
  /** Null = panel closed. Mirrors the ?hospital=id selection. */
  hospitalId: string | null;
  hospitalName?: string;
  onClose: () => void;
  onSelectHospital: (id: string | null) => void;
  /** Optional role gating (Task 3). Defaults to full network_admin view. */
  role?: "hospital_admin" | "network_admin";
  /** Prototype own-hospital for hospital_admin scoping. Defaults to none. */
  ownHospitalId?: string | null;
}

export function HospitalPanel({
  hospitalId,
  hospitalName,
  onClose,
  onSelectHospital,
  role = "network_admin",
  ownHospitalId = null,
}: HospitalPanelProps) {
  const isOpen = !!hospitalId;

  // Trap scroll on body while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Unknown id → guided empty state
  if (!isKnownHospitalId(fixture, hospitalId)) {
    return (
      <>
        <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
        <aside
          data-testid="hospital-panel"
          style={drawerStyle}
          aria-label="Hospital detail panel"
        >
          <DrawerHeader title="Unknown hospital" onClose={onClose} />
          <div style={scrollBodyStyle}>
            <p style={mutedStyle}>
              No hospital with id {hospitalId} in this network snapshot. Pick
              one of the hospitals below.
            </p>
            <HospitalSwitcher
              hospitals={fixture.hospitals}
              activeId={null}
              onSelectHospital={onSelectHospital}
            />
          </div>
        </aside>
      </>
    );
  }

  const hospital = fixture.hospitals.find((h) => h.id === hospitalId)!;
  const displayName = hospitalName ?? hospital.name;
  const medicines = fixture.medicines;
  const inventoryForHospital = fixture.inventory.filter(
    (r) => r.hospitalId === hospitalId,
  );
  const totalStock = inventoryForHospital.reduce(
    (sum, r) => sum + r.stock,
    0,
  );
  const leadByMedicine = new Map(
    fixture.leadDays
      .filter((l) => l.hospitalId === hospitalId)
      .map((l) => [l.medicineId, l.days]),
  );
  const criticalCount = inventoryForHospital.filter((r) =>
    riskForDaysToStockout(
      r.daysToStockout,
      leadByMedicine.get(r.medicineId) ?? 0,
      medicines.find((m) => m.id === r.medicineId)?.bufferDays ?? 0,
    ) === "critical",
  ).length;
  const warningCount = inventoryForHospital.filter((r) =>
    riskForDaysToStockout(
      r.daysToStockout,
      leadByMedicine.get(r.medicineId) ?? 0,
      medicines.find((m) => m.id === r.medicineId)?.bufferDays ?? 0,
    ) === "warning",
  ).length;

  const priority = fixture.priorities.find((p) => p.hospitalId === hospitalId);
  const movesForHospital = fixture.moves.filter(
    (m) => m.fromId === hospitalId || m.toId === hospitalId,
  );
  const ordersForHospital = fixture.emergencyOrders.filter(
    (o) => o.hospitalId === hospitalId,
  );
  const medicineNameById = Object.fromEntries(
    medicines.map((m) => [m.id, m.name]),
  );

  const isOwn = ownHospitalId !== null && ownHospitalId === hospitalId;
  const showMoveActions = role === "network_admin" || isOwn;

  return (
    <>
      {/* Scrim */}
      <div
        className="drawer-scrim"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        data-testid="hospital-panel"
        style={drawerStyle}
        aria-label={`${displayName} detail panel`}
      >
        {/* Accent bar */}
        <div style={accentBarStyle} aria-hidden="true" />

        <DrawerHeader title={displayName} onClose={onClose} subtitle="Hospital detail" />

        {/* Scrollable body */}
        <div style={scrollBodyStyle}>

          {/* Stock summary chips */}
          <div
            data-testid="hospital-panel-header-stock"
            style={chipsRowStyle}
          >
            <Badge level="neutral">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {totalStock.toLocaleString()}
              </span>
              {" units · "}
              {inventoryForHospital.length} medicines
            </Badge>
            {criticalCount > 0 ? (
              <Badge level="critical">{criticalCount} critical</Badge>
            ) : null}
            {warningCount > 0 ? (
              <Badge level="warning">{warningCount} low</Badge>
            ) : null}
            {criticalCount === 0 && warningCount === 0 ? (
              <Badge level="ok">stocks healthy</Badge>
            ) : null}
          </div>

          {/* Hospital switcher */}
          <HospitalSwitcher
            hospitals={fixture.hospitals}
            activeId={hospitalId}
            onSelectHospital={onSelectHospital}
          />

          {/* Priority section */}
          {priority ? (
            <section data-testid="hospital-panel-priority" style={sectionStyle}>
              <h3 style={sectionTitleStyle}>
                Priority #{priority.rank} · score{" "}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {priority.score}
                </span>
              </h3>
              <div style={chipsRowStyle}>
                {priority.reasons.map((reason) => (
                  <Badge key={reason} level="neutral">
                    {reason}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {/* Medicines section */}
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Medicines</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {medicines.map((medicine) => {
                const inv = inventoryForHospital.find(
                  (r) => r.medicineId === medicine.id,
                );
                if (!inv) return null;
                const forecast = fixture.forecast.find(
                  (f) =>
                    f.hospitalId === hospitalId &&
                    f.medicineId === medicine.id,
                );
                const expiries = fixture.expiries.filter(
                  (e) =>
                    e.hospitalId === hospitalId &&
                    e.medicineId === medicine.id,
                );
                const wasteQty = expiries.reduce(
                  (sum, e) => sum + e.qty,
                  0,
                );
                const wasteExpiryDate =
                  expiries.length > 0
                    ? expiries.map((e) => e.expiryDate).sort()[0]
                    : null;
                const movesForMedicine = fixture.moves
                  .filter(
                    (m) =>
                      m.medicineId === medicine.id &&
                      (m.fromId === hospitalId || m.toId === hospitalId),
                  )
                  .map((m) =>
                    buildMoveDetail(fixture, m, hospitalId),
                  );
                const detail: MedicineRowDetail = {
                  medicineId: medicine.id,
                  medicineName: medicine.name,
                  stock: inv.stock,
                  daysToStockout: inv.daysToStockout,
                  trend: inv.trend,
                  forecastNext7: forecast?.next7 ?? inv.trend,
                  forecastAvgDaily: forecast?.avgDaily ?? 0,
                  forecastMode: forecast?.mode ?? null,
                  wasteQty,
                  wasteExpiryDate,
                  leadDays: leadByMedicine.get(medicine.id) ?? 0,
                  bufferDays: medicine.bufferDays,
                  moves: movesForMedicine,
                  showMoveActions,
                };
                return <MedicineRow key={medicine.id} detail={detail} />;
              })}
            </ul>
          </section>

          {/* Moves in / out section */}
          <section
            data-testid="hospital-panel-moves"
            style={{ ...sectionStyle, paddingBottom: 32 }}
          >
            <h3 style={sectionTitleStyle}>Moves in / out</h3>
            {movesForHospital.length === 0 && ordersForHospital.length === 0 ? (
              <p style={mutedStyle}>
                No moves for {displayName} in this snapshot.
              </p>
            ) : (
              <>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {movesForHospital.map((m, i) => (
                    <MoveRow
                      key={`pm-${i}`}
                      detail={buildMoveDetail(fixture, m, hospitalId)}
                      showAction={showMoveActions}
                      testId={`panel-move-${m.fromId}-${m.toId}`}
                    />
                  ))}
                </ul>
                {ordersForHospital.length > 0 ? (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "8px 0 0",
                      padding: 0,
                    }}
                  >
                    {ordersForHospital.map((o, i) => (
                      <li
                        key={`po-${i}`}
                        data-testid={`panel-order-${o.hospitalId}`}
                        style={{
                          marginBottom: 8,
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        Order{" "}
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {o.qty.toLocaleString()}
                        </span>{" "}
                        units {medicineNameById[o.medicineId] ?? o.medicineId}{" "}
                        <Badge level="warning">
                          lead time {o.leadDays}d
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

// ─── Drawer sub-components ─────────────────────────────────────────────────

function DrawerHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div style={drawerHeaderStyle}>
      <div style={{ minWidth: 0 }}>
        {subtitle && (
          <span style={subtitleStyle}>{subtitle}</span>
        )}
        <h2 style={drawerTitleStyle}>{title}</h2>
      </div>
      <button
        data-testid="hospital-panel-close"
        type="button"
        onClick={onClose}
        aria-label="Close hospital panel"
        style={closeButtonStyle}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function HospitalSwitcher({
  hospitals,
  activeId,
  onSelectHospital,
}: {
  hospitals: ResultsFixture["hospitals"];
  activeId: string | null;
  onSelectHospital: (id: string | null) => void;
}) {
  return (
    <nav
      data-testid="hospital-panel-switcher"
      aria-label="Switch hospital"
      style={switcherStyle}
    >
      {hospitals.map((h) => {
        const active = h.id === activeId;
        return (
          <button
            key={h.id}
            data-testid={`hospital-switcher-${h.id}`}
            type="button"
            onClick={() => {
              if (!isKnownHospitalId(fixture, h.id)) return;
              onSelectHospital(h.id);
            }}
            aria-pressed={active}
            style={{
              ...switcherBtnBase,
              background: active ? "var(--accent)" : "var(--card-surface)",
              color: active ? "#ffffff" : "var(--text-primary)",
              border: active
                ? "1px solid var(--accent)"
                : "1px solid var(--card-border)",
              boxShadow: active
                ? "0 1px 3px rgba(79, 110, 247, 0.25)"
                : "var(--card-shadow)",
            }}
          >
            {h.name}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const drawerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(440px, 100vw)",
  background: "var(--card-surface)",
  borderLeft: "1px solid var(--card-border)",
  boxShadow: "-4px 0 32px rgba(2, 6, 23, 0.12)",
  zIndex: 40,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  // Slide-in from the right
  animation: "slideIn 220ms cubic-bezier(0.16, 1, 0.3, 1)",
};

const accentBarStyle: CSSProperties = {
  height: 3,
  background: "linear-gradient(90deg, var(--hero-accent-bar), rgba(79, 110, 247, 0.3))",
  flexShrink: 0,
};

const drawerHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 20px 12px",
  borderBottom: "1px solid var(--card-border)",
  flexShrink: 0,
};

const subtitleStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 2,
};

const drawerTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: "-0.015em",
  color: "var(--text-primary)",
};

const closeButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  background: "transparent",
  border: "1px solid var(--card-border)",
  borderRadius: 8,
  cursor: "pointer",
  color: "var(--text-secondary)",
  flexShrink: 0,
  transition: "background 150ms",
};

const scrollBodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const chipsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  paddingBottom: 6,
  borderBottom: "1px solid var(--card-border)",
};

const switcherStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const switcherBtnBase: CSSProperties = {
  borderRadius: 8,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 150ms, border-color 150ms, box-shadow 150ms",
  letterSpacing: "0.01em",
};

const mutedStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  margin: 0,
};
