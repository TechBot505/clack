"use client";

import { useEffect, useRef } from "react";

/**
 * Each keystroke releases the typed character from the caret; it drifts up
 * and dissolves behind the text. Canvas-only, no DOM churn.
 */
export function FloatingGlyphs({ anchorSelector = ".caret:not(.ghost)" }: { anchorSelector?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (document.documentElement.dataset.motion === "reduced") return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const parts: { ch: string; x: number; y: number; vx: number; vy: number; life: number; rot: number; bad: boolean }[] = [];
    let raf = 0;
    let font = "20px monospace";
    let fg = "#fff";
    let err = "#f55";
    const readStyle = () => {
      const css = getComputedStyle(document.documentElement);
      fg = css.getPropertyValue("--accent").trim() || fg;
      err = css.getPropertyValue("--error").trim() || err;
      font = `600 22px ${css.getPropertyValue("--type-font").trim() || "monospace"}`;
    };
    readStyle();
    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = font;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.985;
        p.rot += p.vx * 0.01;
        p.life -= 0.018;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.life * 0.55;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.bad ? err : fg;
        ctx.fillText(p.ch, 0, 0);
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
    };
    const onKey = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; correct: boolean; kind: string }>).detail;
      if (!d || d.kind === "back" || d.key.length !== 1 || d.key === " ") return;
      const anchor = document.querySelector(anchorSelector);
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      parts.push({
        ch: d.key,
        x: r.left - 6,
        y: r.top + r.height * 0.7,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(1.2 + Math.random() * 1.4),
        life: 1,
        rot: (Math.random() - 0.5) * 0.4,
        bad: !d.correct,
      });
      if (parts.length > 120) parts.shift();
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("clack:key", onKey);
    window.addEventListener("resize", resize);
    const obs = new MutationObserver(readStyle);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-font"] });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("clack:key", onKey);
      window.removeEventListener("resize", resize);
    };
  }, [anchorSelector]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden />;
}
