"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_SPEED,
  anchorFromDispatch,
  reanchor,
  simElapsedMs,
  type ClockAnchor,
} from "@/lib/orders";

/**
 * Demo clock for the simulated vehicle (D-10). Simulated time since dispatch
 * = real time since `inTransitAt` x speed, re-anchored on speed change or
 * pause so the vehicle never jumps. Smooth (rAF) normally; 1 Hz discrete
 * steps under prefers-reduced-motion.
 */
export function useDemoClock(inTransitAt: string | null, reducedMotion: boolean) {
  const [speed, setSpeedState] = useState(DEFAULT_SPEED);
  const [paused, setPaused] = useState(false);
  const anchor = useRef<ClockAnchor | null>(null);
  const [simMs, setSimMs] = useState(0);

  useEffect(() => {
    anchor.current = inTransitAt ? anchorFromDispatch(Date.parse(inTransitAt), Date.now(), speed) : null;
    setSimMs(anchor.current?.simMs ?? 0);
    // re-anchor only when the dispatch time changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTransitAt]);

  useEffect(() => {
    if (!inTransitAt || paused) return;
    let raf = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      if (anchor.current) setSimMs(simElapsedMs(anchor.current, Date.now(), speed, false));
    };
    if (reducedMotion) {
      tick();
      timer = setInterval(tick, 1000);
    } else {
      const loop = () => {
        tick();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
    };
  }, [inTransitAt, paused, speed, reducedMotion]);

  const setSpeed = useCallback(
    (next: number) => {
      if (anchor.current) anchor.current = reanchor(anchor.current, Date.now(), speed, paused);
      setSpeedState(next);
    },
    [speed, paused],
  );

  const togglePause = useCallback(() => {
    if (anchor.current) anchor.current = reanchor(anchor.current, Date.now(), speed, paused);
    setPaused((p) => !p);
  }, [speed, paused]);

  return { simMs, speed, setSpeed, paused, togglePause };
}
