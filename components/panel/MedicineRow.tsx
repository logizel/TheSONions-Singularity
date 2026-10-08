/**
 * MedicineRow — expandable per-medicine drill-in rows (D-11, D-14).
 *
 * Collapsed: medicine name, units on hand, days-to-stockout badge.
 * Expanded: 30-day forecast outlook, days-to-stockout vs supplier lead
 * time, waste quantity with expiry date, and the suggested moves for that
 * medicine. Every move row states transit days and the shelf-life-on-arrival
 * check plus a short sender rationale (buffer / need-cap / waste-first /
 * nearest-sender) so the choice is explainable (D-14).
 *
 * Read-only: buttons and text only, no editable fields. All rationale
 * strings render as escaped text — never interpolated HTML (T-4-09).
 */
"use client";

import { useState } from "react";
import { Badge, Sparkline } from "../cards/ui";
import { colors, spacing } from "@/theme/tokens";
import type { MoveRow as FixtureMove, ResultsFixture } from "@/app/data/results";

export interface PanelMoveDetail {
  direction: "in" | "out";
  counterpartName: string;
  medicineName: string;
  qty: number;
  /** Directed transport-leg days sender -> receiver (D-14). */
  transitDays: number;
  /** Days of shelf life left on arrival; null = no expiry on record. */
  shelfLifeOnArrivalDays: number | null;
  shelfLifeOk: boolean;
  /** Short sender rationale (buffer / need-cap / waste-first / nearest). */
  rationale: string;
}

export interface MedicineRowDetail {
  medicineId: string;
  medicineName: string;
  stock: number;
  daysToStockout: number;
  trend: number[];
  forecastNext7: number[];
  forecastAvgDaily: number;
  forecastMode: "base" | "trend" | null;
  wasteQty: number;
  wasteExpiryDate: string | null;
  leadDays: number;
  bufferDays: number;
  moves: PanelMoveDetail[];
  /** Panel-level move-action visibility (role gating, display-only). */
  showMoveActions: boolean;
}

/** Prototype usability floor for the shelf-life-on-arrival check (D-14). */
const SHELF_LIFE_OK_FLOOR_DAYS = 14;

const DAY_MS = 86_400_000;

/**
 * Build an explainable move row for one fixture move, seen from the
 * perspective hospital (the panel hospital). Transit comes from the directed
 * transport matrix; shelf life counts from arrival (generatedAt + transit)
 * to the sender's earliest recorded expiry for that medicine; the rationale
 * cites whichever of waste-first / nearest-sender / buffer-cushion /
 * need-cap the fixture numbers support.
 */
export function buildMoveDetail(
  fixture: ResultsFixture,
  move: FixtureMove,
  perspectiveHospitalId: string,
): PanelMoveDetail {
  const direction = move.toId === perspectiveHospitalId ? "in" : "out";
  const counterpartId = direction === "in" ? move.fromId : move.toId;
  const counterpartName =
    fixture.hospitals.find((h) => h.id === counterpartId)?.name ??
    counterpartId;
  const medicineName =
    fixture.medicines.find((m) => m.id === move.medicineId)?.name ??
    move.medicineId;

  const transitDays =
    fixture.transport.find(
      (t) => t.fromId === move.fromId && t.toId === move.toId,
    )?.days ?? move.arrivesInDays;

  const senderExpiries = fixture.expiries.filter(
    (e) => e.hospitalId === move.fromId && e.medicineId === move.medicineId,
  );
  const arrivalMs = Date.parse(fixture.generatedAt) + transitDays * DAY_MS;
  let shelfLifeOnArrivalDays: number | null = null;
  if (senderExpiries.length > 0) {
    const earliestMs = Math.min(
      ...senderExpiries.map((e) => Date.parse(e.expiryDate)),
    );
    shelfLifeOnArrivalDays = Math.floor((earliestMs - arrivalMs) / DAY_MS);
  }
  const shelfLifeOk =
    shelfLifeOnArrivalDays === null ||
    shelfLifeOnArrivalDays >= SHELF_LIFE_OK_FLOOR_DAYS;

  const reasons: string[] = [];
  if (senderExpiries.length > 0) {
    const wasteQty = senderExpiries.reduce((sum, e) => sum + e.qty, 0);
    reasons.push(
      `waste-first: sender holds ${wasteQty.toLocaleString()} units expiring soon`,
    );
  }
  const rivalLegs = fixture.transport.filter(
    (t) => t.toId === move.toId && t.fromId !== move.fromId,
  );
  if (
    rivalLegs.length === 0 ||
    transitDays <= Math.min(...rivalLegs.map((t) => t.days))
  ) {
    reasons.push(`nearest sender (${transitDays}d transit)`);
  }
  const senderInv = fixture.inventory.find(
    (r) => r.hospitalId === move.fromId && r.medicineId === move.medicineId,
  );
  const senderBuffer =
    fixture.medicines.find((m) => m.id === move.medicineId)?.bufferDays ?? 0;
  if (senderInv && senderInv.daysToStockout > senderBuffer) {
    reasons.push(
      `sender keeps ${senderInv.daysToStockout}d cushion above ${senderBuffer}d buffer`,
    );
  }
  const receiverForecast = fixture.forecast.find(
    (f) => f.hospitalId === move.toId && f.medicineId === move.medicineId,
  );
  if (receiverForecast && receiverForecast.avgDaily > 0) {
    const coversDays = Math.floor(move.qty / receiverForecast.avgDaily);
    reasons.push(`covers ~${coversDays}d of demand (need-cap)`);
  }
  if (reasons.length === 0) {
    reasons.push("best available sender in this snapshot");
  }

  return {
    direction,
    counterpartName,
    medicineName,
    qty: move.qty,
    transitDays,
    shelfLifeOnArrivalDays,
    shelfLifeOk,
    rationale: `why this sender: ${reasons.join("; ")}`,
  };
}

/**
 * One move row with transit days, shelf-life-on-arrival check, sender
 * rationale, and an optional display-only action affordance (role-gated by
 * the caller; true enforcement belongs to Phase 3 middleware — see
 * components/roles.tsx, T-4-06).
 */
export function MoveRow({
  detail,
  showAction,
  testId,
}: {
  detail: PanelMoveDetail;
  showAction: boolean;
  testId: string;
}) {
  return (
    <li data-testid={testId} style={{ marginBottom: 8, fontSize: 13 }}>
      <span>
        {detail.direction === "in" ? "Receive" : "Send"}{" "}
        {detail.qty.toLocaleString()} units {detail.medicineName}{" "}
        {detail.direction === "in" ? "from" : "to"} {detail.counterpartName}
        {" · "}transit {detail.transitDays}{" "}
        {detail.transitDays === 1 ? "day" : "days"}
        {" · "}
        {detail.shelfLifeOnArrivalDays === null ? (
          <span>
            no expiry constraint on record — shelf life on arrival OK
          </span>
        ) : (
          <span>
            shelf life on arrival {detail.shelfLifeOnArrivalDays}d —{" "}
            {detail.shelfLifeOk ? "OK" : "check expiry"}
          </span>
        )}
      </span>{" "}
      <Badge level={detail.shelfLifeOk ? "ok" : "warning"}>
        {detail.shelfLifeOk ? "shelf-life OK" : "shelf-life check"}
      </Badge>
      <span
        style={{
          display: "block",
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
        }}
      >
        {detail.rationale}
      </span>
      {showAction ? (
        <button
          data-testid={`${testId}-approve`}
          type="button"
          onClick={() => {}}
          title="Prototype display-only action — approval wires up in Phase 5"
          style={approveButtonStyle}
        >
          Approve
        </button>
      ) : (
        <span style={{ fontSize: 12, color: colors.textMuted }}>
          {" "}
          (read-only)
        </span>
      )}
    </li>
  );
}

export function MedicineRow({ detail }: { detail: MedicineRowDetail }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li
      data-testid={`panel-medicine-${detail.medicineId}`}
      style={rowStyle}
    >
      <button
        data-testid={`panel-medicine-toggle-${detail.medicineId}`}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={toggleStyle}
      >
        <span style={{ fontSize: 13, fontWeight: 650 }}>
          {detail.medicineName}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            {detail.stock.toLocaleString()} units
          </span>
          <span
            style={{
              display: "inline-block",
              transform: expanded ? "rotate(180deg)" : "none",
              fontSize: 11,
              color: colors.textSecondary,
            }}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {expanded ? (
        <div style={{ marginTop: spacing.sm }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              marginBottom: 6,
            }}
          >
            <Sparkline values={detail.forecastNext7} />
            <span style={{ fontSize: 12, color: colors.textSecondary }}>
              {detail.forecastMode === null ? (
                "No forecast row for this medicine in the fixture."
              ) : (
                <>
                  ~{detail.forecastAvgDaily}/day next 7d
                  {detail.forecastMode === "trend" ? " (trend mode)" : ""} ·
                  30-day outlook ≈
                  {(detail.forecastAvgDaily * 30).toLocaleString()} units
                  (projected)
                </>
              )}
            </span>
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            {detail.daysToStockout} days to stockout vs {detail.leadDays}d
            supplier lead time ({detail.bufferDays}d buffer)
          </div>
          <div
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {detail.wasteQty > 0 && detail.wasteExpiryDate ? (
              <>
                Waste at risk: {detail.wasteQty.toLocaleString()} units
                expiring {detail.wasteExpiryDate}
              </>
            ) : (
              <>No waste at risk before expiry.</>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: colors.textPrimary,
                marginBottom: 4,
              }}
            >
              Suggested moves for this medicine
            </div>
            {detail.moves.length === 0 ? (
              <p
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  margin: 0,
                }}
              >
                No suggested moves for this medicine in this snapshot.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {detail.moves.map((m, i) => (
                  <MoveRow
                    key={`${m.direction}-${m.counterpartName}-${i}`}
                    detail={m}
                    showAction={detailShowAction(detail)}
                    testId={`panel-medmove-${detail.medicineId}-${i}`}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Per-medicine rows inherit the panel-level action visibility. */
function detailShowAction(detail: MedicineRowDetail): boolean {
  return detail.showMoveActions;
}

const rowStyle: React.CSSProperties = {
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 8,
  padding: spacing.sm,
  marginBottom: spacing.sm,
};

const toggleStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
};

const approveButtonStyle: React.CSSProperties = {
  marginTop: 4,
  background: "transparent",
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 8,
  padding: "2px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
