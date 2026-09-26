"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/stores/settings";
import { getTheme, type Atmosphere } from "@/lib/themes";

/**
 * Theme atmosphere. Procedural and cheap: one canvas (capped DPR, paused when
 * hidden) plus CSS layers. Every keystroke dispatches `clack:key`, which adds
 * "energy" that the scene spends on a subtle reaction.
 */

function useAtmosphere(): { atmos: Atmosphere; enabled: boolean; id: string } {
  const theme = useSettings((s) => s.theme);
  const follow = useSettings((s) => s.followSystem);
  const dark = useSettings((s) => s.darkTheme);
  const light = useSettings((s) => s.lightTheme);
  const fx = useSettings((s) => s.backgroundFx);
  let id = theme;
  if (follow && typeof window !== "undefined") {
    id = window.matchMedia("(prefers-color-scheme: dark)").matches ? dark : light;
  }
  return { atmos: getTheme(id).atmosphere, enabled: fx, id };
}

export function Background() {
  const { atmos, enabled, id } = useAtmosphere();
  const pathname = usePathname();
  if (pathname === "/focus") return null; // focus mode brings its own scenery
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {atmos === "aurora" && <Aurora />}
      {atmos === "nebula" && <Nebula />}
      {atmos === "synth" && <SynthFloor animate={enabled} />}
      {atmos === "scanlines" && <Scanlines />}
      {atmos === "paper" && <PaperLines />}
      {atmos !== "void" && atmos !== "paper" && atmos !== "scanlines" && <CanvasScene key={id} atmos={atmos} animate={enabled} />}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 40%, color-mix(in oklab, var(--bg) 70%, transparent) 100%)" }} />
    </div>
  );
}

function Aurora() {
  return (
    <div className="absolute inset-0 opacity-70">
      <div className="absolute -left-1/4 top-[-20%] h-[70vh] w-[70vw] rounded-full blur-[120px]" style={{ background: "color-mix(in oklab, var(--accent) 22%, transparent)", animation: "aurora-a 24s ease-in-out infinite alternate" }} />
      <div className="absolute right-[-20%] top-[10%] h-[60vh] w-[60vw] rounded-full blur-[140px]" style={{ background: "color-mix(in oklab, var(--accent-2) 20%, transparent)", animation: "aurora-b 30s ease-in-out infinite alternate" }} />
      <style>{`@keyframes aurora-a{to{transform:translate(18vw,12vh) scale(1.2)}}@keyframes aurora-b{to{transform:translate(-22vw,18vh) scale(.9)}}`}</style>
    </div>
  );
}

function Nebula() {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-[10%] top-[5%] h-[60vh] w-[60vw] rounded-full blur-[130px]" style={{ background: "color-mix(in oklab, var(--accent) 25%, transparent)", animation: "aurora-a 28s ease-in-out infinite alternate" }} />
      <div className="absolute bottom-[-10%] right-[0%] h-[60vh] w-[50vw] rounded-full blur-[120px]" style={{ background: "color-mix(in oklab, var(--accent-2) 22%, transparent)", animation: "aurora-b 34s ease-in-out infinite alternate" }} />
      <style>{`@keyframes aurora-a{to{transform:translate(18vw,12vh) scale(1.2)}}@keyframes aurora-b{to{transform:translate(-22vw,-12vh) scale(.9)}}`}</style>
    </div>
  );
}

function Scanlines() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 2px, color-mix(in oklab, var(--accent) 7%, transparent) 2px 3px)" }}
      />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, color-mix(in oklab, var(--accent) 7%, transparent), transparent 65%)", animation: "crt-flicker 6s infinite" }} />
      <style>{`@keyframes crt-flicker{0%,100%{opacity:.9}47%{opacity:.8}50%{opacity:1}53%{opacity:.85}}`}</style>
    </div>
  );
}

function PaperLines() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 35px, var(--grid) 35px 36px)" }} />
      <div className="absolute bottom-0 left-[8vw] top-0 w-px" style={{ background: "color-mix(in oklab, var(--accent) 30%, transparent)" }} />
    </div>
  );
}

function SynthFloor({ animate }: { animate: boolean }) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[30vh] overflow-hidden" style={{ perspective: "320px" }}>
      <div
        className="absolute left-1/2 top-[-38%] h-[34vh] w-[34vh] -translate-x-1/2 rounded-full opacity-[0.18] blur-[2px]"
        style={{ background: "linear-gradient(to bottom, var(--accent-3), var(--accent-2) 70%)", maskImage: "repeating-linear-gradient(to bottom, black 0 12px, transparent 12px 16px)" }}
      />
      <div
        className="absolute inset-x-[-50%] bottom-[-10%] h-[200%]"
        style={{
          transform: "rotateX(72deg)",
          transformOrigin: "bottom",
          backgroundImage: "linear-gradient(var(--grid) 2px, transparent 2px), linear-gradient(90deg, var(--grid) 2px, transparent 2px)",
          backgroundSize: "60px 60px",
          animation: animate ? "synth-move 1.6s linear infinite" : undefined,
          maskImage: "linear-gradient(to top, black 30%, transparent)",
        }}
      />
      <style>{`@keyframes synth-move{to{background-position:0 60px}}`}</style>
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  rot: number;
  life: number;
}

function CanvasScene({ atmos, animate }: { atmos: Atmosphere; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = document.documentElement.dataset.motion === "reduced";
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let fg = "#fff";
    let accent = "#ff6b3d";
    let accent2 = "#8ab4ff";
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      fg = css.getPropertyValue("--fg").trim() || fg;
      accent = css.getPropertyValue("--accent").trim() || accent;
      accent2 = css.getPropertyValue("--accent-2").trim() || accent2;
    };
    readColors();

    let energy = 0;
    let mx = -9999;
    let my = -9999;
    const ripples: { x: number; y: number; r: number; a: number }[] = [];
    const parts: Particle[] = [];

    const onKey = (e: Event) => {
      const correct = (e as CustomEvent<{ correct: boolean }>).detail?.correct !== false;
      energy = Math.min(1.6, energy + (correct ? 0.12 : 0.05));
      if (atmos === "grid" && ripples.length < 6 && Math.random() < 0.18) {
        ripples.push({ x: w * (0.3 + Math.random() * 0.4), y: h * (0.35 + Math.random() * 0.2), r: 0, a: 0.5 });
      }
      if (atmos === "embers") {
        for (let i = 0; i < 2; i++) spawnEmber(true);
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const spawnPetal = (initial = false): Particle => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -20,
      vx: 0.2 + Math.random() * 0.5,
      vy: 0.3 + Math.random() * 0.6,
      r: 4 + Math.random() * 5,
      a: 0.25 + Math.random() * 0.4,
      rot: Math.random() * Math.PI,
      life: 1,
    });
    function spawnEmber(burst = false) {
      parts.push({
        x: burst ? w * (0.2 + Math.random() * 0.6) : Math.random() * w,
        y: h + 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.4 + Math.random() * (burst ? 1.6 : 0.8)),
        r: 0.8 + Math.random() * 1.8,
        a: 0.5 + Math.random() * 0.5,
        rot: 0,
        life: 1,
      });
    }
    const spawnStar = (): Particle => ({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, r: Math.random() * 1.2 + 0.2, a: Math.random(), rot: Math.random() * 6, life: 1 });

    if (atmos === "petals") for (let i = 0; i < 26; i++) parts.push(spawnPetal(true));
    if (atmos === "aurora" || atmos === "nebula") for (let i = 0; i < 120; i++) parts.push(spawnStar());
    if (atmos === "embers") for (let i = 0; i < 30; i++) {
      spawnEmber();
      parts[i].y = Math.random() * h;
    }

    let raf = 0;
    let t = 0;
    const frame = () => {
      t += 1;
      if (t % 60 === 1) readColors();
      ctx.clearRect(0, 0, w, h);
      energy *= 0.965;

      if (atmos === "grid" || atmos === "synth") {
        const gap = 34;
        ctx.fillStyle = fg;
        for (let y = gap / 2; y < h; y += gap) {
          for (let x = gap / 2; x < w; x += gap) {
            let px = x;
            let py = y;
            const dx = x - mx;
            const dy = y - my;
            const d2 = dx * dx + dy * dy;
            let boost = 0;
            if (d2 < 160 * 160) {
              const d = Math.sqrt(d2) || 1;
              const f = (1 - d / 160) ** 2;
              px += (dx / d) * f * 14;
              py += (dy / d) * f * 14;
              boost = f * 0.25;
            }
            for (const rp of ripples) {
              const rd = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rp.r);
              if (rd < 18) boost += (1 - rd / 18) * rp.a * 0.5;
            }
            ctx.globalAlpha = 0.07 + boost + energy * 0.03;
            ctx.fillRect(px - 0.75, py - 0.75, 1.5, 1.5);
          }
        }
        for (let i = ripples.length - 1; i >= 0; i--) {
          ripples[i].r += 5;
          ripples[i].a *= 0.975;
          if (ripples[i].a < 0.02) ripples.splice(i, 1);
        }
      } else if (atmos === "petals") {
        for (const p of parts) {
          p.x += p.vx + energy * 1.2 + Math.sin((t + p.rot * 100) / 60) * 0.3;
          p.y += p.vy;
          p.rot += 0.01 + energy * 0.02;
          if (p.y > h + 20 || p.x > w + 20) Object.assign(p, spawnPetal(), { x: Math.random() * w * 0.8 - 40 });
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.a;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (atmos === "embers") {
        if (Math.random() < 0.3) spawnEmber();
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.x += p.vx + Math.sin((t + i * 13) / 30) * 0.2;
          p.y += p.vy * (1 + energy);
          p.life -= 0.0025;
          if (p.y < -10 || p.life <= 0) {
            parts.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = p.a * p.life;
          ctx.fillStyle = i % 3 ? accent : accent2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (parts.length > 220) parts.splice(0, parts.length - 220);
      } else if (atmos === "waves") {
        ctx.lineWidth = 1;
        for (let k = 0; k < 7; k++) {
          ctx.beginPath();
          ctx.strokeStyle = k % 2 ? accent : accent2;
          ctx.globalAlpha = 0.06 + energy * 0.04;
          const base = h * (0.55 + k * 0.06);
          for (let x = 0; x <= w; x += 12) {
            const y = base + Math.sin(x / (140 + k * 20) + t / (90 - k * 6)) * (14 + k * 3 + energy * 18) + Math.sin(x / 57 + t / 50) * 4;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (atmos === "aurora" || atmos === "nebula") {
        for (const p of parts) {
          const tw = 0.5 + 0.5 * Math.sin(t / 40 + p.rot);
          ctx.globalAlpha = Math.min(1, p.a * tw * 0.7 + energy * 0.35 * p.a);
          ctx.fillStyle = fg;
          ctx.fillRect(p.x, p.y, p.r + energy, p.r + energy);
        }
      }
      ctx.globalAlpha = 1;
      if (animate && !reduced && !document.hidden) raf = requestAnimationFrame(frame);
    };

    frame();
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && animate && !reduced) raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", resize);
    window.addEventListener("clack:key", onKey);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("clack:key", onKey);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [atmos, animate]);

  return <canvas ref={ref} className="absolute inset-0" />;
}
