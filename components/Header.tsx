/**
 * Dashboard header: sticky top bar with title, "Updated X ago" timestamp
 * (D-27), manual Refresh, and dark mode toggle.
 * Redesigned (D-23-ext): Inter typography, refined scale, glassmorphism
 * sticky bar treatment, integrated dark mode toggle.
 */
"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { colors } from "@/theme/tokens";

export function formatUpdatedAgo(generatedAt: string, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - new Date(generatedAt).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

export function Header({
  generatedAt,
  onRefresh,
}: {
  generatedAt: string;
  onRefresh: () => void;
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [isDark, setIsDark] = useState(false);

  // Tick the timestamp display each minute
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Dark mode toggle — class strategy on <html>
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const updatedAgo = formatUpdatedAgo(generatedAt, nowMs);

  return (
    <header
      data-testid="dashboard-header"
      style={headerStyle}
    >
      {/* Brand / title */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Network indicator dot */}
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)",
              flexShrink: 0,
            }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            Stock Balancer
          </h1>
        </div>
        <p
          data-testid="header-timestamp"
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
            paddingLeft: 18,
          }}
        >
          Updated {updatedAgo}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
          style={iconBtnStyle}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Refresh */}
        <button
          data-testid="refresh-button"
          type="button"
          onClick={onRefresh}
          style={refreshBtnStyle}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </button>
      </div>
    </header>
  );
}

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
  padding: "12px 0",
  borderBottom: "1px solid var(--card-border)",
};

const iconBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  background: "var(--card-surface)",
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  cursor: "pointer",
  color: "var(--text-secondary)",
  transition: "background 150ms, border-color 150ms",
  boxShadow: "var(--card-shadow)",
};

const refreshBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "var(--accent)",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.01em",
  transition: "background 150ms",
  boxShadow: "0 1px 2px rgba(79, 110, 247, 0.2), 0 4px 12px rgba(79, 110, 247, 0.15)",
};
