import { describe, expect, it } from "vitest";
import { computePbs, computeStreaks, pbImprovements, rollingAverage, type TestRecord } from "./records";
import { evaluateAchievements } from "./achievements";
import { goalProgress } from "./goals";
import { levelFor, testXp, xpForLevel } from "./progression";
import { buildFingerprint } from "./fingerprint";
import { buildDna } from "./dna";
import { dailySpec, dailyStreaks } from "./daily";
import { decodeChallenge, encodeChallenge } from "./challenge";
import { findWeaknesses, buildExercise } from "./adaptive";
import { histogram, accuracyDistribution } from "./stats";

const DAY = 86400000;
const base = new Date("2026-06-15T12:00:00").getTime();

function rec(p: Partial<TestRecord>): TestRecord {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: base,
    mode: "time",
    mode2: 30,
    content: "common",
    language: "english",
    punctuation: false,
    numbers: false,
    seed: "s",
    sourceId: null,
    stopOnError: "off",
    confidence: "off",
    strict: false,
    category: "time:30",
    wpm: 80,
    raw: 85,
    accuracy: 97,
    consistency: 75,
    peakWpm: 95,
    durationMs: 30000,
    correct: 200,
    incorrect: 5,
    extra: 0,
    missed: 0,
    keystrokes: 220,
    wordsTyped: 40,
    backspaces: 6,
    samples: { t: [1, 2], wpm: [80, 80], raw: [85, 85], err: [0, 0] },
    keyStats: { e: [50, 2, 5000], t: [40, 1, 4400], h: [30, 3, 4200], q: [3, 1, 600] },
    isPb: false,
    ...p,
  };
}

describe("records", () => {
  it("computes PBs per category and ignores short or flagged runs", () => {
    const tests = [rec({ wpm: 80 }), rec({ wpm: 95, flagged: true }), rec({ wpm: 120, durationMs: 2000 }), rec({ wpm: 90, mode: "words", mode2: 25, category: "words:25" })];
    const pbs = computePbs(tests);
    expect(pbs["time:30"].wpm).toBe(80);
    expect(pbs["words:25"].wpm).toBe(90);
  });

  it("detects improvements", () => {
    const prior = [rec({ wpm: 80 })];
    expect(pbImprovements(prior, rec({ wpm: 85 }))).toEqual([{ category: "time:30", previous: 80, wpm: 85 }]);
    expect(pbImprovements(prior, rec({ wpm: 70 }))).toEqual([]);
    expect(pbImprovements([], rec({ wpm: 70 }))[0].previous).toBeNull();
  });

  it("computes streaks", () => {
    const now = base + 3 * DAY;
    const tests = [0, 1, 2, 3].map((d) => rec({ createdAt: base + d * DAY }));
    expect(computeStreaks(tests, now)).toEqual({ current: 4, longest: 4, today: true });
    expect(computeStreaks(tests, now + 2 * DAY).current).toBe(0);
    expect(computeStreaks(tests.slice(0, 2).concat(tests.slice(3)), now).longest).toBe(2);
  });

  it("rolling averages", () => {
    expect(rollingAverage([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
  });
});

describe("achievements, goals, progression", () => {
  it("unlocks achievements from history", () => {
    const tests = [rec({ accuracy: 100, keystrokes: 150 }), rec({ wpm: 101, createdAt: base + 1000 }), rec({ wpm: 121, createdAt: base + 2000 })];
    const u = evaluateAchievements(tests, { konami: true });
    expect(u["first-words"]).toBeTruthy();
    expect(u["clean-sheet"]).toBeTruthy();
    expect(u["mach-100"].at).toBe(base + 1000);
    expect(u["palindrome"]).toBeTruthy();
    expect(u["konami"]).toBeTruthy();
    expect(u["mach-150"]).toBeUndefined();
  });

  it("tracks goals without failure states", () => {
    const tests = [rec({ wpm: 50 })];
    const g = goalProgress({ id: "g", kind: "wpm", target: 100, createdAt: base }, tests, base);
    expect(g.pct).toBeCloseTo(0.5);
    expect(g.done).toBe(false);
    const t = goalProgress({ id: "g2", kind: "tests_per_day", target: 1, createdAt: base }, tests, base);
    expect(t.done).toBe(true);
  });

  it("levels grow monotonically", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(2));
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(xpForLevel(5)).level).toBe(5);
    expect(testXp(rec({}))).toBeGreaterThan(0);
    expect(testXp(rec({ flagged: true }))).toBe(0);
  });
});

describe("fingerprint & dna", () => {
  it("builds a finite fingerprint and a DNA shape without NaN", () => {
    const tests = Array.from({ length: 12 }, (_, i) => rec({ createdAt: base + i * DAY, wpm: 70 + i }));
    const fp = buildFingerprint(tests, []);
    expect(fp.axes).toHaveLength(8);
    fp.axes.forEach((a) => expect(Number.isFinite(a.value)).toBe(true));
    const dna = buildDna(fp, "seed");
    expect(dna.strandA).not.toContain("NaN");
    expect(dna.rungs.length).toBeGreaterThan(20);
    const again = buildDna(fp, "seed");
    expect(again.strandA).toBe(dna.strandA);
  });
});

describe("daily & challenges", () => {
  it("daily spec is deterministic and rotates", () => {
    expect(dailySpec("2026-09-26")).toEqual(dailySpec("2026-09-26"));
    const names = new Set(Array.from({ length: 7 }, (_, i) => dailySpec(`2026-09-${String(10 + i).padStart(2, "0")}`).name));
    expect(names.size).toBe(7);
  });

  it("daily streaks", () => {
    const log = { "2026-09-24": { testId: "a", wpm: 1, accuracy: 1, at: 0, attempts: 1 }, "2026-09-25": { testId: "b", wpm: 1, accuracy: 1, at: 0, attempts: 1 } };
    expect(dailyStreaks(log, "2026-09-26")).toEqual({ current: 2, longest: 2 });
    expect(dailyStreaks(log, "2026-09-28").current).toBe(0);
  });

  it("challenge links round-trip and reject garbage", () => {
    const s = encodeChallenge({ v: 1, title: "hi", config: { mode: "custom", customText: "hello  “world”" } });
    const c = decodeChallenge(s);
    expect(c?.config.customText).toBe('hello "world"');
    expect(decodeChallenge("not-a-challenge")).toBeNull();
  });
});

describe("adaptive & stats", () => {
  it("finds weaknesses and builds targeted text", () => {
    const keyStats = { e: [100, 1, 10000], q: [30, 10, 9000], a: [80, 2, 8000] } as Record<string, [number, number, number]>;
    const bigrams = { th: [40, 8, 6000], in: [60, 1, 5000] } as Record<string, [number, number, number]>;
    const weak = findWeaknesses(keyStats, bigrams);
    expect(weak[0].pattern === "th" || weak[0].pattern === "q").toBe(true);
    const ex = buildExercise(weak, 2, "x");
    expect(ex.text.split(" ").length).toBeGreaterThan(20);
    expect(ex.reason).toMatch(/weakest/);
  });

  it("histograms", () => {
    expect(histogram([55, 61, 69, 72], 10).map((b) => b.count)).toEqual([1, 2, 1]);
    const acc = accuracyDistribution([rec({ accuracy: 100 }), rec({ accuracy: 95.5 }), rec({ accuracy: 80 })]);
    expect(acc[11].count).toBe(1);
    expect(acc[0].count).toBe(1);
  });
});
