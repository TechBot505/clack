import { createRng } from "./rng";
import type { EngineOptions, TestConfig, TextSpec } from "./types";
import { filterQuotes, getQuote, QUOTES } from "@/content/quotes";
import { snippetsFor, SNIPPETS } from "@/content/code";

export const TIME_PRESETS = [15, 30, 60, 120] as const;
export const WORD_PRESETS = [10, 25, 50, 100] as const;

export const LIMITS = {
  minDuration: 5,
  maxDuration: 600,
  minWords: 1,
  maxWords: 1000,
  maxCustomText: 5000,
};

export function clampConfig(c: TestConfig): TestConfig {
  return {
    ...c,
    duration: Math.round(Math.min(LIMITS.maxDuration, Math.max(LIMITS.minDuration, c.duration || 30))),
    wordCount: Math.round(Math.min(LIMITS.maxWords, Math.max(LIMITS.minWords, c.wordCount || 25))),
    customText: (c.customText ?? "").slice(0, LIMITS.maxCustomText),
    customTimer: Math.round(Math.min(LIMITS.maxDuration, Math.max(0, c.customTimer || 0))),
  };
}

export function engineOptionsFor(c: TestConfig): EngineOptions {
  return {
    stopOnError: c.strict ? "letter" : c.stopOnError,
    confidence: c.confidence,
    zen: c.mode === "zen",
    code: c.mode === "code",
  };
}

/** Chooses the concrete text for a test. `seed` makes the choice reproducible. */
export function textSpecFor(c: TestConfig, seed: string, fixed?: { sourceId?: string; text?: string }, ctx?: { favorites?: string[] }): TextSpec {
  switch (c.mode) {
    case "time":
      return { kind: "words", language: c.language, content: c.content, punctuation: c.punctuation, numbers: c.numbers, seed };
    case "words":
      return { kind: "words", language: c.language, content: c.content, punctuation: c.punctuation, numbers: c.numbers, seed, count: c.wordCount };
    case "quote": {
      if (fixed?.sourceId && getQuote(fixed.sourceId)) return { kind: "quote", id: fixed.sourceId };
      const favs = (ctx?.favorites ?? []).map((id) => getQuote(id)).filter((q): q is NonNullable<typeof q> => !!q);
      const pool = c.quoteGroup === "favorites" ? favs.filter((q) => c.quoteLength === "any" || filterQuotes(c.quoteLength, "any").includes(q)) : filterQuotes(c.quoteLength, c.quoteGroup);
      const list = pool.length ? pool : QUOTES;
      return { kind: "quote", id: createRng(seed).pick(list).id };
    }
    case "code": {
      if (fixed?.sourceId && SNIPPETS.some((s) => s.id === fixed.sourceId)) return { kind: "code", id: fixed.sourceId };
      const pool = snippetsFor(c.codeLanguage);
      const list = pool.length ? pool : SNIPPETS;
      return { kind: "code", id: createRng(seed).pick(list).id };
    }
    case "custom":
      return { kind: "custom", text: fixed?.text ?? c.customText };
    case "zen":
      return { kind: "zen" };
  }
}

export function sourceIdOf(spec: TextSpec): string | undefined {
  return spec.kind === "quote" || spec.kind === "code" ? spec.id : undefined;
}

/** Primary category, used for grouping and leaderboards. */
export function categoryFor(c: Pick<TestConfig, "mode" | "duration" | "wordCount">): string {
  switch (c.mode) {
    case "time":
      return `time:${c.duration}`;
    case "words":
      return `words:${c.wordCount}`;
    default:
      return c.mode;
  }
}

export interface PbInput {
  mode: string;
  mode2: number;
  content: string;
  punctuation: boolean;
  numbers: boolean;
}

/** All personal-best buckets a finished test counts toward. */
export function pbCategories(t: PbInput): string[] {
  const out: string[] = [];
  const plain = !t.punctuation && !t.numbers && t.content === "common";
  if (t.mode === "time" && plain) out.push(`time:${t.mode2}`);
  if (t.mode === "words" && plain) out.push(`words:${t.mode2}`);
  if (t.mode === "quote") out.push("quote");
  if (t.mode === "code") out.push("code");
  if ((t.mode === "time" || t.mode === "words") && t.punctuation) out.push("punctuation");
  if ((t.mode === "time" || t.mode === "words") && t.numbers) out.push("numbers");
  if ((t.mode === "time" || t.mode === "words") && t.content === "difficult") out.push("difficult");
  return out;
}

export const RECORD_CATEGORIES: { id: string; label: string; group: "time" | "words" | "modes" }[] = [
  { id: "time:15", label: "15 seconds", group: "time" },
  { id: "time:30", label: "30 seconds", group: "time" },
  { id: "time:60", label: "60 seconds", group: "time" },
  { id: "time:120", label: "120 seconds", group: "time" },
  { id: "words:10", label: "10 words", group: "words" },
  { id: "words:25", label: "25 words", group: "words" },
  { id: "words:50", label: "50 words", group: "words" },
  { id: "words:100", label: "100 words", group: "words" },
  { id: "quote", label: "Quotes", group: "modes" },
  { id: "code", label: "Code", group: "modes" },
  { id: "numbers", label: "Numbers", group: "modes" },
  { id: "punctuation", label: "Punctuation", group: "modes" },
];

export function categoryLabel(id: string): string {
  const known = RECORD_CATEGORIES.find((c) => c.id === id);
  if (known) return known.label;
  const [kind, n] = id.split(":");
  if (kind === "time") return `${n} seconds`;
  if (kind === "words") return `${n} words`;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** Tests shorter than this don't count toward records or stats averages. */
export const MIN_VALID_MS = 3000;
