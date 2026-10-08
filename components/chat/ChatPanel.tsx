/**
 * ChatPanel — right-docked quote-only chat (D-17, D-18, D-19, D-20, D-21,
 * D-22, D-23). Redesigned (D-23-ext): premium floating panel with header
 * bar, bubble-style messages, refined chips, collapse-to-FAB.
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
import type { CSSProperties } from "react";
import fixtureJson from "@/app/data/mock-results.json";
import { type ResultsFixture } from "@/app/data/results";
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

  const turnCount = Math.ceil(messages.length / 2);

  return (
    <>
      {/* Right dock — stays mounted while collapsed */}
      <section
        data-testid="chat-panel"
        aria-hidden={open ? undefined : true}
        aria-label="Assistant chat"
        style={{
          ...dockStyle,
          display: open ? "flex" : "none",
        }}
      >
        {/* Panel header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Status dot */}
            <span
              aria-hidden="true"
              style={statusDotStyle}
            />
            <h2 style={titleStyle}>Assistant</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={quoteNoteStyle}>quotes system results only</span>
            <button
              data-testid="chat-collapse"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse chat"
              style={iconBtnStyle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!hasAnswerable ? (
          <p data-testid="chat-empty" style={emptyStyle}>
            No system results to quote yet.
          </p>
        ) : (
          <>
            {/* Risk chips */}
            <div
              data-testid="chat-chips"
              style={chipsContainerStyle}
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

            {/* Message history */}
            <div
              data-testid="chat-history"
              ref={scrollRef}
              role="log"
              aria-label="Conversation"
              aria-live="polite"
              style={historyStyle}
            >
              {messages.length === 0 ? (
                <div data-testid="chat-welcome" style={welcomeStyle}>
                  <span style={welcomeIconStyle} aria-hidden="true">💬</span>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {contextHospitalId
                      ? "Ask about risk, stockout timing, expiry, or transfers — answers quote system numbers."
                      : "Pick a risk question above or ask about stockout timing — answers quote system numbers."}
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    data-testid={`chat-message-${m.role}`}
                    style={m.role === "user" ? userBubbleStyle : assistantBubbleStyle}
                  >
                    {m.role === "assistant" && (
                      <span
                        aria-hidden="true"
                        style={asstIconStyle}
                      >
                        ✦
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{m.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div style={composerWrapStyle}>
              <PromptBar
                value={draft}
                onChange={setDraft}
                onSubmit={() => send(draft)}
              />
            </div>
          </>
        )}
      </section>

      {/* Floating restore button (D-17) */}
      {!open ? (
        <button
          data-testid="chat-fab"
          type="button"
          onClick={() => setOpen(true)}
          style={fabStyle}
          aria-label={`Open assistant chat${turnCount > 0 ? ` (${turnCount} turns)` : ""}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {turnCount > 0 ? (
            <span style={fabBadgeStyle}>{turnCount}</span>
          ) : null}
        </button>
      ) : null}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const dockStyle: CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  width: "min(380px, calc(100vw - 40px))",
  maxHeight: "62vh",
  flexDirection: "column",
  background: "var(--card-surface)",
  border: "1px solid var(--card-border)",
  borderRadius: 16,
  boxShadow: "0 8px 32px rgba(2, 6, 23, 0.16), 0 2px 8px rgba(2, 6, 23, 0.08)",
  zIndex: 20,
  overflow: "hidden",
  animation: "cardMount 220ms cubic-bezier(0.16, 1, 0.3, 1)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px 10px",
  borderBottom: "1px solid var(--card-border)",
  background: "var(--card-surface)",
  flexShrink: 0,
};

const statusDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "-0.01em",
};

const quoteNoteStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "var(--text-muted)",
  letterSpacing: "0.01em",
};

const iconBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  background: "transparent",
  border: "1px solid var(--card-border)",
  borderRadius: 8,
  cursor: "pointer",
  color: "var(--text-muted)",
  transition: "background 150ms",
};

const chipsContainerStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  padding: "10px 16px 8px",
  borderBottom: "1px solid var(--card-border)",
  flexShrink: 0,
};

const chipStyle: CSSProperties = {
  background: "var(--risk-neutral-bg)",
  color: "var(--text-secondary)",
  border: "1px solid var(--card-border)",
  borderRadius: 999,
  padding: "4px 12px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 150ms, border-color 150ms",
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};

const historyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflowY: "auto",
  flex: 1,
  padding: "12px 14px",
  minHeight: 100,
};

const welcomeStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "16px 8px",
  textAlign: "center",
};

const welcomeIconStyle: CSSProperties = {
  fontSize: 24,
  opacity: 0.5,
};

const userBubbleStyle: CSSProperties = {
  alignSelf: "flex-end",
  display: "flex",
  background: "var(--accent)",
  color: "#ffffff",
  borderRadius: "12px 12px 3px 12px",
  padding: "8px 12px",
  fontSize: 13,
  maxWidth: "85%",
  lineHeight: 1.4,
  boxShadow: "0 1px 3px rgba(79, 110, 247, 0.2)",
};

const assistantBubbleStyle: CSSProperties = {
  alignSelf: "flex-start",
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  background: "var(--risk-neutral-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "3px 12px 12px 12px",
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
  maxWidth: "90%",
  lineHeight: 1.5,
};

const asstIconStyle: CSSProperties = {
  color: "var(--accent)",
  fontSize: 12,
  flexShrink: 0,
  marginTop: 1,
};

const emptyStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  margin: 0,
  padding: "16px",
};

const composerWrapStyle: CSSProperties = {
  padding: "10px 14px 14px",
  borderTop: "1px solid var(--card-border)",
  flexShrink: 0,
  background: "var(--card-surface)",
};

const fabStyle: CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  width: 50,
  height: 50,
  background: "var(--accent)",
  color: "#ffffff",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(79, 110, 247, 0.35), 0 1px 4px rgba(2, 6, 23, 0.12)",
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 150ms, box-shadow 150ms",
};

const fabBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: "#ef4444",
  color: "#ffffff",
  fontSize: 10,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid var(--accent)",
};
