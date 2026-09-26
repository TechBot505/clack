import type { TestRecord } from "./records";
import { dayKey, isValidForStats } from "./records";
import { categoryLabel, pbCategories } from "@/engine/config";

/**
 * Personal goals. Progress is framed positively: there are no failure states,
 * no broken-streak warnings, only how far along you are.
 */

export type GoalKind = "wpm" | "accuracy" | "minutes_per_day" | "tests_per_day" | "category_wpm";

export interface Goal {
  id: string;
  kind: GoalKind;
  target: number;
  category?: string;
  createdAt: number;
}

export interface GoalProgress {
  goal: Goal;
  title: string;
  current: number;
  pct: number;
  done: boolean;
  note: string;
}

export const GOAL_TEMPLATES: { kind: GoalKind; label: string; defaultTarget: number; category?: string; unit: string }[] = [
  { kind: "wpm", label: "Reach a speed", defaultTarget: 100, unit: "wpm" },
  { kind: "accuracy", label: "Keep accuracy at", defaultTarget: 98, unit: "%" },
  { kind: "minutes_per_day", label: "Practice daily", defaultTarget: 10, unit: "min/day" },
  { kind: "tests_per_day", label: "Tests per day", defaultTarget: 5, unit: "tests/day" },
  { kind: "category_wpm", label: "Punctuation speed", defaultTarget: 70, unit: "wpm", category: "punctuation" },
  { kind: "category_wpm", label: "Code speed", defaultTarget: 90, unit: "wpm", category: "code" },
];

export function goalProgress(goal: Goal, tests: TestRecord[], now = Date.now()): GoalProgress {
  const valid = tests.filter(isValidForStats);
  const today = dayKey(now);
  const todays = tests.filter((t) => dayKey(t.createdAt) === today);
  switch (goal.kind) {
    case "wpm": {
      const best = valid.reduce((m, t) => Math.max(m, t.wpm), 0);
      return mk(goal, `Reach ${goal.target} WPM`, best, best / goal.target, `best so far: ${best.toFixed(0)} wpm`);
    }
    case "accuracy": {
      const recent = [...valid].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
      const avg = recent.length ? recent.reduce((s, t) => s + t.accuracy, 0) / recent.length : 0;
      return mk(goal, `Keep ${goal.target}% accuracy`, avg, recent.length ? avg / goal.target : 0, recent.length ? `last 10 average: ${avg.toFixed(1)}%` : "finish a test to start");
    }
    case "minutes_per_day": {
      const min = todays.reduce((s, t) => s + t.durationMs, 0) / 60000;
      return mk(goal, `Practice ${goal.target} minutes a day`, min, min / goal.target, `${min.toFixed(1)} min today`);
    }
    case "tests_per_day": {
      return mk(goal, `${goal.target} tests a day`, todays.length, todays.length / goal.target, `${todays.length} today`);
    }
    case "category_wpm": {
      const cat = goal.category ?? "code";
      const best = valid.filter((t) => pbCategories(t).includes(cat)).reduce((m, t) => Math.max(m, t.wpm), 0);
      return mk(goal, `Reach ${goal.target} WPM in ${categoryLabel(cat).toLowerCase()}`, best, best / goal.target, best ? `best: ${best.toFixed(0)} wpm` : "no tests in this mode yet");
    }
  }
}

function mk(goal: Goal, title: string, current: number, ratio: number, note: string): GoalProgress {
  const pct = Math.max(0, Math.min(1, ratio));
  return { goal, title, current, pct, done: pct >= 1, note: pct >= 1 ? `${note} ✦ done` : note };
}
