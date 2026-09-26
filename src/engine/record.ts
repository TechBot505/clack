import { analyzeRun, type RunResult } from "./analyze";
import { buildText } from "@/content/generator";
import { categoryFor } from "./config";
import type { Confidence, EngineOptions, RunLog, StopOnError, TestMode, TextSpec, WordContent } from "./types";
import type { TestRecord } from "@/lib/records";

/** The minimal description of a run: enough to rebuild its text and replay it. */
export interface RunInput {
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
}

export function specFromInput(i: RunInput): TextSpec {
  switch (i.mode) {
    case "time":
    case "words":
      return {
        kind: "words",
        language: i.language,
        content: i.content,
        punctuation: i.punctuation,
        numbers: i.numbers,
        seed: i.seed ?? "",
        count: i.mode === "words" ? i.mode2 : undefined,
      };
    case "quote":
      return { kind: "quote", id: i.sourceId ?? "" };
    case "code":
      return { kind: "code", id: i.sourceId ?? "" };
    case "custom":
      return { kind: "custom", text: i.customText ?? "" };
    case "zen":
      return { kind: "zen" };
  }
}

export function optionsFromInput(i: Pick<RunInput, "stopOnError" | "confidence" | "strict">): EngineOptions {
  return { stopOnError: i.strict ? "letter" : i.stopOnError, confidence: i.confidence };
}

export function replayInput(i: RunInput, log: RunLog): RunResult {
  return analyzeRun(buildText(specFromInput(i)), optionsFromInput(i), log);
}

export function recordFromRun(i: RunInput, log: RunLog): { record: TestRecord; result: RunResult } {
  const result = replayInput(i, log);
  const record: TestRecord = {
    ...i,
    customText: i.mode === "custom" ? (i.customText ?? "") : null,
    category: categoryFor({ mode: i.mode, duration: i.mode2, wordCount: i.mode2 }),
    wpm: result.wpm,
    raw: result.raw,
    accuracy: result.accuracy,
    consistency: result.consistency,
    peakWpm: result.peakWpm,
    durationMs: result.durationMs,
    correct: result.chars.correct,
    incorrect: result.chars.incorrect,
    extra: result.chars.extra,
    missed: result.chars.missed,
    keystrokes: result.keystrokes,
    wordsTyped: result.chars.wordsTyped,
    backspaces: result.backspaces,
    samples: result.samples,
    keyStats: result.keyStats,
    isPb: false,
  };
  return { record, result };
}
