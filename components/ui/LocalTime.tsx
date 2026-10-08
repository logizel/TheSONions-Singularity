"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { fmtUpdated } from "@/lib/dashboard/view";

const subscribeNoop = () => () => {};

/** True after hydration; times render only then so server and client markup match. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21:40" (24 h, browser local). */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "21:42 · 08 Oct" (browser local). */
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${pad(d.getHours())}:${pad(d.getMinutes())} · ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** "08 Oct 2026 21:40" (browser local). */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Browser-local time, rendered after hydration only. */
export function LocalTime({ iso, format }: { iso: string; format: "clock" | "stamp" | "datetime" }) {
  const client = useIsClient();
  if (!client) return <span>—</span>;
  const f = format === "clock" ? fmtClock : format === "stamp" ? fmtStamp : fmtDateTime;
  return <time dateTime={iso}>{f(iso)}</time>;
}

/** "Updated 4 min ago", re-evaluated every 30 s. */
export function UpdatedAgo({ iso }: { iso: string }) {
  const client = useIsClient();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!client || !now) return <span>Updated</span>;
  return <span>Updated {fmtUpdated(iso, now)}</span>;
}
