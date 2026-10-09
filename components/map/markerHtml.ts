import type { MapHospital } from "@/lib/dashboard/view";
import { EVENT_LABEL } from "@/lib/engine/events";
import { colors, risk } from "@/theme/tokens";

// Marker markup for L.divIcon (06-UI-SPEC Map Contract). A 44x44 hit box,
// glyph centred: Critical diamond, Low triangle, OK hollow ring. Every shape
// is drawn over a 6px surface halo with a 2px ink stroke, so it clears 3:1 on
// any tile. Colours come from theme/tokens.ts because this is a string.

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function glyphSvg(level: MapHospital["risk"]): string {
  const ink = colors.ink;
  const halo = colors.surface;
  if (level === "critical") {
    const d = "M22 10 L34 22 L22 34 L10 22 Z";
    return `<path d="${d}" fill="none" stroke="${halo}" stroke-width="6" stroke-linejoin="round"/>
<path d="${d}" fill="${risk.critical.fill}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
<path d="M22 16.5 v6.5 M22 26.6 v0.8" stroke="${halo}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  if (level === "low") {
    const d = "M22 11.5 L34 32.5 L10 32.5 Z";
    return `<path d="${d}" fill="none" stroke="${halo}" stroke-width="6" stroke-linejoin="round"/>
<path d="${d}" fill="${risk.warning.fill}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
<path d="M22 19 v6.5 M22 28.6 v0.8" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `<circle cx="22" cy="22" r="10" fill="none" stroke="${halo}" stroke-width="6"/>
<circle cx="22" cy="22" r="10" fill="none" stroke="${ink}" stroke-width="2"/>
<circle cx="22" cy="22" r="7.5" fill="${halo}" stroke="${risk.ok.fill}" stroke-width="3"/>`;
}

export function markerHtml(h: MapHospital, cls: Record<string, string>): string {
  const ring = `<svg class="${cls.selRing}" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18.5" fill="none" stroke="${colors.surface}" stroke-width="2"/><circle cx="22" cy="22" r="20" fill="none" stroke="${colors.accent}" stroke-width="3"/></svg>`;
  const pulse = h.outbreak ? `<span class="${cls.pulse}" aria-hidden="true"></span>` : "";
  const first = h.events[0];
  const eventTag = first ? ` · ${esc(EVENT_LABEL[first.type].toUpperCase())}` : "";
  const tag = `${esc(h.name)}${h.outbreak ? " · OUTBREAK" : ""}${eventTag}`;
  // EVT-04: local-event badge in the top-right corner, outside the glyph and
  // click-through (pointer-events: none) so the 44x44 hit box is unchanged.
  const badge = first
    ? `<span class="${cls.eventBadge}" data-testid="map-event-badge-${esc(h.id)}" aria-hidden="true">!</span>`
    : "";
  return `${pulse}${ring}<svg class="${cls.glyph}" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">${glyphSvg(h.risk)}</svg>${badge}<span class="${cls.nameTag}" aria-hidden="true">${tag}</span>`;
}

export function vehicleHtml(cls: Record<string, string>): string {
  return `<span class="${cls.vehicleBody}" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20"><rect x="0.5" y="0.5" width="19" height="19" rx="2" fill="${colors.ink}" stroke="${colors.surface}" stroke-width="1"/><path d="M6 13 L10 6 L14 13" fill="none" stroke="${colors.surface}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg></span>`;
}

export function arrowHtml(cls: Record<string, string>): string {
  return `<span class="${cls.arrowBody}" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 10 L6 2 L10 10 Z" fill="${colors.ink3}"/></svg></span>`;
}
