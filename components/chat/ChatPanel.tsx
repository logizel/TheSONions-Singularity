"use client";

/**
 * Quote-only chat (D-11). Answers come from lib/chat/answers.ts over the
 * same ResultsJSON snapshot the dashboard shows, scoped to the selected
 * hospital; every number is gated twice (cited rows + snapshot post-check).
 * Order records are never passed in. History is session-only state and
 * never feeds answering. The panel stays mounted when collapsed so draft,
 * scroll and history survive; opening a sheet collapses it to the FAB.
 */
import { useEffect, useRef, useState } from "react";

import { RISK_CHIPS, answerQuestion } from "@/lib/chat/answers";
import type { ResultsJSON } from "@/lib/contracts";
import { Glyph } from "../icons/Glyph";
import styles from "./chat.module.css";
import { PromptBar } from "./PromptBar";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export function ChatPanel({
  results,
  scopeId,
  sheetOpen,
  modal,
  ready,
  wide,
  onOpenChange,
}: {
  results: ResultsJSON;
  scopeId: string | null;
  /** A drill-in / cart / tracking sheet is open: collapse to the FAB. */
  sheetOpen: boolean;
  /** XS: full-screen modal dialog with a focus trap. */
  modal: boolean;
  /** Viewport known (after hydration). */
  ready: boolean;
  /** >= 1024 px: open by default. */
  wide: boolean;
  /** Lets the map keep its fit clear of the open panel. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const seq = useRef(1);
  const historyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (!ready || initialised.current) return;
    initialised.current = true;
    if (wide && !sheetOpen) setOpen(true);
  }, [ready, wide, sheetOpen]);

  // Opening a sheet collapses chat; it does not auto-restore (L-07).
  useEffect(() => {
    if (sheetOpen) setOpen(false);
  }, [sheetOpen]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    const el = historyRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open || !modal) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        fabRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>("button, input, [tabindex='0']");
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, modal]);

  const answerable = results.inventory.length > 0;

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || !answerable) return;
    const reply = answerQuestion(text, scopeId, results);
    const id = seq.current;
    seq.current += 2;
    setMessages((prev) => [...prev, { id, role: "user", text }, { id: id + 1, role: "assistant", text: reply.text }]);
    setDraft("");
  };

  const collapse = () => {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  };

  return (
    <>
      <section
        ref={panelRef}
        className={`${styles.panel} ${open ? "" : styles.hidden} ${sheetOpen ? styles.shifted : ""}`}
        data-testid="chat-panel"
        aria-label="Ask the results"
        role={modal && open ? "dialog" : undefined}
        aria-modal={modal && open ? true : undefined}
        hidden={!open}
      >
        <div className={styles.head}>
          <h2 className={styles.title}>Ask the results</h2>
          <p className={styles.sub}>Answers quote this snapshot only.</p>
          <button type="button" className={styles.hide} onClick={collapse} aria-label="Collapse chat" data-testid="chat-collapse">
            Hide
          </button>
        </div>
        {!answerable ? (
          <p className={styles.empty} data-testid="chat-empty">
            No system results to quote yet.
          </p>
        ) : (
          <>
            <div className={styles.chips} data-testid="chat-chips">
              {RISK_CHIPS.map((chip, i) => (
                <button key={chip} type="button" className={styles.chip} onClick={() => send(chip)} data-testid={`chat-chip-${i}`}>
                  {chip}
                </button>
              ))}
            </div>
            <div ref={historyRef} className={styles.history} role="log" aria-label="Conversation" data-testid="chat-history" tabIndex={0}>
              {messages.length === 0 ? (
                <p className={styles.empty} data-testid="chat-welcome">
                  Ask about risk, stockout timing, expiry, or transfers. Answers quote system numbers.
                </p>
              ) : (
                messages.map((m) => (
                  <p key={m.id} className={m.role === "user" ? styles.user : styles.answer} data-testid={`chat-message-${m.role}`}>
                    {m.text}
                  </p>
                ))
              )}
            </div>
            <PromptBar value={draft} onChange={setDraft} onSubmit={() => send(draft)} inputRef={inputRef} />
          </>
        )}
      </section>
      {!open ? (
        <button ref={fabRef} type="button" className={styles.fab} onClick={() => setOpen(true)} data-testid="chat-fab">
          <Glyph name="chat" />
          Ask{messages.length > 0 ? ` (${messages.length / 2})` : ""}
        </button>
      ) : null}
    </>
  );
}
