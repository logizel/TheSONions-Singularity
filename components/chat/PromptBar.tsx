"use client";

import styles from "./chat.module.css";

/** Single-line composer for the quote-only chat. Posts to local state only. */
export function PromptBar({
  value,
  onChange,
  onSubmit,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <form
      className={styles.form}
      data-testid="prompt-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}
        className={styles.input}
        data-testid="prompt-bar-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about stockout, risk, expiry, or transfers…"
        aria-label="Chat question"
        autoComplete="off"
        maxLength={500}
      />
      <button type="submit" className={styles.send} data-testid="prompt-bar-send">
        Send
      </button>
    </form>
  );
}
