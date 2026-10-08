"use client";

import { Glyph } from "../icons/Glyph";
import rows from "./rows.module.css";

/** Sticky sheet header: heading (focus target on open), Back and Close. */
export function SheetHeader({
  title,
  onClose,
  onBack,
  backLabel = "Back",
  closeLabel,
  closeTestId,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  closeLabel: string;
  closeTestId?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={rows.sheetHead}>
      <div className={rows.sheetHeadTop}>
        <h2 className={rows.heading} id="detail-heading" tabIndex={-1}>
          {title}
        </h2>
        <div className={rows.headButtons}>
          {onBack ? (
            <button type="button" className={rows.iconButton} onClick={onBack} data-testid="sheet-back">
              <Glyph name="back" />
              {backLabel}
            </button>
          ) : null}
          <button type="button" className={rows.iconButton} onClick={onClose} aria-label={closeLabel} data-testid={closeTestId}>
            <Glyph name="close" />
          </button>
        </div>
      </div>
      {children}
    </header>
  );
}
