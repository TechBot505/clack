/** Separator that must be typed after a word: space, newline (code) or nothing (last word). */
export type Sep = " " | "\n" | "";

export interface Word {
  text: string;
  sep: Sep;
  /** Leading indentation (in spaces) shown before this word when it starts a line. Auto-typed. */
  indent: number;
  /** Optional syntax token classes, one per character (code mode). */
  tokens?: string;
}

/** Special key codes stored in the event log. */
export const KEY_BACKSPACE = "\b";
export const KEY_WORD_BACKSPACE = "\x17";
export const KEY_ENTER = "\n";
export const KEY_SPACE = " ";

export type StopOnError = "off" | "letter" | "word";
export type Confidence = "off" | "on" | "max";

export interface EngineOptions {
  stopOnError: StopOnError;
  /** on: cannot return to previous words. max: backspace disabled entirely. */
  confidence: Confidence;
  /** Free typing, no target text. */
  zen?: boolean;
  /** Enter vs space are distinct separators (code mode). */
  code?: boolean;
  /** Max extra characters allowed past the end of a word. */
  maxExtra?: number;
}

export type TestMode = "time" | "words" | "quote" | "code" | "custom" | "zen";

export type WordContent = "common" | "difficult";

/** Everything needed to (re)build the exact text for a test. */
export type TextSpec =
  | {
      kind: "words";
      language: string;
      content: WordContent;
      punctuation: boolean;
      numbers: boolean;
      seed: string;
      /** Finite word count (words mode); omit for an endless stream (time mode). */
      count?: number;
    }
  | { kind: "quote"; id: string }
  | { kind: "code"; id: string }
  | { kind: "custom"; text: string }
  | { kind: "zen" };

/** Compact keystroke log. keys[i] happened deltas[i] ms after keys[i-1] (deltas[0] = 0). */
export interface RunLog {
  keys: string;
  deltas: number[];
  /** Elapsed ms from the first keystroke to the end of the test. */
  endMs: number;
}

export interface TestConfig {
  mode: TestMode;
  /** seconds (time mode) */
  duration: number;
  /** words mode count */
  wordCount: number;
  content: WordContent;
  punctuation: boolean;
  numbers: boolean;
  language: string;
  stopOnError: StopOnError;
  confidence: Confidence;
  /** quote length filter */
  quoteLength: "any" | "short" | "medium" | "long";
  quoteGroup: "any" | "books" | "philosophy" | "technology" | "speeches";
  codeLanguage: string;
  customText: string;
  /** optional time limit for custom tests (seconds, 0 = none) */
  customTimer: number;
  /** Hide all live stats and fade the UI while typing. */
  flow: boolean;
  /** Accuracy mode: mistakes block progress and must be fixed. */
  strict: boolean;
}

export const DEFAULT_CONFIG: TestConfig = {
  mode: "time",
  duration: 30,
  wordCount: 25,
  content: "common",
  punctuation: false,
  numbers: false,
  language: "english",
  stopOnError: "off",
  confidence: "off",
  quoteLength: "any",
  quoteGroup: "any",
  codeLanguage: "any",
  customText: "",
  customTimer: 0,
  flow: false,
  strict: false,
};
