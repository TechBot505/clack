import "server-only";
import type { z } from "zod";
import type { Db } from "./db";
import { HttpError } from "./http";
import { recordFromRun, type RunInput } from "@/engine/record";
import { suspicionReasons } from "@/engine/validate";
import { categoryFor, MIN_VALID_MS, pbCategories } from "@/engine/config";
import { getQuote } from "@/content/quotes";
import { getSnippet } from "@/content/code";
import { sanitizeText } from "@/content/generator";
import type { RunLog } from "@/engine/types";
import type { TestRecord } from "@/lib/records";
import type { importedRecordSchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";

type Row = Prisma.TypingTestGetPayload<object>;

/** DB row → the TestRecord shape the client uses (client id is the public id). */
export function toRecord(r: Row): TestRecord {
  return {
    id: r.clientId ?? r.id,
    createdAt: r.createdAt.getTime(),
    mode: r.mode as TestRecord["mode"],
    mode2: r.mode2,
    content: r.content as TestRecord["content"],
    language: r.language,
    punctuation: r.punctuation,
    numbers: r.numbers,
    seed: r.seed,
    sourceId: r.sourceId,
    customText: null,
    stopOnError: "off",
    confidence: "off",
    strict: false,
    category: r.category,
    wpm: r.wpm,
    raw: r.rawWpm,
    accuracy: r.accuracy,
    consistency: r.consistency,
    peakWpm: r.peakWpm,
    durationMs: Math.round(r.duration * 1000),
    correct: r.correctChars,
    incorrect: r.incorrectChars,
    extra: r.extraChars,
    missed: r.missedChars,
    keystrokes: r.keystrokes,
    wordsTyped: r.wordsTyped,
    backspaces: r.backspaces,
    samples: r.samples as unknown as TestRecord["samples"],
    keyStats: r.keyStats as unknown as TestRecord["keyStats"],
    isPb: r.isPb,
    flagged: r.flagged,
    synced: true,
  };
}

/** Engine options & text that aren't columns live in the event row's metadata. */
interface EventMeta {
  stopOnError: RunInput["stopOnError"];
  confidence: RunInput["confidence"];
  strict: boolean;
}

export function withEventMeta(rec: TestRecord, text: string | null, meta: EventMeta | null): TestRecord {
  return { ...rec, customText: rec.mode === "custom" ? text : null, ...(meta ?? {}) };
}

function normalizeInput(input: RunInput): RunInput {
  const out = { ...input };
  if (out.mode === "quote" && (!out.sourceId || !getQuote(out.sourceId))) throw new HttpError(400, "unknown quote");
  if (out.mode === "code" && (!out.sourceId || !getSnippet(out.sourceId))) throw new HttpError(400, "unknown snippet");
  if (out.mode === "custom") {
    const clean = sanitizeText(out.customText ?? "");
    if (!clean) throw new HttpError(400, "empty custom text");
    out.customText = clean;
  } else out.customText = null;
  if (out.mode !== "time" && out.mode !== "words") {
    out.seed = null;
    out.punctuation = false;
    out.numbers = false;
  }
  if (out.mode !== "quote" && out.mode !== "code") out.sourceId = null;
  // never trust client timestamps in the future
  out.createdAt = Math.min(out.createdAt, Date.now());
  return out;
}

/**
 * Validate a run by replaying it. The client's numbers are ignored entirely:
 * the text is rebuilt from the seed/source, the keystrokes are re-fed through
 * the engine, and the result is checked for impossible patterns.
 */
export function verifyRun(inputRaw: RunInput, log: RunLog) {
  const input = normalizeInput(inputRaw);
  const { record, result } = recordFromRun(input, log);
  const reasons = suspicionReasons(log, result);
  if (input.mode === "time") {
    if (Math.abs(log.endMs - input.mode2 * 1000) > 250) reasons.push("duration_mismatch");
  } else if (input.mode === "words" || input.mode === "quote" || input.mode === "code") {
    if (!result.completed) reasons.push("incomplete");
  } else if (input.mode === "custom" && input.mode2 > 0) {
    if (!result.completed && Math.abs(log.endMs - input.mode2 * 1000) > 250) reasons.push("duration_mismatch");
  }
  if (result.keystrokes === 0) throw new HttpError(422, "empty run");
  return { input, record, result, reasons };
}

export async function saveVerified(prisma: Db, userId: string, input: RunInput, log: RunLog | null, record: TestRecord, reasons: string[]) {
  const flagged = reasons.some((r) => r !== "unverified_import");
  const category = categoryFor({ mode: input.mode, duration: input.mode2, wordCount: input.mode2 });
  const valid = !flagged && record.durationMs >= MIN_VALID_MS && input.mode !== "zen" && !reasons.length;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.typingTest.findUnique({ where: { userId_clientId: { userId, clientId: input.id } } });
    if (existing) return { row: existing, pbCats: [] as string[], duplicate: true };

    // server-side personal bests
    const pbCats: string[] = [];
    if (valid) {
      for (const cat of pbCategories(input)) {
        const cur = await tx.personalBest.findUnique({ where: { userId_category: { userId, category: cat } } });
        if (!cur || record.wpm > cur.wpm) pbCats.push(cat);
      }
    }

    const row = await tx.typingTest.create({
      data: {
        userId,
        clientId: input.id,
        createdAt: new Date(input.createdAt),
        mode: input.mode,
        mode2: input.mode2,
        content: input.content,
        language: input.language,
        punctuation: input.punctuation,
        numbers: input.numbers,
        seed: input.seed,
        sourceId: input.sourceId,
        category,
        wpm: record.wpm,
        rawWpm: record.raw,
        accuracy: record.accuracy,
        consistency: record.consistency,
        peakWpm: record.peakWpm,
        duration: record.durationMs / 1000,
        correctChars: record.correct,
        incorrectChars: record.incorrect,
        extraChars: record.extra,
        missedChars: record.missed,
        keystrokes: record.keystrokes,
        wordsTyped: record.wordsTyped,
        backspaces: record.backspaces,
        samples: record.samples as unknown as Prisma.InputJsonValue,
        keyStats: record.keyStats as unknown as Prisma.InputJsonValue,
        isPb: pbCats.length > 0,
        flagged,
        flagReasons: reasons,
        events: {
          create: {
            version: 1,
            keys: log?.keys ?? "",
            deltas: log?.deltas ?? [],
            endMs: log?.endMs ?? record.durationMs,
            // store what can't be regenerated from a seed
            text: input.customText ?? null,
            meta: { stopOnError: input.stopOnError, confidence: input.confidence, strict: input.strict },
          },
        },
      },
    });

    for (const cat of pbCats) {
      await tx.personalBest.upsert({
        where: { userId_category: { userId, category: cat } },
        update: { wpm: record.wpm, accuracy: record.accuracy, rawWpm: record.raw, testId: row.id, achievedAt: row.createdAt },
        create: { userId, category: cat, wpm: record.wpm, accuracy: record.accuracy, rawWpm: record.raw, testId: row.id, achievedAt: row.createdAt },
      });
    }
    await tx.user.update({ where: { id: userId }, data: { xp: { increment: xpFor(record, valid) } } });
    return { row, pbCats, duplicate: false };
  });
}

/** XP rewards meaningful practice: time spent × accuracy, not test spam. */
export function xpFor(r: Pick<TestRecord, "durationMs" | "accuracy" | "wordsTyped">, valid: boolean): number {
  if (!valid) return 0;
  const minutes = r.durationMs / 60000;
  const accFactor = Math.max(0, (r.accuracy - 80) / 20);
  return Math.round(Math.min(60, minutes * 20 * accFactor + r.wordsTyped * 0.1));
}

export function recordFromImported(input: RunInput, rec: z.infer<typeof importedRecordSchema>): TestRecord {
  return {
    ...input,
    category: categoryFor({ mode: input.mode, duration: input.mode2, wordCount: input.mode2 }),
    wpm: rec.wpm,
    raw: rec.raw,
    accuracy: rec.accuracy,
    consistency: rec.consistency,
    peakWpm: rec.peakWpm,
    durationMs: rec.durationMs,
    correct: rec.correct,
    incorrect: rec.incorrect,
    extra: rec.extra,
    missed: rec.missed,
    keystrokes: rec.keystrokes,
    wordsTyped: rec.wordsTyped,
    backspaces: rec.backspaces,
    samples: rec.samples,
    keyStats: rec.keyStats,
    isPb: false,
  };
}

export function eventMeta(meta: unknown): EventMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Partial<EventMeta>;
  return {
    stopOnError: m.stopOnError === "letter" || m.stopOnError === "word" ? m.stopOnError : "off",
    confidence: m.confidence === "on" || m.confidence === "max" ? m.confidence : "off",
    strict: !!m.strict,
  };
}

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

/** Rebuild one personal-best row from the user's remaining tests. */
export async function recomputePb(tx: Tx, userId: string, category: string) {
  const rows = await tx.typingTest.findMany({
    where: { userId, flagged: false, duration: { gte: MIN_VALID_MS / 1000 }, mode: { not: "zen" } },
    select: { id: true, mode: true, mode2: true, content: true, punctuation: true, numbers: true, wpm: true, accuracy: true, rawWpm: true, createdAt: true, flagReasons: true },
    orderBy: { wpm: "desc" },
    take: 5000,
  });
  const best = rows.find((r) => r.flagReasons.length === 0 && pbCategories(r).includes(category));
  if (!best) return;
  await tx.personalBest.create({
    data: { userId, category, wpm: best.wpm, accuracy: best.accuracy, rawWpm: best.rawWpm, testId: best.id, achievedAt: best.createdAt },
  });
}
