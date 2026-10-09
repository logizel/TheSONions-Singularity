"use client";

/** One hospital's charts with plain-language explanations (/insights/[id]). */
import Link from "next/link";
import { useState } from "react";

import {
  coverSentence,
  demandSentences,
  hospitalSummary,
  niceDate,
  prioritySentences,
  runDownSentences,
  unitWord,
} from "@/lib/insights/explain";
import type { HospitalInsight } from "@/lib/insights/view";
import { riskLabel } from "@/theme/tokens";
import { RiskGlyph } from "../icons/Glyph";
import { OutbreakTag, RiskTag } from "../ui/Tag";
import { CoverChart, DemandChart, FactorBars, RunDownChart } from "./charts";
import styles from "./insights.module.css";

function Explain({ lines }: { lines: string[] }) {
  return (
    <div className={styles.explain}>
      <p className={styles.explainKicker}>In plain words</p>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

export function HospitalInsights({
  h,
  hospitalNames,
  canSeeAll,
}: {
  h: HospitalInsight;
  hospitalNames: Record<string, string>;
  canSeeAll: boolean;
}) {
  const [medId, setMedId] = useState(h.medicines[0]?.medicineId ?? "");
  const m = h.medicines.find((x) => x.medicineId === medId) ?? h.medicines[0];
  const hName = (id: string) => hospitalNames[id] ?? id;
  const medName = (id: string) => h.medicines.find((x) => x.medicineId === id)?.name ?? id;
  const top = h.priorities[0];
  const crit = h.medicines.filter((x) => x.severity === "critical").length;
  const unit = m ? unitWord(m.baseUnit, 2) : "units";

  return (
    <main className={styles.page} data-testid="insights-hospital">
      <nav className={styles.crumbs}>
        <Link href="/">← Map</Link>
        {canSeeAll ? <Link href="/insights">All hospitals</Link> : null}
      </nav>

      <header className={styles.head}>
        <p className={styles.kicker}>Insights · as of {niceDate(h.asOf)}</p>
        <h1 className={styles.h1}>{h.name}</h1>
        <div className={styles.tags}>
          <RiskTag severity={h.level} />
          {h.summary?.outbreak ? <OutbreakTag /> : null}
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>Patients a day</dt>
            <dd>{h.summary?.patientLoad ?? "—"}</dd>
          </div>
          <div>
            <dt>Emergency share</dt>
            <dd>{h.summary ? `${h.summary.emergencyPct}%` : "—"}</dd>
          </div>
          <div>
            <dt>Medicines at risk</dt>
            <dd>
              {crit} of {h.medicines.length}
            </dd>
          </div>
          <div>
            <dt>Network priority</dt>
            <dd>{top ? `#${top.rank}` : "—"}</dd>
          </div>
        </dl>
        <div className={styles.summary}>
          {hospitalSummary(h).map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      </header>

      <section className={styles.section} aria-labelledby="cover-h">
        <div className={styles.sectionHead}>
          <h2 id="cover-h" className={styles.h2}>
            How long each medicine lasts
          </h2>
          <p className={styles.sub}>Days of stock at the current forecast, against how long a supplier order takes. Click a medicine to see its charts below.</p>
        </div>
        <div className={styles.split}>
          <CoverChart
            rows={h.medicines.map((x) => ({ id: x.medicineId, name: x.name, days: x.daysUntilStockout, leadDays: x.leadDays, bufferDays: x.bufferDays, severity: x.severity }))}
            selected={m?.medicineId}
            onSelect={setMedId}
          />
          <Explain lines={h.medicines.map(coverSentence)} />
        </div>
      </section>

      {m ? (
        <>
          <div className={styles.medTabs} role="tablist" aria-label="Medicine">
            {h.medicines.map((x) => (
              <button
                key={x.medicineId}
                type="button"
                role="tab"
                aria-selected={x.medicineId === m.medicineId}
                className={styles.medTab}
                onClick={() => setMedId(x.medicineId)}
                data-testid={`insights-med-${x.medicineId}`}
              >
                <RiskGlyph severity={x.severity} />
                {x.name}
                <span className="sr-only">, {riskLabel[x.severity]}</span>
              </button>
            ))}
          </div>

          <section className={styles.section} aria-labelledby="demand-h">
            <div className={styles.sectionHead}>
              <h2 id="demand-h" className={styles.h2}>
                {m.name}: daily use and forecast
              </h2>
              <p className={styles.sub}>
                Recorded use for the last {m.history.length || 60} days, then the engine&apos;s forecast for the next 30. Hover for exact numbers.
              </p>
            </div>
            <div className={styles.split}>
              {h.historyAvailable || m.forecast.length ? (
                <DemandChart history={m.history} forecast={m.forecast} asOf={h.asOf} advisoryFromDay={h.advisoryFromDay} unit={unit} />
              ) : (
                <p className={styles.note}>Usage history is unavailable right now.</p>
              )}
              <Explain lines={demandSentences(m, h.name)} />
            </div>
          </section>

          <section className={styles.section} aria-labelledby="rundown-h">
            <div className={styles.sectionHead}>
              <h2 id="rundown-h" className={styles.h2}>
                {m.name}: stock running down
              </h2>
              <p className={styles.sub}>What is left at the end of each day if nothing new arrives, and when help could get here.</p>
            </div>
            <div className={styles.split}>
              <RunDownChart
                points={m.runDown}
                asOf={h.asOf}
                stockoutDay={m.daysUntilStockout}
                leadDays={m.leadDays}
                transferDays={m.transfersIn[0]?.transportDays ?? null}
                unit={unit}
              />
              <Explain lines={runDownSentences(m, h.asOf, hName)} />
            </div>
          </section>
        </>
      ) : null}

      <section className={styles.section} aria-labelledby="prio-h">
        <div className={styles.sectionHead}>
          <h2 id="prio-h" className={styles.h2}>
            Why this hospital is {top ? `#${top.rank}` : "not ranked"} on the attention list
          </h2>
          <p className={styles.sub}>The priority score adds up how soon stock runs out, how many patients are emergencies, how busy the hospital is, and subtracts a little if a substitute exists.</p>
        </div>
        <div className={styles.split}>
          {top ? <FactorBars factors={top.factors as unknown as Record<string, number>} /> : <p className={styles.note}>No ranked positions.</p>}
          <Explain lines={prioritySentences(h, medName)} />
        </div>
      </section>
    </main>
  );
}
