"use client";

import { useEffect, useRef, useState } from "react";
import { useUI } from "@/stores/ui";
import { useSettings } from "@/stores/settings";

/**
 * Hidden things. Deliberately undocumented in the UI.
 */

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const SECRET_PHRASE = "into the nebula";

function barrelRoll() {
  if (document.documentElement.dataset.motion === "reduced") return;
  document.body.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
    duration: 1100,
    easing: "cubic-bezier(0.65, 0, 0.35, 1)",
  });
}

let matrixTrigger: (() => void) | null = null;

export const triggerEasterEgg = {
  match(q: string): { label: string; run: () => void } | null {
    const s = q.trim().toLowerCase();
    if (s === "sudo make me a sandwich") return { label: "sudo make me a sandwich", run: () => useUI.getState().toast({ title: "okay.", body: "🥪 (it's a very small sandwich)" }) };
    if (s === "make me a sandwich") return { label: "make me a sandwich", run: () => useUI.getState().toast({ title: "what? make it yourself.", tone: "error" }) };
    if (s === "do a barrel roll" || s === "barrel roll") return { label: "do a barrel roll", run: barrelRoll };
    if (s === "matrix" || s === "follow the white rabbit") return { label: "wake up…", run: () => matrixTrigger?.() };
    if (s === "hello" || s === "hello world") return { label: "hello?", run: () => useUI.getState().toast({ title: "hello, human.", body: "now type something beautiful." }) };
    if (s === "clack") return { label: "clack clack clack", run: () => useUI.getState().toast({ title: "clack.", body: "that's the sound a good idea makes." }) };
    return null;
  },
};

export function EasterEggs() {
  const [comet, setComet] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const progress = useRef(0);
  const typed = useRef("");

  useEffect(() => {
    matrixTrigger = () => setMatrix(true);
    const onKey = (e: KeyboardEvent) => {
      const expected = KONAMI[progress.current];
      if (e.key === expected || e.key.toLowerCase() === expected) {
        progress.current++;
        if (progress.current === KONAMI.length) {
          progress.current = 0;
          setComet(true);
          useUI.getState().toast({ title: "↑↑↓↓←→←→ba", body: "cursor upgraded. for a while.", tone: "accent" });
          setTimeout(() => setComet(false), 30000);
        }
      } else {
        progress.current = e.key === KONAMI[0] ? 1 : 0;
      }
    };
    const onTyped = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail.key;
      if (key.length !== 1) return;
      typed.current = (typed.current + key.toLowerCase()).slice(-SECRET_PHRASE.length);
      if (typed.current === SECRET_PHRASE) {
        const s = useSettings.getState();
        if (!s.unlockedThemes.includes("nebula")) {
          s.set({ unlockedThemes: [...s.unlockedThemes, "nebula"] });
          useUI.getState().toast({ title: "a new theme drifted in.", body: "look for Nebula in the theme list.", tone: "accent" });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("clack:key", onTyped);
    return () => {
      matrixTrigger = null;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("clack:key", onTyped);
    };
  }, []);

  return (
    <>
      {comet && <CometCursor />}
      {matrix && <MatrixRain onDone={() => setMatrix(false)} />}
    </>
  );
}

function CometCursor() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
    };
    resize();
    const pts: { x: number; y: number; life: number }[] = [];
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff6b3d";
    const move = (e: PointerEvent) => pts.push({ x: e.clientX * dpr, y: e.clientY * dpr, life: 1 });
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.life -= 0.035;
        if (p.life <= 0) {
          pts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 * dpr * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener("pointermove", move);
    window.addEventListener("resize", resize);
    document.documentElement.style.cursor = "crosshair";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", resize);
      document.documentElement.style.cursor = "";
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[90] h-full w-full" aria-hidden />;
}

function MatrixRain({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    c.width = innerWidth;
    c.height = innerHeight;
    const size = 16;
    const cols = Math.ceil(c.width / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const glyphs = "clack.アカサタナハマヤラワ0123456789{}[]<>/=+*";
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#39ff14";
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#000";
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = now - start;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = t > 5000 ? Math.max(0, 1 - (t - 5000) / 1000) : 1;
      ctx.fillStyle = accent;
      ctx.font = `${size}px monospace`;
      for (let i = 0; i < cols; i++) {
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, drops[i] * size);
        drops[i] += 0.6 + Math.random() * 0.5;
        if (drops[i] * size > c.height && Math.random() > 0.975) drops[i] = 0;
      }
      if (t < 6000) raf = requestAnimationFrame(loop);
      else onDone();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[70] h-full w-full opacity-80" aria-hidden />;
}
