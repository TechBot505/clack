import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";

/**
 * Daily challenge: one globally consistent test per UTC day. The config and
 * seed are pure functions of the date, so every client (and the server)
 * derives the exact same text without coordination.
 */

export function utcDay(ms = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const ROTATION: { name: string; config: Partial<TestConfig> }[] = [
  { name: "30 seconds, plain", config: { mode: "time", duration: 30 } },
  { name: "50 words with punctuation", config: { mode: "words", wordCount: 50, punctuation: true } },
  { name: "a quote", config: { mode: "quote", quoteLength: "medium", quoteGroup: "any" } },
  { name: "60 seconds with numbers", config: { mode: "time", duration: 60, numbers: true } },
  { name: "25 difficult words", config: { mode: "words", wordCount: 25, content: "difficult" } },
  { name: "a snippet of code", config: { mode: "code", codeLanguage: "any" } },
  { name: "15-second sprint", config: { mode: "time", duration: 15 } },
];

export interface DailySpec {
  date: string;
  seed: string;
  name: string;
  config: TestConfig;
}

export function dailySpec(date = utcDay()): DailySpec {
  const [y, m, d] = date.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const r = ROTATION[((dayNumber % ROTATION.length) + ROTATION.length) % ROTATION.length];
  return {
    date,
    seed: `daily:${date}`,
    name: r.name,
    config: {
      ...DEFAULT_CONFIG,
      punctuation: false,
      numbers: false,
      content: "common",
      ...r.config,
      stopOnError: "off",
      confidence: "off",
      strict: false,
      flow: false,
    },
  };
}

export interface DailyEntry {
  testId: string;
  wpm: number;
  accuracy: number;
  at: number;
  attempts: number;
}

export type DailyLog = Record<string, DailyEntry>;

export function dailyStreaks(log: DailyLog, today = utcDay()): { current: number; longest: number } {
  const days = Object.keys(log).sort();
  if (!days.length) return { current: 0, longest: 0 };
  const toNum = (s: string) => Math.floor(Date.parse(s + "T00:00:00Z") / 86400000);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = toNum(days[i]) - toNum(days[i - 1]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  let current = 0;
  const gap = toNum(today) - toNum(days[days.length - 1]);
  if (gap <= 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (toNum(days[i]) - toNum(days[i - 1]) === 1) current++;
      else break;
    }
  }
  return { current, longest };
}
