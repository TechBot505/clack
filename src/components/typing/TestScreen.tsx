"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Smartphone } from "lucide-react";
import { TypingSurface, type TypingSurfaceHandle } from "./TypingSurface";
import { TestConfigBar } from "./TestConfigBar";
import { LiveStats, type LiveStatsHandle } from "./LiveStats";
import type { FinishedRun, LiveStats as Live } from "./session";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { useHistory } from "@/stores/history";
import type { PbImprovement } from "@/lib/records";
import type { TestConfig } from "@/engine/types";
import { MIN_VALID_MS } from "@/engine/config";
import { getLocal, setLocal } from "@/lib/local-store";
import { KeyboardOverlay } from "@/components/KeyboardOverlay";

const ResultsView = dynamic(() => import("@/components/results/ResultsView").then((m) => m.ResultsView), {
  ssr: false,
  loading: () => <div className="mx-auto h-[60vh] w-full max-w-[1200px]" />,
});

export interface Override {
  config: Partial<TestConfig>;
  fixed?: { seed?: string; sourceId?: string; text?: string };
  label?: string;
}

interface Finished {
  run: FinishedRun;
  pbs: PbImprovement[];
  firstTest: boolean;
}

export function TestScreen({ override }: { override?: Override | null }) {
  const router = useRouter();
  const baseConfig = useSettings((s) => s.test);
  const showWpm = useSettings((s) => s.showLiveWpm);
  const showAcc = useSettings((s) => s.showLiveAcc);
  const showTimer = useSettings((s) => s.showTimer);
  const showProgress = useSettings((s) => s.showProgress);
  const showKeyboard = useSettings((s) => s.showKeyboard);
  const restartNonce = useUI((s) => s.restartNonce);
  const history = useHistory((s) => s.tests);

  const [nonce, setNonce] = useState(0);
  const [fixed, setFixed] = useState<Override["fixed"]>(override?.fixed);
  const [activeOverride, setActiveOverride] = useState<Override | null | undefined>(override);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [touch, setTouch] = useState(false);
  const surface = useRef<TypingSurfaceHandle>(null);
  const live = useRef<LiveStatsHandle>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = useMemo<TestConfig>(
    () => (activeOverride ? { ...baseConfig, ...activeOverride.config } : baseConfig),
    [baseConfig, activeOverride],
  );
  const flow = config.flow;
  const lines = config.mode === "code" ? 5 : 3;

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const restart = useCallback((keepText = false) => {
    setFinished(null);
    if (!keepText) setFixed(activeOverride?.fixed);
    setNonce((n) => n + 1);
  }, [activeOverride]);

  // config changes from the bar start a fresh test (and drop any shared override)
  const firstConfig = useRef(true);
  useEffect(() => {
    if (firstConfig.current) {
      firstConfig.current = false;
      return;
    }
    setActiveOverride(null);
    setFixed(undefined);
    setFinished(null);
  }, [baseConfig]);

  // palette / shortcuts can request a restart
  const firstNonce = useRef(restartNonce);
  useEffect(() => {
    if (restartNonce === firstNonce.current) return;
    firstNonce.current = restartNonce;
    setActiveOverride(null);
    setFixed(undefined);
    restart();
  }, [restartNonce, restart]);

  useEffect(() => {
    live.current?.reset(config.mode === "time" ? String(config.duration) : config.mode === "custom" && config.customTimer ? String(config.customTimer) : "");
  }, [config, nonce]);

  // keys that work while results are showing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUI.getState().paletteOpen || document.querySelector("[role=dialog]")) return;
      const q = useSettings.getState().quickRestart;
      if (e.key === "Escape" && q !== "esc") {
        e.preventDefault();
        useUI.getState().openPalette();
        return;
      }
      if (!finished) return;
      if (e.key === "Tab" || (e.key === "Escape" && q === "esc")) {
        e.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, restart]);

  const onTick = useCallback((l: Live) => live.current?.update(l), []);

  const onKey = useCallback(() => {
    if (!flow) return;
    // flow: chrome slips away while typing, returns when you pause
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => useUI.getState().setTyping(false), 2500);
  }, [flow]);

  const onFinish = useCallback(
    async (run: FinishedRun) => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      const tooShort = run.record.durationMs < 1000 || run.record.keystrokes < 2;
      if (tooShort) {
        restart();
        return;
      }
      const firstTest = !getLocal<boolean>("has-finished", false);
      setLocal("has-finished", true);
      let pbs: PbImprovement[] = [];
      let record = run.record;
      if (run.record.durationMs >= MIN_VALID_MS || run.record.mode !== "time") {
        const saved = await useHistory.getState().add(run.input, run.record, run.log);
        pbs = saved.pbs;
        record = saved.record;
      }
      setFinished({ run: { ...run, record }, pbs, firstTest });
    },
    [restart],
  );

  const onRestart = useCallback(() => restart(), [restart]);

  return (
    <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 sm:px-8">
      <AnimatePresence mode="wait" initial={false}>
        {!finished ? (
          <motion.div
            key="test"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
          >
            <div className="chrome pt-2">
              <TestConfigBar onCustomEdit={() => router.push("/practice#custom")} />
              {activeOverride?.label && (
                <div className="mt-3 text-center font-mono text-xs text-accent">
                  {activeOverride.label} ·{" "}
                  <button className="underline decoration-dotted underline-offset-4 hover:text-fg" onClick={() => { setActiveOverride(null); setFixed(undefined); restart(); }}>
                    leave
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-center py-10 sm:py-16">
              {!flow && <LiveStats ref={live} showWpm={showWpm} showAcc={showAcc} showTimer={showTimer} showProgress={showProgress} />}
              <TypingSurface
                ref={surface}
                config={config}
                nonce={nonce}
                fixed={fixed}
                lines={lines}
                onTick={onTick}
                onFinish={onFinish}
                onRestart={onRestart}
                onKey={onKey}
              />
              <div className="chrome mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => restart()}
                  className="press grid h-10 w-10 place-items-center text-sub hover:text-fg"
                  aria-label="Restart test"
                  title="Restart (tab)"
                >
                  <RotateCcw size={17} />
                </button>
              </div>
              {touch && (
                <p className="chrome mt-6 flex items-center justify-center gap-2 text-center font-mono text-xs text-faint">
                  <Smartphone size={13} /> tap the words to bring up your keyboard. a physical keyboard is where clack. really sings.
                </p>
              )}
              {showKeyboard && !touch && <KeyboardOverlay />}
            </div>
          </motion.div>
        ) : (
          <motion.div key="results" className="py-6 sm:py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultsView
              record={finished.run.record}
              result={finished.run.result}
              pbs={finished.pbs}
              history={history}
              cinematic={flow}
              firstTest={finished.firstTest}
              onNext={() => restart()}
              onRepeat={() => {
                const r = finished.run.record;
                setFixed({ seed: r.seed ?? undefined, sourceId: r.sourceId ?? undefined, text: r.customText ?? undefined });
                restart(true);
              }}
              replayHref={`/history/${encodeURIComponent(finished.run.record.id)}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
