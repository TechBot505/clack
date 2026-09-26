"use client";

import { useEffect, useRef } from "react";

/**
 * Oversized headline whose letters swell toward the cursor using the display
 * face's variable weight & width axes. Pure style writes inside rAF.
 */
export function ReactiveHeadline({ lines, className = "" }: { lines: string[]; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (document.documentElement.dataset.motion === "reduced") return;
    const letters = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-l]"));
    let mx = -9999;
    let my = -9999;
    let raf = 0;
    let centers: { x: number; y: number }[] = [];
    const measure = () => {
      centers = letters.map((l) => {
        const r = l.getBoundingClientRect();
        return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
      });
    };
    const render = () => {
      raf = 0;
      const px = mx + window.scrollX;
      const py = my + window.scrollY;
      for (let i = 0; i < letters.length; i++) {
        const c = centers[i];
        if (!c) continue;
        const d = Math.hypot(c.x - px, c.y - py);
        const f = Math.max(0, 1 - d / 260);
        const e = f * f * (3 - 2 * f);
        const wght = 520 + e * 280;
        const wdth = 78 + e * 22;
        letters[i].style.fontVariationSettings = `"wght" ${wght.toFixed(0)}, "wdth" ${wdth.toFixed(1)}, "opsz" 96`;
        letters[i].style.transform = e > 0.01 ? `translateY(${(-e * 6).toFixed(2)}px)` : "";
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(render);
    };
    const onLeave = () => {
      mx = -9999;
      my = -9999;
      if (!raf) raf = requestAnimationFrame(render);
    };
    measure();
    const t = setTimeout(measure, 600); // fonts settle
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <h1 ref={ref} className={`display font-display text-fg ${className}`} aria-label={lines.join(" ")}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden>
          {line.split("").map((ch, i) => (
            <span
              key={i}
              data-l
              className="inline-block transition-[transform] duration-300 ease-out"
              style={{ fontVariationSettings: '"wght" 520, "wdth" 78, "opsz" 96', whiteSpace: "pre" }}
            >
              {ch}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
