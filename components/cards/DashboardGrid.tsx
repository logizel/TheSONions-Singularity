/**
 * Equal 6-card grid (D-01, D-03): three columns at 1280px and above,
 * vertical stack with scroll on smaller windows.
 * Pure layout — every card renders from props passed by app/page.tsx.
 */
import type { CSSProperties, ReactNode } from "react";
import styles from "./DashboardGrid.module.css";

export function DashboardGrid({ cards }: { cards: ReactNode[] }) {
  return (
    <div data-testid="dashboard-grid" className={styles.grid}>
      {cards.map((card, i) => (
        <div key={i} style={fillStyle}>
          {card}
        </div>
      ))}
    </div>
  );
}

const fillStyle: CSSProperties = { minWidth: 0, display: "flex", flexDirection: "column" };
