"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Target } from "lucide-react";
import { PageShell, Segmented } from "@/components/ui/primitives";
import { Slider } from "@/components/ui/controls";
import { TypingSurface } from "@/components/typing/TypingSurface";
import type { FinishedRun } from "@/components/typing/session";
import type { InputEffect } from "@/engine/engine";
import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";
import { paceScore } from "@/lib/bursts";
import { useHistory } from "@/stores/history";
import { computeTotals } from "@/lib/records";
import { RollingNumber } from "@/components/ui/RollingNumber";

/**
 * Consistency Challenge: hold a target speed. Your live pace is drawn against
 * the target line; the closer you stay, the higher the score.
 */
export function PaceClient() {
  const tests = useHistory((s) => s.tests);
  const suggested = useMemo(() => {
    const avg = computeTotals(tests).avgWpm;
    return avg ? Math.max(30, Math.round(avg / 5) * 5) : 60;
  }, [tests]);
  const [target, setTarget] = useState<number | null>(null);
  const tgt = target ?? suggested;
  const [seconds, setSeconds] = useState<30 | 60>(30);
  const [nonce, setNonce] = useState(0);
  const [done, setDone] = useState<{ run: FinishedRun; score: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef<number[]>([]);
  const trail = useRef<{ t: number; wpm: number }[]>([]);
  const start = useRef<number | null>(null);
  const config = useMemo<TestConfig>(() => ({ ...DEFAULT_CONFIG, mode: "time", duration: seconds }), [seconds]);

  const reset = useCallback(() => {
    keys.current = [];
    trail.current = [];
    start.current = null;
    setDone(null);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!done) return;
    // ignore the keystroke that finished the run (it's still bubbling when this registers)
    const since = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.timeStamp <= since) return;
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, reset]);

  // live chart
  useEffect(() => {
    if (done) return;
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (c.width !== w * dpr) {
          c.width = w * dpr;
          c.height = h * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const css = getComputedStyle(document.documentElement);
        const accent = css.getPropertyValue("--accent").trim();
        const fg = css.getPropertyValue("--fg").trim();
        const faint = css.getPropertyValue("--faint").trim();
        const maxY = tgt * 2;
        const y = (v: number) => h - (Math.min(maxY, v) / maxY) * h;
        const now = performance.now();
        if (start.current !== null) {
          const cutoff = now - 2000;
          const recent = keys.current.filter((k) => k >= cutoff).length;
          const elapsed = (now - start.current) / 1000;
          const win = Math.min(2, Math.max(0.5, elapsed));
          const last = trail.current[trail.current.length - 1];
          if (!last || elapsed - last.t > 0.1) trail.current.push({ t: elapsed, wpm: (recent / 5) * (60 / win) });
        }
        const x = (t: number) => (t / seconds) * w;
        // tolerance band ±10%
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(0, y(tgt * 1.1), w, y(tgt * 0.9) - y(tgt * 1.1));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y(tgt));
        ctx.lineTo(w, y(tgt));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = faint;
        ctx.font = "11px monospace";
        ctx.fillText(`target ${tgt}`, 6, y(tgt) - 6);
        const tr = trail.current;
        if (tr.length > 1) {
          ctx.strokeStyle = fg;
          ctx.lineWidth = 2;
          ctx.beginPath();
          tr.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.wpm)) : ctx.moveTo(x(p.t), y(p.wpm))));
          ctx.stroke();
          const lp = tr[tr.length - 1];
          const off = Math.abs(lp.wpm - tgt) / tgt;
          ctx.fillStyle = off <= 0.1 ? accent : fg;
          ctx.beginPath();
          ctx.arc(x(lp.t), y(lp.wpm), 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [done, tgt, seconds]);

  const onKey = useCallback((eff: InputEffect) => {
    const now = performance.now();
    if (start.current === null) start.current = now;
    if ((eff.kind === "char" || eff.kind === "sep") && eff.correct) keys.current.push(now);
  }, []);

  const onFinish = useCallback(
    async (run: FinishedRun) => {
      const score = paceScore(run.record.samples.raw, tgt);
      if (run.record.keystrokes > 5) {
        const saved = await useHistory.getState().add(run.input, run.record, run.log);
        setDone({ run: { ...run, record: saved.record }, score });
      } else setDone({ run, score });
    },
    [tgt],
  );

  return (
    <PageShell wide>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="label mb-3 flex items-center gap-2 !text-accent">
            <Target size={12} /> experimental · consistency challenge
          </div>
          <h1 className="display text-[clamp(2.6rem,6vw,5rem)] font-semibold">
            hold <span className="italic-serif font-normal text-accent">{tgt}</span> wpm
          </h1>
          <p className="mt-2 max-w-lg text-sub">Not faster. Steadier. Stay inside the band and the score climbs; sprinting is as wrong as crawling.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Slider label="Target WPM" value={tgt} min={20} max={200} step={5} onChange={(v) => { setTarget(v); reset(); }} format={(v) => `${v} wpm`} />
          <Segmented id="pace-len" label="Duration" size="sm" value={seconds} onChange={(v) => { setSeconds(v); reset(); }} options={[{ id: 30 as const, label: "30s" }, { id: 60 as const, label: "60s" }]} />
        </div>
      </div>

      {!done ? (
        <>
          <canvas ref={canvas} className="mb-6 h-40 w-full border-y border-line" aria-label="Live pace against the target" role="img" />
          <TypingSurface config={config} nonce={nonce} lines={2} onKey={onKey} onFinish={onFinish} onRestart={reset} />
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap items-end gap-10">
            <div>
              <div className="label">pace score</div>
              <div className="display text-[clamp(6rem,14vw,10rem)] font-bold text-accent">
                <RollingNumber value={done.score} />
              </div>
            </div>
            <div className="mb-6 font-mono text-sm text-sub">
              <div>
                average <span className="text-fg">{done.run.record.wpm.toFixed(0)} wpm</span> vs target {tgt}
              </div>
              <div>
                consistency <span className="text-fg">{done.run.record.consistency.toFixed(0)}%</span>
              </div>
              <div>
                accuracy <span className="text-fg">{done.run.record.accuracy.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <PaceChart raw={done.run.record.samples.raw} t={done.run.record.samples.t} target={tgt} />
          <button onClick={reset} className="press mt-8 bg-accent px-5 py-3 font-mono text-sm text-on-accent" style={{ borderRadius: "var(--radius)" }}>
            again <span className="opacity-60">tab</span>
          </button>
        </motion.div>
      )}
    </PageShell>
  );
}

function PaceChart({ raw, t, target }: { raw: number[]; t: number[]; target: number }) {
  const W = 800;
  const H = 180;
  const maxY = Math.max(target * 2, ...raw);
  const x = (s: number) => (s / Math.max(1, t[t.length - 1] ?? 1)) * W;
  const y = (v: number) => H - (v / maxY) * H;
  const d = raw.map((v, i) => `${i ? "L" : "M"}${x(t[i]).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full border-y border-line" preserveAspectRatio="none" role="img" aria-label="Per-second speed against the target">
      <rect x={0} y={y(target * 1.1)} width={W} height={y(target * 0.9) - y(target * 1.1)} fill="var(--accent)" opacity={0.08} />
      <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--fg)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
