/**
 * P1-local role view layer (D-26) — PROTOTYPE STUB.
 * Redesigned (D-23-ext): segmented control pattern replacing individual
 * buttons; cleaner visual integration into the header area.
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

import type { CSSProperties } from "react";

export type Role = "hospital_admin" | "network_admin";

/** Prototype stub default: full network view until real auth lands. */
export const PROTOTYPE_DEFAULT_ROLE: Role = "network_admin";

/** Prototype stub own-hospital for the hospital_admin view. */
export const PROTOTYPE_OWN_HOSPITAL_ID: string = "h-city";

export function isOwnHospital(
  ownHospitalId: string | null,
  hospitalId: string,
): boolean {
  // Unknown owner hides actions (fail closed, G-04-6): a null
  // ownHospitalId means "no scoping info", never "sees everything".
  if (ownHospitalId === null) return false;
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
 * Prototype role toggle — segmented control pattern.
 * Exists only so the two D-26 views can be flipped visually.
 */
export function RoleSwitcher({
  role,
  onChange,
}: {
  role: Role;
  onChange: (role: Role) => void;
}) {
  const options: { id: Role; label: string; short: string }[] = [
    { id: "network_admin", label: "Network admin", short: "Network" },
    { id: "hospital_admin", label: "Hospital admin", short: "Hospital" },
  ];

  return (
    <div
      data-testid="role-switcher"
      title="Prototype stub — real roles arrive with the Phase 3 server-side auth layer"
      style={containerStyle}
    >
      <span style={labelStyle}>Role</span>
      <div style={segmentStyle}>
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
                ...optionStyle,
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#ffffff" : "var(--text-secondary)",
                boxShadow: active
                  ? "0 1px 2px rgba(79, 110, 247, 0.3)"
                  : "none",
              }}
            >
              {o.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  fontWeight: 500,
  letterSpacing: "0.02em",
};

const segmentStyle: CSSProperties = {
  display: "flex",
  background: "var(--card-surface)",
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  padding: 3,
  gap: 2,
  boxShadow: "var(--card-shadow)",
};

const optionStyle: CSSProperties = {
  border: "none",
  borderRadius: 7,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 150ms, color 150ms, box-shadow 150ms",
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};
