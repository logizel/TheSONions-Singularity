/**
 * PromptBar — composer primitive for the quote-only chat panel (D-18).
 *
 * Adapted primitive pattern (copy-paste into components/, never hotlinked):
 * a single-line composer with a Send affordance. The full upstream Prompt
 * Bar carries @sources, slash-commands, a model picker, and dictation —
 * none of that is wired in v1 (D-18): no sources component, no model
 * picker, no network calls. The form posts to local state only.
 */
"use client";

import { colors, spacing } from "@/theme/tokens";

export interface PromptBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PromptBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask about stockout, risk, expiry, or transfers…",
  disabled = false,
}: PromptBarProps) {
  return (
    <form
      data-testid="prompt-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        display: "flex",
        gap: spacing.sm,
        alignItems: "center",
      }}
    >
      <input
        data-testid="prompt-bar-input"
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Chat question"
        autoComplete="off"
        style={{
          flex: 1,
          minWidth: 0,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          color: colors.textPrimary,
          background: "#ffffff",
        }}
      />
      <button
        data-testid="prompt-bar-send"
        type="submit"
        disabled={disabled}
        style={{
          background: colors.accent,
          color: "#ffffff",
          border: "none",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 650,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        Send
      </button>
    </form>
  );
}
