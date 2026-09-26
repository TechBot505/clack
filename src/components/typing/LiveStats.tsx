"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { LiveStats as Live } from "./session";

export interface LiveStatsHandle {
  update: (live: Live) => void;
  reset: (label: string) => void;
}

/**
 * Live numbers written straight to the DOM (no React state), so updating
 * them ten times a second never re-renders the page.
 */
export const LiveStats = forwardRef<LiveStatsHandle, { showWpm: boolean; showAcc: boolean; showTimer: boolean; showProgress: boolean }>(function LiveStats(
  { showWpm, showAcc, showTimer, showProgress },
  ref,
) {
  const timer = useRef<HTMLSpanElement>(null);
  const wpm = useRef<HTMLSpanElement>(null);
  const acc = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    update(live) {
      if (timer.current) {
        if (live.remainingMs !== null) timer.current.textContent = String(Math.ceil(live.remainingMs / 1000));
        else if (live.wordTotal) timer.current.textContent = `${Math.min(live.wordIndex, live.wordTotal)}/${live.wordTotal}`;
        else timer.current.textContent = String(Math.floor(live.elapsedMs / 1000));
      }
      if (wpm.current) wpm.current.textContent = String(Math.round(live.wpm));
      if (acc.current) acc.current.textContent = `${Math.floor(live.acc)}%`;
      if (bar.current) bar.current.style.transform = `scaleX(${live.progress})`;
      root.current?.setAttribute("data-live", "true");
    },
    reset(label) {
      if (timer.current) timer.current.textContent = label;
      if (wpm.current) wpm.current.textContent = "0";
      if (acc.current) acc.current.textContent = "100%";
      if (bar.current) bar.current.style.transform = "scaleX(0)";
      root.current?.setAttribute("data-live", "false");
    },
  }));

  return (
    <div ref={root} data-live="false" className="group relative mb-3 flex items-end justify-between gap-6" aria-hidden>
      <div className="flex items-baseline gap-6">
        {showTimer && (
          <span ref={timer} className="display text-[clamp(2rem,4vw,3rem)] font-semibold text-accent transition-opacity duration-300 group-data-[live=false]:opacity-40">
            &nbsp;
          </span>
        )}
        {showWpm && (
          <span className="font-mono text-sm text-sub opacity-0 transition-opacity duration-300 group-data-[live=true]:opacity-100">
            <span ref={wpm} className="text-lg text-fg">
              0
            </span>{" "}
            wpm
          </span>
        )}
        {showAcc && (
          <span className="font-mono text-sm text-sub opacity-0 transition-opacity duration-300 group-data-[live=true]:opacity-100">
            <span ref={acc} className="text-lg text-fg">
              100%
            </span>{" "}
            acc
          </span>
        )}
      </div>
      {showProgress && (
        <div className="absolute inset-x-0 -bottom-1 h-px bg-line">
          <div ref={bar} className="h-px origin-left bg-accent transition-transform duration-150 ease-linear" style={{ transform: "scaleX(0)" }} />
        </div>
      )}
    </div>
  );
});
