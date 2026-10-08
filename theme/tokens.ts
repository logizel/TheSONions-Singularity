/**
 * P1 theme tokens — final say: P1 UI principal (Phase 4, per Phase 1 D-23).
 * Single source of truth for dashboard surfaces, risk badges, spacing.
 * Components bind to these tokens via inline styles; globals.css mirrors
 * the page background / font for the document shell only.
 *
 * Extended in redesign (D-23-ext): elevation, typography scale, dark mode
 * surfaces, motion durations — all wired as CSS variables in globals.css
 * and available via the Tailwind theme extension.
 */

// ─── Light-mode surfaces ───────────────────────────────────────────────────
export const colors = {
  pageBackground: "#f0f2f7",
  cardSurface: "#ffffff",
  cardBorder: "rgba(15, 23, 42, 0.06)",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  accent: "#4f6ef7",           // refined indigo-blue family
  accentHover: "#3d5ce8",
  accentSubtle: "#eef1fe",
  outbreak: "#dc2626",
  // Semantic surfaces for hero action cards
  heroSurface: "#ffffff",
  heroBorder: "rgba(79, 110, 247, 0.15)",
  heroAccentBar: "#4f6ef7",
} as const;

// ─── Dark-mode overrides (applied via .dark class strategy) ───────────────
export const darkColors = {
  pageBackground: "#0d1117",
  cardSurface: "#161b22",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  textPrimary: "#e6edf3",
  textSecondary: "#8b949e",
  textMuted: "#484f58",
  accent: "#6e8efb",
  accentHover: "#5a7bf0",
  accentSubtle: "#1c2340",
  outbreak: "#f87171",
  heroSurface: "#1a2035",
  heroBorder: "rgba(110, 142, 251, 0.2)",
  heroAccentBar: "#6e8efb",
} as const;

// ─── Risk badge tokens ─────────────────────────────────────────────────────
export type RiskLevel = "critical" | "warning" | "ok" | "neutral" | "advisory";

export const badges: Record<
  RiskLevel,
  { background: string; text: string; border: string; label: string; dot: string }
> = {
  critical: {
    background: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    dot: "#ef4444",
    label: "critical",
  },
  warning: {
    background: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "low",
  },
  ok: {
    background: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "ok",
  },
  neutral: {
    background: "#f1f5f9",
    text: "#475569",
    border: "#e2e8f0",
    dot: "#94a3b8",
    label: "info",
  },
  advisory: {
    background: "#f8fafc",
    text: "#64748b",
    border: "#e2e8f0",
    dot: "#94a3b8",
    label: "advisory",
  },
} as const;

// ─── Spacing scale ─────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ─── Elevation / surface geometry ─────────────────────────────────────────
export const surfaces = {
  cardRadius: 16,
  cardShadow:
    "0 1px 2px rgba(2, 6, 23, 0.04), 0 8px 24px rgba(2, 6, 23, 0.06)",
  cardShadowHover:
    "0 2px 4px rgba(2, 6, 23, 0.06), 0 16px 40px rgba(2, 6, 23, 0.10)",
  heroCardShadow:
    "0 1px 2px rgba(2, 6, 23, 0.04), 0 12px 32px rgba(79, 110, 247, 0.10)",
  chatShadow:
    "0 8px 32px rgba(2, 6, 23, 0.16), 0 2px 8px rgba(2, 6, 23, 0.08)",
  panelShadow:
    "-4px 0 32px rgba(2, 6, 23, 0.12)",
  cardPadding: 20,
} as const;

// ─── Typography scale (px) ─────────────────────────────────────────────────
export const type = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  h1: 26,
} as const;

// ─── Layout breakpoints ────────────────────────────────────────────────────
export const layout = {
  /** Full 6-card asymmetric grid at 1280px and above (D-03). */
  desktopBreakpointPx: 1280,
  /** Two-column responsive at 1024–1279 */
  tabletBreakpointPx: 1024,
  maxWidthPx: 1440,
  panelWidthPx: 440,
} as const;

// ─── Motion durations ──────────────────────────────────────────────────────
export const motion = {
  fast: "150ms",
  base: "200ms",
  slow: "280ms",
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
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
