/**
 * PromptBar — composer primitive for the quote-only chat panel (D-18).
 * Redesigned (D-23-ext): refined input + send button matching the premium
 * chat panel style.
 *
 * Adapted primitive pattern (copy-paste into components/, never hotlinked):
 * a single-line composer with a Send affordance. The full upstream Prompt
 * Bar carries @sources, slash-commands, a model picker, and dictation —
 * none of that is wired in v1 (D-18): no sources component, no model
 * picker, no network calls. The form posts to local state only.
 */
"use client";

import type { CSSProperties } from "react";

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
      style={formStyle}
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
        style={inputStyle}
      />
      <button
        data-testid="prompt-bar-send"
        type="submit"
        disabled={disabled}
        aria-label="Send message"
        style={{
          ...sendBtnStyle,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
      </button>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
  background: "var(--risk-neutral-bg)",
  outline: "none",
  transition: "border-color 150ms, background 150ms",
  fontFamily: "inherit",
};

const sendBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  background: "var(--accent)",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  flexShrink: 0,
  transition: "background 150ms",
};
