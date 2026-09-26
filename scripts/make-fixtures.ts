/**
 * Generates a realistic fake typing history (for local previews and e2e
 * tests). Every test is produced by actually driving the engine with a
 * simulated human, so replays, heatmaps and insights all work.
 *
 *   npx tsx scripts/make-fixtures.ts > fixtures.json
 */
import { TypingEngine } from "../src/engine/engine";
import { buildText } from "../src/content/generator";
import { textSpecFor, engineOptionsFor, sourceIdOf } from "../src/engine/config";
import { recordFromRun, type RunInput } from "../src/engine/record";
import { DEFAULT_CONFIG, KEY_BACKSPACE, type TestConfig } from "../src/engine/types";
import { createRng } from "../src/engine/rng";
import { pbImprovements, type TestRecord } from "../src/lib/records";

const rng = createRng(process.argv[2] ?? "fixtures");
const N = Number(process.argv[3] ?? 140);
const DAYS = 75;
const now = Date.now();

const SLOW = new Set(["q", "z", "x", "p", "b", "y", "'", '"', "(", ")", ";", ":"]);
const configs: Partial<TestConfig>[] = [
  { mode: "time", duration: 30 },
  { mode: "time", duration: 30 },
  { mode: "time", duration: 15 },
  { mode: "time", duration: 60 },
  { mode: "words", wordCount: 25 },
  { mode: "words", wordCount: 50 },
  { mode: "time", duration: 30, punctuation: true },
  { mode: "quote" },
  { mode: "code" },
  { mode: "words", wordCount: 10 },
];

function gauss() {
  return Math.sqrt(-2 * Math.log(rng.next() || 1e-9)) * Math.cos(2 * Math.PI * rng.next());
}

const tests: TestRecord[] = [];
const logs: Record<string, unknown> = {};

for (let n = 0; n < N; n++) {
  const progress = n / N;
  const skill = 68 + progress * 30 + gauss() * 4; // wpm drifts up over time
  const cfg: TestConfig = { ...DEFAULT_CONFIG, ...rng.pick(configs) };
  const seed = `fx${n}`;
  const spec = textSpecFor(cfg, seed);
  const built = buildText(spec);
  const engine = new TypingEngine(built.words, { ...engineOptionsFor(cfg), zen: built.zen, code: built.code }, built.supply);
  const limit = cfg.mode === "time" ? cfg.duration * 1000 : Infinity;
  let t = 1000;
  const baseMs = 12000 / skill;
  outer: for (let guard = 0; guard < 5000 && !engine.finished; guard++) {
    const w = engine.words[engine.wordIndex];
    if (!w) break;
    for (let j = engine.currentTyped.length; j < w.text.length; j++) {
      const ch = w.text[j];
      let dt = baseMs * Math.exp(gauss() * 0.28) * (SLOW.has(ch.toLowerCase()) ? 1.6 : 1) * (/[A-Z]/.test(ch) ? 1.4 : 1);
      if (rng.chance(0.012)) dt += 700 + rng.next() * 900; // a pause
      t += dt;
      if (t - 1000 >= limit) break outer;
      if (rng.chance(0.035 - progress * 0.012)) {
        engine.input(String.fromCharCode(97 + rng.int(0, 25)), t);
        t += baseMs * 1.8;
        if (rng.chance(0.85)) {
          engine.input(KEY_BACKSPACE, t);
          t += baseMs * 1.2;
        }
      }
      engine.input(ch, t);
      if (engine.finished) break outer;
    }
    if (w.sep) {
      t += baseMs * Math.exp(gauss() * 0.25) * 1.1;
      if (t - 1000 >= limit) break;
      engine.input(w.sep === "\n" ? "\n" : " ", t);
    }
  }
  if (!engine.finished) engine.finish(Math.min(limit, t - 1000));
  const created = now - (DAYS - (progress * DAYS + rng.next() * 0.8)) * 86400000;
  const input: RunInput = {
    id: `fixture-${n}`,
    createdAt: Math.round(Math.min(created, now - 60000)),
    mode: cfg.mode,
    mode2: cfg.mode === "time" ? cfg.duration : cfg.mode === "words" ? cfg.wordCount : 0,
    content: cfg.content,
    language: cfg.language,
    punctuation: cfg.punctuation,
    numbers: cfg.numbers,
    seed: spec.kind === "words" ? seed : null,
    sourceId: sourceIdOf(spec) ?? null,
    customText: null,
    stopOnError: cfg.stopOnError,
    confidence: cfg.confidence,
    strict: cfg.strict,
  };
  const log = engine.getLog();
  const { record } = recordFromRun(input, log);
  record.isPb = pbImprovements(tests, record).length > 0;
  tests.push(record);
  logs[record.id] = log;
}

tests.sort((a, b) => b.createdAt - a.createdAt);
const keep = new Set(tests.slice(0, 100).map((t) => t.id));
for (const k of Object.keys(logs)) if (!keep.has(k)) delete logs[k];
process.stdout.write(JSON.stringify({ tests, logs }));
