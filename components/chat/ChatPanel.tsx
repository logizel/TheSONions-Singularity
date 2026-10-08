/**
 * ChatPanel — STABLE MOUNT INTERFACE for Plan 03.
 * Plan 01 mounts this shell; Plan 03 implements the docked chat
 * (BeautifulUI Chat + Prompt Bar, canned mock Q&A) behind these
 * props without touching app/page.tsx (D-17).
 */
import { colors, spacing } from "@/theme/tokens";

export interface ChatPanelProps {
  /** Currently selected hospital, for context-aware canned answers. */
  contextHospitalId: string | null;
}

export function ChatPanel({ contextHospitalId }: ChatPanelProps) {
  return (
    <section
      data-testid="chat-panel"
      style={{
        background: colors.cardSurface,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 12,
        padding: spacing.lg,
        marginTop: spacing.lg,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16 }}>Assistant</h2>
      <p style={{ fontSize: 13, color: colors.textSecondary }}>
        {contextHospitalId
          ? `Answering from system results for ${contextHospitalId}. Chat arrives in Plan 03.`
          : "Quote-only chat from system results arrives in Plan 03."}
      </p>
    </section>
  );
}
