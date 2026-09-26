import { createRng } from "@/engine/rng";
import type { Fingerprint } from "./fingerprint";

/**
 * Typing DNA: a generative portrait of how someone types. A double strand
 * bent into a ring, shaped by their numbers:
 *
 *   twists        ← speed           strand jitter  ← (in)consistency
 *   rung density  ← accuracy        gaps           ← pauses
 *   swelling      ← per-key speed   inner web      ← most frequent key transitions
 *   flares        ← burst length    curls          ← corrections / weak keys
 */

export interface DnaShape {
  size: number;
  strandA: string;
  strandB: string;
  rungs: { x1: number; y1: number; x2: number; y2: number; weak: boolean; o: number }[];
  chords: { d: string; w: number }[];
  flares: { x1: number; y1: number; x2: number; y2: number }[];
  curls: { d: string }[];
  dots: { x: number; y: number; r: number; o: number }[];
  twist: number;
}

const LETTERS = "etaoinshrdlucmfwypvbgkjqxz".split("");
const TAU = Math.PI * 2;

export function letterAngle(ch: string): number {
  const i = LETTERS.indexOf(ch);
  // interleave frequent and rare letters around the ring
  const pos = i < 0 ? 0 : (i * 11) % 26;
  return (pos / 26) * TAU - Math.PI / 2;
}

export function buildDna(fp: Fingerprint, seed: string, size = 600): DnaShape {
  const rng = createRng(`dna:${seed}`);
  const c = size / 2;
  const R = size * 0.32;
  const twist = 5 + Math.round(Math.min(160, fp.avgWpm) / 14);
  const jitter = (1 - Math.min(1, fp.consistency / 100)) * size * 0.05;
  const phases = [rng.next() * TAU, rng.next() * TAU, rng.next() * TAU];
  const noise = (t: number) => (Math.sin(t * 3 + phases[0]) + Math.sin(t * 7 + phases[1]) * 0.6 + Math.sin(t * 13 + phases[2]) * 0.35) / 1.95;

  // per-letter speed → swelling of the strands near that letter's angle
  const speed: Record<string, number> = {};
  const letterMs = LETTERS.map((l) => {
    const s = fp.keyStats[l];
    return s && s[0] > 5 ? s[2] / s[0] : 0;
  });
  const known = letterMs.filter(Boolean);
  const med = known.length ? [...known].sort((a, b) => a - b)[Math.floor(known.length / 2)] : 1;
  LETTERS.forEach((l, i) => (speed[l] = letterMs[i] ? Math.max(-1, Math.min(1, (med - letterMs[i]) / med)) : 0));
  const swell = (theta: number) => {
    let acc = 0;
    let wsum = 0;
    for (const l of LETTERS) {
      let d = Math.abs(theta - letterAngle(l)) % TAU;
      if (d > Math.PI) d = TAU - d;
      const w = Math.exp(-(d * d) / 0.02);
      acc += speed[l] * w;
      wsum += w;
    }
    return wsum ? acc / wsum : 0;
  };

  // gaps from pauses
  const gapCount = Math.min(8, Math.round(fp.pausesPerMinute * 1.5));
  const gaps = Array.from({ length: gapCount }, () => rng.next() * TAU);
  const inGap = (t: number) => gaps.some((g) => {
    let d = Math.abs(t - g) % TAU;
    if (d > Math.PI) d = TAU - d;
    return d < 0.035;
  });

  const amp = (t: number) => size * 0.045 * (1 + 0.5 * swell(t - Math.PI / 2)) + jitter * noise(t * 2);
  const point = (t: number, sign: 1 | -1) => {
    const r = R + sign * amp(t) * Math.sin(twist * t);
    return { x: c + r * Math.cos(t - Math.PI / 2), y: c + r * Math.sin(t - Math.PI / 2) };
  };

  const strand = (sign: 1 | -1) => {
    let d = "";
    let pen = false;
    const N = 720;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * TAU;
      if (inGap(t)) {
        pen = false;
        continue;
      }
      const p = point(t, sign);
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  // rungs: more with higher accuracy; weak (error-prone) letters get marked rungs
  const rungCount = Math.round(40 + Math.max(0, fp.accuracy - 88) * 5);
  const weakSet = new Set(fp.mistypedLetters.filter((m) => m.rate > 0.04).map((m) => m.key));
  const rungs: DnaShape["rungs"] = [];
  for (let i = 0; i < rungCount; i++) {
    const t = (i / rungCount) * TAU;
    if (inGap(t)) continue;
    const a = point(t, 1);
    const b = point(t, -1);
    // nearest letter to this angle
    let near = "e";
    let best = Infinity;
    for (const l of LETTERS) {
      let d = Math.abs(t - Math.PI / 2 - letterAngle(l)) % TAU;
      if (d > Math.PI) d = TAU - d;
      if (d < best) {
        best = d;
        near = l;
      }
    }
    rungs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, weak: weakSet.has(near), o: 0.35 + 0.65 * Math.abs(Math.sin(twist * t)) });
  }

  // inner web: most frequent transitions
  const pairs = Object.entries(fp.bigrams)
    .filter(([k]) => /^[a-z]{2}$/.test(k))
    .sort((a, b) => b[1][0] - a[1][0])
    .slice(0, 16);
  const maxN = pairs.length ? pairs[0][1][0] : 1;
  const inner = R * 0.62;
  const chords = pairs.map(([k, s]) => {
    const a1 = letterAngle(k[0]);
    const a2 = letterAngle(k[1]);
    const p1 = { x: c + inner * Math.cos(a1), y: c + inner * Math.sin(a1) };
    const p2 = { x: c + inner * Math.cos(a2), y: c + inner * Math.sin(a2) };
    const mid = { x: c + (p1.x + p2.x - 2 * c) * 0.15, y: c + (p1.y + p2.y - 2 * c) * 0.15 };
    return { d: `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q${mid.x.toFixed(1)} ${mid.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`, w: 0.6 + 2.4 * (s[0] / maxN) };
  });
  const dots = LETTERS.map((l) => {
    const a = letterAngle(l);
    const s = fp.keyStats[l];
    const n = s ? s[0] + s[1] : 0;
    return { x: c + inner * Math.cos(a), y: c + inner * Math.sin(a), r: 1.5 + Math.min(4, Math.sqrt(n) / 8), o: n ? 0.9 : 0.25 };
  });

  // flares at the strongest keys, length from burst length
  const flareLen = size * (0.02 + Math.min(0.08, fp.burstLength / 180));
  const flares = fp.strongestKeys.slice(0, 5).map((k) => {
    const a = letterAngle(k.key);
    const r1 = R + size * 0.07;
    return { x1: c + r1 * Math.cos(a), y1: c + r1 * Math.sin(a), x2: c + (r1 + flareLen) * Math.cos(a), y2: c + (r1 + flareLen) * Math.sin(a) };
  });

  // curls at mistyped letters, more of them with more corrections
  const curlCount = Math.min(fp.mistypedLetters.length, 2 + Math.round(fp.backspaceRate / 2));
  const curls = fp.mistypedLetters.slice(0, curlCount).map((m) => {
    const a = letterAngle(m.key);
    const r = R - size * 0.09;
    const x = c + r * Math.cos(a);
    const y = c + r * Math.sin(a);
    const s = size * 0.018;
    return { d: `M${(x + s).toFixed(1)} ${y.toFixed(1)} a${s} ${s} 0 1 0 ${(-s).toFixed(1)} ${(-s).toFixed(1)}` };
  });

  return { size, strandA: strand(1), strandB: strand(-1), rungs, chords, flares, curls, dots, twist };
}
