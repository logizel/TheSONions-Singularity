/** Network admin overview: one card per hospital, worst first (/insights). */
import Link from "next/link";

import { cardSentence, networkSummary } from "@/lib/insights/explain";
import type { HospitalCard } from "@/lib/insights/view";
import { OutbreakTag, RiskTag } from "../ui/Tag";
import { MiniCover } from "./charts";
import styles from "./insights.module.css";

export function InsightsGrid({ cards, asOf }: { cards: HospitalCard[]; asOf: string }) {
  const crit = cards.filter((c) => c.level === "critical").length;
  const low = cards.filter((c) => c.level === "warning").length;
  return (
    <main className={styles.page} data-testid="insights-grid">
      <nav className={styles.crumbs}>
        <a href="/">← Map</a>
      </nav>
      <header className={styles.head}>
        <p className={styles.kicker}>Insights · all hospitals · as of {asOf}</p>
        <h1 className={styles.h1}>Network at a glance</h1>
        <dl className={styles.stats}>
          <div>
            <dt>Hospitals</dt>
            <dd>{cards.length}</dd>
          </div>
          <div>
            <dt>Critical</dt>
            <dd>{crit}</dd>
          </div>
          <div>
            <dt>Low</dt>
            <dd>{low}</dd>
          </div>
          <div>
            <dt>Transfers lined up</dt>
            <dd>{cards.reduce((s, c) => s + c.transfersIn, 0)}</dd>
          </div>
        </dl>
        <div className={styles.summary}>
          <p>{networkSummary(cards)}</p>
          <p className={styles.sub}>Each bar is one medicine: how many days its stock lasts (colour and symbol show risk). The black tick is the supplier lead time; a bar that stops before the tick runs out first.</p>
        </div>
      </header>
      <ul className={styles.cardGrid}>
        {cards.map((c) => (
          <li key={c.hospitalId}>
            <Link href={`/insights/${c.hospitalId}`} className={`${styles.card} ${styles[`card_${c.level}`]}`} data-testid={`insights-card-${c.hospitalId}`}>
              <span className={styles.cardTop}>
                <span className={styles.cardName}>{c.name}</span>
                <span className={styles.cardRank}>{c.topRank ? `#${c.topRank}` : ""}</span>
              </span>
              <span className={styles.tags}>
                <RiskTag severity={c.level} />
                {c.outbreak ? <OutbreakTag /> : null}
              </span>
              <MiniCover rows={c.cover} />
              <span className={styles.cardMeds}>
                {c.cover.map((r) => (
                  <span key={r.name}>{r.name}</span>
                ))}
              </span>
              <span className={styles.cardText}>{cardSentence(c)}</span>
              <span className={styles.cardFoot}>
                {c.critical} critical · {c.low} low · {c.transfersIn} in · {c.transfersOut} out
                <span className={styles.cardCta}>Open charts →</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
