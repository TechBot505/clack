"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { KeyStat } from "@/engine/analyze";
import { LAYOUTS, ROW_OFFSET, keyMetrics, type KeyMetric } from "@/lib/keyboard";
import { useSettings } from "@/stores/settings";

type Metric = "speed" | "accuracy" | "errors";

const METRICS: { id: Metric; label: string }[] = [
  { id: "speed", label: "speed" },
  { id: "accuracy", label: "accuracy" },
  { id: "errors", label: "errors" },
];

/**
 * Keyboard heatmap. Keys glow by speed, accuracy or error frequency.
 * Hover for numbers, click to pin a key and see its neighbours.
 */
export function KeyboardHeatmap({
  stats,
  bigrams,
  compact = false,
  minSamples = 3,
  title,
}: {
  stats: Record<string, KeyStat>;
  bigrams?: Record<string, KeyStat>;
  compact?: boolean;
  minSamples?: number;
  title?: string;
}) {
  const layout = useSettings((s) => s.keyboardLayout);
  const [metric, setMetric] = useState<Metric>("speed");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const metrics = useMemo(() => keyMetrics(stats), [stats]);

  // Ignore keys with too few presses (relative to how much data there is), and
  // scale between the 10th and 90th percentile so one odd key can't wash out the rest.
  const threshold = useMemo(() => {
    const counts = Object.values(metrics).map((m) => m.hits + m.misses).sort((a, b) => a - b);
    const med = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
    return Math.max(minSamples, Math.floor(med * 0.15));
  }, [metrics, minSamples]);

  const scale = useMemo(() => {
    const vals = Object.values(metrics).filter((m) => m.hits + m.misses >= threshold);
    const pick = (m: KeyMetric) => (metric === "speed" ? m.wpm : metric === "accuracy" ? m.accuracy : m.misses);
    const nums = vals
      .map(pick)
      .filter((n) => Number.isFinite(n) && (metric !== "speed" || n > 0))
      .sort((a, b) => a - b);
    const q = (p: number) => (nums.length ? nums[Math.min(nums.length - 1, Math.max(0, Math.round((nums.length - 1) * p)))] : NaN);
    const robust = nums.length >= 8;
    return { min: robust ? q(0.1) : q(0), max: robust ? q(0.9) : q(1), pick };
  }, [metrics, metric, threshold]);

  const intensity = (m: KeyMetric | undefined): number | null => {
    if (!m || m.hits + m.misses < threshold) return null;
    const v = scale.pick(m);
    if (!Number.isFinite(scale.min) || scale.max === scale.min) return 0.6;
    return Math.max(0, Math.min(1, (v - scale.min) / (scale.max - scale.min)));
  };

  const colorFor = (t: number | null): { bg: string; glow: string; fg: string } => {
    if (t === null) return { bg: "var(--bg-2)", glow: "transparent", fg: "var(--faint)" };
    if (metric === "speed") {
      const p = Math.round(12 + t * 78);
      return { bg: `color-mix(in oklab, var(--accent) ${p}%, var(--bg-3))`, glow: t > 0.7 ? "var(--glow)" : "transparent", fg: t > 0.55 ? "var(--on-accent)" : "var(--fg)" };
    }
    if (metric === "accuracy") {
      // low accuracy → error color, high → ok color
      const bad = Math.round((1 - t) * 85);
      return { bg: `color-mix(in oklab, var(--error) ${bad}%, color-mix(in oklab, var(--ok) 30%, var(--bg-3)))`, glow: t < 0.3 ? "color-mix(in oklab, var(--error) 50%, transparent)" : "transparent", fg: "var(--fg)" };
    }
    const p = Math.round(t * 90);
    return { bg: `color-mix(in oklab, var(--error) ${p}%, var(--bg-3))`, glow: t > 0.6 ? "color-mix(in oklab, var(--error) 50%, transparent)" : "transparent", fg: t > 0.6 ? "var(--bg)" : "var(--fg)" };
  };

  const active = pinned ?? hover;
  const am = active ? metrics[active] : undefined;
  const neighbours = useMemo(() => {
    if (!active || !bigrams) return null;
    const before: [string, number][] = [];
    const after: [string, number][] = [];
    for (const [bg, s] of Object.entries(bigrams)) {
      const [a, b] = [bg[0], bg[1]];
      const n = s[0] + s[1];
      if (b === active && a !== " ") before.push([a, n]);
      if (a === active && b !== " ") after.push([b, n]);
    }
    const top = (l: [string, number][]) => l.sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k]) => k);
    return { before: top(before), after: top(after) };
  }, [active, bigrams]);

  // scale to the container: the widest row is ~18 key-units
  const unit = compact ? "min(2.5rem, calc(100cqw / 18.2))" : "min(3.2rem, calc(100cqw / 18.2))";
  const hasData = Object.values(metrics).some((m) => m.hits + m.misses >= threshold);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {title ? <div className="label">{title}</div> : <span />}
        <div className="flex items-center gap-1" role="tablist" aria-label="Heatmap metric">
          {METRICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
              className={`press relative px-2.5 py-1 font-mono text-[0.72rem] ${metric === m.id ? "text-fg" : "text-sub hover:text-fg"}`}
            >
              {metric === m.id && (
                <motion.span layoutId={`hm-tab-${title ?? "x"}`} className="absolute inset-0 bg-bg3" style={{ borderRadius: "var(--radius)" }} transition={{ type: "spring", stiffness: 500, damping: 36 }} />
              )}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="relative w-full" style={{ containerType: "inline-size" }}>
        <div className="mx-auto flex w-max flex-col gap-[0.35em] py-2" style={{ fontSize: unit }} onMouseLeave={() => setHover(null)}>
          {LAYOUTS[layout].map((row, ri) => (
            <div key={ri} className="flex gap-[0.35em]" style={{ paddingLeft: `${ROW_OFFSET[ri]}em` }}>
              {row.map((k) => {
                const m = metrics[k];
                const t = intensity(m);
                const c = colorFor(t);
                const selected = pinned === k;
                return (
                  <button
                    key={k}
                    onMouseEnter={() => setHover(k)}
                    onFocus={() => setHover(k)}
                    onClick={() => setPinned(selected ? null : k)}
                    aria-label={`${k}: ${m ? `${Math.round(m.wpm)} wpm, ${m.accuracy.toFixed(1)}% accuracy, ${m.misses} errors` : "no data"}`}
                    className="press relative grid h-[1em] w-[1em] place-items-center font-mono transition-[background-color,box-shadow,transform] duration-500"
                    style={{
                      background: c.bg,
                      color: c.fg,
                      boxShadow: `0 0 0.5em ${c.glow}${selected ? ", inset 0 0 0 2px var(--fg)" : ""}`,
                      borderRadius: "calc(var(--radius) + 3px)",
                      fontSize: "1em",
                    }}
                  >
                    <span style={{ fontSize: "0.34em" }}>{k}</span>
                    {m && m.misses > 0 && metric !== "speed" ? (
                      <span className="absolute right-[0.12em] top-[0.08em] leading-none opacity-70" style={{ fontSize: "0.2em" }}>
                        {m.misses}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex justify-center" style={{ paddingLeft: "2.2em" }}>
            {(() => {
              const m = metrics["space"];
              const c = colorFor(intensity(m));
              return (
                <button
                  onMouseEnter={() => setHover("space")}
                  onClick={() => setPinned(pinned === "space" ? null : "space")}
                  className="press h-[0.8em] w-[6em] font-mono transition-[background-color] duration-500"
                  style={{ background: c.bg, borderRadius: "calc(var(--radius) + 3px)", boxShadow: `0 0 0.5em ${c.glow}` }}
                  aria-label="space bar"
                >
                  <span className="block leading-none" style={{ fontSize: "0.28em", color: c.fg }}>space</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>
      <div className="mt-3 min-h-[3.25rem] font-mono text-xs text-sub" aria-live="polite">
        <AnimatePresence mode="wait">
          {active && am ? (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1"
            >
              <span className="font-display text-2xl text-fg">{active}</span>
              <span>
                <span className="text-fg">{Math.round(am.avgMs)}</span> ms avg
              </span>
              <span>
                <span className="text-fg">{Math.round(am.wpm)}</span> wpm-eq
              </span>
              <span>
                <span className="text-fg">{am.accuracy.toFixed(1)}%</span> accurate
              </span>
              <span>
                <span className="text-fg">{am.hits + am.misses}</span> presses
              </span>
              {neighbours && neighbours.before.length > 0 && (
                <span>
                  after <span className="text-fg">{neighbours.before.join(" ")}</span>
                </span>
              )}
              {neighbours && neighbours.after.length > 0 && (
                <span>
                  before <span className="text-fg">{neighbours.after.join(" ")}</span>
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-faint">
              {hasData ? "hover a key · click to pin it" : "type a few tests and your keyboard will start to glow."}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
