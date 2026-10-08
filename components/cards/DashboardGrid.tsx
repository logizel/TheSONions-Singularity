/**
 * Asymmetric 6-card dashboard grid (D-01, D-03, D-23-ext redesign).
 *
 * Layout strategy (desktop-first):
 * ≥1280px: 3-column grid with action cards (Moves + Priorities) spanning
 *           the full bottom row at 1.5× visual weight — hero prominence.
 *           Supporting cards (Inventory, Forecast, Shortage, Expiry) sit
 *           above in a tighter 3-col arrangement.
 * 1024–1279px: 2 columns, stagger wraps, action cards remain prominent.
 * <1024px: single column, cards stack gracefully.
 *
 * Card order: [inventory, forecast, shortage, expiry, moves, priorities]
 * Index 4 = Moves (hero), Index 5 = Priorities (hero).
 */
import type { ReactNode } from "react";
import styles from "./DashboardGrid.module.css";

export function DashboardGrid({ cards }: { cards: ReactNode[] }) {
  return (
    <div data-testid="dashboard-grid" className={styles.grid}>
      {/* Supporting cards row: Inventory, Forecast, Shortage, Expiry */}
      <div className={styles.supportRow}>
        {cards.slice(0, 4).map((card, i) => (
          <div key={i} className={styles.cell}>
            {card}
          </div>
        ))}
      </div>

      {/* Hero action cards row: Moves + Priorities — full width, emphasized */}
      <div className={styles.heroRow}>
        {cards.slice(4, 6).map((card, i) => (
          <div key={i} className={styles.heroCell}>
            {card}
          </div>
        ))}
      </div>
    </div>
  );
}
