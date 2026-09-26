"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Lock, Plus, Sparkles, X } from "lucide-react";
import type { TestRecord } from "@/lib/records";
import { buildFingerprint, type Fingerprint } from "@/lib/fingerprint";
import { loadAllLogs } from "@/lib/local-store";
import { replayInput, type RunInput } from "@/engine/record";
import type { RunResult } from "@/engine/analyze";
import { useHistory } from "@/stores/history";
import { useSettings } from "@/stores/settings";
import { useProgression } from "@/lib/use-progression";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { UNLOCKS } from "@/lib/progression";
import { GOAL_TEMPLATES, goalProgress, type Goal } from "@/lib/goals";
import { SectionTitle } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";
import { TypingDNA } from "./TypingDNA";
import { FingerprintView } from "./FingerprintView";
import { useNow } from "@/lib/hooks";

/** Replays up to `limit` recent local logs (for timing-level traits). */
function useReplays(tests: TestRecord[], limit = 60) {
  const owner = useHistory((s) => s.owner);
  const [state, setState] = useState<{ key: string; replays: { record: TestRecord; result: RunResult }[] } | null>(null);
  const key = `${owner}:${tests.length}:${tests[0]?.id ?? ""}`;
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      const logs = loadAllLogs(owner);
      const out: { record: TestRecord; result: RunResult }[] = [];
      for (const t of tests.slice(0, limit)) {
        const log = logs[t.id];
        if (!log || t.mode === "zen") continue;
        try {
          out.push({ record: t, result: replayInput(t as unknown as RunInput, log) });
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setState({ key, replays: out });
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [key, owner, tests, limit]);
  return state?.key === key ? state.replays : null;
}

export function ProfileExtras({ tests }: { tests: TestRecord[] }) {
  const replays = useReplays(tests);
  const fp = useMemo<Fingerprint | null>(() => (replays ? buildFingerprint(tests, replays) : null), [tests, replays]);
  // stable per person: their very first test
  const seed = tests.length ? tests[tests.length - 1].id : "clack";
  const now = useNow();

  // monthly snapshots so the DNA visibly evolves
  const evolution = useMemo(() => {
    if (tests.length < 10) return [];
    const out: { label: string; fp: Fingerprint }[] = [];
    const d = new Date(now);
    for (let m = 5; m >= 0; m--) {
      const end = new Date(d.getFullYear(), d.getMonth() - m + 1, 1).getTime();
      const upto = tests.filter((t) => t.createdAt < end);
      if (upto.length < 5) continue;
      out.push({ label: new Date(end - 1).toLocaleString("en-US", { month: "short" }).toLowerCase(), fp: buildFingerprint(upto, []) });
    }
    return out;
  }, [tests, now]);

  return (
    <>
      <LevelBar />
      <section className="mb-16">
        <SectionTitle n="a">typing dna</SectionTitle>
        {tests.length < 3 ? (
          <p className="font-mono text-sm text-sub">Your DNA needs at least three tests to take shape.</p>
        ) : fp ? (
          <TypingDNA fp={fp} seed={seed} history={evolution} />
        ) : (
          <div className="aspect-square w-full max-w-[560px] animate-pulse bg-bg2/40" style={{ borderRadius: "50%" }} />
        )}
      </section>
      <section className="mb-16">
        <SectionTitle n="b">typing fingerprint</SectionTitle>
        {fp && tests.length >= 3 ? <FingerprintView fp={fp} /> : <p className="font-mono text-sm text-sub">A few more tests and your fingerprint will resolve.</p>}
      </section>
      <GoalsSection tests={tests} />
      <AchievementsSection />
    </>
  );
}

function LevelBar() {
  const p = useProgression();
  if (!p.on) return null;
  const next = UNLOCKS.find((u) => u.level > p.level);
  return (
    <section className="mb-14 max-w-2xl">
      <div className="flex items-baseline justify-between font-mono text-xs text-sub">
        <span>
          level <span className="display text-3xl font-semibold text-fg">{p.level}</span>
        </span>
        <span>
          {p.into} / {p.span} xp{next ? ` · next unlock at level ${next.level}: ${next.label}` : ""}
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-bg3" style={{ borderRadius: 999 }}>
        <motion.div className="h-full bg-accent" style={{ borderRadius: 999 }} initial={{ width: 0 }} animate={{ width: `${(p.into / Math.max(1, p.span)) * 100}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
      </div>
      <div className="mt-2 font-mono text-[0.65rem] text-faint">xp comes from minutes typed × accuracy, plus achievements. it only unlocks cosmetics.</div>
    </section>
  );
}

function GoalsSection({ tests }: { tests: TestRecord[] }) {
  const goals = useSettings((s) => s.goals);
  const set = useSettings((s) => s.set);
  const [adding, setAdding] = useState(false);
  const now = useNow();
  const progress = useMemo(() => goals.map((g) => goalProgress(g, tests, now)), [goals, tests, now]);

  const add = (tpl: (typeof GOAL_TEMPLATES)[number], target: number) => {
    const g: Goal = { id: `${tpl.kind}-${tpl.category ?? "x"}-${goals.length}-${target}`, kind: tpl.kind, target, category: tpl.category, createdAt: now };
    set({ goals: [...goals, g].slice(0, 8) });
    setAdding(false);
  };

  return (
    <section className="mb-16">
      <SectionTitle
        n="c"
        right={
          <button onClick={() => setAdding((a) => !a)} className="press inline-flex items-center gap-1.5 font-mono text-xs text-sub hover:text-fg">
            {adding ? <X size={13} /> : <Plus size={13} />} {adding ? "cancel" : "add goal"}
          </button>
        }
      >
        goals
      </SectionTitle>
      {adding && <GoalPicker onAdd={add} />}
      {progress.length === 0 && !adding ? (
        <p className="font-mono text-sm text-sub">No goals yet. Set one and it will quietly track itself: no nagging, no guilt.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {progress.map((p) => (
            <div key={p.goal.id} className="group relative border border-line p-5" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="text-[0.95rem] text-fg">{p.title}</div>
                <button onClick={() => set({ goals: goals.filter((g) => g.id !== p.goal.id) })} className="press text-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100" aria-label={`Remove goal ${p.title}`}>
                  <X size={14} />
                </button>
              </div>
              <div className="mt-4 h-2 bg-bg3" style={{ borderRadius: 999 }}>
                <motion.div
                  className="h-full"
                  style={{ borderRadius: 999, background: p.done ? "var(--ok)" : "var(--accent)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${p.pct * 100}%` }}
                  transition={{ type: "spring", stiffness: 70, damping: 18 }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-xs text-sub">
                <span>{p.note}</span>
                <span className="text-fg">{Math.round(p.pct * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GoalPicker({ onAdd }: { onAdd: (tpl: (typeof GOAL_TEMPLATES)[number], target: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [target, setTarget] = useState(String(GOAL_TEMPLATES[0].defaultTarget));
  const tpl = GOAL_TEMPLATES[idx];
  return (
    <form
      className="mb-6 flex flex-wrap items-end gap-3 border border-line bg-bg2/50 p-4"
      style={{ borderRadius: "calc(var(--radius) + 4px)" }}
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(target);
        if (n > 0) onAdd(tpl, n);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="label">goal</span>
        <select
          value={idx}
          onChange={(e) => {
            const i = Number(e.target.value);
            setIdx(i);
            setTarget(String(GOAL_TEMPLATES[i].defaultTarget));
          }}
          className="border border-line bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none"
          style={{ borderRadius: "var(--radius)" }}
        >
          {GOAL_TEMPLATES.map((g, i) => (
            <option key={i} value={i}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">target ({tpl.unit})</span>
        <input
          value={target}
          inputMode="numeric"
          onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))}
          className="w-24 border border-line bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
          style={{ borderRadius: "var(--radius)" }}
        />
      </label>
      <button type="submit" className="press bg-accent px-3 py-1.5 font-mono text-xs text-on-accent" style={{ borderRadius: "var(--radius)" }}>
        add
      </button>
    </form>
  );
}

function AchievementsSection() {
  const p = useProgression();
  const unlockedCount = Object.keys(p.achievements).length;
  return (
    <section className="mb-16">
      <SectionTitle n="d">
        achievements · {unlockedCount}/{ACHIEVEMENTS.length}
      </SectionTitle>
      <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
        {ACHIEVEMENTS.map((a) => {
          const u = p.achievements[a.id];
          const hidden = a.secret && !u;
          return (
            <div key={a.id} className={`relative flex gap-4 bg-bg p-5 ${u ? "" : "opacity-60"}`}>
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center border ${u ? "border-accent text-accent" : "border-line text-faint"}`}
                style={{ borderRadius: "calc(var(--radius) + 4px)", boxShadow: u ? "0 0 18px var(--glow)" : undefined }}
                aria-hidden
              >
                {u ? <Sparkles size={17} /> : <Lock size={15} />}
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold leading-tight text-fg">{hidden ? "???" : a.name}</div>
                <div className="mt-1 text-sm text-sub">{hidden ? `secret · ${a.hint ?? "keep typing"}` : a.description}</div>
                <div className="mt-1.5 font-mono text-[0.65rem] text-faint">
                  {u ? (u.at ? `unlocked ${fmtDate(u.at)}` : "unlocked") : `${a.xp} xp`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
