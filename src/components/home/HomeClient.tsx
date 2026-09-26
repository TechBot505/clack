"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CalendarDays, Swords, Flame, Trophy, Target } from "lucide-react";
import { ReactiveHeadline } from "./ReactiveHeadline";
import { MorphingWord } from "./MorphingWord";
import { HeroTyping } from "./HeroTyping";
import { FloatingGlyphs } from "./FloatingGlyphs";
import { Magnetic } from "@/components/ui/Magnetic";
import { KeyboardOverlay } from "@/components/KeyboardOverlay";
import { useHistory } from "@/stores/history";
import { useSettings } from "@/stores/settings";
import { computeStreaks, isValidForStats } from "@/lib/records";
import { THEMES } from "@/lib/themes";
import type { CaretStyle } from "@/stores/settings";
import { useNow } from "@/lib/hooks";

const MORPH = ["mean it.", "think.", "write code.", "dream.", "breathe.", "are late.", "explain things."];

export function HomeClient() {
  const tests = useHistory((s) => s.tests);
  const loaded = useHistory((s) => s.loaded);
  const goal = useSettings((s) => s.weeklyGoalWpm);
  const [typing, setTyping] = useState(false);

  const now = useNow();
  const personal = useMemo(() => {
    const valid = tests.filter(isValidForStats);
    if (!valid.length) return null;
    const best = Math.max(...valid.map((t) => t.wpm));
    const streak = computeStreaks(tests);
    const weekAgo = now - 7 * 86400000;
    const week = valid.filter((t) => t.createdAt >= weekAgo);
    const weekBest = week.length ? Math.max(...week.map((t) => t.wpm)) : 0;
    return { best, streak, weekBest, count: tests.length };
  }, [tests, now]);

  const returning = loaded && personal !== null;

  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip">
      <FloatingGlyphs />
      <section className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-5 pb-16 pt-[5vh] sm:px-8">
        {/* ghost keyboard behind the hero */}
        <div className="pointer-events-none absolute right-[-6%] top-[4%] hidden opacity-[0.16] lg:block" style={{ perspective: "900px" }} aria-hidden>
          <div style={{ transform: "rotateX(58deg) rotateZ(-9deg)", transformOrigin: "center" }}>
            <KeyboardOverlay size="min(5.2vw, 4.4rem)" className="!mt-0" />
          </div>
        </div>

        <motion.div
          className="label flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <span className="text-accent">{returning ? "welcome back." : "01"}</span>
          <span className="h-px w-10 bg-line" />
          <span>{returning ? `${personal!.count} tests in the bank` : "a typing playground"}</span>
        </motion.div>

        <motion.div animate={{ opacity: typing ? 0.28 : 1, scale: typing ? 0.985 : 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ transformOrigin: "left center" }}>
          <ReactiveHeadline lines={["How fast are", "your thoughts?"]} className="mt-5 text-[clamp(3.3rem,10.4vw,10.5rem)] font-semibold" />
          <p className="mt-5 font-mono text-base text-sub sm:text-lg">
            type like you <MorphingWord words={MORPH} className="text-fg" />
          </p>
        </motion.div>

        <div className="relative mt-10 max-w-[980px] sm:mt-14">
          <HeroTyping onTypingChange={setTyping} />
          <motion.p animate={{ opacity: typing ? 0 : 1 }} className="mt-4 font-mono text-xs text-faint">
            ↑ no button. just start typing.
          </motion.p>
        </div>

        <motion.div
          className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-3"
          animate={{ opacity: typing ? 0.15 : 1 }}
          transition={{ duration: 0.4 }}
        >
          <Magnetic>
            <Link
              href="/type"
              className="press group inline-flex items-center gap-3 bg-accent px-5 py-3.5 font-mono text-sm text-on-accent"
              style={{ borderRadius: "var(--radius)" }}
            >
              start test
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/daily" className="press inline-flex items-center gap-2 border border-line px-4 py-3.5 font-mono text-sm text-sub hover:border-faint hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
              <CalendarDays size={15} /> daily challenge
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/race" className="press inline-flex items-center gap-2 border border-line px-4 py-3.5 font-mono text-sm text-sub hover:border-faint hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
              <Swords size={15} /> race
            </Link>
          </Magnetic>

          {returning && personal && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm text-sub sm:ml-6">
              <span className="inline-flex items-center gap-2">
                <Trophy size={14} className="text-accent" /> your best: <span className="text-fg">{Math.round(personal.best)} wpm</span>
              </span>
              {personal.streak.current > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Flame size={14} className="text-accent" /> <span className="text-fg">{personal.streak.current}-day</span> streak
                </span>
              )}
              {goal > 0 && (
                <span className="inline-flex items-center gap-2">
                  <Target size={14} className="text-accent" />
                  {personal.weekBest >= goal ? (
                    <span className="text-fg">weekly goal reached ✦</span>
                  ) : (
                    <span>
                      <span className="text-fg">{Math.ceil(goal - personal.weekBest)} wpm</span> away from your weekly goal
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </motion.div>
      </section>

      <Features />
    </div>
  );
}

function Features() {
  const set = useSettings((s) => s.set);
  const theme = useSettings((s) => s.theme);
  const caret = useSettings((s) => s.caretStyle);
  const unlocked = useSettings((s) => s.unlockedThemes);

  return (
    <section className="chrome relative mx-auto w-full max-w-[1400px] border-t border-line px-5 py-16 sm:px-8">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        <div>
          <div className="label mb-3">
            <span className="text-accent">02</span> atmospheres
          </div>
          <p className="max-w-xs text-sub">Ten themes that change the whole room, not just an accent color. Try one.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {THEMES.filter((t) => !t.hidden || unlocked.includes(t.id)).map((t) => (
              <button
                key={t.id}
                onClick={() => set({ theme: t.id, followSystem: false })}
                title={t.name}
                aria-label={`Theme ${t.name}`}
                aria-pressed={theme === t.id}
                className="press relative h-9 w-9 overflow-hidden border"
                style={{ borderRadius: "calc(var(--radius) + 4px)", borderColor: theme === t.id ? "var(--accent)" : "var(--line)", background: t.swatch[0] }}
              >
                <span className="absolute bottom-1 left-1 h-2 w-2 rounded-full" style={{ background: t.swatch[2] }} />
                <span className="absolute right-1 top-1 h-1 w-3" style={{ background: t.swatch[1] }} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-3">
            <span className="text-accent">03</span> a caret with manners
          </div>
          <p className="max-w-xs text-sub">It glides between letters instead of teleporting, and leaves a faint streak when you&apos;re flying.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(["line", "block", "underscore", "glow", "pulse"] as CaretStyle[]).map((c) => (
              <button
                key={c}
                onClick={() => set({ caretStyle: c })}
                aria-pressed={caret === c}
                className={`press border px-3 py-1.5 font-mono text-xs ${caret === c ? "border-accent text-fg" : "border-line text-sub hover:text-fg"}`}
                style={{ borderRadius: "var(--radius)" }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-3">
            <span className="text-accent">04</span> it remembers
          </div>
          <p className="max-w-xs text-sub">Every run is replayable. Your keyboard glows where you&apos;re fast and blushes where you stumble. No account needed.</p>
          <div className="mt-5 flex gap-4 font-mono text-xs">
            <Link href="/stats" className="text-sub underline decoration-line underline-offset-4 hover:text-fg">
              stats →
            </Link>
            <Link href="/history" className="text-sub underline decoration-line underline-offset-4 hover:text-fg">
              history →
            </Link>
            <Link href="/records" className="text-sub underline decoration-line underline-offset-4 hover:text-fg">
              records →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
