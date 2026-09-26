import type { TestRecord } from "./records";
import { dayKey, isValidForStats } from "./records";
import { pbCategories } from "@/engine/config";

/**
 * Achievements are derived from history (plus a few local "egg" flags), so
 * they're always consistent with what you actually did and never need a
 * separate source of truth. Unlock time = the first test that qualified.
 */

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  secret?: boolean;
  /** hint shown while a secret one is still locked */
  hint?: string;
  xp: number;
}

export interface AchievementContext {
  tests: TestRecord[]; // chronological
  flags: Record<string, boolean>;
}

type Check = (ctx: AchievementContext) => TestRecord | true | null;

const firstWhere = (ctx: AchievementContext, fn: (t: TestRecord, i: number) => boolean) => ctx.tests.find(fn) ?? null;

const DEFS: (AchievementDef & { check: Check })[] = [
  {
    id: "first-words",
    name: "First Words",
    description: "Finish your first test.",
    xp: 10,
    check: (c) => c.tests[0] ?? null,
  },
  {
    id: "clean-sheet",
    name: "Clean Sheet",
    description: "100% accuracy on a test of at least 100 keystrokes.",
    xp: 40,
    check: (c) => firstWhere(c, (t) => t.accuracy === 100 && t.keystrokes >= 100 && isValidForStats(t)),
  },
  {
    id: "mach-100",
    name: "Mach 100",
    description: "Reach 100 WPM.",
    xp: 100,
    check: (c) => firstWhere(c, (t) => t.wpm >= 100 && isValidForStats(t) && t.mode !== "zen"),
  },
  {
    id: "mach-150",
    name: "Sound Barrier",
    description: "Reach 150 WPM.",
    xp: 200,
    check: (c) => firstWhere(c, (t) => t.wpm >= 150 && isValidForStats(t) && t.mode !== "zen"),
  },
  {
    id: "no-backspace",
    name: "Backspace? Never Heard of It",
    description: "Finish a 30-second-or-longer test without touching backspace.",
    xp: 40,
    check: (c) => firstWhere(c, (t) => t.backspaces === 0 && t.durationMs >= 30000 && t.keystrokes >= 60),
  },
  {
    id: "locked-in",
    name: "Locked In",
    description: "Complete 10 tests with 98%+ accuracy.",
    xp: 80,
    check: (c) => {
      let n = 0;
      return firstWhere(c, (t) => isValidForStats(t) && t.accuracy >= 98 && ++n >= 10);
    },
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Complete a test after midnight.",
    xp: 20,
    check: (c) => firstWhere(c, (t) => new Date(t.createdAt).getHours() < 4),
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Complete a test before 7 a.m.",
    xp: 20,
    check: (c) => firstWhere(c, (t) => {
      const h = new Date(t.createdAt).getHours();
      return h >= 5 && h < 7;
    }),
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "Type for 30 minutes in a single day.",
    xp: 80,
    check: (c) => {
      const perDay = new Map<string, number>();
      return firstWhere(c, (t) => {
        const k = dayKey(t.createdAt);
        const v = (perDay.get(k) ?? 0) + t.durationMs;
        perDay.set(k, v);
        return v >= 30 * 60000;
      });
    },
  },
  {
    id: "metronome",
    name: "Metronome",
    description: "90%+ consistency on a test of 30 seconds or more.",
    xp: 60,
    check: (c) => firstWhere(c, (t) => t.consistency >= 90 && t.durationMs >= 30000),
  },
  {
    id: "redemption-arc",
    name: "Redemption Arc",
    description: "Beat a personal best after 10 or more attempts that didn't.",
    xp: 80,
    check: (c) => {
      const best = new Map<string, number>();
      const misses = new Map<string, number>();
      return firstWhere(c, (t) => {
        if (!isValidForStats(t)) return false;
        let hit = false;
        for (const cat of pbCategories(t)) {
          const b = best.get(cat);
          if (b === undefined || t.wpm > b) {
            if (b !== undefined && (misses.get(cat) ?? 0) >= 10) hit = true;
            best.set(cat, t.wpm);
            misses.set(cat, 0);
          } else misses.set(cat, (misses.get(cat) ?? 0) + 1);
        }
        return hit;
      });
    },
  },
  {
    id: "polyglot-coder",
    name: "Polyglot",
    description: "Finish code tests in 5 different languages.",
    xp: 60,
    check: (c) => {
      const langs = new Set<string>();
      return firstWhere(c, (t) => {
        if (t.mode !== "code" || !t.sourceId) return false;
        langs.add(t.sourceId.split("-")[0]);
        return langs.size >= 5;
      });
    },
  },
  {
    id: "bookworm",
    name: "Bookworm",
    description: "Type 25 quotes.",
    xp: 50,
    check: (c) => {
      let n = 0;
      return firstWhere(c, (t) => t.mode === "quote" && ++n >= 25);
    },
  },
  {
    id: "century",
    name: "Century",
    description: "Complete 100 tests.",
    xp: 100,
    check: (c) => c.tests[99] ?? null,
  },
  {
    id: "week-streak",
    name: "Seven Days of Clack",
    description: "Type on 7 days in a row.",
    xp: 70,
    check: (c) => {
      const days = new Set<string>();
      return firstWhere(c, (t) => {
        days.add(dayKey(t.createdAt));
        for (let i = 0; i < 7; i++) if (!days.has(dayKey(t.createdAt - i * 86400000))) return false;
        return true;
      });
    },
  },
  // ── secrets ──────────────────────────────────────────────────────────────
  {
    id: "keyboard-smash",
    name: "asdfghjkl",
    description: "Finish a test with under 50% accuracy. We've all been there.",
    secret: true,
    hint: "something went very wrong",
    xp: 5,
    check: (c) => firstWhere(c, (t) => t.accuracy < 50 && t.keystrokes >= 20 && t.mode !== "zen"),
  },
  {
    id: "palindrome",
    name: "Palindrome",
    description: "Finish with a palindromic WPM of 100 or more, like 101 or 121.",
    secret: true,
    hint: "the same forwards and backwards",
    xp: 30,
    check: (c) => firstWhere(c, (t) => {
      const s = String(Math.round(t.wpm));
      return t.wpm >= 100 && s === [...s].reverse().join("") && isValidForStats(t);
    }),
  },
  {
    id: "caffeinated",
    name: "Caffeinated",
    description: "Finish 25 tests in a single day.",
    secret: true,
    hint: "one more. just one more.",
    xp: 40,
    check: (c) => {
      const per = new Map<string, number>();
      return firstWhere(c, (t) => {
        const k = dayKey(t.createdAt);
        const v = (per.get(k) ?? 0) + 1;
        per.set(k, v);
        return v >= 25;
      });
    },
  },
  {
    id: "over-9000",
    name: "It's Over 9000",
    description: "Type more than 9,000 characters in total.",
    secret: true,
    hint: "a very specific scouter reading",
    xp: 30,
    check: (c) => {
      let n = 0;
      return firstWhere(c, (t) => (n += t.correct + t.incorrect + t.extra) > 9000);
    },
  },
  {
    id: "zen-master",
    name: "Zen Master",
    description: "Write 300 words in zen mode in one go.",
    secret: true,
    hint: "no timer, no text, no problem",
    xp: 40,
    check: (c) => firstWhere(c, (t) => t.mode === "zen" && t.wordsTyped >= 300),
  },
  {
    id: "konami",
    name: "Up Up Down Down",
    description: "Find the old code.",
    secret: true,
    hint: "30 lives",
    xp: 20,
    check: (c) => (c.flags.konami ? true : null),
  },
  {
    id: "nebula",
    name: "Into the Nebula",
    description: "Unlock the hidden theme.",
    secret: true,
    hint: "a phrase, typed anywhere",
    xp: 30,
    check: (c) => (c.flags.nebula ? true : null),
  },
  {
    id: "logo-poker",
    name: "Stop Poking Me",
    description: "Annoy the logo.",
    secret: true,
    hint: "it's not a button",
    xp: 10,
    check: (c) => (c.flags.logo ? true : null),
  },
];

export const ACHIEVEMENTS: AchievementDef[] = DEFS.map(({ check: _check, ...d }) => {
  void _check;
  return d;
});

export interface Unlocked {
  id: string;
  at: number;
  testId: string | null;
}

export function evaluateAchievements(tests: TestRecord[], flags: Record<string, boolean>): Record<string, Unlocked> {
  const chronological = [...tests].sort((a, b) => a.createdAt - b.createdAt);
  const ctx = { tests: chronological, flags };
  const out: Record<string, Unlocked> = {};
  for (const d of DEFS) {
    const r = d.check(ctx);
    if (!r) continue;
    out[d.id] = r === true ? { id: d.id, at: 0, testId: null } : { id: d.id, at: r.createdAt, testId: r.id };
  }
  return out;
}

export function achievementXp(unlocked: Record<string, Unlocked>): number {
  return ACHIEVEMENTS.filter((a) => unlocked[a.id]).reduce((s, a) => s + a.xp, 0);
}
