"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Swords } from "lucide-react";
import { useHistory } from "@/stores/history";
import { computeTotals, mergeKeyStats } from "@/lib/records";
import { buildExercise, findWeaknesses, nextLevel, type Weakness } from "@/lib/adaptive";
import { getLocal, loadAllLogs, setLocal } from "@/lib/local-store";
import { replayInput, type RunInput } from "@/engine/record";
import type { KeyStat } from "@/engine/analyze";
import type { TestConfig } from "@/engine/types";
import { newSeed } from "@/engine/rng";
import { useHydrated } from "@/lib/hooks";

interface AdaptiveState {
  level: number;
  lastText: string | null;
  lastCounted: string | null;
}

const DEFAULT_STATE: AdaptiveState = { level: 1, lastText: null, lastCounted: null };

export function AdaptivePanel({ onStart }: { onStart: (c: Partial<TestConfig>) => void }) {
  const tests = useHistory((s) => s.tests);
  const owner = useHistory((s) => s.owner);
  const [bigrams, setBigrams] = useState<Record<string, KeyStat> | null>(null);
  const hydrated = useHydrated();
  const [version, setVersion] = useState(0);
  const stored = useMemo<AdaptiveState>(
    () => (hydrated ? getLocal<AdaptiveState>("adaptive", DEFAULT_STATE) : DEFAULT_STATE),
    // version bumps force a re-read after we write
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, version],
  );

  // bigram stats come from replaying the recent keystroke logs kept on this device
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const logs = loadAllLogs(owner);
      const merged: Record<string, KeyStat> = {};
      for (const t of tests.slice(0, 60)) {
        const log = logs[t.id];
        if (!log || t.mode === "zen") continue;
        try {
          const r = replayInput(t as unknown as RunInput, log);
          for (const [k, v] of Object.entries(r.bigramStats)) {
            const m = (merged[k] ??= [0, 0, 0]);
            m[0] += v[0];
            m[1] += v[1];
            m[2] += v[2];
          }
        } catch {
          /* skip corrupt logs */
        }
      }
      if (!cancelled) setBigrams(merged);
    };
    const id = setTimeout(run, 50);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [tests, owner]);

  // level evolves from the most recent adaptive session
  const st = useMemo<AdaptiveState>(() => {
    if (!stored.lastText) return stored;
    const last = tests.find((t) => t.mode === "custom" && t.customText === stored.lastText);
    if (!last || stored.lastCounted === last.id) return stored;
    const level = nextLevel(stored.level, last.accuracy, last.wpm, computeTotals(tests).avgWpm);
    return { ...stored, level, lastCounted: last.id };
  }, [stored, tests]);
  useEffect(() => {
    if (st !== stored) setLocal("adaptive", st);
  }, [st, stored]);

  const weak = useMemo<Weakness[]>(() => (bigrams ? findWeaknesses(mergeKeyStats(tests), bigrams) : []), [tests, bigrams]);
  const nemesis = weak[0];
  const enough = tests.length >= 3 && weak.length > 0;

  const train = () => {
    const ex = buildExercise(weak, st.level, newSeed());
    setLocal("adaptive", { ...st, lastText: ex.text });
    setVersion((v) => v + 1);
    onStart({ mode: "custom", customText: ex.text, customTimer: 0, strict: false, flow: false });
  };

  const preview = useMemo(() => buildExercise(weak, st.level, "preview"), [weak, st.level]);

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line lg:grid-cols-[1fr_1.4fr]" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
      <div className="relative bg-bg p-6 sm:p-8">
        <div className="label flex items-center gap-2 !text-accent">
          <Swords size={12} /> your nemesis
        </div>
        {enough && nemesis ? (
          <>
            <motion.div key={nemesis.pattern} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="display mt-3 text-[clamp(4rem,10vw,7rem)] font-bold text-fg">
              “{nemesis.pattern}”
            </motion.div>
            <div className="mt-2 font-mono text-sm text-sub">
              accuracy <span className="text-fg">{nemesis.accuracy.toFixed(1)}%</span> · {Math.round(nemesis.avgMs)} ms per key · {nemesis.samples} seen
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {weak.slice(1, 6).map((w) => (
                <span key={w.pattern} className="border border-line px-2.5 py-1 font-mono text-xs text-sub" style={{ borderRadius: "var(--radius)" }} title={`${w.accuracy.toFixed(1)}% · ${Math.round(w.avgMs)}ms`}>
                  <span className="text-fg">{w.pattern}</span> {w.accuracy.toFixed(0)}%
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="display mt-3 text-6xl font-bold text-faint/50">“?”</div>
            <p className="mt-3 max-w-sm text-sm text-sub">Finish a few tests and clack. will find the letters and pairs that slow you down, then build drills around them.</p>
          </>
        )}
      </div>
      <div className="flex flex-col justify-between gap-6 bg-bg p-6 sm:p-8">
        <div>
          <div className="flex items-center justify-between">
            <div className="label">next session</div>
            <div className="flex items-center gap-1.5" aria-label={`Difficulty level ${st.level} of 5`}>
              <span className="mr-1 font-mono text-[0.65rem] text-faint">level</span>
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`h-1.5 w-5 ${i <= st.level ? "bg-accent" : "bg-bg3"}`} style={{ borderRadius: 2 }} />
              ))}
            </div>
          </div>
          <p className="mt-3 text-[0.95rem] text-fg">{preview.reason}</p>
          <p className="mt-4 line-clamp-3 font-mono text-sm leading-relaxed text-faint">{preview.text}</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={train} className="press bg-accent px-5 py-2.5 font-mono text-xs text-on-accent" style={{ borderRadius: "var(--radius)" }}>
            train now
          </button>
          <span className="font-mono text-[0.68rem] text-faint">difficulty adjusts after every session</span>
        </div>
      </div>
    </div>
  );
}
