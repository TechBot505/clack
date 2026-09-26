"use client";

import { useMemo } from "react";
import { useHistory } from "@/stores/history";
import { useSettings } from "@/stores/settings";
import { evaluateAchievements, achievementXp, type Unlocked } from "./achievements";
import { isUnlocked, levelFor, testXp } from "./progression";
import { useEggs } from "./eggs";
import type { TestRecord } from "./records";

export interface Progression {
  on: boolean;
  xp: number;
  level: number;
  into: number;
  span: number;
  achievements: Record<string, Unlocked>;
  can: (id: string) => boolean;
}

export function progressionFrom(tests: TestRecord[], flags: Record<string, boolean>, on: boolean): Progression {
  const achievements = evaluateAchievements(tests, flags);
  const xp = tests.reduce((s, t) => s + testXp(t), 0) + achievementXp(achievements);
  const lv = levelFor(xp);
  return { on, xp, ...lv, achievements, can: (id) => isUnlocked(id, lv.level, on) };
}

export function useProgression(): Progression {
  const tests = useHistory((s) => s.tests);
  const on = useSettings((s) => s.progression);
  const themes = useSettings((s) => s.unlockedThemes);
  const eggs = useEggs();
  return useMemo(() => progressionFrom(tests, { ...eggs, nebula: themes.includes("nebula") }, on), [tests, eggs, themes, on]);
}
