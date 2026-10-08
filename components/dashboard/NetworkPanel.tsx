"use client";

import { useRef } from "react";

import { type ScopedResults, type TabKey, TAB_KEYS, tabFigures } from "@/lib/dashboard/panel";
import { RiskGlyph } from "../icons/Glyph";
import { LocalTime } from "../ui/LocalTime";
import { useDash } from "./context";
import styles from "./panel.module.css";
import rows from "./rows.module.css";
import { SECTION } from "./sections";

/**
 * Network panel (`dashboard-grid`): banners, then a 3x2 counter board that
 * is the WAI-ARIA tab list, then one dense section. Replaces the six
 * identical cards of phase 4.
 */
export function NetworkPanel({
  scoped,
  tab,
  onTab,
  onClearFilter,
  source,
  onRetry,
}: {
  scoped: ScopedResults;
  tab: TabKey;
  onTab: (k: TabKey) => void;
  onClearFilter: () => void;
  source: "live" | "snapshot";
  onRetry: () => void;
}) {
  const { results, selectedId, hospName } = useDash();
  const figures = tabFigures(results, scoped);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const outbreaks = results.hospitals.filter((h) => h.outbreak);

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    const n = TAB_KEYS.length;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    const key = TAB_KEYS[next];
    onTab(key);
    tabRefs.current[key]?.focus();
  };

  const Section = SECTION[tab];

  return (
    <div className={styles.root} data-testid="dashboard-grid">
      <div className={styles.header}>
        {outbreaks.length > 0 ? (
          <div className={`${rows.banner} ${rows.bannerInk}`} data-testid="outbreak-banner" role="note">
            <span>
              Outbreak at {outbreaks.map((h) => h.hospitalName).join(", ")}. Forecasts there use the last 7 days&apos; trend.
            </span>
          </div>
        ) : null}
        {selectedId ? (
          <div className={`${rows.banner} ${rows.bannerPlain}`} data-testid="filter-banner">
            <span>
              Filtered to <span className={rows.strong}>{hospName(selectedId)}</span>
            </span>
            <button type="button" className={rows.linkButton} onClick={onClearFilter} data-testid="clear-filter">
              Clear
            </button>
          </div>
        ) : null}
        {source === "snapshot" ? (
          <div className={`${rows.banner} ${rows.bannerSunk}`} data-testid="snapshot-banner">
            <span>
              Showing the saved snapshot from <LocalTime iso={results.generatedAt} format="datetime" />. Live database unreachable.
            </span>
            <button type="button" className={rows.linkButton} onClick={onRetry}>
              Retry live
            </button>
          </div>
        ) : null}
        <div className={styles.board} role="tablist" aria-label="Network results" id="panel-tabs">
          {figures.map((f, i) => (
            <button
              key={f.key}
              ref={(el) => {
                tabRefs.current[f.key] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${f.key}`}
              aria-selected={tab === f.key}
              aria-controls="panel-section"
              aria-label={f.ariaLabel}
              tabIndex={tab === f.key ? 0 : -1}
              className={styles.cell}
              onClick={() => onTab(f.key)}
              onKeyDown={(e) => onKey(e, i)}
              data-testid={`panel-tab-${f.key}`}
            >
              <span className={styles.cellLabel}>{f.label}</span>
              <span className={`${styles.cellFigure} ${f.zero ? styles.zero : ""}`}>{f.figure}</span>
              {f.critical ? (
                <span className={styles.cellGlyph}>
                  <RiskGlyph severity="critical" size={14} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.body} role="tabpanel" id="panel-section" aria-labelledby={`tab-${tab}`} data-testid={`panel-section-${tab}`} tabIndex={0}>
        <Section s={scoped} />
      </div>
    </div>
  );
}
