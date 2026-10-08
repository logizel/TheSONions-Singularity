/**
 * Shared card primitives bound to theme/tokens.ts.
 * All text renders through React default escaping (T-4-04).
 */
import { badges, colors, spacing, surfaces, type RiskLevel } from "@/theme/tokens";

export function Card({
  title,
  action,
  children,
  testId,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      style={{
        background: colors.cardSurface,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: surfaces.cardRadius,
        boxShadow: surfaces.cardShadow,
        padding: surfaces.cardPadding,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 650,
            color: colors.textPrimary,
          }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  level,
  children,
}: {
  level: RiskLevel;
  children: React.ReactNode;
}) {
  const token = badges[level];
  return (
    <span
      style={{
        display: "inline-block",
        background: token.background,
        color: token.text,
        border: `1px solid ${token.border}`,
        borderRadius: 999,
        padding: "1px 8px",
        fontSize: 11,
        fontWeight: 650,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** Small inline SVG trend line — no chart library, no heavy per-card charts (D-02). */
export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (height - 3 - ((v - min) / span) * (height - 6)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={rising ? "trend rising" : "trend falling"}
    >
      <polyline
        points={points}
        fill="none"
        stroke={rising ? "#dc2626" : "#2563eb"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Skeleton placeholder shown while the dashboard mounts (D-25). */
export function SkeletonCard({ testId }: { testId?: string }) {
  return (
    <div
      data-testid={testId ?? "skeleton-card"}
      aria-busy="true"
      style={{
        background: colors.cardSurface,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: surfaces.cardRadius,
        padding: surfaces.cardPadding,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <div
        style={{
          height: 16,
          width: "55%",
          borderRadius: 6,
          background: "#e2e8f0",
        }}
      />
      <div
        style={{
          height: 34,
          width: "80%",
          borderRadius: 6,
          background: "#e2e8f0",
        }}
      />
      <div
        style={{
          height: 12,
          width: "65%",
          borderRadius: 6,
          background: "#f1f5f9",
        }}
      />
    </div>
  );
}
