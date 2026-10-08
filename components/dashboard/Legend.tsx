"use client";

import { useState } from "react";

import { RiskGlyph } from "../icons/Glyph";
import styles from "./dashboard.module.css";

/** Map key (`map-legend`). Collapses behind a "Key" button on XS. */
export function Legend({
  missing,
  showTransfers,
  showRoutes,
  showVehicle,
  compact,
}: {
  missing: number;
  showTransfers: boolean;
  showRoutes: boolean;
  showVehicle: boolean;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (compact && !open) {
    return (
      <button type="button" className={`${styles.outlineButton} ${styles.legendKey}`} onClick={() => setOpen(true)} aria-expanded={false}>
        Key
      </button>
    );
  }
  return (
    <aside className={styles.legend} data-testid="map-legend" aria-label="Map key">
      <ul className={styles.legendList}>
        <li className={styles.legendItem}>
          <RiskGlyph severity="critical" size={14} /> Critical
        </li>
        <li className={styles.legendItem}>
          <RiskGlyph severity="warning" size={14} /> Low
        </li>
        <li className={styles.legendItem}>
          <RiskGlyph severity="ok" size={14} /> OK
        </li>
        <li className={styles.legendItem}>
          <span className={styles.swatchOutbreak} /> Outbreak
        </li>
        <li className={styles.legendItem}>
          <span className={styles.swatchSelected} /> Selected
        </li>
        {showTransfers ? (
          <li className={styles.legendItem}>
            <span className={styles.swatchDash} /> Planned transfer (straight line, not a road)
          </li>
        ) : null}
        {showRoutes ? (
          <>
            <li className={styles.legendItem}>
              <span className={styles.swatchLine} /> Route
            </li>
            <li className={styles.legendItem}>
              <span className={styles.swatchAccentDash} /> Straight-line estimate
            </li>
          </>
        ) : null}
        {showVehicle ? (
          <li className={styles.legendItem}>
            <span className={styles.swatchVehicle} /> Simulated vehicle
          </li>
        ) : null}
      </ul>
      <p className={styles.legendFoot}>
        Hospital positions are fictional demo points in Mangaluru.
        {missing > 0 ? ` ${missing} hospital${missing === 1 ? "" : "s"} not on the map (no position). See List.` : ""}
      </p>
      {compact ? (
        <button type="button" className={styles.outlineButton} onClick={() => setOpen(false)}>
          Hide key
        </button>
      ) : null}
    </aside>
  );
}
