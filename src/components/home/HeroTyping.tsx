"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { TypingSurface } from "@/components/typing/TypingSurface";
import type { FinishedRun } from "@/components/typing/session";
import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";
import { useHistory } from "@/stores/history";
import { RollingNumber } from "@/components/ui/RollingNumber";
import type { PbImprovement } from "@/lib/records";
import { setLocal } from "@/lib/local-store";

/** The landing page's live mini test: start typing, no button required. */
export function HeroTyping({ onTypingChange }: { onTypingChange?: (typing: boolean) => void }) {
  const config = useMemo<TestConfig>(() => ({ ...DEFAULT_CONFIG, mode: "words", wordCount: 15 }), []);
  const [nonce, setNonce] = useState(0);
  const [done, setDone] = useState<{ run: FinishedRun; pbs: PbImprovement[] } | null>(null);

  const again = useCallback(() => {
    setDone(null);
    setNonce((n) => n + 1);
    onTypingChange?.(false);
  }, [onTypingChange]);

  useEffect(() => {
    if (!done) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        again();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, again]);

  const onFinish = useCallback(
    async (run: FinishedRun) => {
      onTypingChange?.(false);
      if (run.record.keystrokes < 5) return again();
      setLocal("has-finished", true);
      const saved = await useHistory.getState().add(run.input, run.record, run.log);
      setDone({ run: { ...run, record: saved.record }, pbs: saved.pbs });
    },
    [again, onTypingChange],
  );

  return (
    <div className="relative min-h-[8.5rem]">
      <AnimatePresence mode="wait" initial={false}>
        {!done ? (
          <motion.div key={`t${nonce}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <TypingSurface
              config={config}
              nonce={nonce}
              lines={2}
              focusMode={false}
              onStart={() => onTypingChange?.(true)}
              onFinish={onFinish}
              onRestart={again}
              ariaLabel="Mini typing test. Just start typing."
            />
          </motion.div>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-end gap-x-10 gap-y-4"
          >
            <div className="flex items-end gap-3">
              <span className="display text-[clamp(4rem,9vw,7rem)] font-bold text-fg">
                <RollingNumber value={done.run.record.wpm} />
              </span>
              <span className="italic-serif mb-3 text-2xl text-sub">wpm</span>
            </div>
            <div className="mb-3 font-mono text-sm text-sub">
              <div>
                <span className="text-fg">{done.run.record.accuracy.toFixed(1)}%</span> accuracy
              </div>
              <div>
                <span className="text-fg">{done.run.record.consistency.toFixed(0)}%</span> consistency
              </div>
              {done.pbs.length > 0 && <div className="text-accent">new personal best ✦</div>}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={again} className="press inline-flex items-center gap-2 border border-line px-3.5 py-2 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
                <RotateCcw size={13} /> again <span className="text-faint">tab</span>
              </button>
              <Link href="/type" className="press inline-flex items-center gap-2 bg-fg px-3.5 py-2 font-mono text-xs text-bg hover:bg-accent hover:text-on-accent" style={{ borderRadius: "var(--radius)" }}>
                the real test <ArrowRight size={13} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
