/**
 * Shared card primitives bound to theme/tokens.ts CSS variables.
 * All text renders through React default escaping (T-4-04).
 *
 * Redesigned (D-23-ext): elevated surfaces, layered shadows, pill badges
 * with leading status dots, gradient-fill Sparkline, shimmer skeletons.
 */
import type { CSSProperties, ReactNode } from "react";
import { badges, type RiskLevel } from "@/theme/tokens";

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({
  title,
  action,
  children,
  testId,
  hero = false,
  accentBar = false,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** Hero cards (Moves, Priorities) get an accent border treatment. */
  hero?: boolean;
  /** Show a coloured left accent bar for hero cards. */
  accentBar?: boolean;
  className?: string;
}) {
  const style: CSSProperties = hero
    ? {
        background: "var(--hero-surface)",
        border: "1px solid var(--hero-border)",
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--hero-shadow)",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
      }
    : {
        background: "var(--card-surface)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--card-shadow)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        transition: "box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      };

  if (hero) {
    return (
      <section
        data-testid={testId}
        style={style}
        className={className}
      >
        {/* Accent bar */}
        {accentBar && (
          <div
            aria-hidden="true"
            style={{
              height: 3,
              background: "linear-gradient(90deg, var(--hero-accent-bar), rgba(79, 110, 247, 0.4))",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <CardHeader title={title} action={action} />
          {children}
        </div>
      </section>
    );
  }

  return (
    <section data-testid={testId} style={style} className={className}>
      <CardHeader title={title} action={action} />
      {children}
    </section>
  );
}

function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────

/**
 * Modernized pill badge with a leading status dot.
 * Color semantics map 1-to-1 from tokens.ts badges record.
 */
export function Badge({
  level,
  children,
}: {
  level: RiskLevel;
  children: ReactNode;
}) {
  const token = badges[level];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: `var(--risk-${level}-bg, ${token.background})`,
        color: `var(--risk-${level}-text, ${token.text})`,
        border: `1px solid var(--risk-${level}-border, ${token.border})`,
        borderRadius: 999,
        padding: "2px 9px 2px 7px",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
      }}
    >
      {/* Leading status dot for color-blind safety */}
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: `var(--risk-${level}-dot, ${token.dot})`,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────────────

/**
 * Small inline SVG trend line with optional gradient area fill.
 * No chart library (D-02). Now supports an area gradient for visual richness.
 */
export function Sparkline({
  values,
  width = 80,
  height = 24,
  showArea = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  showArea?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (height - 3 - ((v - min) / span) * (height - 6)).toFixed(1);
    return { x, y };
  });
  const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const rising = values[values.length - 1] >= values[0];
  // Area fill path: close down to the baseline
  const areaPath = [
    `M ${pts[0].x},${pts[0].y}`,
    ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${pts[pts.length - 1].x},${height}`,
    `L ${pts[0].x},${height}`,
    "Z",
  ].join(" ");
  const lineColor = rising ? "#ef4444" : "#4f6ef7";
  const fillId = `spark-fill-${width}-${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={rising ? "trend rising" : "trend falling"}
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${fillId})`} />
        </>
      )}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── SkeletonCard ──────────────────────────────────────────────────────────

/** Skeleton placeholder with shimmer animation (D-25). */
export function SkeletonCard({ testId }: { testId?: string }) {
  return (
    <div
      data-testid={testId ?? "skeleton-card"}
      aria-busy="true"
      style={{
        background: "var(--card-surface)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--card-radius)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* Card title skeleton */}
      <div
        className="skeleton-shimmer"
        style={{ height: 16, width: "45%", borderRadius: 8 }}
      />
      {/* Row 1 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[72, 88, 60].map((w, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{
              height: 36,
              width: `${w}%`,
              borderRadius: 10,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── InteractiveRow ────────────────────────────────────────────────────────

/**
 * Wrapper that applies the standardized interactive row styles:
 * hover lift, focus ring, consistent padding.
 * Used as a thin style container — logic stays in card-specific buttons.
 */
export function RowButton({
  children,
  onClick,
  testId,
  selected = false,
  className,
  ariaPressed,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  testId?: string;
  selected?: boolean;
  className?: string;
  ariaPressed?: boolean;
  ariaLabel?: string;
}) {
  const baseStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left",
    background: selected
      ? "var(--accent-subtle)"
      : "transparent",
    border: selected
      ? "1px solid var(--accent)"
      : "1px solid transparent",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    transition:
      "transform 150ms cubic-bezier(0.16, 1, 0.3, 1), background 150ms, box-shadow 150ms",
    fontVariantNumeric: "tabular-nums",
    // Pseudo-hover handled via className="row-interactive"
  };

  return (
    <button
      data-testid={testId}
      type="button"
      onClick={onClick}
      style={baseStyle}
      className={`row-interactive${className ? ` ${className}` : ""}`}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

// ─── ActionButton ──────────────────────────────────────────────────────────

/** Styled inline action button (Approve / Order). */
export function ActionButton({
  children,
  onClick,
  testId,
  title,
  variant = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  testId?: string;
  title?: string;
  variant?: "default" | "primary" | "ghost";
}) {
  const styles: Record<string, CSSProperties> = {
    default: {
      background: "transparent",
      color: "var(--accent)",
      border: "1px solid var(--accent)",
      borderRadius: 8,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: "background 150ms, color 150ms",
      letterSpacing: "0.01em",
    },
    primary: {
      background: "var(--accent)",
      color: "#ffffff",
      border: "1px solid var(--accent)",
      borderRadius: 8,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: "background 150ms",
      letterSpacing: "0.01em",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-muted)",
      border: "1px solid transparent",
      borderRadius: 8,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 500,
      cursor: "default",
      whiteSpace: "nowrap",
    },
  };

  return (
    <button
      data-testid={testId}
      type="button"
      onClick={onClick ?? (() => {})}
      title={title}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

// ─── SectionLabel ──────────────────────────────────────────────────────────

/** Small section divider label used inside cards and panels. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        padding: "4px 0 2px",
        borderBottom: "1px solid var(--card-border)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
