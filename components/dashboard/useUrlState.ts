"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type UrlPatch = Partial<Record<"hospital" | "tab" | "view" | "order" | "cart" | "logs" | "events" | "stock", string | null>>;

/**
 * The URL is the source of truth for selection and views (?hospital, ?tab,
 * ?view, ?order, ?cart, ?logs, ?events), so reload, back/forward and shared links restore
 * them. Every update copies the existing params (fixes L-04 clobbering).
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (patch: UrlPatch, mode: "push" | "replace" = "push") => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [params, pathname, router],
  );

  return {
    hospital: params.get("hospital"),
    tab: params.get("tab"),
    view: params.get("view"),
    order: params.get("order"),
    cart: params.get("cart"),
    logs: params.get("logs"),
    events: params.get("events"),
    stock: params.get("stock"),
    update,
  };
}
