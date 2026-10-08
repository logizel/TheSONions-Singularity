/**
 * Typed mirror of theme/tokens.css (Phase 6, 06-UI-SPEC). Components style
 * through CSS Modules + the CSS variables; these raw values exist for code
 * that cannot read CSS variables (Leaflet path options, SVG markup built as
 * strings, matchMedia). theme/tokens.test.ts asserts both files agree.
 */
import type { Severity } from "../lib/contracts";

export const colors = {
  paper: "#F3EFE6",
  surface: "#FBF9F4",
  sunk: "#ECE7DB",
  ink: "#1C1B18",
  ink2: "#4D483F",
  ink3: "#6B6558",
  rule: "#D8D1C2",
  ruleStrong: "#B9B09D",
  accent: "#0B6B53",
  accentStrong: "#08533F",
  accentTint: "#DDEDE6",
  onAccent: "#FFFFFF",
  critical: "#B42318",
} as const;

/** CSS var name for each `colors` key. */
export const colorVars: Record<keyof typeof colors, string> = {
  paper: "--color-paper",
  surface: "--color-surface",
  sunk: "--color-sunk",
  ink: "--color-ink",
  ink2: "--color-ink-2",
  ink3: "--color-ink-3",
  rule: "--color-rule",
  ruleStrong: "--color-rule-strong",
  accent: "--color-accent",
  accentStrong: "--color-accent-strong",
  accentTint: "--color-accent-tint",
  onAccent: "--color-on-accent",
  critical: "--color-critical",
};

export type { Severity };

/** UI risk level; `warning` in the data is shown as "Low". */
export const riskLabel: Record<Severity, string> = {
  critical: "Critical",
  warning: "Low",
  ok: "OK",
};

export const risk: Record<Severity, { fill: string; text: string; tint: string }> = {
  critical: { fill: "#B42318", text: "#B42318", tint: "#FBE5E0" },
  warning: { fill: "#D99A1E", text: "#7A5100", tint: "#FAEFD4" },
  ok: { fill: "#5C6657", text: "#5C6657", tint: "#EAE7DF" },
};

/** CSS var prefix per severity: `${prefix}`, `${prefix}-text`, `${prefix}-tint`. */
export const riskVars: Record<Severity, string> = {
  critical: "--risk-critical",
  warning: "--risk-low",
  ok: "--risk-ok",
};

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 } as const;

export const radius = { 0: 0, 1: 2, 2: 4, 3: 8 } as const;

export const elevation = {
  1: "0 0 0 1px #B9B09D, 0 4px 12px rgba(28, 27, 24, 0.10)",
  2: "0 0 0 1px #B9B09D, 0 12px 32px rgba(28, 27, 24, 0.18)",
} as const;

export const z = {
  map: 0,
  mapUi: 5,
  panel: 10,
  topbar: 20,
  sheet: 30,
  chat: 40,
  menu: 50,
  toast: 60,
  skip: 70,
} as const;

export const motion = {
  fastMs: 120,
  sheetInMs: 240,
  sheetOutMs: 160,
  pulseMs: 2000,
  easeOut: "cubic-bezier(0.2, 0, 0, 1)",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

export const breakpoints = { md: 768, lg: 1024, xl: 1280, xxl: 1440 } as const;

export const layout = {
  topbarH: 56,
  /** Floating-surface inset: 16px from 768 px, 8px below. */
  inset: 16,
  insetXs: 8,
  /** Left panel width at md / lg / 2xl. */
  panelW: { md: 360, lg: 400, xxl: 440 },
  /** Right sheet width at xl / 2xl. */
  sheetW: { xl: 420, xxl: 440 },
  markerHit: 44,
  /** Floating chat panel width (>= 768 px). */
  chatW: 360,
  /** Bottom sheet snap heights (XS): peek px; half/full are viewport-relative. */
  sheetPeek: 144,
} as const;
