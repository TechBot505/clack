import { describe, expect, it } from "vitest";
import { TypingEngine } from "./engine";
import { analyzeRun } from "./analyze";
import { buildText, codeToWords, sanitizeText, WordStream } from "@/content/generator";
import { KEY_BACKSPACE, KEY_ENTER, KEY_WORD_BACKSPACE, type EngineOptions, type Word } from "./types";
import { suspicionReasons } from "./validate";
import { highlight } from "@/content/highlight";
import { pbCategories, textSpecFor } from "./config";
import { DEFAULT_CONFIG } from "./types";

const OPTS: EngineOptions = { stopOnError: "off", confidence: "off" };
const words = (...list: string[]): Word[] =>
  list.map((text, i) => ({ text, sep: i === list.length - 1 ? "" : " ", indent: 0 }));

/** type `text` one key every `ms` starting at t=1000 (absolute clock) */
function typeAll(e: TypingEngine, text: string, ms = 100, start = 1000) {
  let t = start;
  for (const ch of text) {
    e.input(ch, t);
    t += ms;
  }
  return t;
}

describe("TypingEngine", () => {
  it("finishes a words test when the last word is typed correctly", () => {
    const e = new TypingEngine(words("hello", "world"), OPTS);
    typeAll(e, "hello world");
    expect(e.finished).toBe(true);
    const s = e.charStats();
    expect(s.correct).toBe(10);
    expect(s.incorrect).toBe(0);
    expect(s.wpmChars).toBe(11); // 10 letters + 1 space
    expect(e.correctKeys).toBe(11);
  });

  it("ignores leading separators and backspaces before start", () => {
    const e = new TypingEngine(words("a", "b"), OPTS);
    expect(e.input(" ", 0).kind).toBe("none");
    expect(e.input(KEY_BACKSPACE, 0).kind).toBe("none");
    expect(e.started).toBe(false);
    e.input("a", 5);
    expect(e.started).toBe(true);
  });

  it("classifies incorrect, extra and missed characters", () => {
    const e = new TypingEngine(words("cat", "dog", "fish"), OPTS);
    typeAll(e, "cxt dogs f ");
    expect(e.finished).toBe(true);
    const s = e.charStats();
    expect(s.incorrect).toBe(1); // x
    expect(s.extra).toBe(1); // s
    expect(s.missed).toBe(3); // ish
    expect(s.correctWords).toBe(0);
    expect(s.wpmChars).toBe(0);
  });

  it("allows returning to an incorrect previous word but not a correct one", () => {
    const e = new TypingEngine(words("one", "two", "three"), OPTS);
    typeAll(e, "one ");
    expect(e.input(KEY_BACKSPACE, 5000).kind).toBe("none");
    expect(e.wordIndex).toBe(1);
    typeAll(e, "twx ", 100, 6000);
    expect(e.wordIndex).toBe(2);
    expect(e.input(KEY_BACKSPACE, 7000).kind).toBe("back");
    expect(e.wordIndex).toBe(1);
    e.input(KEY_BACKSPACE, 7100);
    typeAll(e, "o three", 100, 7200);
    expect(e.finished).toBe(true);
    expect(e.charStats().correctWords).toBe(3);
  });

  it("confidence 'max' disables backspace entirely", () => {
    const e = new TypingEngine(words("ab"), { stopOnError: "off", confidence: "max" });
    e.input("x", 0);
    expect(e.input(KEY_BACKSPACE, 10).kind).toBe("none");
    expect(e.currentTyped).toBe("x");
  });

  it("word backspace clears the current word", () => {
    const e = new TypingEngine(words("alpha", "beta"), OPTS);
    typeAll(e, "alp");
    e.input(KEY_WORD_BACKSPACE, 5000);
    expect(e.currentTyped).toBe("");
  });

  it("stop on letter blocks wrong characters but counts them", () => {
    const e = new TypingEngine(words("hi"), { stopOnError: "letter", confidence: "off" });
    e.input("h", 0);
    const eff = e.input("x", 100);
    expect(eff.blocked).toBe(true);
    expect(e.currentTyped).toBe("h");
    e.input("i", 200);
    expect(e.finished).toBe(true);
    expect(e.incorrectKeys).toBe(1);
  });

  it("stop on word blocks committing an incorrect word", () => {
    const e = new TypingEngine(words("ab", "cd"), { stopOnError: "word", confidence: "off" });
    typeAll(e, "ax ");
    expect(e.wordIndex).toBe(0);
  });

  it("caps extra characters", () => {
    const e = new TypingEngine(words("a", "b"), { ...OPTS, maxExtra: 3 });
    typeAll(e, "aqqqqqq");
    expect(e.currentTyped).toBe("aqqq");
  });

  it("zen mode accepts everything and builds words", () => {
    const e = new TypingEngine([], { ...OPTS, zen: true });
    typeAll(e, "free text");
    e.input(KEY_ENTER, 9000);
    typeAll(e, "more", 100, 9100);
    expect(e.words.map((w) => w.text)).toEqual(["free", "text", "more"]);
    expect(e.words[1].sep).toBe("\n");
    e.finish(10000);
    expect(e.charStats().incorrect).toBe(0);
  });

  it("supplies more words in endless mode", () => {
    const built = buildText({ kind: "words", language: "english", content: "common", punctuation: false, numbers: false, seed: "s" });
    const e = new TypingEngine(built.words, OPTS, built.supply);
    const initial = e.words.length;
    let t = 0;
    for (let w = 0; w < 70; w++) {
      for (const ch of e.words[e.wordIndex].text) e.input(ch, (t += 50));
      e.input(" ", (t += 50));
    }
    expect(e.words.length).toBeGreaterThan(initial);
    expect(e.finished).toBe(false);
  });
});

describe("analyzeRun", () => {
  it("replays a log to the same results as the live engine", () => {
    const built = buildText({ kind: "words", language: "english", content: "common", punctuation: true, numbers: true, seed: "abc", count: 15 });
    const live = new TypingEngine(built.words, OPTS, built.supply);
    let t = 500;
    for (let i = 0; i < built.words.length; i++) {
      const w = built.words[i].text;
      for (let j = 0; j < w.length; j++) {
        // inject a typo + fix every few words
        if (i % 4 === 1 && j === 1) {
          live.input("#", (t += 90));
          live.input(KEY_BACKSPACE, (t += 120));
        }
        live.input(w[j], (t += 80 + ((i * 7 + j * 13) % 40)));
      }
      if (i < built.words.length - 1) live.input(" ", (t += 90));
    }
    expect(live.finished).toBe(true);
    const log = live.getLog();
    const result = analyzeRun(buildText({ kind: "words", language: "english", content: "common", punctuation: true, numbers: true, seed: "abc", count: 15 }), OPTS, log);
    const liveStats = live.charStats();
    expect(result.chars).toEqual(liveStats);
    expect(result.durationMs).toBe(log.endMs);
    expect(result.correctKeys).toBe(live.correctKeys);
    expect(result.backspaces).toBe(4);
    expect(result.accuracy).toBeLessThan(100);
    expect(result.wpm).toBeGreaterThan(0);
    expect(result.raw).toBeGreaterThanOrEqual(result.wpm);
    expect(result.samples.wpm.length).toBe(result.samples.raw.length);
    expect(result.samples.t[result.samples.t.length - 1]).toBeCloseTo(log.endMs / 1000, 2);
    expect(result.words.length).toBe(15);
  });

  it("computes 60 WPM for 5 chars/second of perfect typing", () => {
    // "aaaa " repeated: 5 keystrokes per word, 200ms apart → 5 keys/s = 60 WPM
    const list = Array.from({ length: 30 }, () => "aaaa");
    const built = { words: words(...list) };
    const e = new TypingEngine(built.words, OPTS);
    let t = 0;
    for (let i = 0; i < list.length; i++) {
      for (const ch of list[i]) {
        e.input(ch, t);
        t += 200;
      }
      if (i < list.length - 1) {
        e.input(" ", t);
        t += 200;
      }
    }
    const log = e.getLog();
    const r = analyzeRun(built, OPTS, log);
    // 30 words * 5 chars - 1 (no trailing space) = 149 chars over 29.6s
    expect(r.wpm).toBeCloseTo((149 / 5) / (log.endMs / 60000), 1);
    expect(r.wpm).toBeGreaterThan(59);
    expect(r.wpm).toBeLessThan(61);
    expect(r.accuracy).toBe(100);
    expect(r.consistency).toBeGreaterThan(90);
    expect(r.longestStreak).toBe(149);
  });

  it("respects the end time for timed runs", () => {
    const built = buildText({ kind: "words", language: "english", content: "common", punctuation: false, numbers: false, seed: "t" });
    const e = new TypingEngine(built.words, OPTS, built.supply);
    let t = 0;
    outer: for (let i = 0; ; i++) {
      for (const ch of e.words[i].text) {
        if (t >= 15000) break outer;
        e.input(ch, t);
        t += 100;
      }
      if (t >= 15000) break;
      e.input(" ", t);
      t += 100;
    }
    e.finish(15000);
    const log = e.getLog();
    expect(log.endMs).toBe(15000);
    const r = analyzeRun(buildText({ kind: "words", language: "english", content: "common", punctuation: false, numbers: false, seed: "t" }), OPTS, log);
    expect(r.durationMs).toBe(15000);
    expect(r.samples.t.length).toBe(15);
    expect(r.wpm).toBeGreaterThan(100);
    expect(r.wpm).toBeLessThan(125);
  });

  it("builds per-key stats", () => {
    const built = { words: words("ab", "ab") };
    const e = new TypingEngine(built.words, OPTS);
    typeAll(e, "ax ab", 100, 0);
    const r = analyzeRun(built, OPTS, e.getLog());
    expect(r.keyStats["a"][0]).toBe(2);
    expect(r.keyStats["b"][1]).toBe(1);
    expect(r.keyStats["b"][0]).toBe(1);
  });
});

describe("content", () => {
  it("word streams are deterministic regardless of batching", () => {
    const spec = { kind: "words" as const, language: "english", content: "common" as const, punctuation: true, numbers: true, seed: "x" };
    const a = new WordStream(spec).take(200);
    const s = new WordStream(spec);
    const b = [...s.take(13), ...s.take(87), ...s.take(100)];
    expect(a).toEqual(b);
    expect(new WordStream({ ...spec, seed: "y" }).take(50)).not.toEqual(a.slice(0, 50));
  });

  it("splits code into words with newline separators and indentation", () => {
    const w = codeToWords("if (a) {\n  b();\n}", "javascript");
    expect(w.map((x) => x.text)).toEqual(["if", "(a)", "{", "b();", "}"]);
    expect(w[2].sep).toBe("\n");
    expect(w[3].indent).toBe(2);
    expect(w[4].sep).toBe("");
    expect(w[0].tokens).toBe("kk");
  });

  it("highlights code with one class per char", () => {
    const code = 'const x = "hi"; // yo';
    const h = highlight(code, "javascript");
    expect(h.length).toBe(code.length);
    expect(h.slice(0, 5)).toBe("kkkkk");
    expect(h.slice(10, 14)).toBe("ssss");
    expect(h.endsWith("ccccc")).toBe(true);
  });

  it("sanitizes custom text", () => {
    expect(sanitizeText("  “Hello”\u0000 — world…\n\tnew  ")).toBe('"Hello" - world... new');
  });

  it("every code snippet is typeable", () => {
    for (const lang of ["any"]) {
      const spec = textSpecFor({ ...DEFAULT_CONFIG, mode: "code", codeLanguage: lang }, "seed");
      const built = buildText(spec);
      expect(built.words.length).toBeGreaterThan(3);
      for (const w of built.words) {
        expect(w.text).not.toMatch(/\s/);
        expect(w.tokens?.length).toBe(w.text.length);
      }
    }
  });

  it("maps tests to PB categories", () => {
    expect(pbCategories({ mode: "time", mode2: 60, content: "common", punctuation: false, numbers: false })).toEqual(["time:60"]);
    expect(pbCategories({ mode: "words", mode2: 25, content: "common", punctuation: true, numbers: false })).toEqual(["punctuation"]);
    expect(pbCategories({ mode: "quote", mode2: 0, content: "common", punctuation: false, numbers: false })).toEqual(["quote"]);
  });
});

describe("code typing", () => {
  it("requires enter at line ends and auto-skips indentation", () => {
    const built = buildText({ kind: "code", id: "css-grid" });
    expect(built.code).toBe(true);
    const e = new TypingEngine(built.words, { ...OPTS, code: true });
    let t = 0;
    for (let i = 0; i < built.words.length; i++) {
      for (const ch of built.words[i].text) e.input(ch, (t += 60));
      if (built.words[i].sep) e.input(built.words[i].sep, (t += 60));
    }
    expect(e.finished).toBe(true);
    expect(e.incorrectKeys).toBe(0);
    const r = analyzeRun(buildText({ kind: "code", id: "css-grid" }), { ...OPTS, code: true }, e.getLog());
    expect(r.accuracy).toBe(100);
  });

  it("counts a space where a newline was expected as a mistake", () => {
    const w = codeToWords("a\nb", "javascript");
    const e = new TypingEngine(w, { ...OPTS, code: true });
    e.input("a", 0);
    e.input(" ", 50);
    expect(e.incorrectKeys).toBe(1);
    expect(e.wordIndex).toBe(1);
  });
});

describe("anti-cheat", () => {
  it("flags robotic, too-fast input", () => {
    const list = Array.from({ length: 40 }, () => "word");
    const built = { words: words(...list) };
    const e = new TypingEngine(built.words, OPTS);
    let t = 0;
    for (let i = 0; i < list.length; i++) {
      for (const ch of list[i]) e.input(ch, (t += 4));
      if (i < list.length - 1) e.input(" ", (t += 4));
    }
    const log = e.getLog();
    const r = analyzeRun(built, OPTS, log);
    const reasons = suspicionReasons(log, r);
    expect(reasons).toContain("wpm_impossible");
    expect(reasons).toContain("too_fast");
  });

  it("does not flag a human-like run", () => {
    const list = Array.from({ length: 40 }, () => "word");
    const built = { words: words(...list) };
    const e = new TypingEngine(built.words, OPTS);
    let t = 0;
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      for (const ch of list[i]) e.input(ch, (t += 70 + ((k++ * 37) % 90)));
      if (i < list.length - 1) e.input(" ", (t += 90 + ((k++ * 53) % 70)));
    }
    const log = e.getLog();
    expect(suspicionReasons(log, analyzeRun(built, OPTS, log))).toEqual([]);
  });
});
