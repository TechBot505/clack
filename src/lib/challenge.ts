import LZString from "lz-string";
import { z } from "zod";
import type { TestConfig } from "@/engine/types";
import { sanitizeText } from "@/content/generator";
import { LIMITS } from "@/engine/config";

/**
 * Shareable challenges live entirely in the URL (compressed JSON), so anyone
 * opening the link gets exactly the same test — no account or database needed.
 */

const schema = z.object({
  v: z.literal(1),
  title: z.string().max(60).optional(),
  seed: z.string().max(40).optional(),
  sourceId: z.string().max(40).optional(),
  config: z.object({
    mode: z.enum(["time", "words", "quote", "code", "custom", "zen"]),
    duration: z.number().int().min(LIMITS.minDuration).max(LIMITS.maxDuration).optional(),
    wordCount: z.number().int().min(1).max(LIMITS.maxWords).optional(),
    punctuation: z.boolean().optional(),
    numbers: z.boolean().optional(),
    content: z.enum(["common", "difficult"]).optional(),
    language: z.string().max(40).optional(),
    customText: z.string().max(LIMITS.maxCustomText).optional(),
    customTimer: z.number().int().min(0).max(LIMITS.maxDuration).optional(),
    strict: z.boolean().optional(),
  }),
});

export type Challenge = z.infer<typeof schema>;

export function encodeChallenge(c: Challenge): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(c));
}

export function decodeChallenge(s: string): { title?: string; seed?: string; sourceId?: string; config: Partial<TestConfig> } | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const parsed = schema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;
    const c = parsed.data;
    const config: Partial<TestConfig> = { ...c.config };
    if (config.customText !== undefined) config.customText = sanitizeText(config.customText, LIMITS.maxCustomText);
    return { title: c.title ? sanitizeText(c.title, 60) : undefined, seed: c.seed, sourceId: c.sourceId, config };
  } catch {
    return null;
  }
}

export function challengeUrl(c: Challenge, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/type?c=${encodeChallenge(c)}`;
}
