import { TypingEngine, wpmFromChars, type InputEffect } from "@/engine/engine";
import { buildText, type BuiltText } from "@/content/generator";
import { engineOptionsFor, sourceIdOf, textSpecFor } from "@/engine/config";
import { newSeed } from "@/engine/rng";
import { recordFromRun, type RunInput } from "@/engine/record";
import type { RunResult } from "@/engine/analyze";
import type { RunLog, TestConfig, TextSpec } from "@/engine/types";
import type { TestRecord } from "@/lib/records";
import { applyEffect, type TypingRenderer } from "./renderer";

/**
 * One typing test from first key to results. Owns the engine, drives the
 * renderer, runs the clock. React never re-renders per keystroke: live stats
 * are pushed through onTick at ~10 Hz and written straight to the DOM.
 */

export interface LiveStats {
  wpm: number;
  raw: number;
  acc: number;
  elapsedMs: number;
  /** time mode only */
  remainingMs: number | null;
  /** 0..1 */
  progress: number;
  wordIndex: number;
  wordTotal: number | null;
  errors: number;
}

export interface FinishedRun {
  input: RunInput;
  log: RunLog;
  record: TestRecord;
  result: RunResult;
}

export interface SessionCallbacks {
  onStart?: () => void;
  onFinish: (run: FinishedRun) => void;
  onTick?: (live: LiveStats) => void;
  onKey?: (effect: InputEffect, key: string) => void;
  onLine?: (line: number) => void;
}

export interface GhostTrack {
  /** cumulative correct-char counts, one per event */
  times: number[];
  chars: number[];
}

export class TestSession {
  readonly seed: string;
  readonly spec: TextSpec;
  readonly built: BuiltText;
  readonly engine: TypingEngine;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private done = false;
  private recent: number[] = [];
  private lastLine = 0;
  private ghost: GhostTrack | null = null;
  private ghostIdx = 0;

  constructor(
    readonly config: TestConfig,
    private readonly renderer: TypingRenderer,
    private readonly cb: SessionCallbacks,
    fixed?: { seed?: string; sourceId?: string; text?: string },
  ) {
    this.seed = fixed?.seed ?? newSeed();
    this.spec = textSpecFor(config, this.seed, fixed);
    this.built = buildText(this.spec);
    this.engine = new TypingEngine(this.built.words, { ...engineOptionsFor(config), zen: this.built.zen, code: this.built.code }, this.built.supply);
    renderer.mount(this.engine.words, this.engine.typed);
    renderer.setActive(0);
    renderer.placeCaret(0, 0);
    renderer.setIdle();
  }

  get started() {
    return this.engine.started;
  }
  get finished() {
    return this.done;
  }

  get timeLimitMs(): number | null {
    if (this.config.mode === "time") return this.config.duration * 1000;
    if (this.config.mode === "custom" && this.config.customTimer > 0) return this.config.customTimer * 1000;
    return null;
  }

  /** Enable a pace ghost: the PB's cumulative char progress over time. */
  setGhost(track: GhostTrack | null) {
    this.ghost = track;
    this.ghostIdx = 0;
  }

  key(key: string, now: number) {
    if (this.done) return;
    const limit = this.timeLimitMs;
    if (limit !== null && this.engine.started && now - this.engine.startClock >= limit) {
      this.finish();
      return;
    }
    const wasStarted = this.engine.started;
    const e = this.engine;
    const eff = e.input(key, now);
    if (eff.kind === "none") return;
    if (!wasStarted) this.onStart();
    this.render(eff);
    this.recent.push(now);
    this.cb.onKey?.(eff, key);
    if (eff.finished) this.finish();
  }

  private render(eff: InputEffect) {
    const line = applyEffect(this.engine, this.renderer, eff);
    if (line !== this.lastLine) {
      this.lastLine = line;
      this.cb.onLine?.(line);
    }
    this.renderer.poke();
  }

  private onStart() {
    this.cb.onStart?.();
    const limit = this.timeLimitMs;
    if (limit !== null) {
      this.timer = setTimeout(() => this.finish(), limit);
    }
    this.ticker = setInterval(() => this.tick(), 100);
    this.tick();
  }

  live(now = performance.now()): LiveStats {
    const e = this.engine;
    const elapsed = e.elapsed(now);
    const stats = e.charStats();
    const total = e.correctKeys + e.incorrectKeys;
    const limit = this.timeLimitMs;
    const wordTotal = this.built.supply || this.built.zen ? null : e.words.length;
    return {
      wpm: elapsed > 500 ? wpmFromChars(stats.wpmChars, elapsed) : 0,
      raw: elapsed > 500 ? wpmFromChars(stats.rawChars, elapsed) : 0,
      acc: total ? (e.correctKeys / total) * 100 : 100,
      elapsedMs: elapsed,
      remainingMs: limit !== null ? Math.max(0, limit - elapsed) : null,
      progress: limit !== null ? Math.min(1, elapsed / limit) : wordTotal ? Math.min(1, e.wordIndex / wordTotal) : 0,
      wordIndex: e.wordIndex,
      wordTotal,
      errors: e.incorrectKeys,
    };
  }

  private tick() {
    if (this.done) return;
    const now = performance.now();
    // velocity: keystrokes over the last second → 0..1
    const cutoff = now - 1000;
    while (this.recent.length && this.recent[0] < cutoff) this.recent.shift();
    const instWpm = this.recent.length * 12;
    this.renderer.setVelocity(Math.max(0, Math.min(1, (instWpm - 60) / 120)));
    const live = this.live(now);
    this.cb.onTick?.(live);
    this.updateGhost(live.elapsedMs);
    const limit = this.timeLimitMs;
    if (limit !== null && live.elapsedMs >= limit) this.finish();
  }

  private updateGhost(elapsed: number) {
    const g = this.ghost;
    if (!g || !g.times.length) return;
    while (this.ghostIdx < g.times.length - 1 && g.times[this.ghostIdx + 1] <= elapsed) this.ghostIdx++;
    const chars = g.times[this.ghostIdx] <= elapsed ? g.chars[this.ghostIdx] : 0;
    // walk words to find the position of `chars` characters (incl. separators)
    const words = this.engine.words;
    let left = chars;
    let wi = 0;
    while (wi < words.length - 1 && left > words[wi].text.length) {
      left -= words[wi].text.length + 1;
      wi++;
    }
    this.renderer.placeCaret(wi, Math.max(0, Math.min(left, words[wi]?.text.length ?? 0)), this.renderer.ghost());
  }

  /** Where the ghost is relative to us: positive = we're ahead (chars). */
  ghostDelta(): { chars: number; seconds: number } | null {
    const g = this.ghost;
    if (!g || !g.times.length || !this.engine.started) return null;
    const elapsed = this.engine.elapsed(performance.now());
    const mine = this.engine.charStats().wpmChars;
    let i = 0;
    while (i < g.times.length - 1 && g.times[i + 1] <= elapsed) i++;
    const theirs = g.times[i] <= elapsed ? g.chars[i] : 0;
    // time at which ghost reached my char count
    let j = 0;
    while (j < g.chars.length && g.chars[j] < mine) j++;
    const ghostTimeAtMine = j < g.times.length ? g.times[j] : g.times[g.times.length - 1];
    return { chars: mine - theirs, seconds: (ghostTimeAtMine - elapsed) / 1000 };
  }

  finish() {
    if (this.done) return;
    if (!this.engine.started) return;
    this.done = true;
    this.clearTimers();
    const limit = this.timeLimitMs;
    const elapsed = this.engine.elapsed(performance.now());
    if (!this.engine.finished) this.engine.finish(limit !== null ? limit : elapsed);
    const log = this.engine.getLog();
    const c = this.config;
    const input: RunInput = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t${Date.now()}${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      mode: c.mode,
      mode2: c.mode === "time" ? c.duration : c.mode === "words" ? c.wordCount : c.mode === "custom" ? c.customTimer : 0,
      content: c.content,
      language: c.language,
      punctuation: c.mode === "time" || c.mode === "words" ? c.punctuation : false,
      numbers: c.mode === "time" || c.mode === "words" ? c.numbers : false,
      seed: this.spec.kind === "words" ? this.seed : null,
      sourceId: sourceIdOf(this.spec) ?? null,
      customText: this.spec.kind === "custom" ? this.spec.text : null,
      stopOnError: c.stopOnError,
      confidence: c.confidence,
      strict: c.strict,
    };
    const { record, result } = recordFromRun(input, log);
    this.renderer.setIdle();
    this.cb.onFinish({ input, log, record, result });
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.ticker) clearInterval(this.ticker);
    this.timer = null;
    this.ticker = null;
  }

  destroy() {
    this.done = true;
    this.clearTimers();
    this.renderer.destroy();
  }
}

/** Build a ghost track (cumulative net chars over time) from a replayed run. */
export function ghostFromResult(result: RunResult): GhostTrack {
  const times: number[] = [];
  const chars: number[] = [];
  let count = 0;
  for (const ev of result.events) {
    if ((ev.kind === "char" || ev.kind === "sep") && ev.correct && !ev.blocked) count++;
    else if (ev.kind === "back") count = Math.max(0, count - 1);
    times.push(ev.t);
    chars.push(count);
  }
  return { times, chars };
}
