"use client";

/**
 * Hospital drill-in (`hospital-panel`): stock strip, switcher, priority,
 * per-medicine table with expandable forecast/trend/expiry/moves, moves in
 * and out with order status, supplier orders. Lives in the right sheet
 * (>=1280), the panel stack (768-1279) or the bottom sheet (XS).
 */
import { useState } from "react";

import type { HospitalLocation } from "@/lib/hospital-locations";
import { dShort, fmtDate, shortName, signed } from "@/lib/dashboard/panel";
import { fmtUnits, hospitalRisk } from "@/lib/dashboard/view";
import { Glyph, RiskGlyph } from "../icons/Glyph";
import { ChecksDisclosure, TransferRow } from "../orders/OrderBits";
import { SupplierTimeline } from "../orders/SupplierTimeline";
import { ForecastStrip, forecastSentence } from "../ui/ForecastStrip";
import { Sparkline, sparkSentence } from "../ui/Sparkline";
import { OutbreakTag, RiskTag, Tag } from "../ui/Tag";
import { useDash } from "./context";
import rows from "./rows.module.css";
import { SheetHeader } from "./SheetHeader";
import { RecentActivity } from "../logs/LogsSheet";

const SEV_FROM_RISK = { critical: "critical", low: "warning", ok: "ok" } as const;

export function HospitalDetail({
  hospitalId,
  location,
  onClose,
  onBack,
  activityBump,
}: {
  activityBump?: unknown;
  hospitalId: string;
  location: HospitalLocation | null;
  onClose: () => void;
  onBack?: () => void;
}) {
  const { results, medName, hospName, unit, selectHospital, role, ownHospitalId, openCart } = useDash();
  const [open, setOpen] = useState<string | null>(null);
  const summary = results.hospitals.find((h) => h.hospitalId === hospitalId);
  const name = summary?.hospitalName ?? hospitalId;
  const inv = results.inventory
    .filter((e) => e.hospitalId === hospitalId)
    .sort((a, b) => ({ critical: 0, warning: 1, ok: 2 })[a.severity] - ({ critical: 0, warning: 1, ok: 2 })[b.severity] || a.daysUntilStockout - b.daysUntilStockout);
  const risk = hospitalRisk(results, hospitalId);
  const units = inv.reduce((n, e) => n + e.stock, 0);
  const crit = inv.filter((e) => e.severity === "critical").length;
  const low = inv.filter((e) => e.severity === "warning").length;
  const top = results.priorities.filter((p) => p.hospitalId === hospitalId).sort((a, b) => a.rank - b.rank)[0];
  const transfers = results.transfers.filter((t) => t.fromHospital === hospitalId || t.toHospital === hospitalId);
  const supplier = results.emergencyOrders.filter((o) => o.hospitalId === hospitalId);
  const readOnly = role === "hospital_admin" && ownHospitalId !== hospitalId;
  const { fromDay, toDay } = results.advisory;

  return (
    <div data-testid="hospital-panel">
      <SheetHeader
        title={name}
        onClose={onClose}
        onBack={onBack}
        closeTestId="hospital-panel-close"
        closeLabel={`Close ${name}`}
      >
        <p className={rows.caption}>
          {location?.address ?? "No position on file"} {location ? <Tag tone="demo">Demo location</Tag> : null}
        </p>
        <div className={rows.inlineRow}>
          <RiskTag severity={SEV_FROM_RISK[risk.level]} />
          {summary?.outbreak ? <OutbreakTag /> : null}
          {summary ? (
            <span className={rows.caption}>
              {summary.patientLoad} patients a day · emergency {summary.emergencyPct}%
            </span>
          ) : null}
        </div>
      </SheetHeader>

      {readOnly ? (
        <p className={rows.note} role="note">
          Read only. You manage {ownHospitalId ? hospName(ownHospitalId) : "another hospital"}.
        </p>
      ) : null}

      {role === "network_admin" || ownHospitalId === hospitalId ? (
        <p className={rows.block}>
          <a className={rows.linkButton} href={`/insights/${hospitalId}`} data-testid="open-insights">
            Open charts and forecasts →
          </a>
        </p>
      ) : null}
      <div className={rows.block} data-testid="hospital-panel-header-stock">
        <p>
          <span className={rows.strong}>{fmtUnits(units)} units</span> · {inv.length} medicines · {crit} critical · {low} low
        </p>
      </div>

      <div className={rows.block}>
        <p className={rows.label}>Hospitals</p>
        <div className={rows.switcher} data-testid="hospital-panel-switcher">
          {results.hospitals.map((h) => {
            const r = hospitalRisk(results, h.hospitalId);
            return (
              <button
                key={h.hospitalId}
                type="button"
                aria-pressed={h.hospitalId === hospitalId}
                onClick={() => h.hospitalId !== hospitalId && selectHospital(h.hospitalId)}
                data-testid={`hospital-switcher-${h.hospitalId}`}
                title={h.hospitalName}
              >
                <RiskGlyph severity={SEV_FROM_RISK[r.level]} />
                {shortName(h.hospitalName)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={rows.block} data-testid="hospital-panel-priority">
        <p className={rows.label}>Priority</p>
        {top ? (
          <>
            <p>
              <span className={rows.monoHeading}>#{top.rank}</span> {medName(top.medicineId)} · score <span className={rows.strong}>{top.score}</span>
            </p>
            <p className={rows.caption}>
              Soonness {signed(top.factors.soonness)} · Emergency {signed(top.factors.emergencyShare)} · Load {signed(top.factors.patientLoad)} · Substitute{" "}
              {signed(top.factors.substitute)}
            </p>
            {top.reasons.map((r) => (
              <p key={r} className={rows.caption}>
                {r}
              </p>
            ))}
          </>
        ) : (
          <p className={rows.caption}>No ranked positions for {name}.</p>
        )}
      </div>

      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Medicines {inv.length}</span>
        <span className={rows.muted}>cover vs lead + buffer</span>
      </h3>
      <ul className={rows.rows}>
        {inv.map((e) => {
          const f = results.forecasts.find((x) => x.hospitalId === hospitalId && x.medicineId === e.medicineId);
          const waste = results.wasteWarnings.filter((w) => w.hospitalId === hospitalId && w.medicineId === e.medicineId);
          const medMoves = transfers.filter((t) => t.medicineId === e.medicineId);
          const expanded = open === e.medicineId;
          return (
            <li key={e.medicineId} className={rows.row} data-testid={`panel-medicine-${e.medicineId}`}>
              <span className={rows.tagCell}>
                <RiskTag severity={e.severity} />
              </span>
              <span className={rows.main}>
                <span className={rows.line1}>
                  <button
                    type="button"
                    className={rows.disclosure}
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : e.medicineId)}
                    data-testid={`panel-medicine-toggle-${e.medicineId}`}
                  >
                    <Glyph name={expanded ? "chevron-up" : "chevron-down"} size={12} />
                    <span className={rows.strong}>{medName(e.medicineId)}</span>
                  </button>
                </span>
                <span className={rows.line2}>
                  {fmtUnits(e.stock)} {unit(e.medicineId, e.stock)} · lead {dShort(e.leadDays)} + buffer {dShort(e.bufferDays)}
                </span>
              </span>
              <span className={rows.right}>{dShort(e.daysUntilStockout)} cover</span>
              {expanded ? (
                <div className={`${rows.full} ${rows.main}`}>
                  {f ? (
                    <>
                      <span className={rows.inlineRow}>
                        <span className={rows.line2}>MAPE {f.mapePct}%</span>
                        {f.mode === "trend" ? <Tag tone="ink">Trend (outbreak)</Tag> : <Tag tone="outline">Base</Tag>}
                        <span className={rows.line2}>{fmtUnits(e.dailyDemand)} {unit(e.medicineId, e.dailyDemand)} a day</span>
                      </span>
                      <ForecastStrip points={f.forecast} fromDay={fromDay} />
                      <span className="sr-only">{forecastSentence(f.forecast, unit(e.medicineId, 2), fromDay, toDay)}</span>
                    </>
                  ) : null}
                  <span className={rows.inlineRow}>
                    <span className={rows.line2}>7-day usage</span>
                    <Sparkline values={e.trend} />
                    <span className="sr-only">{sparkSentence(e.trend)}</span>
                    <span className={rows.line2}>Nearest expiry {fmtDate(e.nearestExpiry)}</span>
                  </span>
                  {waste.map((w) => (
                    <span key={w.expiryDate} className={rows.line2}>
                      Waste: {fmtUnits(w.wasteUnits)} {unit(e.medicineId, w.wasteUnits)} expire unused by {fmtDate(w.expiryDate)}
                    </span>
                  ))}
                  {medMoves.map((t) => (
                    <span key={`${t.fromHospital}-${t.toHospital}`} className={rows.main}>
                      <span className={rows.line2}>
                        {t.toHospital === hospitalId ? "In" : "Out"}: {fmtUnits(t.qty)} {unit(e.medicineId, t.qty)} {hospName(t.fromHospital)} →{" "}
                        {hospName(t.toHospital)}
                      </span>
                      <ChecksDisclosure checks={t.checksPassed} />
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div data-testid="hospital-panel-moves">
        <h3 className={`${rows.subhead} ${rows.label}`}>
          <span>Moves in / out {transfers.length}</span>
          {transfers.length > 0 ? (
            <button type="button" className={rows.outlineButton} onClick={openCart}>
              Review transfers ({results.transfers.length})
            </button>
          ) : null}
        </h3>
        {transfers.length === 0 && supplier.length === 0 ? (
          <p className={rows.empty}>No transfers or supplier orders for {name}.</p>
        ) : (
          <ul className={rows.rows}>
            {transfers.map((t) => (
              <TransferRow key={`${t.fromHospital}-${t.toHospital}-${t.medicineId}`} t={t} direction={t.toHospital === hospitalId ? "IN" : "OUT"} />
            ))}
            {supplier.map((o) => (
              <li key={o.medicineId} className={rows.row} data-testid={`supplier-order-row-${o.hospitalId}-${o.medicineId}`}>
                <span className={rows.tagCell}>
                  <Tag tone="outline">Supplier</Tag>
                </span>
                <span className={rows.main}>
                  <span className={rows.line1}>
                    <span className={rows.strong}>{medName(o.medicineId)}</span> {fmtUnits(o.qty)} {unit(o.medicineId, o.qty)}
                  </span>
                  <span className={rows.line2}>{o.reason}</span>
                  <SupplierTimeline order={o} />
                </span>
                <span className={rows.right}>lead {dShort(o.leadDays)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <RecentActivity hospitalId={hospitalId} bump={activityBump} />
    </div>
  );
}
