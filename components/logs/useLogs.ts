"use client";

import { useCallback, useEffect, useState } from "react";

import type { LogEntry } from "@/lib/logs";

export type LogsState = { status: "loading" } | { status: "ok"; logs: LogEntry[] } | { status: "error" };

/** Fetches /api/logs; re-fetches when params or `bump` change. */
export function useLogs(params: { hospital?: string | null; action?: string | null; limit?: number }, bump: unknown) {
  const [state, setState] = useState<LogsState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const qs = new URLSearchParams();
  if (params.hospital) qs.set("hospital", params.hospital);
  if (params.action) qs.set("action", params.action);
  if (params.limit) qs.set("limit", String(params.limit));
  const key = qs.toString();
  useEffect(() => {
    let alive = true;
    fetch(`/api/logs?${key}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { logs: LogEntry[] }) : Promise.reject(r.status)))
      .then((j) => alive && setState({ status: "ok", logs: j.logs }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [key, bump, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
