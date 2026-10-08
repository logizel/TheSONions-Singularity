"use client";

import { useEffect, useState } from "react";

import type { RouteResult } from "@/lib/routing";

export type RouteState = { status: "loading" } | { status: "ok"; route: RouteResult } | { status: "error" };

// One fetch per lane per page session; /api/route also caches server-side.
const cache = new Map<string, Promise<RouteResult | null>>();

function fetchRoute(from: string, to: string): Promise<RouteResult | null> {
  const key = `${from}>${to}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as RouteResult) : null))
      .catch(() => null);
    p.then((r) => {
      if (r === null) cache.delete(key);
    });
    cache.set(key, p);
  }
  return p;
}

/** Road routes for lanes ("from>to" keys). Failed lanes report status "error". */
export function useRoutes(lanes: readonly string[]): Record<string, RouteState> {
  const [state, setState] = useState<Record<string, RouteState>>({});
  const key = [...new Set(lanes)].sort().join(",");
  useEffect(() => {
    let alive = true;
    const unique = key === "" ? [] : key.split(",");
    for (const lane of unique) {
      const [from, to] = lane.split(">");
      fetchRoute(from, to).then((route) => {
        if (!alive) return;
        setState((s) => ({ ...s, [lane]: route ? { status: "ok", route } : { status: "error" } }));
      });
    }
    return () => {
      alive = false;
    };
  }, [key]);
  const out: Record<string, RouteState> = {};
  for (const lane of lanes) out[lane] = state[lane] ?? { status: "loading" };
  return out;
}
