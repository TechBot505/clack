"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Scene, SCENES, type SceneId } from "@/components/lab/Scene";
import { TypingSurface } from "@/components/typing/TypingSurface";
import type { FinishedRun } from "@/components/typing/session";
import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";
import { useHistory } from "@/stores/history";
import { getLocal, setLocal } from "@/lib/local-store";
import { useHydrated } from "@/lib/hooks";

type Session = "zen" | "60" | "300";

/** Focus / Ambient mode: fullscreen, one scene, only words and a caret. */
export function FocusClient() {
  const hydrated = useHydrated();
  const [picked, setPicked] = useState<SceneId | null>(null);
  const scene: SceneId = picked ?? (hydrated ? getLocal<SceneId>("focus-scene", "rain") : "rain");
  const [session, setSession] = useState<Session>("zen");
  const [nonce, setNonce] = useState(0);
  const [done, setDone] = useState<FinishedRun | null>(null);
  const [full, setFull] = useState(false);
  const vars = SCENES.find((s) => s.id === scene)!.vars;
  const config = useMemo<TestConfig>(
    () => (session === "zen" ? { ...DEFAULT_CONFIG, mode: "zen" } : { ...DEFAULT_CONFIG, mode: "time", duration: Number(session) }),
    [session],
  );

  const pick = (id: SceneId) => {
    setPicked(id);
    setLocal("focus-scene", id);
  };
  const again = useCallback(() => {
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
        again();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, again]);

  const toggleFull = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFull(true);
      } else {
        await document.exitFullscreen();
        setFull(false);
      }
    } catch {
      /* not allowed */
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col" style={{ ...(vars as React.CSSProperties), background: vars["--bg"], color: vars["--fg"] }}>
      <Scene id={scene} />
      <div className="chrome relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-4 font-mono text-xs">
          <Link href="/" className="font-display text-lg font-bold" style={{ color: vars["--fg"] }}>
            clack<span style={{ color: vars["--accent"] }}>.</span>
          </Link>
          <span style={{ color: vars["--sub"] }}>focus</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 font-mono text-[0.72rem]">
          {SCENES.map((s) => (
            <button key={s.id} onClick={() => pick(s.id)} aria-pressed={scene === s.id} className="press px-2.5 py-1" style={{ color: scene === s.id ? vars["--accent"] : vars["--sub"] }}>
              {s.name}
            </button>
          ))}
          <span className="mx-2 h-4 w-px" style={{ background: vars["--faint"] }} />
          {(["zen", "60", "300"] as Session[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSession(s);
                again();
              }}
              aria-pressed={session === s}
              className="press px-2.5 py-1"
              style={{ color: session === s ? vars["--accent"] : vars["--sub"] }}
            >
              {s === "zen" ? "free write" : s === "60" ? "1 min" : "5 min"}
            </button>
          ))}
          <button onClick={toggleFull} className="press ml-2 grid h-8 w-8 place-items-center" style={{ color: vars["--sub"] }} aria-label={full ? "Exit fullscreen" : "Enter fullscreen"}>
            {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <Link href="/type" className="press grid h-8 w-8 place-items-center" style={{ color: vars["--sub"] }} aria-label="Leave focus mode">
            <X size={15} />
          </Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 pb-24 sm:px-8">
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div key={`t${nonce}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TypingSurface
                config={config}
                nonce={nonce}
                lines={3}
                onRestart={again}
                onFinish={async (run) => {
                  if (run.record.keystrokes > 5) {
                    const saved = await useHistory.getState().add(run.input, run.record, run.log);
                    setDone({ ...run, record: saved.record });
                  } else again();
                }}
              />
              <p className="chrome mt-10 text-center font-mono text-xs" style={{ color: vars["--faint"] }}>
                {session === "zen" ? "type anything. shift + enter when you're done." : "the clock starts on your first key."}
              </p>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="display text-[clamp(5rem,12vw,9rem)] font-bold">{Math.round(session === "zen" ? done.record.raw : done.record.wpm)}</div>
              <div className="italic-serif text-2xl" style={{ color: vars["--sub"] }}>
                wpm · {done.record.accuracy.toFixed(1)}% · {Math.round(done.record.durationMs / 1000)}s
              </div>
              <button onClick={again} className="press mt-8 px-5 py-2.5 font-mono text-sm" style={{ border: `1px solid ${vars["--faint"]}`, borderRadius: "var(--radius)" }}>
                again <span style={{ color: vars["--faint"] }}>tab</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
