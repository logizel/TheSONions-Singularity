"use client";

/**
 * The six network sections (06-UI-SPEC Network panel): Stock, Forecast,
 * Shortage, Waste, Moves, Priority. Dense two-line rows; every figure is a
 * ResultsJSON value shown verbatim (one-decimal engine quantities keep their
 * decimal).
 */
import { useState } from "react";

import type { InventoryEntry, Severity } from "@/lib/contracts";
import { type ScopedResults, dShort, fmtDate, signed } from "@/lib/dashboard/panel";
import { fmtUnits } from "@/lib/dashboard/view";
import { SupplierTimeline } from "../orders/SupplierTimeline";
import { TransferRow } from "../orders/OrderBits";
import { ForecastStrip, forecastSentence } from "../ui/ForecastStrip";
import { Sparkline, sparkSentence } from "../ui/Sparkline";
import { OutbreakTag, RiskTag, Tag } from "../ui/Tag";
import { useDash } from "./context";
import rows from "./rows.module.css";

function Empty({ heading, body }: { heading?: string; body: string }) {
  return (
    <div className={rows.empty}>
      {heading ? <p className={rows.emptyHeading}>{heading}</p> : null}
      <p className={rows.caption}>{body}</p>
    </div>
  );
}

function MedHosp({ medicineId, hospitalId }: { medicineId: string; hospitalId: string }) {
  const { medName, hospName, selectHospital } = useDash();
  return (
    <span className={rows.line1}>
      <span className={rows.strong}>{medName(medicineId)}</span> ·{" "}
      <button type="button" className={rows.hospitalLink} onClick={() => selectHospital(hospitalId)}>
        {hospName(hospitalId)}
      </button>
    </span>
  );
}

// ---- Stock --------------------------------------------------------------------

function StockRow({ e }: { e: InventoryEntry }) {
  const { unit } = useDash();
  return (
    <li className={rows.row} data-testid={`stock-row-${e.hospitalId}-${e.medicineId}`}>
      <span className={rows.tagCell}>
        <RiskTag severity={e.severity} />
      </span>
      <span className={rows.main}>
        <MedHosp medicineId={e.medicineId} hospitalId={e.hospitalId} />
        <span className={rows.line2}>
          {fmtUnits(e.stock)} {unit(e.medicineId, e.stock)} · lead {dShort(e.leadDays)} + buffer {dShort(e.bufferDays)} · expires{" "}
          {fmtDate(e.nearestExpiry)}
        </span>
      </span>
      <span className={rows.right}>
        {dShort(e.daysUntilStockout)} cover
        <Sparkline values={e.trend} />
        <span className="sr-only">{sparkSentence(e.trend)}</span>
      </span>
    </li>
  );
}

const GROUPS: { sev: Severity; label: string }[] = [
  { sev: "critical", label: "Critical" },
  { sev: "warning", label: "Low" },
  { sev: "ok", label: "OK" },
];

export function StockSection({ s }: { s: ScopedResults }) {
  const { selectedId, hospName, results } = useDash();
  const [showOk, setShowOk] = useState(false);
  const total = s.inventory.reduce((n, e) => n + e.stock, 0);
  const scope = selectedId ? hospName(selectedId) : "the network";
  if (s.inventory.length === 0) return <Empty body={`No stock positions for ${scope}.`} />;
  return (
    <>
      <div className={rows.sectionHead}>
        <p className={rows.caption}>
          {selectedId
            ? `${fmtUnits(total)} units at ${hospName(selectedId)}`
            : `${fmtUnits(total)} units network-wide · ${s.inventory.length} positions · ${results.hospitals.length} hospitals`}
        </p>
      </div>
      {GROUPS.map(({ sev, label }) => {
        const list = s.inventory.filter((e) => e.severity === sev);
        if (list.length === 0) return null;
        const collapsed = sev === "ok" && !showOk;
        return (
          <section key={sev} aria-label={`${label} positions`}>
            <h3 className={`${rows.subhead} ${rows.label}`}>
              <span>
                {label} {list.length}
              </span>
              {sev === "ok" ? (
                <button type="button" className={rows.linkButton} aria-expanded={!collapsed} onClick={() => setShowOk((v) => !v)}>
                  {collapsed ? `Show ${list.length} OK positions` : "Hide"}
                </button>
              ) : null}
            </h3>
            {collapsed ? null : (
              <ul className={rows.rows}>
                {list.map((e) => (
                  <StockRow key={`${e.hospitalId}-${e.medicineId}`} e={e} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

// ---- Forecast -----------------------------------------------------------------

export function ForecastSection({ s }: { s: ScopedResults }) {
  const { results, selectedId, hospName, unit } = useDash();
  const [all, setAll] = useState(false);
  const { fromDay, toDay } = results.advisory;
  if (s.forecasts.length === 0) {
    return <Empty body={`No forecast series for ${selectedId ? hospName(selectedId) : "the network"}.`} />;
  }
  const shown = all ? s.forecasts : s.forecasts.slice(0, 5);
  return (
    <>
      <div className={rows.sectionHead}>
        <p className={rows.caption}>
          Forecast error (MAPE) <span className={rows.strong}>{results.mapePct}%</span> network mean · target 3–11%
        </p>
        <p className={rows.caption}>
          Days 1–{fromDay - 1} actionable · days {fromDay}–{toDay} <Tag tone="muted">Advisory</Tag>
        </p>
      </div>
      <ul className={rows.rows}>
        {shown.map((f) => {
          const sev = results.inventory.find((e) => e.hospitalId === f.hospitalId && e.medicineId === f.medicineId)?.severity ?? "ok";
          return (
            <li key={`${f.hospitalId}-${f.medicineId}`} className={rows.row} data-testid={`forecast-row-${f.hospitalId}-${f.medicineId}`}>
              <span className={rows.tagCell}>
                <RiskTag severity={sev} />
              </span>
              <span className={rows.main}>
                <MedHosp medicineId={f.medicineId} hospitalId={f.hospitalId} />
                <span className={rows.inlineRow}>
                  <span className={rows.line2}>MAPE {f.mapePct}%</span>
                  {f.mode === "trend" ? <Tag tone="ink">Trend (outbreak)</Tag> : <Tag tone="outline">Base</Tag>}
                  {f.outbreak ? <OutbreakTag /> : null}
                </span>
                <ForecastStrip points={f.forecast} fromDay={fromDay} testId={`forecast-advisory-${f.hospitalId}-${f.medicineId}`} />
                <span className="sr-only">{forecastSentence(f.forecast, unit(f.medicineId, 2), fromDay, toDay)}</span>
              </span>
              <span />
            </li>
          );
        })}
      </ul>
      {s.forecasts.length > 5 ? (
        <p className={rows.sectionHead}>
          <button type="button" className={rows.linkButton} onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Show fewer" : `Show all ${s.forecasts.length} forecasts`}
          </button>
        </p>
      ) : null}
    </>
  );
}

// ---- Shortage -----------------------------------------------------------------

function CoverBar({ cover, lead }: { cover: number; lead: number }) {
  const max = Math.max(cover, lead, 1) * 1.1;
  const W = 160;
  return (
    <svg width={W} height={10} viewBox={`0 0 ${W} 10`} aria-hidden="true" focusable="false" className={rows.bar}>
      <rect x={0} y={3} width={W} height={4} fill="var(--color-sunk)" />
      <rect x={0} y={3} width={(cover / max) * W} height={4} fill="var(--risk-critical)" />
      <rect x={(lead / max) * W - 1} y={0} width={2} height={10} fill="var(--color-ink)" />
    </svg>
  );
}

export function ShortageSection({ s }: { s: ScopedResults }) {
  if (s.shortages.length === 0) {
    return <Empty heading="No shortages forecast" body="Every position covers its supplier lead time." />;
  }
  return (
    <>
      <div className={rows.sectionHead}>
        <p className={rows.caption}>Positions that run out before the supplier can deliver</p>
      </div>
      <ul className={rows.rows}>
        {s.shortages.map((w) => (
          <li key={`${w.hospitalId}-${w.medicineId}`} className={rows.row} data-testid={`shortage-row-${w.hospitalId}-${w.medicineId}`}>
            <span className={rows.tagCell}>
              <RiskTag severity="critical" />
            </span>
            <span className={rows.main}>
              <MedHosp medicineId={w.medicineId} hospitalId={w.hospitalId} />
              <span className={rows.line2}>Supplier lead {dShort(w.leadDays)}</span>
              <CoverBar cover={w.daysUntilStockout} lead={w.leadDays} />
              <span className="sr-only">
                Runs out in {w.daysUntilStockout} days; supplier needs {w.leadDays} days.
              </span>
            </span>
            <span className={rows.right}>{dShort(w.daysUntilStockout)} to stockout</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Waste ----------------------------------------------------------------------

export function WasteSection({ s }: { s: ScopedResults }) {
  const { unit } = useDash();
  if (s.waste.length === 0) {
    return <Empty heading="No waste forecast" body="No batch is expected to expire before use within 90 days." />;
  }
  return (
    <>
      <div className={rows.sectionHead}>
        <p className={rows.caption}>Stock expected to expire unused (90-day horizon)</p>
      </div>
      <ul className={rows.rows}>
        {s.waste.map((w) => (
          <li key={`${w.hospitalId}-${w.medicineId}-${w.expiryDate}`} className={rows.row} data-testid={`waste-row-${w.hospitalId}-${w.medicineId}`}>
            <span className={rows.tagCell}>
              <RiskTag severity={w.severity} />
            </span>
            <span className={rows.main}>
              <MedHosp medicineId={w.medicineId} hospitalId={w.hospitalId} />
              <span className={rows.line2}>
                Expires {fmtDate(w.expiryDate)} ({dShort(w.expiryDays)})
              </span>
            </span>
            <span className={rows.right}>
              {fmtUnits(w.wasteUnits)} {unit(w.medicineId, w.wasteUnits)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Moves ----------------------------------------------------------------------

export function MovesSection({ s }: { s: ScopedResults }) {
  const { medName, hospName, unit, selectHospital, openCart, results, orders } = useDash();
  const networkTransfers = results.transfers.length;
  return (
    <>
      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Transfers {s.transfers.length}</span>
        {networkTransfers > 0 ? (
          <button type="button" className={rows.outlineButton} onClick={openCart} data-testid="review-transfers">
            Review transfers ({networkTransfers})
          </button>
        ) : null}
      </h3>
      {orders === null && networkTransfers > 0 ? (
        <p className={rows.note}>Order tracking unavailable: the order store did not respond.</p>
      ) : null}
      {s.transfers.length === 0 ? (
        <Empty heading="No transfers suggested" body="No hospital has stock to spare that passes all five checks." />
      ) : (
        <ul className={rows.rows}>
          {s.transfers.map((t) => (
            <TransferRow key={`${t.fromHospital}-${t.toHospital}-${t.medicineId}`} t={t} />
          ))}
        </ul>
      )}
      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Supplier orders {s.supplierOrders.length}</span>
      </h3>
      {s.supplierOrders.length === 0 ? (
        <Empty body="No supplier orders needed." />
      ) : (
        <ul className={rows.rows}>
          {s.supplierOrders.map((o) => (
            <li key={`${o.hospitalId}-${o.medicineId}`} className={`${rows.row} ${rows.rowNoTag}`} data-testid={`supplier-order-row-${o.hospitalId}-${o.medicineId}`}>
              <span className={rows.main}>
                <span className={rows.line1}>
                  <span className={rows.strong}>{medName(o.medicineId)}</span> {fmtUnits(o.qty)} {unit(o.medicineId, o.qty)} for{" "}
                  <button type="button" className={rows.hospitalLink} onClick={() => selectHospital(o.hospitalId)}>
                    {hospName(o.hospitalId)}
                  </button>
                </span>
                <span className={rows.line2}>{o.reason}</span>
                <SupplierTimeline order={o} />
              </span>
              <span className={rows.right}>lead {dShort(o.leadDays)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={`${rows.sectionHead} ${rows.caption}`}>Place supplier orders with your supplier. This system does not send orders.</p>
    </>
  );
}

// ---- Priority -------------------------------------------------------------------

export function PrioritySection({ s }: { s: ScopedResults }) {
  const { selectedId, hospName } = useDash();
  if (s.priorities.length === 0) {
    return <Empty body={`No ranked positions for ${selectedId ? hospName(selectedId) : "the network"}.`} />;
  }
  return (
    <>
      <div className={rows.sectionHead}>
        <p className={rows.caption}>Ranked worst first. Score = soonness + emergency share + patient load + substitute</p>
      </div>
      <ul className={rows.rows}>
        {s.priorities.map((p) => (
          <li key={`${p.hospitalId}-${p.medicineId}`} className={rows.row} data-testid={`priority-row-${p.hospitalId}-${p.medicineId}`}>
            <span className={rows.monoHeading}>#{p.rank}</span>
            <span className={rows.main}>
              <MedHosp medicineId={p.medicineId} hospitalId={p.hospitalId} />
              <span className={rows.line2}>
                Soonness {signed(p.factors.soonness)} · Emergency {signed(p.factors.emergencyShare)} · Load {signed(p.factors.patientLoad)} ·
                Substitute {signed(p.factors.substitute)}
              </span>
              {p.reasons.map((r) => (
                <span key={r} className={rows.line2}>
                  {r}
                </span>
              ))}
            </span>
            <span className={rows.right}>score {p.score}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export const SECTION: Record<string, (p: { s: ScopedResults }) => React.ReactNode> = {
  stock: StockSection,
  forecast: ForecastSection,
  shortage: ShortageSection,
  waste: WasteSection,
  moves: MovesSection,
  priority: PrioritySection,
};
