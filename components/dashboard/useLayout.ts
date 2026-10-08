"use client";

import { useSyncExternalStore } from "react";

import { breakpoints } from "@/theme/tokens";

export type Breakpoint = "xs" | "md" | "lg" | "xl" | "xxl";

function read(): string {
  const w = window.innerWidth;
  const bp: Breakpoint = w >= breakpoints.xxl ? "xxl" : w >= breakpoints.xl ? "xl" : w >= breakpoints.lg ? "lg" : w >= breakpoints.md ? "md" : "xs";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return `${bp}|${window.innerHeight}|${reduced ? 1 : 0}`;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("resize", cb);
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener("resize", cb);
    mq.removeEventListener("change", cb);
  };
}

export interface LayoutInfo {
  bp: Breakpoint;
  viewportH: number;
  reducedMotion: boolean;
  /** Layout chosen on the server before the viewport is known. */
  pending: boolean;
}

/** Breakpoint, viewport height and reduced-motion preference. CSS owns layout; JS only needs these for map insets. */
export function useLayout(): LayoutInfo {
  const snap = useSyncExternalStore(subscribe, read, () => "server");
  if (snap === "server") return { bp: "xl", viewportH: 900, reducedMotion: false, pending: true };
  const [bp, h, r] = snap.split("|");
  return { bp: bp as Breakpoint, viewportH: Number(h), reducedMotion: r === "1", pending: false };
}

export function isDesktop(bp: Breakpoint): boolean {
  return bp !== "xs";
}

/** Right sheet exists only at >= 1280 px; below that the detail replaces the panel. */
export function hasRightSheet(bp: Breakpoint): boolean {
  return bp === "xl" || bp === "xxl";
}
