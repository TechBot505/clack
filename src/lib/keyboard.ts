import type { KeyStat } from "@/engine/analyze";
import type { KeyboardLayout } from "@/stores/settings";

export const LAYOUTS: Record<KeyboardLayout, string[][]> = {
  qwerty: [
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
    ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
  ],
  dvorak: [
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "[", "]"],
    ["'", ",", ".", "p", "y", "f", "g", "c", "r", "l", "/", "=", "\\"],
    ["a", "o", "e", "u", "i", "d", "h", "t", "n", "s", "-"],
    [";", "q", "j", "k", "x", "b", "m", "w", "v", "z"],
  ],
  colemak: [
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
    ["q", "w", "f", "p", "g", "j", "l", "u", "y", ";", "[", "]", "\\"],
    ["a", "r", "s", "t", "d", "h", "n", "e", "i", "o", "'"],
    ["z", "x", "c", "v", "b", "k", "m", ",", ".", "/"],
  ],
};

/** row offsets (in key units) to mimic physical stagger */
export const ROW_OFFSET = [0, 0.5, 0.8, 1.3];

/** shifted characters count toward their base key */
const SHIFTED: Record<string, string> = {
  "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
};

export function baseKey(ch: string): string {
  const lower = ch.toLowerCase();
  return SHIFTED[lower] ?? lower;
}

export interface KeyMetric {
  key: string;
  hits: number;
  misses: number;
  avgMs: number;
  /** words-per-minute equivalent of this key's average interval */
  wpm: number;
  accuracy: number;
}

/** Fold raw per-character stats into physical keys. */
export function keyMetrics(stats: Record<string, KeyStat>): Record<string, KeyMetric> {
  const folded: Record<string, KeyStat> = {};
  for (const [ch, s] of Object.entries(stats)) {
    const k = ch === " " ? "space" : baseKey(ch);
    const f = (folded[k] ??= [0, 0, 0]);
    f[0] += s[0];
    f[1] += s[1];
    f[2] += s[2];
  }
  const out: Record<string, KeyMetric> = {};
  for (const [k, [hits, misses, ms]] of Object.entries(folded)) {
    const avgMs = hits ? ms / hits : 0;
    out[k] = {
      key: k,
      hits,
      misses,
      avgMs,
      wpm: avgMs > 0 ? 12000 / avgMs : 0,
      accuracy: hits + misses ? (hits / (hits + misses)) * 100 : 100,
    };
  }
  return out;
}
