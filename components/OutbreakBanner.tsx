/**
 * OutbreakBanner — red Outbreak banner chip (D-08).
 * Redesigned (D-23-ext): pulsing dot, refined typography, uses CSS variables.
 *
 * Renders only from the envelope outbreak flag: callers pass the flag
 * through and mount this chip solely when it is true (T-4-12). Plain
 * escaped text, no raw HTML.
 */
import type { CSSProperties } from "react";

export function OutbreakBanner({ hospitalName }: { hospitalName: string }) {
  return (
    <span
      data-testid="outbreak-banner"
      role="alert"
      style={bannerStyle}
    >
      {/* Pulsing alert dot */}
      <span
        aria-hidden="true"
        style={dotStyle}
      />
      Outbreak · {hospitalName}
    </span>
  );
}

const bannerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--outbreak, #dc2626)",
  color: "#ffffff",
  borderRadius: 999,
  padding: "2px 10px 2px 8px",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
  letterSpacing: "0.02em",
  boxShadow: "0 0 0 3px rgba(220, 38, 38, 0.15)",
};

const dotStyle: CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.9)",
  flexShrink: 0,
  // Animation defined in globals.css shimmer -- using a simple pulse
  animation: "pulse 1.5s ease-in-out infinite",
};
