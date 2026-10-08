// Placeholder theme tokens (D-23). P1 (Likith) finalizes the theme in Phase 4 —
// no theme debates in other tracks' work. Unstyled Phase 1 pages use spacing only.
export const tokens = {
  colors: {
    background: "#ffffff",
    foreground: "#111111",
    muted: "#f5f5f5",
    danger: "#b42318",
    warning: "#b54708",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;

export type Tokens = typeof tokens;
