"use client";

import { useEffect, useRef } from "react";

export type SceneId = "rain" | "space" | "city" | "cozy" | "terminal" | "void";

export const SCENES: { id: SceneId; name: string; vars: Record<string, string> }[] = [
  { id: "rain", name: "rainy window", vars: { "--bg": "#0b1016", "--fg": "#dfe8f2", "--sub": "#7f8fa3", "--faint": "#48566a", "--accent": "#8fc1ff", "--caret": "#8fc1ff", "--error": "#ff8a8a", "--glow": "rgba(143,193,255,.45)" } },
  { id: "space", name: "deep space", vars: { "--bg": "#03040a", "--fg": "#e8ebff", "--sub": "#8088b5", "--faint": "#3d4470", "--accent": "#b69cff", "--caret": "#b69cff", "--error": "#ff6b8b", "--glow": "rgba(182,156,255,.5)" } },
  { id: "city", name: "night city", vars: { "--bg": "#0a0712", "--fg": "#f3e9ff", "--sub": "#9b8bb8", "--faint": "#4c3f66", "--accent": "#ffcf5c", "--caret": "#ffcf5c", "--error": "#ff5c8a", "--glow": "rgba(255,207,92,.45)" } },
  { id: "cozy", name: "cozy room", vars: { "--bg": "#160d08", "--fg": "#ffeede", "--sub": "#b58c6c", "--faint": "#6b4a36", "--accent": "#ff9a4d", "--caret": "#ff9a4d", "--error": "#ff5f5f", "--glow": "rgba(255,154,77,.5)" } },
  { id: "terminal", name: "terminal", vars: { "--bg": "#020602", "--fg": "#b9ffb3", "--sub": "#5fae58", "--faint": "#2f5a2c", "--accent": "#39ff14", "--caret": "#39ff14", "--error": "#ff6a3d", "--glow": "rgba(57,255,20,.5)" } },
  { id: "void", name: "minimal void", vars: { "--bg": "#050505", "--fg": "#e9e9e9", "--sub": "#7a7a7a", "--faint": "#3a3a3a", "--accent": "#ffffff", "--caret": "#ffffff", "--error": "#ff6b6b", "--glow": "rgba(255,255,255,.3)" } },
];

/**
 * Ambient scenes for Focus mode. One canvas, procedural, paused when hidden.
 * Keystrokes (`clack:key`) nudge the scene: stars pulse, windows light up,
 * the fire flares, rain beads on the glass.
 */
export function Scene({ id }: { id: SceneId }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduced = document.documentElement.dataset.motion === "reduced";
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setup();
    };
    let energy = 0;
    let t = 0;
    const R = Math.random;

    // scene state
    let stars: { x: number; y: number; z: number }[] = [];
    let drops: { x: number; y: number; v: number; l: number }[] = [];
    let beads: { x: number; y: number; r: number; slide: number }[] = [];
    let bokeh: { x: number; y: number; r: number; hue: number }[] = [];
    let buildings: { x: number; w: number; h: number; windows: { x: number; y: number; on: number }[] }[] = [];
    let motes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    let cols: { y: number; speed: number; lit: number }[] = [];

    function setup() {
      stars = Array.from({ length: 420 }, () => ({ x: (R() - 0.5) * w, y: (R() - 0.5) * h, z: R() * w }));
      drops = Array.from({ length: 160 }, () => ({ x: R() * w, y: R() * h, v: 8 + R() * 10, l: 10 + R() * 18 }));
      beads = Array.from({ length: 70 }, () => ({ x: R() * w, y: R() * h, r: 1 + R() * 3.5, slide: 0 }));
      bokeh = Array.from({ length: 26 }, () => ({ x: R() * w, y: h * (0.4 + R() * 0.6), r: 20 + R() * 60, hue: R() < 0.5 ? 35 : 200 + R() * 60 }));
      buildings = [];
      let x = -20;
      while (x < w + 40) {
        const bw = 40 + R() * 90;
        const bh = h * (0.15 + R() * 0.45);
        const windows = [];
        for (let wy = h - bh + 12; wy < h - 10; wy += 16) for (let wx = x + 8; wx < x + bw - 8; wx += 14) windows.push({ x: wx, y: wy, on: R() < 0.18 ? 0.6 + R() * 0.4 : 0 });
        buildings.push({ x, w: bw, h: bh, windows });
        x += bw + 4 + R() * 10;
      }
      motes = Array.from({ length: 60 }, () => ({ x: R() * w, y: R() * h, vx: (R() - 0.5) * 0.2, vy: -0.05 - R() * 0.2, r: 0.6 + R() * 1.6 }));
      cols = Array.from({ length: Math.ceil(w / 18) }, () => ({ y: R() * h, speed: 0.3 + R() * 1.2, lit: 0 }));
    }
    resize();

    const onKey = (e: Event) => {
      const correct = (e as CustomEvent<{ correct: boolean }>).detail?.correct !== false;
      energy = Math.min(2, energy + (correct ? 0.12 : 0.04));
      if (id === "city") {
        const b = buildings[(R() * buildings.length) | 0];
        const win = b?.windows[(R() * b.windows.length) | 0];
        if (win) win.on = 1;
      } else if (id === "rain") {
        beads.push({ x: R() * w, y: R() * h * 0.8, r: 1.5 + R() * 3, slide: 0 });
        if (beads.length > 140) beads.shift();
      } else if (id === "terminal") {
        const col = cols[(R() * cols.length) | 0];
        if (col) col.lit = 1;
      }
    };

    let raf = 0;
    const frame = () => {
      t++;
      energy *= 0.97;
      ctx.clearRect(0, 0, w, h);
      if (id === "space") {
        const cx = w / 2;
        const cy = h / 2;
        const speed = 1.2 + energy * 6;
        for (const s of stars) {
          s.z -= speed;
          if (s.z <= 1) {
            s.z = w;
            s.x = (R() - 0.5) * w;
            s.y = (R() - 0.5) * h;
          }
          const k = 180 / s.z;
          const px = cx + s.x * k;
          const py = cy + s.y * k;
          const r = Math.max(0.3, (1 - s.z / w) * 2.2);
          ctx.globalAlpha = Math.min(1, (1 - s.z / w) * (0.8 + energy * 0.4));
          ctx.fillStyle = "#e8ebff";
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
        const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 10, w * 0.7, h * 0.3, w * 0.5);
        g.addColorStop(0, `rgba(182,156,255,${0.08 + energy * 0.04})`);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      } else if (id === "rain") {
        for (const b of bokeh) {
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, `hsla(${b.hue},80%,65%,0.16)`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
        ctx.strokeStyle = "rgba(200,220,255,0.18)";
        ctx.lineWidth = 1;
        for (const d of drops) {
          d.y += d.v;
          d.x -= d.v * 0.12;
          if (d.y > h) {
            d.y = -20;
            d.x = R() * w * 1.1;
          }
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.l * 0.12, d.y - d.l);
          ctx.stroke();
        }
        for (const b of beads) {
          if (R() < 0.002 + energy * 0.003) b.slide = 1.5 + R() * 2;
          if (b.slide > 0) {
            b.y += b.slide;
            b.slide *= 0.985;
            if (b.slide < 0.05) b.slide = 0;
          }
          if (b.y > h + 5) {
            b.y = -5;
            b.x = R() * w;
          }
          ctx.fillStyle = "rgba(220,235,255,0.35)";
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (id === "city") {
        ctx.fillStyle = "rgba(255,240,200,0.9)";
        ctx.beginPath();
        ctx.arc(w * 0.82, h * 0.18, 34, 0, Math.PI * 2);
        ctx.fill();
        for (const b of buildings) {
          ctx.fillStyle = "#07050d";
          ctx.fillRect(b.x, h - b.h, b.w, b.h);
          for (const win of b.windows) {
            if (win.on > 0) {
              ctx.fillStyle = `rgba(255,207,92,${win.on * 0.85})`;
              ctx.fillRect(win.x, win.y, 7, 9);
              if (win.on < 0.6 && R() < 0.001) win.on = 0;
              if (win.on > 0.6) win.on -= 0.0015;
            }
          }
        }
        ctx.fillStyle = `rgba(255,207,92,${0.04 + energy * 0.03})`;
        ctx.fillRect(0, h * 0.6, w, h * 0.4);
      } else if (id === "cozy") {
        const flick = 0.75 + Math.sin(t / 7) * 0.08 + Math.sin(t / 3.3) * 0.05 + energy * 0.25;
        const g = ctx.createRadialGradient(w * 0.5, h * 1.05, 10, w * 0.5, h * 1.05, h * 0.9 * flick);
        g.addColorStop(0, "rgba(255,150,60,0.55)");
        g.addColorStop(0.4, "rgba(255,110,40,0.18)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        for (const m of motes) {
          m.x += m.vx;
          m.y += m.vy * (1 + energy);
          if (m.y < -5) {
            m.y = h + 5;
            m.x = R() * w;
          }
          ctx.fillStyle = "rgba(255,210,160,0.35)";
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (id === "terminal") {
        ctx.font = "14px monospace";
        cols.forEach((col, i) => {
          col.y += col.speed * (1 + energy);
          if (col.y > h + 20) col.y = -20;
          col.lit *= 0.96;
          ctx.fillStyle = `rgba(57,255,20,${0.06 + col.lit * 0.6})`;
          ctx.fillText(String.fromCharCode(0x30a0 + ((t / 8 + i * 7) | 0) % 96), i * 18, col.y);
        });
        ctx.fillStyle = "rgba(57,255,20,0.03)";
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      }
      ctx.globalAlpha = 1;
      if (!reduced && !document.hidden) raf = requestAnimationFrame(frame);
    };
    frame();
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", resize);
    window.addEventListener("clack:key", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("clack:key", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [id]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden />;
}
