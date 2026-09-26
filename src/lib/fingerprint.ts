import type { KeyStat, RunResult } from "@/engine/analyze";
import type { TestRecord } from "./records";
import { computeTotals, isValidForStats, mergeKeyStats } from "./records";

/**
 * Typing Fingerprint: a behavioural profile built from history. Summary
 * numbers come from every test; timing-level traits (pauses, bursts,
 * corrections, word lengths, capitals) come from replaying recent logs.
 */

export interface Fingerprint {
  tests: number;
  replayed: number;
  avgWpm: number;
  accuracy: number;
  consistency: number;
  keyStats: Record<string, KeyStat>;
  bigrams: Record<string, KeyStat>;
  mistypedLetters: { key: string; rate: number; misses: number }[];
  mistypedPairs: { pair: string; rate: number; misses: number }[];
  slowestKeys: { key: string; ms: number }[];
  strongestKeys: { key: string; ms: number; acc: number }[];
  slowestWords: { word: string; wpm: number; n: number }[];
  backspaceRate: number; // backspaces per 100 keystrokes
  correctionMs: number; // avg time from a mistake to its first backspace
  pauseMs: number; // avg pause length (>= 1s)
  pausesPerMinute: number;
  burstLength: number; // avg length of keystroke runs faster than your median
  byWordLength: { len: string; wpm: number; n: number }[];
  punctuation: { with: number; without: number };
  capitals: { upperMs: number; lowerMs: number };
  byHour: { hour: number; wpm: number; n: number }[];
  /** 0..1 axes for the radar */
  axes: { id: string; label: string; value: number; hint: string }[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function buildFingerprint(tests: TestRecord[], replays: { record: TestRecord; result: RunResult }[]): Fingerprint {
  const valid = tests.filter(isValidForStats);
  const totals = computeTotals(tests);
  const keyStats = mergeKeyStats(valid);
  const bigrams: Record<string, KeyStat> = {};
  for (const { result } of replays) {
    for (const [k, v] of Object.entries(result.bigramStats)) {
      const b = (bigrams[k] ??= [0, 0, 0]);
      b[0] += v[0];
      b[1] += v[1];
      b[2] += v[2];
    }
  }

  const letters = Object.entries(keyStats).filter(([k]) => /^[a-z]$/.test(k));
  const mistypedLetters = letters
    .filter(([, s]) => s[0] + s[1] >= 15)
    .map(([key, s]) => ({ key, rate: s[1] / (s[0] + s[1]), misses: s[1] }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);
  const mistypedPairs = Object.entries(bigrams)
    .filter(([k, s]) => /^[a-z]{2}$/.test(k) && s[0] + s[1] >= 8)
    .map(([pair, s]) => ({ pair, rate: s[1] / (s[0] + s[1]), misses: s[1] }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);
  const speeds = letters.filter(([, s]) => s[0] >= 15).map(([key, s]) => ({ key, ms: s[2] / s[0], acc: s[0] / (s[0] + s[1]) }));
  const slowestKeys = [...speeds].sort((a, b) => b.ms - a.ms).slice(0, 6);
  const strongestKeys = [...speeds].sort((a, b) => a.ms / a.acc - b.ms / b.acc).slice(0, 6);

  // replay-derived traits
  const words = new Map<string, { sum: number; n: number }>();
  const byLen = new Map<string, { sum: number; n: number }>();
  let backspaces = 0;
  let keys = 0;
  const corrections: number[] = [];
  const pauses: number[] = [];
  let typingMs = 0;
  const bursts: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (const { result } of replays) {
    backspaces += result.backspaces;
    keys += result.keystrokes;
    typingMs += result.durationMs;
    const ev = result.events;
    const intervals: number[] = [];
    let pendingError: number | null = null;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      const dt = i ? e.t - ev[i - 1].t : 0;
      if (i && dt >= 1000) pauses.push(dt);
      if ((e.kind === "char" || e.kind === "sep") && !e.correct && pendingError === null) pendingError = e.t;
      if (e.kind === "back" && pendingError !== null) {
        corrections.push(e.t - pendingError);
        pendingError = null;
      }
      if (e.kind === "char" && e.correct && i && dt < 1500) {
        intervals.push(dt);
        if (/[A-Z]/.test(e.key)) upper.push(dt);
        else if (/[a-z]/.test(e.key)) lower.push(dt);
      }
    }
    // bursts: runs of intervals under this run's median
    const med = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)] ?? 0;
    let run = 0;
    for (const d of intervals) {
      if (d <= med) run++;
      else {
        if (run >= 3) bursts.push(run);
        run = 0;
      }
    }
    if (run >= 3) bursts.push(run);
    for (const w of result.words) {
      if (!w.clean || w.text.length < 3) continue;
      const bare = w.text.toLowerCase().replace(/[^a-z']/g, "");
      if (bare.length < 3) continue;
      const e = words.get(bare) ?? { sum: 0, n: 0 };
      e.sum += w.wpm;
      e.n++;
      words.set(bare, e);
      const lk = bare.length >= 9 ? "9+" : String(bare.length);
      const l = byLen.get(lk) ?? { sum: 0, n: 0 };
      l.sum += w.wpm;
      l.n++;
      byLen.set(lk, l);
    }
  }
  const slowestWords = Array.from(words.entries())
    .filter(([, v]) => v.n >= 2)
    .map(([word, v]) => ({ word, wpm: v.sum / v.n, n: v.n }))
    .sort((a, b) => a.wpm - b.wpm)
    .slice(0, 6);
  const byWordLength = ["3", "4", "5", "6", "7", "8", "9+"].map((len) => {
    const v = byLen.get(len);
    return { len, wpm: v ? v.sum / v.n : 0, n: v?.n ?? 0 };
  });

  const withP = valid.filter((t) => t.punctuation && (t.mode === "time" || t.mode === "words"));
  const withoutP = valid.filter((t) => !t.punctuation && !t.numbers && (t.mode === "time" || t.mode === "words"));
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, wpm: 0, n: 0 }));
  for (const t of valid) {
    const h = hours[new Date(t.createdAt).getHours()];
    h.wpm += t.wpm;
    h.n++;
  }
  hours.forEach((h) => (h.wpm = h.n ? h.wpm / h.n : 0));

  const long = valid.filter((t) => t.durationMs >= 55000);
  const short = valid.filter((t) => t.durationMs < 35000);
  const stamina = long.length && short.length ? mean(long.map((t) => t.wpm)) / Math.max(1, mean(short.map((t) => t.wpm))) : 0.9;
  const punctRatio = withP.length && withoutP.length ? mean(withP.map((t) => t.wpm)) / Math.max(1, mean(withoutP.map((t) => t.wpm))) : 0.85;
  const pausesPerMinute = typingMs ? pauses.length / (typingMs / 60000) : 0;
  const backspaceRate = keys ? (backspaces / keys) * 100 : 0;

  const axes = [
    { id: "speed", label: "speed", value: clamp01(totals.avgWpm / 150), hint: `${totals.avgWpm.toFixed(0)} wpm average` },
    { id: "accuracy", label: "accuracy", value: clamp01((totals.avgAcc - 85) / 15), hint: `${totals.avgAcc.toFixed(1)}%` },
    { id: "rhythm", label: "rhythm", value: clamp01(totals.avgConsistency / 100), hint: `${totals.avgConsistency.toFixed(0)}% consistency` },
    { id: "flow", label: "flow", value: clamp01(1 - pausesPerMinute / 6), hint: `${pausesPerMinute.toFixed(1)} long pauses / min` },
    { id: "stamina", label: "stamina", value: clamp01((stamina - 0.75) / 0.3), hint: `${Math.round(stamina * 100)}% of short-test speed on long tests` },
    { id: "punctuation", label: "punctuation", value: clamp01((punctRatio - 0.6) / 0.4), hint: `${Math.round(punctRatio * 100)}% of plain speed` },
    { id: "precision", label: "precision", value: clamp01(1 - backspaceRate / 10), hint: `${backspaceRate.toFixed(1)} backspaces / 100 keys` },
    { id: "burst", label: "burst", value: clamp01((mean(bursts) - 3) / 10), hint: `${mean(bursts).toFixed(1)}-key bursts` },
  ];

  return {
    tests: tests.length,
    replayed: replays.length,
    avgWpm: totals.avgWpm,
    accuracy: totals.avgAcc,
    consistency: totals.avgConsistency,
    keyStats,
    bigrams,
    mistypedLetters,
    mistypedPairs,
    slowestKeys,
    strongestKeys,
    slowestWords,
    backspaceRate,
    correctionMs: mean(corrections),
    pauseMs: mean(pauses),
    pausesPerMinute,
    burstLength: mean(bursts),
    byWordLength,
    punctuation: { with: mean(withP.map((t) => t.wpm)), without: mean(withoutP.map((t) => t.wpm)) },
    capitals: { upperMs: mean(upper), lowerMs: mean(lower) },
    byHour: hours,
    axes,
  };
}
