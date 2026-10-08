/**
 * Dashboard header: title, envelope-driven "Updated X min ago" (D-27)
 * plus a manual Refresh button. No polling — refresh is a full static
 * reload of the fixture per page load (D-24).
 */
import { colors, spacing } from "@/theme/tokens";

export function formatUpdatedAgo(generatedAt: string, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - new Date(generatedAt).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "Updated 1 hour ago";
  return `Updated ${hours} hours ago`;
}

export function Header({
  generatedAt,
  onRefresh,
}: {
  generatedAt: string;
  onRefresh: () => void;
}) {
  return (
    <header
      data-testid="dashboard-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        flexWrap: "wrap",
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: colors.textPrimary,
          }}
        >
          Hospital Stock Balancer
        </h1>
        <p
          data-testid="header-timestamp"
          style={{ margin: "4px 0 0", fontSize: 13, color: colors.textSecondary }}
        >
          {formatUpdatedAgo(generatedAt, Date.now())}
        </p>
      </div>
      <button
        data-testid="refresh-button"
        type="button"
        onClick={onRefresh}
        style={{
          background: colors.accent,
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Refresh
      </button>
    </header>
  );
}
