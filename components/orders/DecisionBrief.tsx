"use client";

/**
 * Order decision brief: what an administrator needs to approve one line.
 * Receiver situation, sender situation (transfers only), stock-out without
 * vs with the order, and the demand trend. Engine numbers are shown as
 * given; derived numbers (lib/orders/brief.ts) are labelled "about"/"≈".
 * Read-only: the brief adds no actions.
 */
import { useId, useMemo, useState } from "react";

import { fmtUnits } from "@/lib/dashboard/view";
import { niceDate } from "@/lib/insights/explain";
import type { OrderStatus } from "@/lib/orders";
import { buildDecisionBrief, type BriefInput } from "@/lib/orders/brief";
import { riskLabel } from "@/theme/tokens";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { Glyph, RiskGlyph } from "../icons/Glyph";
import { DemandChart } from "../insights/charts";
import { Tag } from "../ui/Tag";
import { days } from "./OrderBits";
import styles from "./orders.module.css";

export function DecisionBriefBlock({ input, status, testId }: { input: BriefInput; status?: OrderStatus | "suggested"; testId: string }) {
  const { results, medName, hospName, unit } = useDash();
  const [open, setOpen] = useState(true);
  const id = useId();
  const { kind, fromHospital, toHospital, medicineId, qty, arriveDays } = input;
  const b = useMemo(
    () => buildDecisionBrief(results, { kind, fromHospital, toHospital, medicineId, qty, arriveDays }),
    [results, kind, fromHospital, toHospital, medicineId, qty, arriveDays],
  );
  const delivered = status === "delivered";
  const u = (n: number) => unit(input.medicineId, n);
  const rc = b.receiver;
  const s = b.sender;

  return (
    <div className={styles.brief} data-testid={testId}>
      <button
        type="button"
        className={rows.disclosure}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        data-testid={`${testId}-toggle`}
      >
        <Glyph name={open ? "chevron-up" : "chevron-down"} size={12} />
        Decision brief
      </button>
      {open ? (
        <div id={id} className={styles.briefBody}>
          {rc === null ? (
            <p className={rows.caption}>No stock record for this medicine at {hospName(input.toHospital)}.</p>
          ) : (
            <>
              <div className={styles.briefGrid}>
                <div className={styles.briefCol} data-testid="brief-receiver">
                  <p className={rows.label}>Receiver · {hospName(rc.hospitalId)}</p>
                  <dl className={styles.briefDl}>
                    <dt>Stock</dt>
                    <dd>
                      {fmtUnits(rc.stock)} {u(rc.stock)}
                    </dd>
                    <dt>Daily use</dt>
                    <dd>
                      {fmtUnits(rc.dailyDemand)} {u(2)} a day
                    </dd>
                    <dt>Runs out in</dt>
                    <dd>{days(rc.daysUntilStockout)}</dd>
                    <dt>Needs</dt>
                    <dd>
                      lead {rc.leadDays} + buffer {rc.bufferDays} = {rc.needDays} days
                    </dd>
                    <dt>Severity</dt>
                    <dd className={styles.briefSev}>
                      <RiskGlyph severity={rc.severity} /> {riskLabel[rc.severity]}
                    </dd>
                    <dt>Priority</dt>
                    <dd>{rc.priority ? `#${rc.priority.rank} of ${rc.priority.of} · score ${rc.priority.score}` : "Not ranked"}</dd>
                  </dl>
                  {rc.priority && rc.priority.reasons.length > 0 ? (
                    <ul className={styles.briefList} aria-label="Priority reasons">
                      {rc.priority.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {rc.eventReasons.length > 0 ? (
                    <ul className={styles.briefList} aria-label="Local event reasons">
                      {rc.eventReasons.map((r) => (
                        <li key={r}>Local event: {r}</li>
                      ))}
                    </ul>
                  ) : null}
                  {rc.outbreak ? (
                    <span>
                      <Tag tone="ink">
                        <Glyph name="outbreak" size={12} /> Outbreak trend
                      </Tag>
                    </span>
                  ) : null}
                </div>

                {input.kind === "transfer" && input.fromHospital ? (
                  <div className={styles.briefCol} data-testid="brief-sender">
                    <p className={rows.label}>Sender · {hospName(input.fromHospital)}</p>
                    {s === null ? (
                      <p className={rows.caption}>No stock record for this medicine at {hospName(input.fromHospital)}.</p>
                    ) : (
                      <dl className={styles.briefDl}>
                        <dt>Stock now</dt>
                        <dd>
                          {fmtUnits(s.stockNow)} {u(s.stockNow)}
                        </dd>
                        {!delivered ? (
                          <>
                            <dt>After sending</dt>
                            <dd>
                              about {fmtUnits(s.stockAfter)} {u(s.stockAfter)}
                            </dd>
                            <dt>Cover after</dt>
                            <dd>{s.coverDaysAfter === null ? "not available" : `about ${days(s.coverDaysAfter)}`}</dd>
                          </>
                        ) : null}
                        <dt>Nearest expiry</dt>
                        <dd>{s.nearestExpiry ? niceDate(s.nearestExpiry) : "no stock"}</dd>
                        <dt>Expires unused</dt>
                        <dd>
                          {s.wasteUnits > 0 ? (
                            <>
                              {fmtUnits(s.wasteUnits)} {u(s.wasteUnits)}
                              {s.wasteExpiry ? ` by ${niceDate(s.wasteExpiry)}` : ""}
                              {!delivered ? <span className={styles.blockLine}>about {fmtUnits(s.wasteAfter)} after this transfer</span> : null}
                            </>
                          ) : (
                            "none forecast"
                          )}
                        </dd>
                      </dl>
                    )}
                  </div>
                ) : null}
              </div>

              {delivered ? (
                <p className={rows.caption} data-testid="brief-without-with">
                  Delivered. The figures above already include these units.
                </p>
              ) : (
                <div className={styles.briefLine} data-testid="brief-without-with">
                  <p>
                    <span className={rows.strong}>Without this order:</span>{" "}
                    {b.without.day !== null && b.without.date ? `runs out ${niceDate(b.without.date)} (day ${b.without.day})` : `no stock-out within ${b.horizon} days`}
                    {" · "}
                    <span className={rows.strong}>
                      With it ({input.kind === "supplier" ? `supplier lead time ${days(b.arriveDays)}` : `arrives in ${days(b.arriveDays)}`}):
                    </span>{" "}
                    {b.with.day !== null && b.with.date
                      ? `runs out about ${niceDate(b.with.date)} (day ≈${b.with.day})`
                      : b.with.lastsPast
                        ? `lasts past ${niceDate(b.with.lastsPast)}`
                        : "not available"}
                  </p>
                  {b.with.gapDays > 0 ? (
                    <p className={styles.briefGap} data-testid="brief-gap">
                      <RiskGlyph severity="critical" /> About {days(b.with.gapDays)} with no stock before it arrives.
                    </p>
                  ) : null}
                </div>
              )}

              <div data-testid="brief-chart">
                <DemandChart
                  history={rc.trend}
                  forecast={rc.forecast}
                  asOf={b.asOf}
                  advisoryFromDay={b.advisoryFromDay}
                  unit={u(2)}
                  pastLabel="Last 7 days"
                  height={180}
                />
              </div>
            </>
          )}
          <a className={rows.linkButton} href={`/insights/${input.toHospital}`} data-testid="brief-insights-link">
            Full insights for {hospName(input.toHospital)}
          </a>
          <span className="sr-only">{`Decision brief for ${medName(input.medicineId)}.`}</span>
        </div>
      ) : null}
    </div>
  );
}
