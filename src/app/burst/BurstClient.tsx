"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Zap } from "lucide-react";
import { PageShell, Segmented } from "@/components/ui/primitives";
import { TypingSurface } from "@/components/typing/TypingSurface";
import type { FinishedRun, LiveStats } from "@/components/typing/session";
import { Countdown } from "@/components/lab/Countdown";
import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";
import { bestWindowWpm } from "@/lib/bursts";
import { useHistory } from "@/stores/history";
import { RollingNumber } from "@/components/ui/RollingNumber";

type Phase = "idle" | "countdown" | "run" | "done";

/** Speed Burst: a 5–10 second drag race for raw speed. */
export function BurstClient() {
  const [seconds, setSeconds] = useState<5 | 10>(10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [nonce, setNonce] = useState(0);
  const [run, setRun] = useState<FinishedRun | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const speedo = useRef<HTMLSpanElement>(null);
  const config = useMemo<TestConfig>(() => ({ ...DEFAULT_CONFIG, mode: "time", duration: seconds }), [seconds]);

  const launch = useCallback(() => {
    setRun(null);
    setPhase("countdown");
  }, []);

  const doneAt = useRef(0);
  useEffect(() => {
    if (phase !== "idle" && phase !== "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]")) return;
      // don't let a trailing keystroke from the run skip past the results
      if (phase === "done" && (e.key === " " || performance.now() - doneAt.current < 700)) return;
      if (e.key === " " || e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        launch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, launch]);

  const onTick = useCallback((l: LiveStats) => {
    if (bar.current) bar.current.style.transform = `scaleX(${l.progress})`;
    if (speedo.current) speedo.current.textContent = String(Math.round(l.raw));
  }, []);

  const onFinish = useCallback(async (r: FinishedRun) => {
    doneAt.current = performance.now();
    setPhase("done");
    if (r.record.keystrokes > 3) {
      const saved = await useHistory.getState().add(r.input, r.record, r.log);
      setRun({ ...r, record: saved.record });
    } else setRun(r);
  }, []);

  const stats = run
    ? {
        peak: run.result.peakWpm,
        avg: run.record.wpm,
        best1: bestWindowWpm(run.result, 1000),
        best5: bestWindowWpm(run.result, 5000),
      }
    : null;

  return (
    <PageShell wide>
      <div className="flex min-h-[70vh] flex-col items-center justify-center">
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="label mb-6 !text-accent">experimental · drag race</div>
            <h1 className="display text-[clamp(6rem,20vw,15rem)] font-bold italic tracking-tighter text-fg" style={{ fontVariationSettings: '"wdth" 75, "wght" 800' }}>
              BURST
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sub">A few seconds of pure speed. Short common words, no mercy, no second chances.</p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Segmented id="burst-len" label="Burst length" value={seconds} onChange={setSeconds} options={[{ id: 5 as const, label: "5s" }, { id: 10 as const, label: "10s" }]} />
              <button onClick={launch} className="press inline-flex items-center gap-2 bg-accent px-6 py-3 font-mono text-sm text-on-accent" style={{ borderRadius: "var(--radius)" }}>
                <Zap size={15} /> launch <span className="opacity-60">space</span>
              </button>
            </div>
          </motion.div>
        )}

        {phase === "countdown" && <Countdown word="BURST" onDone={() => {
          setNonce((n) => n + 1);
          setPhase("run");
        }} />}

        {phase === "run" && (
          <div className="w-full max-w-5xl">
            <div className="mb-4 flex items-end justify-between">
              <span className="font-mono text-sm text-sub">
                <span ref={speedo} className="display text-6xl font-bold text-accent">
                  0
                </span>{" "}
                raw wpm
              </span>
              <span className="label">first key starts the clock</span>
            </div>
            <div className="mb-6 h-1 overflow-hidden bg-bg3" style={{ borderRadius: 999 }}>
              <div ref={bar} className="h-full origin-left bg-accent" style={{ transform: "scaleX(0)", boxShadow: "0 0 12px var(--glow)" }} />
            </div>
            <TypingSurface config={config} nonce={nonce} lines={2} onTick={onTick} onFinish={onFinish} onRestart={launch} />
          </div>
        )}

        {phase === "done" && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl">
            <div className="label mb-4 !text-accent">burst · {seconds}s</div>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                ["peak", stats.peak],
                ["average", stats.avg],
                ["best 1s", stats.best1],
                ["best 5s", stats.best5],
              ].map(([label, v], i) => (
                <div key={label as string} className="border-t border-line pt-3">
                  <div className="label">{label}</div>
                  <div className={`display mt-2 font-bold ${i === 0 ? "text-7xl text-accent" : "text-6xl text-fg"}`}>
                    <RollingNumber value={v as number} delay={i * 0.12} />
                  </div>
                  <div className="font-mono text-xs text-faint">wpm</div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-4">
              <button onClick={launch} className="press inline-flex items-center gap-2 bg-accent px-5 py-3 font-mono text-sm text-on-accent" style={{ borderRadius: "var(--radius)" }}>
                <Zap size={15} /> again <span className="opacity-60">tab</span>
              </button>
              <span className="font-mono text-xs text-faint">accuracy {run!.record.accuracy.toFixed(1)}% · {run!.record.keystrokes} keystrokes</span>
            </div>
          </motion.div>
        )}
      </div>
    </PageShell>
  );
}
