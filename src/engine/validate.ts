import type { RunResult } from "./analyze";
import type { RunLog } from "./types";

/**
 * Anti-cheat heuristics on the raw timeline. The server never trusts a
 * client-reported WPM: it replays the log, then runs these checks. Flagged
 * results are still saved to the user's history but excluded from
 * leaderboards and records.
 */
export function suspicionReasons(log: RunLog, result: RunResult): string[] {
  const reasons: string[] = [];
  const n = log.deltas.length;
  if (n === 0) return ["empty"];
  if (log.keys.length !== n) reasons.push("log_length_mismatch");

  const total = log.deltas.reduce((a, b) => a + b, 0);
  if (total > log.endMs + 50) reasons.push("timeline_mismatch");
  if (log.deltas.some((d) => d < 0 || !Number.isFinite(d))) reasons.push("invalid_delta");

  if (result.wpm > 300) reasons.push("wpm_impossible");

  const intervals = log.deltas.slice(1);
  if (intervals.length >= 30) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean < 25) reasons.push("too_fast");
    const tiny = intervals.filter((d) => d < 6).length / intervals.length;
    if (tiny > 0.25) reasons.push("injected_bursts");
    const sd = Math.sqrt(intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length);
    if (intervals.length >= 60 && sd < 4) reasons.push("robotic_rhythm");
  }
  // A 100% perfect run over a long test with zero variance is a classic macro signature.
  if (result.consistency > 99.5 && result.durationMs > 20000) reasons.push("inhuman_consistency");
  return reasons;
}
