import type { KeyStat } from "@/engine/analyze";
import { createRng } from "@/engine/rng";
import { getLanguage } from "@/content/languages";

/**
 * Adaptive Training: find the patterns you're weakest at (slow or error-prone
 * letters and letter pairs), then build practice text that leans on them.
 */

export interface Weakness {
  pattern: string;
  kind: "letter" | "pair" | "punctuation";
  accuracy: number;
  avgMs: number;
  samples: number;
  /** 0..1, higher = weaker */
  score: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function scoreStats(stats: Record<string, KeyStat>, kind: Weakness["kind"], minSamples: number, filter: (k: string) => boolean): Weakness[] {
  const entries = Object.entries(stats).filter(([k, s]) => filter(k) && s[0] + s[1] >= minSamples);
  const speeds = entries.map(([, s]) => (s[0] ? s[2] / s[0] : 0)).filter((v) => v > 0);
  const med = median(speeds) || 1;
  return entries.map(([k, [hits, misses, ms]]) => {
    const n = hits + misses;
    const acc = (hits / n) * 100;
    const avgMs = hits ? ms / hits : med;
    const errPart = Math.min(1, (misses / n) * 8); // 12.5% errors saturates
    const slowPart = Math.max(0, Math.min(1, (avgMs / med - 1) * 1.5));
    return { pattern: k, kind, accuracy: acc, avgMs, samples: n, score: errPart * 0.6 + slowPart * 0.4 };
  });
}

export function findWeaknesses(keyStats: Record<string, KeyStat>, bigrams: Record<string, KeyStat>): Weakness[] {
  const letters = scoreStats(keyStats, "letter", 20, (k) => /^[a-z]$/.test(k));
  const punct = scoreStats(keyStats, "punctuation", 8, (k) => /^[.,;:!?'"()\-]$/.test(k));
  const pairs = scoreStats(bigrams, "pair", 8, (k) => /^[a-z]{2}$/.test(k));
  return [...pairs, ...letters, ...punct].sort((a, b) => b.score - a.score);
}

export interface Exercise {
  text: string;
  focus: Weakness[];
  level: number;
  reason: string;
}

/** Level 1..5: more targets, more words and longer words as you improve. */
export function buildExercise(weak: Weakness[], level: number, seed: string, language = "english"): Exercise {
  const lv = Math.max(1, Math.min(5, Math.round(level)));
  const nTargets = 2 + lv;
  const focus = weak.filter((w) => w.score > 0.05).slice(0, nTargets);
  const pack = getLanguage(language);
  const pool = Array.from(new Set([...pack.words, ...pack.difficult]));
  const rng = createRng(seed);
  const wordCount = 25 + lv * 7;
  const out: string[] = [];
  const letterTargets = focus.filter((f) => f.kind !== "punctuation").map((f) => f.pattern);
  const punctTargets = focus.filter((f) => f.kind === "punctuation").map((f) => f.pattern);
  const matching = letterTargets.length ? pool.filter((w) => letterTargets.some((t) => w.includes(t)) && w.length >= 2 + lv / 2) : [];
  let prev = "";
  for (let i = 0; i < wordCount; i++) {
    let w: string;
    if (matching.length && rng.chance(0.72)) {
      // weight by how many weak patterns the word contains
      let best = rng.pick(matching);
      for (let k = 0; k < 2; k++) {
        const c = rng.pick(matching);
        const hits = (x: string) => letterTargets.filter((t) => x.includes(t)).length;
        if (hits(c) > hits(best)) best = c;
      }
      w = best;
    } else {
      w = pool[Math.floor(Math.pow(rng.next(), 1.4) * Math.min(pool.length, 400))];
    }
    if (w === prev) w = rng.pick(pool);
    if (punctTargets.length && rng.chance(0.25)) {
      const p = rng.pick(punctTargets);
      w = p === "(" || p === ")" ? `(${w})` : p === '"' || p === "'" ? `${p}${w}${p}` : p === "-" ? `${w}-${rng.pick(pool)}` : `${w}${p}`;
    }
    out.push(w);
    prev = w;
  }
  const names = focus.map((f) => (f.kind === "pair" ? `“${f.pattern}”` : f.kind === "letter" ? `'${f.pattern}'` : `“${f.pattern}”`));
  const reason = focus.length
    ? `Built around your ${focus.length} weakest ${focus.every((f) => f.kind === "pair") ? "letter combinations" : "patterns"}: ${names.join(", ")}.`
    : "Not enough data yet, so this is a balanced warm-up. Your weak spots will show up after a few tests.";
  return { text: out.join(" "), focus, level: lv, reason };
}

/** Level adjusts from the last adaptive run: accurate and fast → harder. */
export function nextLevel(level: number, accuracy: number, wpm: number, avgWpm: number): number {
  if (accuracy >= 96 && wpm >= avgWpm * 0.95) return Math.min(5, level + 1);
  if (accuracy < 90) return Math.max(1, level - 1);
  return level;
}
