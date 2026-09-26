import type { TestRecord } from "./records";
import { isValidForStats } from "./records";

/**
 * Optional progression. XP rewards meaningful practice (time × accuracy),
 * not test spam, and unlocks only cosmetics — nothing functional is gated.
 */

export function testXp(t: Pick<TestRecord, "durationMs" | "accuracy" | "wordsTyped" | "flagged" | "mode">): number {
  if (!isValidForStats(t as TestRecord)) return 0;
  const minutes = t.durationMs / 60000;
  const accFactor = Math.max(0, (t.accuracy - 80) / 20);
  return Math.round(Math.min(60, minutes * 20 * accFactor + t.wordsTyped * 0.1));
}

export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : Math.round(120 * Math.pow(level - 1, 1.55));
}

export function levelFor(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  return { level, into: xp - base, span: xpForLevel(level + 1) - base };
}

export type UnlockKind = "caret" | "theme" | "sound" | "profile" | "keyboard";

export interface Unlock {
  level: number;
  kind: UnlockKind;
  id: string;
  label: string;
}

export const UNLOCKS: Unlock[] = [
  { level: 3, kind: "caret", id: "comet", label: "comet caret" },
  { level: 5, kind: "theme", id: "solar", label: "Solar theme" },
  { level: 7, kind: "sound", id: "chime", label: "chime sound pack" },
  { level: 9, kind: "keyboard", id: "neon", label: "neon on-screen keyboard" },
  { level: 12, kind: "profile", id: "halo", label: "DNA halo frame" },
];

export function isUnlocked(id: string, level: number, progressionOn: boolean): boolean {
  if (!progressionOn) return true;
  const u = UNLOCKS.find((x) => x.id === id);
  return !u || level >= u.level;
}
