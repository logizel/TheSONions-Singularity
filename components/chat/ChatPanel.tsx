/**
 * ChatPanel — right-docked quote-only chat (D-17, D-18, D-19, D-20, D-21,
 * D-22, D-23).
 *
 * Primitives: only the Chat tabbed-panel pattern (message list + risk
 * chips) and the Prompt Bar composer below, adapted copy-paste into
 * components/ — no streaming-text or sources components in v1 (D-18), no
 * externally hotlinked component code at runtime.
 *
 * Dock behavior (D-17): the panel docks right; when the hospital drill-in
 * opens (`drillInOpen`), chat auto-collapses to a floating button that
 * restores it with scroll position and composer draft intact — the
 * component never unmounts, so in-memory state is never lost and the two
 * panels never collide.
 *
 * History (D-22): session-only in-memory `useState`; refresh clears it, no
 * DB writes, no storage APIs, no network calls. History is display-only
 * and is never passed into answer matching (T-4-13).
 *
 * Rendering (T-4-10): answers render as plain escaped text — no raw-HTML
 * injection anywhere in this file.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import fixtureJson from "@/app/data/mock-results.json";
import { type ResultsFixture } from "@/app/data/results";
import { colors, spacing } from "@/theme/tokens";
import { PromptBar } from "./PromptBar";
import {
  answerQuestion,
  RISK_CHIPS,
  type ChatMessage,
} from "./mock-answers";

const fixture = fixtureJson as ResultsFixture;

export interface ChatPanelProps {
  /** Currently selected hospital, for context-aware canned answers. */
  contextHospitalId: string | null;
  /** True while the hospital drill-in panel is open (D-17 coordination). */
  drillInOpen?: boolean;
}

export function ChatPanel({
  contextHospitalId,
  drillInOpen = false,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(true);
  const [seq, setSeq] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // D-17: opening the drill-in collapses chat to the floating button.
  // Messages, draft, and scroll position stay in state — nothing is lost.
  useEffect(() => {
    if (drillInOpen) setOpen(false);
  }, [drillInOpen]);

  // Keep the latest turn visible as history grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const hasAnswerable =
    fixture.shortages.length > 0 ||
    fixture.expiries.length > 0 ||
    fixture.moves.length > 0;

  const send = (raw: string) => {
    const text = raw.trim();
    if (text.length === 0 || !hasAnswerable) return;
    // Single-shot: only the current question text is matched (D-22, T-4-13).
    const reply = answerQuestion(text, contextHospitalId);
    const userId = seq;
    setSeq((n) => n + 2);
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text },
      { id: userId + 1, role: "assistant", text: reply.text },
    ]);
    setDraft("");
  };

  return (
    <>
      {/* Right dock. Stays mounted while collapsed so scroll and draft keep
          their place; hidden with display:none instead of unmounting. */}
      <section
        data-testid="chat-panel"
        aria-hidden={open ? undefined : true}
        style={{
          ...dockStyle,
          display: open ? "flex" : "none",
        }}
      >
        <div style={headerRowStyle}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            Assistant
          </h2>
          <span style={quoteNoteStyle}>quotes system results only</span>
          <button
            data-testid="chat-collapse"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse chat"
            style={iconButtonStyle}
          >
            Hide
          </button>
        </div>

        {!hasAnswerable ? (
          <p data-testid="chat-empty" style={emptyStyle}>
            No system results to quote yet.
          </p>
        ) : (
          <>
            <div
              data-testid="chat-chips"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {RISK_CHIPS.map((chip, i) => (
                <button
                  key={chip}
                  data-testid={`chat-chip-${i}`}
                  type="button"
                  onClick={() => send(chip)}
                  style={chipStyle}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div
              data-testid="chat-history"
              ref={scrollRef}
              role="log"
              aria-label="Conversation"
              style={historyStyle}
            >
              {messages.length === 0 ? (
                <p data-testid="chat-welcome" style={emptyStyle}>
                  {contextHospitalId
                    ? "Ask about risk, stockout timing, expiry, or transfers — answers quote system numbers."
                    : "Pick a risk question above or ask about stockout timing — answers quote system numbers."}
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    data-testid={`chat-message-${m.role}`}
                    style={
                      m.role === "user" ? userBubbleStyle : assistantStyle
                    }
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>

            <PromptBar
              value={draft}
              onChange={setDraft}
              onSubmit={() => send(draft)}
            />
          </>
        )}
      </section>

      {/* Floating restore button (D-17): visible whenever the dock hides. */}
      {!open ? (
        <button
          data-testid="chat-fab"
          type="button"
          onClick={() => setOpen(true)}
          style={fabStyle}
        >
          Chat
          {messages.length > 0 ? ` (${Math.ceil(messages.length / 2)})` : ""}
        </button>
      ) : null}
    </>
  );
}

const dockStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  width: "min(360px, calc(100vw - 32px))",
  maxHeight: "60vh",
  flexDirection: "column",
  gap: spacing.sm,
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
  padding: spacing.lg,
  zIndex: 20,
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const quoteNoteStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  flex: 1,
};

const iconButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 8,
  padding: "2px 10px",
  fontSize: 12,
  cursor: "pointer",
  color: colors.textSecondary,
};

const chipStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: colors.textPrimary,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 999,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const historyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
  overflowY: "auto",
  minHeight: 120,
  maxHeight: "32vh",
  padding: "4px 2px",
};

const userBubbleStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 10,
  padding: "6px 10px",
  fontSize: 13,
  color: colors.textPrimary,
  maxWidth: "90%",
};

const assistantStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  fontSize: 13,
  color: colors.textPrimary,
  lineHeight: 1.5,
  maxWidth: "100%",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: colors.textSecondary,
  margin: 0,
};

const fabStyle: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  background: colors.accent,
  color: "#ffffff",
  border: "none",
  borderRadius: 999,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
  zIndex: 20,
};
