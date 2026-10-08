/**
 * MedicineRow — expandable per-medicine drill-in rows (D-11, D-14).
 * Redesigned (D-23-ext): refined expand toggle, CSS vars, tabular-nums,
 * cleaner move row layout matching the MovesCard style.
 *
 * Collapsed: medicine name, units on hand, days-to-stockout badge.
 * Expanded: 30-day forecast outlook, days-to-stockout vs supplier lead
 * time, waste quantity with expiry date, and the suggested moves for that
 * medicine. Every move row states transit days and the shelf-life-on-arrival
 * check plus a short sender rationale (D-14).
 *
 * Read-only: buttons and text only, no editable fields. All rationale
 * strings render as escaped text — never interpolated HTML (T-4-09).
 */
"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Badge, Sparkline } from "../cards/ui";
import { riskForDaysToStockout } from "@/theme/tokens";
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
 * One move row in the panel — transit days, shelf-life check,
 * sender rationale, optional action button.
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
    <li data-testid={testId} style={moveRowStyle}>
      <div style={moveRowInnerStyle}>
        {/* Direction badge */}
        <span
          style={{
            ...dirBadgeStyle,
            background: detail.direction === "in"
              ? "var(--risk-ok-bg)"
              : "var(--accent-subtle)",
            color: detail.direction === "in"
              ? "var(--risk-ok-text)"
              : "var(--accent)",
          }}
        >
          {detail.direction === "in" ? "← in" : "→ out"}
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={moveTextStyle}>
            {detail.direction === "in" ? "Receive" : "Send"}{" "}
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
              {detail.qty.toLocaleString()}
            </span>
            {" "}{detail.medicineName}{" "}
            {detail.direction === "in" ? "from" : "to"}{" "}
            <strong>{detail.counterpartName}</strong>
            {" · transit "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {detail.transitDays}
            </span>
            {detail.transitDays === 1 ? "d" : "d"}
          </span>
          <span style={moveSubStyle}>
            {detail.shelfLifeOnArrivalDays === null ? (
              "no expiry constraint — shelf life OK"
            ) : (
              <>
                shelf life on arrival{" "}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {detail.shelfLifeOnArrivalDays}
                </span>
                d — {detail.shelfLifeOk ? "OK" : "check expiry"}
              </>
            )}
          </span>
          <span style={rationaleStyle}>{detail.rationale}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Badge level={detail.shelfLifeOk ? "ok" : "warning"}>
              {detail.shelfLifeOk ? "shelf-life OK" : "shelf-life check"}
            </Badge>
            {showAction ? (
              <button
                data-testid={`${testId}-approve`}
                type="button"
                onClick={() => {}}
                title="Prototype display-only action — approval wires up in Phase 5"
                style={approveBtnStyle}
              >
                Approve
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                (read-only)
              </span>
            )}
          </span>
        </span>
      </div>
    </li>
  );
}

export function MedicineRow({ detail }: { detail: MedicineRowDetail }) {
  const [expanded, setExpanded] = useState(false);
  const level = riskForDaysToStockout(
    detail.daysToStockout,
    detail.leadDays,
    detail.bufferDays,
  );

  return (
    <li
      data-testid={`panel-medicine-${detail.medicineId}`}
      style={medRowStyle}
    >
      {/* Collapsed toggle */}
      <button
        data-testid={`panel-medicine-toggle-${detail.medicineId}`}
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={toggleStyle}
        className="row-interactive"
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          {detail.medicineName}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            {detail.stock.toLocaleString()} units
          </span>
          <Badge level={level}>
            {level === "ok" ? "healthy" : `${detail.daysToStockout}d`}
          </Badge>
          <span
            style={{
              display: "inline-block",
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 150ms",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
            aria-hidden="true"
          >
            ▾
          </span>
        </span>
      </button>

      {/* Expanded detail */}
      {expanded ? (
        <div style={expandedStyle}>
          {/* Forecast sparkline + summary */}
          <div style={forecastRowStyle}>
            <Sparkline values={detail.forecastNext7} width={72} height={22} />
            <span style={subTextStyle}>
              {detail.forecastMode === null ? (
                "No forecast row for this medicine."
              ) : (
                <>
                  ~
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {detail.forecastAvgDaily}
                  </span>
                  /day next 7d
                  {detail.forecastMode === "trend" ? " (trend mode)" : ""} · 30d ≈
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {" "}{(detail.forecastAvgDaily * 30).toLocaleString()}
                  </span>{" "}
                  units
                </>
              )}
            </span>
          </div>

          {/* Stock vs lead time */}
          <div style={subTextStyle}>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {detail.daysToStockout}
            </span>{" "}
            days to stockout vs{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {detail.leadDays}
            </span>
            d lead (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {detail.bufferDays}
            </span>
            d buffer)
          </div>

          {/* Waste */}
          <div style={subTextStyle}>
            {detail.wasteQty > 0 && detail.wasteExpiryDate ? (
              <>
                Waste risk:{" "}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {detail.wasteQty.toLocaleString()}
                </span>{" "}
                units expiring {detail.wasteExpiryDate}
              </>
            ) : (
              "No waste at risk before expiry."
            )}
          </div>

          {/* Moves */}
          <div style={{ marginTop: 6 }}>
            <div style={movesHeaderStyle}>Suggested moves for this medicine</div>
            {detail.moves.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                No suggested moves in this snapshot.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {detail.moves.map((m, i) => (
                  <MoveRow
                    key={`${m.direction}-${m.counterpartName}-${i}`}
                    detail={m}
                    showAction={detail.showMoveActions}
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

// ─── Styles ────────────────────────────────────────────────────────────────

const medRowStyle: CSSProperties = {
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  overflow: "hidden",
  marginBottom: 6,
};

const toggleStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  background: "transparent",
  border: "none",
  padding: "10px 12px",
  cursor: "pointer",
  textAlign: "left",
  borderRadius: 10,
};

const expandedStyle: CSSProperties = {
  padding: "8px 12px 12px",
  borderTop: "1px solid var(--card-border)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  background: "var(--risk-neutral-bg)",
};

const forecastRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const subTextStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  fontVariantNumeric: "tabular-nums",
};

const movesHeaderStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 6,
};

const moveRowStyle: CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  overflow: "hidden",
};

const moveRowInnerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "8px 10px",
};

const dirBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 6,
  padding: "2px 7px",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
  flexShrink: 0,
  marginTop: 1,
};

const moveTextStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-secondary)",
  fontVariantNumeric: "tabular-nums",
};

const moveSubStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-muted)",
  marginTop: 2,
  fontVariantNumeric: "tabular-nums",
};

const rationaleStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-muted)",
  marginTop: 2,
  fontStyle: "italic",
};

const approveBtnStyle: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--accent)",
  borderRadius: 6,
  padding: "2px 10px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  color: "var(--accent)",
  transition: "background 150ms",
};
