/**
 * P1-local role view layer (D-26) — PROTOTYPE STUB.
 *
 * Role is a plain prop defaulting to network_admin until the Phase 3
 * server-side auth layer lands. hospital_admin renders own-hospital-full
 * plus others-read-only (moves/order ACTION affordances hidden
 * off-hospital); network_admin renders the full dashboard with
 * approve/order actions visible. The drill-in panel applies the same
 * gating via the role / ownHospitalId props it accepts.
 *
 * DISPLAY-ONLY GATING (T-4-06): this file only decides which buttons
 * render. It performs no authentication, no authorization, and no data
 * filtering. True enforcement belongs to the Phase 3 server-side auth
 * layer (P4-owned, outside P1 directories) with final wiring in Phase 5 —
 * do not treat hidden buttons as a security boundary, and never present
 * them as an enforced boundary in UI copy.
 */
"use client";

import { colors, spacing } from "@/theme/tokens";

export type Role = "hospital_admin" | "network_admin";

/** Prototype stub default: full network view until real auth lands. */
export const PROTOTYPE_DEFAULT_ROLE: Role = "network_admin";

/** Prototype stub own-hospital for the hospital_admin view. */
export const PROTOTYPE_OWN_HOSPITAL_ID: string = "h-city";

export function isOwnHospital(
  ownHospitalId: string | null,
  hospitalId: string,
): boolean {
  if (ownHospitalId === null) return true;
  return ownHospitalId === hospitalId;
}

/**
 * Display-only action visibility (T-4-08): network_admin sees move/order
 * actions everywhere; hospital_admin sees them only for the own hospital.
 * Row data itself is never filtered here — aggregates only, no PHI.
 */
export function canSeeMoveActions(
  role: Role,
  ownHospitalId: string | null,
  hospitalId: string,
): boolean {
  if (role === "network_admin") return true;
  return isOwnHospital(ownHospitalId, hospitalId);
}

/** Order controls follow the same display-only rule as move actions. */
export function canSeeOrderActions(
  role: Role,
  ownHospitalId: string | null,
  hospitalId: string,
): boolean {
  return canSeeMoveActions(role, ownHospitalId, hospitalId);
}

/**
 * Prototype role toggle for the dashboard header area. Exists only so the
 * two D-26 views can be flipped visually; the prop default above is what
 * ships when no toggle is mounted.
 */
export function RoleSwitcher({
  role,
  onChange,
}: {
  role: Role;
  onChange: (role: Role) => void;
}) {
  const options: { id: Role; label: string }[] = [
    { id: "network_admin", label: "Network admin" },
    { id: "hospital_admin", label: "Hospital admin" },
  ];
  return (
    <div
      data-testid="role-switcher"
      title="Prototype stub — real roles arrive with the Phase 3 server-side auth layer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.sm,
        fontSize: 12,
        color: colors.textSecondary,
      }}
    >
      <span>Role (prototype):</span>
      {options.map((o) => {
        const active = o.id === role;
        return (
          <button
            key={o.id}
            data-testid={`role-switcher-${o.id}`}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            style={{
              background: active ? colors.accent : "transparent",
              color: active ? "#ffffff" : colors.textPrimary,
              border: `1px solid ${active ? colors.accent : colors.cardBorder}`,
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
