import { TypingEngine, wpmFromChars, type CharStats, type InputEffect } from "./engine";
import type { BuiltText } from "@/content/generator";
import { KEY_BACKSPACE, KEY_WORD_BACKSPACE, type EngineOptions, type RunLog } from "./types";

/**
 * Canonical results. Both the browser (after a test) and the server (when
 * validating an upload) compute results with this one function by replaying
 * the keystroke log, so the numbers always agree.
 */

export interface Samples {
  /** second marks (1, 2, 3 … last may be fractional) */
  t: number[];
  /** cumulative net WPM at each mark */
  wpm: number[];
  /** raw WPM within each bucket */
  raw: number[];
  /** incorrect keystrokes within each bucket */
  err: number[];
}

/** [hits, misses, totalMs] */
export type KeyStat = [number, number, number];

export interface WordTiming {
  index: number;
  text: string;
  ms: number;
  wpm: number;
  clean: boolean;
}

export interface ReplayEvent {
  t: number;
  key: string;
  kind: InputEffect["kind"];
  correct: boolean;
  blocked: boolean;
  word: number;
  /** caret position (typed length of current word) after the key */
  pos: number;
}

export interface RunResult {
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  peakWpm: number;
  durationMs: number;
  chars: CharStats;
  keystrokes: number;
  correctKeys: number;
  incorrectKeys: number;
  backspaces: number;
  samples: Samples;
  keyStats: Record<string, KeyStat>;
  bigramStats: Record<string, KeyStat>;
  words: WordTiming[];
  longestStreak: number;
  pauses: { count: number; totalMs: number };
  events: ReplayEvent[];
  /** final typed text per word (for rendering a static result) */
  typed: string[];
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Kogasa consistency: maps coefficient of variation → 0..100 */
export function kogasa(cov: number): number {
  return 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

export function consistencyOf(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  return Math.max(0, kogasa(stdDev(values) / mean));
}

const MAX_INTERVAL = 1500;

export function analyzeRun(built: BuiltText, options: EngineOptions, log: RunLog): RunResult {
  const engine = new TypingEngine(built.words, { ...options, zen: built.zen, code: built.code }, built.supply);

  const endMs = Math.max(0, log.endMs);
  const nBuckets = Math.max(1, Math.ceil(endMs / 1000));
  const bucketRaw = new Array<number>(nBuckets).fill(0);
  const bucketErr = new Array<number>(nBuckets).fill(0);
  const cumulativeWpm: number[] = [];

  const keyStats: Record<string, KeyStat> = {};
  const bigramStats: Record<string, KeyStat> = {};
  const events: ReplayEvent[] = [];
  const correctTimes: number[] = [];
  const words: WordTiming[] = [];
  const wordDirty = new Map<number, boolean>();

  let now = 0;
  let nextMark = 1000;
  let streak = 0;
  let longestStreak = 0;
  let prevCharKey = "";
  let lastCommitT = 0;
  let pausesCount = 0;
  let pausesMs = 0;

  /** record cumulative WPM for every whole-second mark before time t */
  const snapshotBefore = (t: number) => {
    while (nextMark < t && nextMark <= endMs) {
      cumulativeWpm.push(wpmFromChars(engine.charStats().wpmChars, nextMark));
      nextMark += 1000;
    }
  };

  for (let i = 0; i < log.keys.length; i++) {
    const key = log.keys[i];
    now += log.deltas[i] ?? 0;
    if (now > endMs + 1) break;
    // state at mark m includes every key with t <= m
    snapshotBefore(now);
    const wordBefore = engine.wordIndex;
    const eff = engine.input(key, now);
    if (eff.kind === "none") continue;
    const bucket = Math.min(nBuckets - 1, Math.floor(eff.t / 1000));
    const dt = i === 0 ? 0 : eff.dt;
    if (dt > 1000) {
      pausesCount++;
      pausesMs += dt;
    }

    const isTyping = eff.kind === "char" || eff.kind === "sep";
    if (isTyping) {
      if (!eff.blocked) bucketRaw[bucket]++;
      if (!eff.correct) {
        bucketErr[bucket]++;
        streak = 0;
        wordDirty.set(wordBefore, true);
      } else {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
        correctTimes.push(eff.t);
      }
      const statKey = eff.kind === "sep" ? " " : (eff.expected ?? "").toLowerCase();
      if (statKey) {
        const s = (keyStats[statKey] ??= [0, 0, 0]);
        if (eff.correct) {
          s[0]++;
          if (i > 0) s[2] += Math.min(dt, MAX_INTERVAL);
        } else {
          s[1]++;
        }
        if (prevCharKey && statKey !== " " && prevCharKey !== " ") {
          const bg = (bigramStats[prevCharKey + statKey] ??= [0, 0, 0]);
          if (eff.correct) {
            bg[0]++;
            bg[2] += Math.min(dt, MAX_INTERVAL);
          } else bg[1]++;
        }
        if (eff.correct) prevCharKey = statKey;
      }
    } else if (eff.kind === "back") {
      wordDirty.set(eff.word, true);
      streak = 0;
    }

    // word timings (commit or final char of last word)
    if ((eff.kind === "sep" && !eff.blocked && eff.prevWord !== eff.word) || (eff.kind === "sep" && eff.finished) || (eff.kind === "char" && eff.finished)) {
      const wi = eff.kind === "sep" ? eff.prevWord : eff.word;
      const w = engine.words[wi];
      if (w) {
        const ms = Math.max(1, eff.t - lastCommitT);
        const clean = !wordDirty.get(wi) && engine.typed[wi] === w.text;
        words.push({ index: wi, text: w.text, ms, wpm: wpmFromChars(w.text.length + 1, ms), clean });
      }
      lastCommitT = eff.t;
    }

    events.push({
      t: eff.t,
      key,
      kind: eff.kind,
      correct: eff.correct,
      blocked: !!eff.blocked,
      word: engine.wordIndex >= engine.words.length ? engine.words.length - 1 : engine.wordIndex,
      pos: engine.currentTyped.length,
    });
    if (key === KEY_BACKSPACE || key === KEY_WORD_BACKSPACE) prevCharKey = "";
  }

  if (!engine.finished) engine.finish(endMs);
  snapshotBefore(endMs + 1);

  const chars = engine.charStats();
  const durationMs = endMs;
  const wpm = wpmFromChars(chars.wpmChars, durationMs);
  const raw = wpmFromChars(chars.rawChars, durationMs);
  const total = engine.correctKeys + engine.incorrectKeys;
  const accuracy = total === 0 ? 0 : (engine.correctKeys / total) * 100;

  // per-bucket raw WPM; fold a tiny trailing partial second into the previous bucket
  const lens = Array.from({ length: nBuckets }, (_, i) => (i === nBuckets - 1 ? endMs - i * 1000 : 1000));
  const rawCounts = bucketRaw.slice();
  const errCounts = bucketErr.slice();
  const marks = Array.from({ length: nBuckets }, (_, i) => (i === nBuckets - 1 ? endMs / 1000 : i + 1));
  if (nBuckets > 1 && lens[nBuckets - 1] < 500) {
    rawCounts[nBuckets - 2] += rawCounts[nBuckets - 1];
    errCounts[nBuckets - 2] += errCounts[nBuckets - 1];
    lens[nBuckets - 2] += lens[nBuckets - 1];
    rawCounts.pop();
    errCounts.pop();
    lens.pop();
    marks.pop();
    marks[marks.length - 1] = endMs / 1000;
  }
  const rawSeries = rawCounts.map((c, i) => (lens[i] > 0 ? (c / 5) * (60000 / lens[i]) : 0));
  const wpmSeries = marks.map((m, i) => {
    if (i === marks.length - 1) return wpm;
    return cumulativeWpm[i] ?? wpm;
  });

  // peak: best 2-second sliding window of correct keystrokes
  let peak = 0;
  let lo = 0;
  for (let hi = 0; hi < correctTimes.length; hi++) {
    while (correctTimes[hi] - correctTimes[lo] > 2000) lo++;
    const windowMs = Math.max(1000, Math.min(2000, correctTimes[hi]));
    peak = Math.max(peak, ((hi - lo + 1) / 5) * (60000 / windowMs));
  }
  peak = Math.max(peak, wpm);

  const typedWordCount = engine.words.length;
  return {
    wpm: round2(wpm),
    raw: round2(raw),
    accuracy: round2(accuracy),
    consistency: round2(consistencyOf(rawSeries)),
    peakWpm: round2(peak),
    durationMs,
    chars,
    keystrokes: total,
    correctKeys: engine.correctKeys,
    incorrectKeys: engine.incorrectKeys,
    backspaces: engine.backspaces,
    samples: {
      t: marks.map(round2),
      wpm: wpmSeries.map(round2),
      raw: rawSeries.map(round2),
      err: errCounts,
    },
    keyStats,
    bigramStats,
    words,
    longestStreak,
    pauses: { count: pausesCount, totalMs: pausesMs },
    events,
    typed: engine.typed.slice(0, typedWordCount),
  };
}
