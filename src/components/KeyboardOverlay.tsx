"use client";

import { useEffect, useRef } from "react";
import { LAYOUTS, ROW_OFFSET, baseKey } from "@/lib/keyboard";
import { useSettings } from "@/stores/settings";
import { useProgression } from "@/lib/use-progression";

/**
 * A quiet on-screen keyboard whose keys react to real keypresses.
 * Pure DOM class toggles; never re-renders while typing.
 */
export function KeyboardOverlay({ size = "min(4.2vw, 2.3rem)", className = "" }: { size?: string; className?: string }) {
  const layout = useSettings((s) => s.keyboardLayout);
  const neon = useSettings((s) => s.neonKeyboard);
  const prog = useProgression();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const find = (k: string) => root.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`);
    const down = (e: KeyboardEvent) => {
      const k = e.key === " " ? "space" : e.key.length === 1 ? baseKey(e.key) : "";
      const el = k && find(k);
      if (!el) return;
      el.dataset.down = "true";
      el.animate?.([{ transform: "translateY(0) scale(1)" }, { transform: "translateY(2px) scale(0.94)" }], { duration: 70, fill: "forwards" });
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key === " " ? "space" : e.key.length === 1 ? baseKey(e.key) : "";
      const el = k && find(k);
      if (!el) return;
      delete el.dataset.down;
      el.animate?.([{ transform: "translateY(2px) scale(0.94)" }, { transform: "translateY(0) scale(1)" }], { duration: 220, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [layout]);

  return (
    <div ref={ref} className={`chrome-dim mx-auto mt-10 flex w-max flex-col gap-[0.3em] ${neon && prog.can("neon") ? "kb-neon" : ""} ${className}`} style={{ fontSize: size }} aria-hidden>
      {LAYOUTS[layout].map((row, ri) => (
        <div key={ri} className="flex gap-[0.3em]" style={{ paddingLeft: `${ROW_OFFSET[ri]}em` }}>
          {row.map((k) => (
            <span
              key={k}
              data-k={k}
              className="grid h-[1em] w-[1em] place-items-center border border-line font-mono text-sub transition-colors duration-150 data-[down=true]:border-accent data-[down=true]:bg-accent data-[down=true]:text-on-accent"
              style={{ borderRadius: "calc(var(--radius) + 2px)" }}
            >
              <span style={{ fontSize: "0.34em" }}>{k}</span>
            </span>
          ))}
        </div>
      ))}
      <div className="flex justify-center" style={{ paddingLeft: "2em" }}>
        <span data-k="space" className="h-[0.7em] w-[6em] border border-line transition-colors duration-150 data-[down=true]:border-accent data-[down=true]:bg-accent" style={{ borderRadius: "calc(var(--radius) + 2px)" }} />
      </div>
    </div>
  );
}
