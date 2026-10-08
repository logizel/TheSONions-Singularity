/**
 * In-repo glyphs (06-UI-SPEC): 16px grid, 1.5px stroke, currentColor.
 * No emoji, no icon library. Decorative by default (aria-hidden); pass a
 * `title` only when the glyph is the sole label.
 */
import type { Severity } from "@/lib/contracts";

export type GlyphName =
  | "refresh"
  | "close"
  | "back"
  | "chat"
  | "menu"
  | "check"
  | "outbreak"
  | "arrow"
  | "chevron-down"
  | "chevron-up"
  | "map"
  | "list"
  | "key";

const PATHS: Record<GlyphName, React.ReactNode> = {
  refresh: (
    <>
      <path d="M13 8a5 5 0 1 1-1.46-3.54" />
      <path d="M13 2.5v3h-3" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  back: <path d="M10 3L5 8l5 5" />,
  chat: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  check: <path d="M3 8.5l3 3 7-7" />,
  outbreak: (
    <>
      <circle cx="8" cy="8" r="2" />
      <circle cx="8" cy="8" r="5.5" />
    </>
  ),
  arrow: <path d="M2.5 8h10M9 4.5L12.5 8 9 11.5" />,
  "chevron-down": <path d="M4 6l4 4 4-4" />,
  "chevron-up": <path d="M4 10l4-4 4 4" />,
  map: <path d="M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5zM6 2.5v9.5M10 4v9.5" />,
  list: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.5M2.5 8h.5M2.5 12h.5" />,
  key: (
    <>
      <path d="M2.5 4.5h3M2.5 8h3M2.5 11.5h3" />
      <path d="M8 4.5h5.5M8 8h5.5M8 11.5h5.5" />
    </>
  ),
};

export function Glyph({ name, size = 16, title }: { name: GlyphName; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

/** Risk shape: Critical = filled diamond + "!", Low = filled triangle + "!", OK = hollow ring. */
export function RiskGlyph({ severity, size = 12 }: { severity: Severity; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {severity === "critical" ? (
        <>
          <path d="M8 0.8L15.2 8 8 15.2 0.8 8z" fill="var(--risk-critical)" stroke="var(--color-ink)" strokeWidth={1.2} />
          <path d="M8 4.5v4.2M8 10.8v.6" stroke="var(--color-surface)" strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : severity === "warning" ? (
        <>
          <path d="M8 1.2L15.2 14.6H0.8z" fill="var(--risk-low)" stroke="var(--color-ink)" strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M8 6v4M8 12.2v.4" stroke="var(--color-ink)" strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="5.6" fill="var(--color-surface)" stroke="var(--risk-ok)" strokeWidth={2.6} />
      )}
    </svg>
  );
}
