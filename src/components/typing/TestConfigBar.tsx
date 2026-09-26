"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AtSign, Hash, Flame, Target, Eye, Pencil, Ghost } from "lucide-react";
import { useSettings } from "@/stores/settings";
import { TIME_PRESETS, WORD_PRESETS, LIMITS } from "@/engine/config";
import type { TestConfig, TestMode } from "@/engine/types";
import { CODE_LANGUAGES } from "@/content/code";

const MODES: { id: TestMode; label: string }[] = [
  { id: "time", label: "time" },
  { id: "words", label: "words" },
  { id: "quote", label: "quote" },
  { id: "code", label: "code" },
  { id: "zen", label: "zen" },
  { id: "custom", label: "custom" },
];

function Seg<T extends string | number>({
  value,
  options,
  onChange,
  id,
  label,
}: {
  value: T;
  options: { id: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  id: string;
  label: string;
}) {
  return (
    <div className="flex items-center" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={String(o.id)}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={`press relative px-2.5 py-1.5 font-mono text-[0.76rem] transition-colors ${active ? "text-on-accent" : "text-sub hover:text-fg"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 bg-accent"
                style={{ borderRadius: "var(--radius)" }}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ on, onClick, label, icon, title }: { on: boolean; onClick: () => void; label: string; icon: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`press inline-flex items-center gap-1.5 px-2 py-1.5 font-mono text-[0.76rem] transition-colors ${on ? "text-accent" : "text-sub hover:text-fg"}`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-line" aria-hidden />;

export function TestConfigBar({ onCustomEdit }: { onCustomEdit: () => void }) {
  const test = useSettings((s) => s.test);
  const setTest = useSettings((s) => s.setTest);
  const ghost = useSettings((s) => s.ghost);
  const [customNum, setCustomNum] = useState<string | null>(null);

  const set = (patch: Partial<TestConfig>) => setTest(patch);
  const wordish = test.mode === "time" || test.mode === "words";
  const isCustomTime = test.mode === "time" && !TIME_PRESETS.includes(test.duration as (typeof TIME_PRESETS)[number]);
  const isCustomWords = test.mode === "words" && !WORD_PRESETS.includes(test.wordCount as (typeof WORD_PRESETS)[number]);

  const submitCustom = () => {
    const n = Number(customNum);
    if (Number.isFinite(n) && n > 0) {
      if (test.mode === "time") set({ duration: Math.min(LIMITS.maxDuration, Math.max(LIMITS.minDuration, Math.round(n))) });
      else set({ wordCount: Math.min(LIMITS.maxWords, Math.max(1, Math.round(n))) });
    }
    setCustomNum(null);
  };

  return (
    <div
      className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-y-1 border border-line bg-bg2/70 px-1.5 py-1 backdrop-blur"
      style={{ borderRadius: "calc(var(--radius) + 4px)" }}
    >
      {wordish && (
        <>
          <Toggle on={test.punctuation} onClick={() => set({ punctuation: !test.punctuation })} label="punctuation" icon={<AtSign size={13} />} title="Punctuation" />
          <Toggle on={test.numbers} onClick={() => set({ numbers: !test.numbers })} label="numbers" icon={<Hash size={13} />} title="Numbers" />
          <Toggle
            on={test.content === "difficult"}
            onClick={() => set({ content: test.content === "difficult" ? "common" : "difficult" })}
            label="difficult"
            icon={<Flame size={13} />}
            title="Difficult words"
          />
          <Divider />
        </>
      )}
      <Seg id="mode" label="Test mode" value={test.mode} options={MODES} onChange={(mode) => set({ mode })} />
      <Divider />
      {test.mode === "time" && (
        <Seg
          id="time"
          label="Duration"
          value={isCustomTime ? -1 : test.duration}
          options={[...TIME_PRESETS.map((n) => ({ id: n as number, label: n })), { id: -1, label: isCustomTime ? `${test.duration}s` : <Pencil size={12} />, title: "Custom duration" }]}
          onChange={(v) => (v === -1 ? setCustomNum(String(test.duration)) : set({ duration: v }))}
        />
      )}
      {test.mode === "words" && (
        <Seg
          id="words"
          label="Word count"
          value={isCustomWords ? -1 : test.wordCount}
          options={[...WORD_PRESETS.map((n) => ({ id: n as number, label: n })), { id: -1, label: isCustomWords ? test.wordCount : <Pencil size={12} />, title: "Custom word count" }]}
          onChange={(v) => (v === -1 ? setCustomNum(String(test.wordCount)) : set({ wordCount: v }))}
        />
      )}
      {test.mode === "quote" && (
        <Seg
          id="quote"
          label="Quote length"
          value={test.quoteLength}
          options={(["any", "short", "medium", "long"] as const).map((q) => ({ id: q, label: q }))}
          onChange={(quoteLength) => set({ quoteLength })}
        />
      )}
      {test.mode === "code" && (
        <label className="flex items-center gap-2 px-2 font-mono text-[0.76rem] text-sub">
          <span className="sr-only">Code language</span>
          <select
            value={test.codeLanguage}
            onChange={(e) => set({ codeLanguage: e.target.value })}
            className="cursor-pointer bg-transparent py-1 text-fg outline-none"
          >
            <option value="any">any language</option>
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {test.mode === "custom" && (
        <button onClick={onCustomEdit} className="press inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[0.76rem] text-sub hover:text-fg">
          <Pencil size={12} /> {test.customText ? `${test.customText.split(/\s+/).length} words` : "add text"}
        </button>
      )}
      {test.mode === "zen" && <span className="px-2.5 font-mono text-[0.72rem] text-faint">shift + enter to finish</span>}
      <Divider />
      <Toggle on={test.strict} onClick={() => set({ strict: !test.strict })} label="accuracy" icon={<Target size={13} />} title="Accuracy mode: mistakes block progress" />
      <Toggle on={test.flow} onClick={() => set({ flow: !test.flow })} label="flow" icon={<Eye size={13} />} title="Flow: hide every number until the end" />
      {wordish && (
        <Toggle on={ghost} onClick={() => useSettings.getState().set({ ghost: !ghost })} label="ghost" icon={<Ghost size={13} />} title="Ghost: race a replay of your personal best" />
      )}
      {customNum !== null && (
        <form
          className="flex w-full items-center justify-center gap-2 border-t border-line px-2 pb-1 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitCustom();
          }}
        >
          <label className="font-mono text-xs text-sub" htmlFor="custom-num">
            {test.mode === "time" ? "seconds" : "words"}
          </label>
          <input
            id="custom-num"
            autoFocus
            inputMode="numeric"
            value={customNum}
            onChange={(e) => setCustomNum(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={submitCustom}
            onKeyDown={(e) => e.key === "Escape" && setCustomNum(null)}
            className="w-20 border border-line bg-bg px-2 py-1 font-mono text-sm text-fg outline-none focus:border-accent"
            style={{ borderRadius: "var(--radius)" }}
          />
          <button type="submit" className="press font-mono text-xs text-accent">
            set
          </button>
        </form>
      )}
    </div>
  );
}
