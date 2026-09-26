import type { KeyStat, Samples } from "@/engine/analyze";
import type { Confidence, StopOnError, TestMode, WordContent } from "@/engine/types";
import { MIN_VALID_MS, pbCategories } from "@/engine/config";

/** One finished test, as stored locally and returned by the API. */
export interface TestRecord {
  id: string;
  createdAt: number;
  mode: TestMode;
  mode2: number;
  content: WordContent;
  language: string;
  punctuation: boolean;
  numbers: boolean;
  seed: string | null;
  sourceId: string | null;
  customText?: string | null;
  stopOnError: StopOnError;
  confidence: Confidence;
  strict: boolean;
  category: string;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  peakWpm: number;
  durationMs: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  keystrokes: number;
  wordsTyped: number;
  backspaces: number;
  samples: Samples;
  keyStats: Record<string, KeyStat>;
  isPb: boolean;
  flagged?: boolean;
  /** uploaded to the signed-in account */
  synced?: boolean;
}

export function isValidForStats(t: Pick<TestRecord, "durationMs" | "flagged" | "mode">): boolean {
  return t.durationMs >= MIN_VALID_MS && !t.flagged && t.mode !== "zen";
}

export interface PbEntry {
  category: string;
  wpm: number;
  accuracy: number;
  raw: number;
  testId: string;
  at: number;
}

/** Best result per PB category. */
export function computePbs(tests: TestRecord[]): Record<string, PbEntry> {
  const out: Record<string, PbEntry> = {};
  for (const t of tests) {
    if (!isValidForStats(t)) continue;
    for (const cat of pbCategories(t)) {
      const cur = out[cat];
      if (!cur || t.wpm > cur.wpm || (t.wpm === cur.wpm && t.accuracy > cur.accuracy)) {
        out[cat] = { category: cat, wpm: t.wpm, accuracy: t.accuracy, raw: t.raw, testId: t.id, at: t.createdAt };
      }
    }
  }
  return out;
}

export interface PbImprovement {
  category: string;
  previous: number | null;
  wpm: number;
}

/** Which PBs a new test beats (previous = null means first result in that category). */
export function pbImprovements(prior: TestRecord[], t: TestRecord): PbImprovement[] {
  if (!isValidForStats(t)) return [];
  const pbs = computePbs(prior);
  const out: PbImprovement[] = [];
  for (const cat of pbCategories(t)) {
    const cur = pbs[cat];
    if (!cur || t.wpm > cur.wpm) out.push({ category: cat, previous: cur ? cur.wpm : null, wpm: t.wpm });
  }
  return out;
}

/** PB progression: chronological list of each time the PB in `category` improved. */
export function pbProgression(tests: TestRecord[], category: string): { at: number; wpm: number; testId: string }[] {
  const sorted = [...tests].sort((a, b) => a.createdAt - b.createdAt);
  const out: { at: number; wpm: number; testId: string }[] = [];
  let best = -1;
  for (const t of sorted) {
    if (!isValidForStats(t) || !pbCategories(t).includes(category)) continue;
    if (t.wpm > best) {
      best = t.wpm;
      out.push({ at: t.createdAt, wpm: t.wpm, testId: t.id });
    }
  }
  return out;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export interface Streaks {
  current: number;
  longest: number;
  /** active today already */
  today: boolean;
}

export function computeStreaks(tests: Pick<TestRecord, "createdAt">[], now = Date.now()): Streaks {
  if (tests.length === 0) return { current: 0, longest: 0, today: false };
  const days = Array.from(new Set(tests.map((t) => dayKey(t.createdAt)))).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1], days[i]) === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
  }
  const todayKey = dayKey(now);
  const last = days[days.length - 1];
  const gap = daysBetween(last, todayKey);
  let current = 0;
  if (gap <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (daysBetween(days[i - 1], days[i]) === 1) current++;
      else break;
    }
  }
  return { current, longest, today: gap === 0 };
}

export interface Totals {
  tests: number;
  timeMs: number;
  words: number;
  chars: number;
  avgWpm: number;
  avgAcc: number;
  avgConsistency: number;
  bestWpm: number;
  /** average of the last 10 valid tests */
  recentWpm: number;
}

export function computeTotals(tests: TestRecord[]): Totals {
  const valid = tests.filter(isValidForStats);
  const n = valid.length || 1;
  const sorted = [...valid].sort((a, b) => b.createdAt - a.createdAt);
  const recent = sorted.slice(0, 10);
  return {
    tests: tests.length,
    timeMs: tests.reduce((a, t) => a + t.durationMs, 0),
    words: tests.reduce((a, t) => a + t.wordsTyped, 0),
    chars: tests.reduce((a, t) => a + t.correct + t.incorrect + t.extra, 0),
    avgWpm: valid.reduce((a, t) => a + t.wpm, 0) / n,
    avgAcc: valid.reduce((a, t) => a + t.accuracy, 0) / n,
    avgConsistency: valid.reduce((a, t) => a + t.consistency, 0) / n,
    bestWpm: valid.reduce((a, t) => Math.max(a, t.wpm), 0),
    recentWpm: recent.length ? recent.reduce((a, t) => a + t.wpm, 0) / recent.length : 0,
  };
}

/** Merge per-test key stats into one map. */
export function mergeKeyStats(tests: Pick<TestRecord, "keyStats">[]): Record<string, KeyStat> {
  const out: Record<string, KeyStat> = {};
  for (const t of tests) {
    for (const [k, v] of Object.entries(t.keyStats ?? {})) {
      const s = (out[k] ??= [0, 0, 0]);
      s[0] += v[0];
      s[1] += v[1];
      s[2] += v[2];
    }
  }
  return out;
}

export function rollingAverage(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}
