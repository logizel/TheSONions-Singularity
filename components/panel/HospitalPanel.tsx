/**
 * HospitalPanel — STABLE MOUNT INTERFACE for Plan 02.
 * Plan 01 mounts this shell; Plan 02 implements the full drill-in
 * (per-medicine stock, forecast line, warnings, moves, switcher)
 * behind these props without touching app/page.tsx (D-09).
 */
import { colors, spacing } from "@/theme/tokens";

export interface HospitalPanelProps {
  /** Null = panel closed. Mirrors the ?hospital=id selection. */
  hospitalId: string | null;
  hospitalName?: string;
  onClose: () => void;
  onSelectHospital: (id: string | null) => void;
}

export function HospitalPanel({
  hospitalId,
  hospitalName,
  onClose,
}: HospitalPanelProps) {
  if (!hospitalId) return null;
  return (
    <aside
      data-testid="hospital-panel"
      style={{
        background: colors.cardSurface,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 12,
        padding: spacing.lg,
        marginTop: spacing.lg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>
          {hospitalName ?? hospitalId} — detail
        </h2>
        <button
          data-testid="hospital-panel-close"
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
      <p style={{ fontSize: 13, color: colors.textSecondary }}>
        Full per-medicine drill-in arrives in Plan 02.
      </p>
    </aside>
  );
}
