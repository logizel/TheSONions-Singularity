/**
 * P1 theme tokens — final say: P1 UI principal (Phase 4, per Phase 1 D-23).
 * Single source of truth for dashboard surfaces, risk badges, spacing.
 * Components bind to these tokens via inline styles; globals.css mirrors
 * the page background / font for the document shell only.
 */

export const colors = {
  pageBackground: "#f4f6fa",
  cardSurface: "#ffffff",
  cardBorder: "#e2e8f0",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  outbreak: "#dc2626",
} as const;

export type RiskLevel = "critical" | "warning" | "ok" | "neutral" | "advisory";

export const badges: Record<
  RiskLevel,
  { background: string; text: string; border: string; label: string }
> = {
  critical: {
    background: "#fee2e2",
    text: "#b91c1c",
    border: "#fecaca",
    label: "critical",
  },
  warning: {
    background: "#fef3c7",
    text: "#b45309",
    border: "#fde68a",
    label: "low",
  },
  ok: {
    background: "#dcfce7",
    text: "#15803d",
    border: "#bbf7d0",
    label: "ok",
  },
  neutral: {
    background: "#f1f5f9",
    text: "#475569",
    border: "#e2e8f0",
    label: "info",
  },
  advisory: {
    background: "#e2e8f0",
    text: "#64748b",
    border: "#cbd5e1",
    label: "advisory",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const surfaces = {
  cardRadius: 12,
  cardShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  cardPadding: 16,
} as const;

export const layout = {
  /** Full 6-card grid at 1280px and above, vertical stack below (D-03). */
  desktopBreakpointPx: 1280,
  maxWidthPx: 1440,
} as const;

/**
 * Map days-until-stockout to a badge level.
 * red when at/below the supplier lead time, amber inside the buffer window.
 */
export function riskForDaysToStockout(
  daysToStockout: number,
  leadDays: number,
  bufferDays: number,
): RiskLevel {
  if (daysToStockout <= leadDays) return "critical";
  if (daysToStockout <= leadDays + bufferDays) return "warning";
  return "ok";
}
