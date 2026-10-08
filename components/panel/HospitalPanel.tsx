/**
 * HospitalPanel — drill-in side panel (D-09, D-10, D-12, D-13, D-15, D-16).
 *
 * Mounts beside the dashboard without a route change: page.tsx renders this
 * <aside> in the same one-screen layout and only the ?hospital=id query
 * param changes (D-09, D-16). The hospital switcher below calls the SAME
 * onSelectHospital shared cross-filter state the cards use, so switching
 * refilters the main cards and updates the URL identically to card clicks
 * (D-12, D-16).
 *
 * Read-only by construction (D-13): this file renders buttons and text
 * only — no editable form fields and no content-editable elements, since
 * edits belong to the Phase 1 data-entry screens. All numbers come from the same static fixture slices
 * the dashboard cards read, so panel figures always match the cards.
 *
 * Header is stock-only (D-15): total units, medicine count, risk counts.
 * Patient load / emergency share statistics never render here.
 *
 * NOTE (T-4-09): no dangerouslySetInnerHTML anywhere; every string renders
 * through React default escaping.
 */
import fixtureJson from "@/app/data/mock-results.json";
import {
  isKnownHospitalId,
  type ResultsFixture,
} from "@/app/data/results";
import { Badge, Sparkline } from "@/components/cards/ui";
import { colors, riskForDaysToStockout, spacing } from "@/theme/tokens";

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
  if (!hospitalId) return null;

  // T-4-07: never trust a raw id — unknown ids render the guided empty copy
  // (D-25) instead of panel detail. page.tsx also drops the param.
  if (!isKnownHospitalId(fixture, hospitalId)) {
    return (
      <aside
        data-testid="hospital-panel"
        style={panelStyle}
      >
        <div style={panelHeaderRowStyle}>
          <h2 style={panelTitleStyle}>Unknown hospital</h2>
          <button
            data-testid="hospital-panel-close"
            type="button"
            onClick={onClose}
            style={closeButtonStyle}
          >
            Close
          </button>
        </div>
        <p style={{ fontSize: 13, color: colors.textSecondary }}>
          No hospital with id {hospitalId} in this network snapshot. Pick one
          of the hospitals below.
        </p>
        <HospitalSwitcher
          hospitals={fixture.hospitals}
          activeId={null}
          onSelectHospital={onSelectHospital}
        />
      </aside>
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
  const hospitalNameById = Object.fromEntries(
    fixture.hospitals.map((h) => [h.id, h.name]),
  );

  // T-4-08: hospital_admin sees other hospitals read-only; move/order
  // ACTION affordances hide off-hospital. Row data itself stays visible
  // (aggregates only — no PHI fields exist to leak).
  const isOwn = ownHospitalId === null || ownHospitalId === hospitalId;
  const showMoveActions = role === "network_admin" || isOwn;

  return (
    <aside data-testid="hospital-panel" style={panelStyle}>
      <div style={panelHeaderRowStyle}>
        <h2 style={panelTitleStyle}>{displayName} — detail</h2>
        <button
          data-testid="hospital-panel-close"
          type="button"
          onClick={onClose}
          style={closeButtonStyle}
        >
          Close
        </button>
      </div>

      {/* Stock-only header (D-15): no patient load / emergency share here. */}
      <div
        data-testid="hospital-panel-header-stock"
        style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}
      >
        <Badge level="neutral">
          {totalStock.toLocaleString()} units · {inventoryForHospital.length}{" "}
          medicines
        </Badge>
        {criticalCount > 0 ? (
          <Badge level="critical">
            {criticalCount} critical
          </Badge>
        ) : null}
        {warningCount > 0 ? (
          <Badge level="warning">{warningCount} low</Badge>
        ) : null}
        {criticalCount === 0 && warningCount === 0 ? (
          <Badge level="ok">stocks healthy</Badge>
        ) : null}
      </div>

      <HospitalSwitcher
        hospitals={fixture.hospitals}
        activeId={hospitalId}
        onSelectHospital={onSelectHospital}
      />

      {priority ? (
        <section data-testid="hospital-panel-priority">
          <h3 style={sectionTitleStyle}>
            Priority #{priority.rank} · score {priority.score}
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {priority.reasons.map((reason) => (
              <Badge key={reason} level="neutral">
                {reason}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 style={sectionTitleStyle}>Medicines</h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {medicines.map((medicine) => {
            const inv = inventoryForHospital.find(
              (r) => r.medicineId === medicine.id,
            );
            if (!inv) return null;
            const stock = inv.stock;
            const forecast = fixture.forecast.find(
              (f) =>
                f.hospitalId === hospitalId && f.medicineId === medicine.id,
            );
            const shortage = fixture.shortages.find(
              (s) =>
                s.hospitalId === hospitalId && s.medicineId === medicine.id,
            );
            const expiries = fixture.expiries.filter(
              (e) =>
                e.hospitalId === hospitalId && e.medicineId === medicine.id,
            );
            const leadDays = leadByMedicine.get(medicine.id) ?? 0;
            const level = riskForDaysToStockout(
              inv.daysToStockout,
              leadDays,
              medicine.bufferDays,
            );
            return (
              <li
                key={medicine.id}
                data-testid={`panel-medicine-${medicine.id}`}
                style={medicineRowStyle}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 650 }}>
                    {medicine.name}
                  </span>
                  <Badge level={level}>
                    {inv.daysToStockout}d to stockout
                  </Badge>
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  {stock.toLocaleString()} units on hand
                  {expiries.map((e) => (
                    <span key={`${e.medicineId}-${e.expiryDate}`}>
                      {" "}
                      · {e.qty.toLocaleString()} expiring {e.expiryDate}
                    </span>
                  ))}
                </div>
                {forecast ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing.sm,
                      marginTop: 4,
                    }}
                  >
                    <Sparkline values={forecast.next7} />
                    <span
                      style={{ fontSize: 12, color: colors.textSecondary }}
                    >
                      ~{forecast.avgDaily}/day next 7d
                      {forecast.mode === "trend" ? " (trend mode)" : ""}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{ fontSize: 12, color: colors.textMuted }}
                  >
                    No forecast row for this medicine in the fixture.
                  </div>
                )}
                {shortage ? (
                  <div style={{ marginTop: 4 }}>
                    <Badge level={shortage.severity}>
                      {shortage.severity === "critical" ? "shortage" : "low"}{" "}
                      warning
                    </Badge>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section data-testid="hospital-panel-moves">
        <h3 style={sectionTitleStyle}>Moves in / out</h3>
        {movesForHospital.length === 0 && ordersForHospital.length === 0 ? (
          <p style={{ fontSize: 13, color: colors.textSecondary }}>
            No moves for {displayName} in this snapshot.
          </p>
        ) : (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {movesForHospital.map((m, i) => (
                <li
                  key={`pm-${i}`}
                  data-testid={`panel-move-${m.fromId}-${m.toId}`}
                  style={{ marginBottom: 8, fontSize: 13 }}
                >
                  Send {m.qty.toLocaleString()} units{" "}
                  {medicineNameById[m.medicineId] ?? m.medicineId} from{" "}
                  {hospitalNameById[m.fromId] ?? m.fromId} to{" "}
                  {hospitalNameById[m.toId] ?? m.toId}, arrives in{" "}
                  {m.arrivesInDays}{" "}
                  {m.arrivesInDays === 1 ? "day" : "days"}
                  {showMoveActions ? null : (
                    <span style={{ color: colors.textMuted }}>
                      {" "}
                      (read-only)
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {ordersForHospital.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {ordersForHospital.map((o, i) => (
                  <li
                    key={`po-${i}`}
                    data-testid={`panel-order-${o.hospitalId}`}
                    style={{ marginBottom: 8, fontSize: 13 }}
                  >
                    Order {o.qty.toLocaleString()} units{" "}
                    {medicineNameById[o.medicineId] ?? o.medicineId}{" "}
                    <Badge level="warning">lead time {o.leadDays}d</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>
    </aside>
  );
}

/**
 * Hospital switcher (D-12): one button per fixture hospital (T-4-07 — ids
 * come from the fixture list only, never free text). Clicking drives the
 * shared cross-filter state via onSelectHospital, so the main cards refilter
 * and ?hospital=id updates exactly like a card click (D-16).
 */
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
      style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}
    >
      {hospitals.map((h) => {
        const active = h.id === activeId;
        return (
          <button
            key={h.id}
            data-testid={`hospital-switcher-${h.id}`}
            type="button"
            onClick={() => {
              // T-4-07: validate against the fixture before applying.
              if (!isKnownHospitalId(fixture, h.id)) return;
              onSelectHospital(h.id);
            }}
            aria-pressed={active}
            style={{
              background: active ? colors.accent : "transparent",
              color: active ? "#ffffff" : colors.textPrimary,
              border: `1px solid ${active ? colors.accent : colors.cardBorder}`,
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {h.name}
          </button>
        );
      })}
    </nav>
  );
}

const panelStyle: React.CSSProperties = {
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 12,
  padding: spacing.lg,
  marginTop: spacing.lg,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const panelHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: `0 0 ${spacing.sm}px`,
  fontSize: 13,
  fontWeight: 700,
  color: colors.textPrimary,
};

const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "4px 12px",
  cursor: "pointer",
};

const medicineRowStyle: React.CSSProperties = {
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 8,
  padding: spacing.sm,
  marginBottom: spacing.sm,
};
