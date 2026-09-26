import { z } from "zod";
import { LIMITS } from "@/engine/config";
import { LANGUAGE_IDS } from "@/content/languages";

/** Request validation. Everything from the client is untrusted input. */

export const runInputSchema = z
  .object({
    id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
    createdAt: z.number().int().positive(),
    mode: z.enum(["time", "words", "quote", "code", "custom", "zen"]),
    mode2: z.number().int().min(0).max(Math.max(LIMITS.maxDuration, LIMITS.maxWords)),
    content: z.enum(["common", "difficult"]),
    language: z.string().refine((l) => LANGUAGE_IDS.includes(l), "unknown language"),
    punctuation: z.boolean(),
    numbers: z.boolean(),
    seed: z.string().max(64).nullable(),
    sourceId: z.string().max(64).nullable(),
    customText: z.string().max(LIMITS.maxCustomText).nullable().optional(),
    stopOnError: z.enum(["off", "letter", "word"]),
    confidence: z.enum(["off", "on", "max"]),
    strict: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "time" && (v.mode2 < LIMITS.minDuration || v.mode2 > LIMITS.maxDuration)) ctx.addIssue({ code: "custom", message: "bad duration", path: ["mode2"] });
    if (v.mode === "words" && (v.mode2 < LIMITS.minWords || v.mode2 > LIMITS.maxWords)) ctx.addIssue({ code: "custom", message: "bad word count", path: ["mode2"] });
    if ((v.mode === "time" || v.mode === "words") && !v.seed) ctx.addIssue({ code: "custom", message: "seed required", path: ["seed"] });
    if ((v.mode === "quote" || v.mode === "code") && !v.sourceId) ctx.addIssue({ code: "custom", message: "source required", path: ["sourceId"] });
    if (v.mode === "custom" && !v.customText) ctx.addIssue({ code: "custom", message: "text required", path: ["customText"] });
  });

export const runLogSchema = z
  .object({
    keys: z.string().max(40_000),
    deltas: z.array(z.number().int().min(0).max(600_000)).max(40_000),
    endMs: z.number().int().min(0).max(LIMITS.maxDuration * 1000 + 60_000),
  })
  .refine((l) => l.keys.length === l.deltas.length, "keys/deltas length mismatch");

export const saveTestSchema = z.object({ input: runInputSchema, log: runLogSchema });

const samplesSchema = z.object({
  t: z.array(z.number()).max(700),
  wpm: z.array(z.number()).max(700),
  raw: z.array(z.number()).max(700),
  err: z.array(z.number()).max(700),
});

/** Summary of a test imported without a keystroke log (older local tests). */
export const importedRecordSchema = z.object({
  wpm: z.number().min(0).max(400),
  raw: z.number().min(0).max(500),
  accuracy: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  peakWpm: z.number().min(0).max(600),
  durationMs: z.number().min(0).max(LIMITS.maxDuration * 1000 + 60_000),
  correct: z.number().int().min(0).max(100_000),
  incorrect: z.number().int().min(0).max(100_000),
  extra: z.number().int().min(0).max(100_000),
  missed: z.number().int().min(0).max(100_000),
  keystrokes: z.number().int().min(0).max(200_000),
  wordsTyped: z.number().int().min(0).max(20_000),
  backspaces: z.number().int().min(0).max(100_000),
  samples: samplesSchema,
  keyStats: z.record(z.string().max(2), z.tuple([z.number(), z.number(), z.number()])),
});

export const importSchema = z.object({
  items: z
    .array(z.object({ input: runInputSchema, log: runLogSchema.nullable(), record: importedRecordSchema }))
    .max(100),
});
