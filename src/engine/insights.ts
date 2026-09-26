import type { RunResult } from "./analyze";
import type { TestRecord } from "@/lib/records";
import { isValidForStats } from "@/lib/records";

export interface Insight {
  id: string;
  text: string;
  /** emphasized fragment rendered bigger/colored */
  highlight?: string;
  tone: "good" | "neutral" | "warn";
  weight: number;
}

const PUNCT = /[.,;:!?'"()\-]/;
const pct = (n: number) => `${Math.round(n)}%`;

/** Algorithmic post-test observations, ranked by how interesting they are. */
export function generateInsights(result: RunResult, record: TestRecord, history: TestRecord[], now = Date.now()): Insight[] {
  const out: Insight[] = [];
  const typing = result.events.filter((e) => (e.kind === "char" || e.kind === "sep") && !e.blocked);

  // vs 30-day average
  const monthAgo = now - 30 * 86400000;
  const recent = history.filter((t) => t.id !== record.id && t.createdAt >= monthAgo && isValidForStats(t) && t.mode !== "code");
  if (recent.length >= 3 && record.mode !== "zen") {
    const avg = recent.reduce((a, t) => a + t.wpm, 0) / recent.length;
    if (avg > 0) {
      const diff = ((result.wpm - avg) / avg) * 100;
      if (Math.abs(diff) >= 3) {
        out.push({
          id: "vs-avg",
          text: `Your speed was ${pct(Math.abs(diff))} ${diff > 0 ? "higher" : "lower"} than your 30-day average.`,
          highlight: pct(Math.abs(diff)),
          tone: diff > 0 ? "good" : "neutral",
          weight: diff > 0 ? 9 : 5,
        });
      } else {
        out.push({ id: "vs-avg", text: "Right on your 30-day average. Steady.", tone: "neutral", weight: 3 });
      }
    }
  }

  // burst
  if (result.peakWpm > result.wpm * 1.12 && result.durationMs > 4000) {
    out.push({
      id: "burst",
      text: `Your fastest burst was ${Math.round(result.peakWpm)} WPM.`,
      highlight: `${Math.round(result.peakWpm)} WPM`,
      tone: "good",
      weight: 8,
    });
  }

  // fastest / slowest words
  const clean = result.words.filter((w) => w.clean && w.text.length >= 4);
  if (clean.length >= 3) {
    const fastest = clean.reduce((a, b) => (b.wpm > a.wpm ? b : a));
    const slowest = result.words.filter((w) => w.text.length >= 3).reduce((a, b) => (b.wpm < a.wpm ? b : a), clean[0]);
    out.push({
      id: "fast-word",
      text: `Your fastest word was '${fastest.text}' at an equivalent ${Math.round(fastest.wpm)} WPM.`,
      highlight: `'${fastest.text}'`,
      tone: "good",
      weight: 7,
    });
    if (slowest && slowest.text !== fastest.text) {
      out.push({
        id: "slow-word",
        text: `Your slowest word was '${slowest.text}'.`,
        highlight: `'${slowest.text}'`,
        tone: "neutral",
        weight: 4,
      });
    }
  }

  // streak
  if (result.longestStreak >= 25) {
    out.push({
      id: "streak",
      text: `Your longest mistake-free streak was ${result.longestStreak} characters.`,
      highlight: `${result.longestStreak}`,
      tone: "good",
      weight: result.accuracy === 100 ? 2 : 6,
    });
  }

  // accuracy halves
  if (typing.length >= 40) {
    const mid = result.durationMs / 2;
    const first = typing.filter((e) => e.t < mid);
    const second = typing.filter((e) => e.t >= mid);
    if (first.length >= 15 && second.length >= 15) {
      const a1 = (first.filter((e) => e.correct).length / first.length) * 100;
      const a2 = (second.filter((e) => e.correct).length / second.length) * 100;
      if (Math.abs(a2 - a1) >= 2) {
        out.push({
          id: "halves",
          text: a2 > a1 ? `Accuracy improved during the second half (${pct(a1)} → ${pct(a2)}).` : `Accuracy slipped in the second half (${pct(a1)} → ${pct(a2)}).`,
          tone: a2 > a1 ? "good" : "warn",
          weight: 6,
        });
      }
    }
  }

  // punctuation & capitals slowdowns
  const allEvents = result.events;
  const baseline: number[] = [];
  const afterPunct: number[] = [];
  const capitals: number[] = [];
  for (let i = 1; i < allEvents.length; i++) {
    const e = allEvents[i];
    if (!(e.kind === "char" || e.kind === "sep") || !e.correct) continue;
    const dt = e.t - allEvents[i - 1].t;
    if (dt <= 0 || dt > 1500) continue;
    const prevKey = allEvents[i - 1].key;
    if (PUNCT.test(prevKey)) afterPunct.push(dt);
    else if (/[A-Z]/.test(e.key)) capitals.push(dt);
    else baseline.push(dt);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const base = mean(baseline);
  if (afterPunct.length >= 3 && base > 0) {
    const r = mean(afterPunct) / base;
    if (r >= 1.25) {
      out.push({
        id: "punct",
        text: `You slowed down most after punctuation (+${pct((r - 1) * 100)} per key).`,
        highlight: "punctuation",
        tone: "warn",
        weight: 7,
      });
    }
  }
  if (capitals.length >= 3 && base > 0) {
    const extra = mean(capitals) - base;
    if (extra >= 40) {
      out.push({ id: "caps", text: `Capital letters cost you about ${Math.round(extra)} ms each.`, highlight: `${Math.round(extra)} ms`, tone: "warn", weight: 5 });
    }
  }

  // most-missed key
  const misses = Object.entries(result.keyStats).filter(([, s]) => s[1] > 0).sort((a, b) => b[1][1] - a[1][1]);
  if (misses.length && misses[0][1][1] >= 2) {
    const [k, s] = misses[0];
    out.push({ id: "miss-key", text: `Most missed key: '${k === " " ? "space" : k}' (${s[1]}×).`, highlight: `'${k === " " ? "space" : k}'`, tone: "neutral", weight: 4 });
  }

  // clean run / no backspace
  if (result.backspaces === 0 && result.keystrokes >= 30) {
    out.push({ id: "no-back", text: "Zero backspaces. Committed to every keystroke.", tone: "good", weight: 5 });
  }
  if (result.consistency >= 85 && result.durationMs > 10000) {
    out.push({ id: "metronome", text: `Metronome-level rhythm: ${pct(result.consistency)} consistency.`, highlight: pct(result.consistency), tone: "good", weight: 6 });
  }
  if (result.pauses.count >= 2) {
    out.push({ id: "pauses", text: `You paused ${result.pauses.count} times for over a second.`, tone: "neutral", weight: 3 });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 5);
}
