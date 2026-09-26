"use client";

import { useEffect, useRef } from "react";

/** A short, tasteful burst of theme-colored particles. Skipped with reduced motion. */
export function Confetti({ origin = { x: 0.3, y: 0.35 }, count = 90 }: { origin?: { x: number; y: number }; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (document.documentElement.dataset.motion === "reduced") return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = ["--accent", "--accent-2", "--accent-3", "--fg"].map((v) => css.getPropertyValue(v).trim() || "#fff");
    const parts = Array.from({ length: count }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = 6 + Math.random() * 9;
      return {
        x: origin.x * w,
        y: origin.y * h,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        s: 4 + Math.random() * 6,
        c: colors[(Math.random() * colors.length) | 0],
        shape: Math.random() < 0.5 ? 0 : 1,
      };
    });
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.28;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2.6);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.shape) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.s / 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (t < 2.7) raf = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [origin.x, origin.y, count]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[75] h-full w-full" aria-hidden />;
}
