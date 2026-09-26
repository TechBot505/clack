"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Smartphone } from "lucide-react";
import { TypingSurface, type TypingSurfaceHandle } from "./TypingSurface";
import { TestConfigBar } from "./TestConfigBar";
import { LiveStats, type LiveStatsHandle } from "./LiveStats";
import { ghostFromResult, type FinishedRun, type GhostTrack, type LiveStats as Live } from "./session";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { useHistory } from "@/stores/history";
import type { PbImprovement, TestRecord } from "@/lib/records";
import type { TestConfig } from "@/engine/types";
import { MIN_VALID_MS, pbCategories } from "@/engine/config";
import { computePbs } from "@/lib/records";
import { replayInput, type RunInput } from "@/engine/record";
import { getLocal, setLocal } from "@/lib/local-store";
import { KeyboardOverlay } from "@/components/KeyboardOverlay";
import { useMediaQuery } from "@/lib/hooks";
import { progressionFrom, type Progression } from "@/lib/use-progression";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { UNLOCKS } from "@/lib/progression";
import { playSound } from "@/lib/sound";

/** Toast newly unlocked achievements and level-ups (after the result reveal). */
function announceProgress(before: Progression, after: Progression) {
  const fresh = ACHIEVEMENTS.filter((a) => after.achievements[a.id] && !before.achievements[a.id]);
  const s = useSettings.getState();
  fresh.forEach((a, i) =>
    setTimeout(() => {
      useUI.getState().toast({ title: `achievement · ${a.name}`, body: a.description, tone: "accent" });
      playSound("achievement", s.soundPack, s.volume);
    }, 1800 + i * 900),
  );
  if (after.on && after.level > before.level) {
    const unlock = UNLOCKS.find((u) => u.level === after.level);
    setTimeout(
      () => useUI.getState().toast({ title: `level ${after.level}`, body: unlock ? `unlocked: ${unlock.label}` : "keep going.", tone: "accent" }),
      1800 + fresh.length * 900,
    );
  }
}

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

export function TestScreen({
  override,
  lockConfig = false,
  onRecorded,
}: {
  override?: Override | null;
  /** hide the config bar (daily challenge, shared challenges) */
  lockConfig?: boolean;
  onRecorded?: (record: TestRecord, pbs: PbImprovement[]) => void;
}) {
  const router = useRouter();
  const baseConfig = useSettings((s) => s.test);
  const showWpm = useSettings((s) => s.showLiveWpm);
  const showAcc = useSettings((s) => s.showLiveAcc);
  const showTimer = useSettings((s) => s.showTimer);
  const showProgress = useSettings((s) => s.showProgress);
  const showKeyboard = useSettings((s) => s.showKeyboard);
  const ghostOn = useSettings((s) => s.ghost);
  const restartNonce = useUI((s) => s.restartNonce);
  const history = useHistory((s) => s.tests);

  const [nonce, setNonce] = useState(0);
  const [fixed, setFixed] = useState<Override["fixed"]>(override?.fixed);
  const [activeOverride, setActiveOverride] = useState<Override | null | undefined>(override);
  const [finished, setFinished] = useState<Finished | null>(null);
  const touch = useMediaQuery("(pointer: coarse)");
  const surface = useRef<TypingSurfaceHandle>(null);
  const live = useRef<LiveStatsHandle>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });
  const ghostLabel = useRef<HTMLDivElement>(null);
  const [ghostTrack, setGhostTrack] = useState<{ id: string; track: GhostTrack } | null>(null);

  const config = useMemo<TestConfig>(
    () => (activeOverride ? { ...baseConfig, ...activeOverride.config } : baseConfig),
    [baseConfig, activeOverride],
  );
  const flow = config.flow;
  const lines = config.mode === "code" ? 5 : 3;


  // Ghost: replay the personal best for this exact test length as a pace caret.
  const ghostCategory = useMemo(() => {
    if (!ghostOn || (config.mode !== "time" && config.mode !== "words")) return null;
    const cats = pbCategories({ mode: config.mode, mode2: config.mode === "time" ? config.duration : config.wordCount, content: config.content, punctuation: config.punctuation, numbers: config.numbers });
    return cats[0] ?? null;
  }, [ghostOn, config]);
  const ghostSource = useMemo(() => {
    if (!ghostCategory) return null;
    const pb = computePbs(history)[ghostCategory];
    return pb ? history.find((t) => t.id === pb.testId) ?? null : null;
  }, [ghostCategory, history]);
  useEffect(() => {
    if (!ghostSource) return;
    let cancelled = false;
    (async () => {
      const log = await useHistory.getState().getLog(ghostSource.id);
      if (cancelled || !log) return;
      try {
        setGhostTrack({ id: ghostSource.id, track: ghostFromResult(replayInput(ghostSource as unknown as RunInput, log)) });
      } catch {
        /* unreplayable PB: no ghost */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ghostSource]);
  const ghost = ghostSource && ghostTrack?.id === ghostSource.id ? ghostTrack.track : null;

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
    if (ghostLabel.current) {
      ghostLabel.current.textContent = "your ghost is ready. beat it.";
      delete ghostLabel.current.dataset.tone;
    }
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

  const onTick = useCallback((l: Live) => {
    live.current?.update(l);
    const el = ghostLabel.current;
    const d = surface.current?.session()?.ghostDelta();
    if (!el || !d) return;
    const words = Math.round(Math.abs(d.chars) / 5);
    if (Math.abs(d.seconds) >= 0.1 && Math.abs(d.seconds) < 60) {
      el.textContent = `${Math.abs(d.seconds).toFixed(1)}s ${d.seconds > 0 ? "ahead of" : "behind"} your ghost`;
    } else if (words >= 1) {
      el.textContent = `${words} word${words === 1 ? "" : "s"} ${d.chars > 0 ? "ahead of" : "behind"} PB`;
    } else {
      el.textContent = "neck and neck with your ghost";
    }
    el.dataset.tone = d.chars >= 0 ? "ahead" : "behind";
  }, []);

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
        const flags = { ...getLocal<Record<string, boolean>>("eggs", {}), nebula: useSettings.getState().unlockedThemes.includes("nebula") };
        const on = useSettings.getState().progression;
        const before = progressionFrom(useHistory.getState().tests, flags, on);
        const saved = await useHistory.getState().add(run.input, run.record, run.log);
        pbs = saved.pbs;
        record = saved.record;
        announceProgress(before, progressionFrom(useHistory.getState().tests, flags, on));
      }
      setFinished({ run: { ...run, record }, pbs, firstTest });
      onRecordedRef.current?.(record, pbs);
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
              {!lockConfig && <TestConfigBar onCustomEdit={() => router.push("/practice#custom")} />}
              {activeOverride?.label && (
                <div className="mt-3 text-center font-mono text-xs text-accent">
                  {activeOverride.label}
                  {!lockConfig && (
                    <>
                      {" · "}
                      <button className="underline decoration-dotted underline-offset-4 hover:text-fg" onClick={() => { setActiveOverride(null); setFixed(undefined); restart(); }}>
                        leave
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-center py-10 sm:py-16">
              {!flow && <LiveStats ref={live} showWpm={showWpm} showAcc={showAcc} showTimer={showTimer} showProgress={showProgress} />}
              {ghost && !flow && (
                <div ref={ghostLabel} className="mb-2 h-4 font-mono text-[0.7rem] text-faint transition-colors data-[tone=ahead]:text-accent2 data-[tone=behind]:text-sub" aria-live="off">
                  your ghost is ready. beat it.
                </div>
              )}
              <TypingSurface
                ref={surface}
                config={config}
                nonce={nonce}
                fixed={fixed}
                lines={lines}
                ghost={ghost}
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
