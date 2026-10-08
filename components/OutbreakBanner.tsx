/**
 * OutbreakBanner — red Outbreak banner chip (D-08).
 *
 * Renders only from the envelope outbreak flag: callers pass the flag
 * through and mount this chip solely when it is true (T-4-12). Plain
 * escaped text, no raw HTML.
 */
import { colors } from "@/theme/tokens";

export function OutbreakBanner({ hospitalName }: { hospitalName: string }) {
  return (
    <span
      data-testid="outbreak-banner"
      role="alert"
      style={{
        display: "inline-block",
        background: colors.outbreak,
        color: "#ffffff",
        borderRadius: 999,
        padding: "1px 10px",
        fontSize: 11,
        fontWeight: 750,
        whiteSpace: "nowrap",
      }}
    >
      Outbreak · {hospitalName}
    </span>
  );
}
