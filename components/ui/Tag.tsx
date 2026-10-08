import type { Severity } from "@/lib/contracts";
import { riskLabel } from "@/theme/tokens";
import { Glyph, RiskGlyph } from "../icons/Glyph";
import styles from "./ui.module.css";

/** Risk status tag: glyph + label + colour, never colour alone. */
export function RiskTag({ severity, testId }: { severity: Severity; testId?: string }) {
  return (
    <span className={`${styles.tag} ${styles[severity]}`} data-testid={testId}>
      <RiskGlyph severity={severity} />
      {riskLabel[severity]}
    </span>
  );
}

export type TagTone = "ink" | "outline" | "accent" | "dashed" | "demo" | "muted";

export function Tag({ tone, children, testId }: { tone: TagTone; children: React.ReactNode; testId?: string }) {
  return (
    <span className={`${styles.tag} ${styles[tone]}`} data-testid={testId}>
      {children}
    </span>
  );
}

export function OutbreakTag() {
  return (
    <Tag tone="ink">
      <Glyph name="outbreak" size={12} />
      Outbreak
    </Tag>
  );
}
