import type { RunResult } from "@/engine/analyze";

/** Best sliding-window speed (WPM) over correct keystrokes. */
export function bestWindowWpm(result: RunResult, windowMs: number): number {
  const times = result.events.filter((e) => (e.kind === "char" || e.kind === "sep") && e.correct && !e.blocked).map((e) => e.t);
  if (!times.length) return 0;
  const span = Math.min(windowMs, Math.max(1, result.durationMs));
  let best = 0;
  let lo = 0;
  for (let hi = 0; hi < times.length; hi++) {
    while (times[hi] - times[lo] >= span) lo++;
    best = Math.max(best, hi - lo + 1);
  }
  return (best / 5) * (60000 / span);
}

/** Pace score 0..100: how closely per-second speed stayed on target. */
export function paceScore(raw: number[], target: number): number {
  if (!raw.length || target <= 0) return 0;
  const vals = raw.length > 2 ? raw.slice(1) : raw; // the first second is a warm-up
  const closeness = vals.map((v) => Math.max(0, 1 - Math.abs(v - target) / target));
  return (closeness.reduce((a, b) => a + b, 0) / closeness.length) * 100;
}
