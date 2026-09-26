import {
  KEY_BACKSPACE,
  KEY_ENTER,
  KEY_SPACE,
  KEY_WORD_BACKSPACE,
  type EngineOptions,
  type RunLog,
  type Word,
} from "./types";

/**
 * The typing engine: a small, framework-free state machine.
 *
 * - Input processing only. No DOM, no React, no timers.
 * - Every accepted key is appended to a compact event log (key + ms delta).
 * - Replaying the log through a fresh engine reproduces the run exactly, which
 *   is how final results, server validation, replays and ghosts are computed.
 */

export type EffectKind = "char" | "sep" | "back" | "none";

export interface InputEffect {
  kind: EffectKind;
  /** word index the key affected */
  word: number;
  /** word index before the key (differs when moving between words) */
  prevWord: number;
  /** keystroke correctness (char/sep only) */
  correct: boolean;
  /** the character that was expected (char only; undefined for extra chars) */
  expected?: string;
  /** ms since test start */
  t: number;
  /** ms since the previous accepted key */
  dt: number;
  /** number of words appended to the word list by this key */
  appended: number;
  finished: boolean;
  /** key blocked by stop-on-error (counted as a mistake, not inserted) */
  blocked?: boolean;
}

const NONE: InputEffect = {
  kind: "none",
  word: 0,
  prevWord: 0,
  correct: false,
  t: 0,
  dt: 0,
  appended: 0,
  finished: false,
};

export type WordSupplier = (count: number) => Word[];

export interface CharStats {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  /** chars counted toward net WPM (correct words + their separators) */
  wpmChars: number;
  /** all typed chars incl. separators (raw WPM) */
  rawChars: number;
  /** number of words fully and correctly typed */
  correctWords: number;
  wordsTyped: number;
}

export class TypingEngine {
  readonly words: Word[];
  readonly typed: string[];
  wordIndex = 0;
  started = false;
  finished = false;
  /** absolute clock (caller's timebase) of the first keystroke */
  startClock = 0;
  endMs = 0;

  correctKeys = 0;
  incorrectKeys = 0;
  backspaces = 0;

  /** event log */
  private keys: string[] = [];
  private deltas: number[] = [];
  private lastT = 0;

  /** words that were edited with backspace */
  readonly wordCorrected: boolean[] = [];

  private readonly opts: Required<EngineOptions>;
  private readonly supply?: WordSupplier;

  constructor(initial: Word[], options: EngineOptions, supply?: WordSupplier) {
    this.opts = {
      stopOnError: options.stopOnError,
      confidence: options.confidence,
      zen: options.zen ?? false,
      code: options.code ?? false,
      maxExtra: options.maxExtra ?? 12,
    };
    this.supply = supply;
    this.words = initial.map((w) => ({ ...w }));
    if (this.opts.zen && this.words.length === 0) {
      this.words.push({ text: "", sep: " ", indent: 0 });
    }
    this.typed = this.words.map(() => "");
  }

  get options(): Readonly<Required<EngineOptions>> {
    return this.opts;
  }

  get currentWord(): Word | undefined {
    return this.words[this.wordIndex];
  }

  get currentTyped(): string {
    return this.typed[this.wordIndex] ?? "";
  }

  /** ms elapsed at clock `now` */
  elapsed(now: number): number {
    if (!this.started) return 0;
    if (this.finished) return this.endMs;
    return Math.max(0, now - this.startClock);
  }

  getLog(): RunLog {
    return { keys: this.keys.join(""), deltas: this.deltas.slice(), endMs: this.endMs };
  }

  get keyCount(): number {
    return this.keys.length;
  }

  /**
   * Process one key at absolute time `now` (ms, any monotonic clock).
   * `key` is a printable character or one of the KEY_* codes.
   */
  input(key: string, now: number): InputEffect {
    if (this.finished) return NONE;
    if (!this.started) {
      // Separators and deletions cannot start a test.
      if (key === KEY_SPACE || key === KEY_ENTER || key === KEY_BACKSPACE || key === KEY_WORD_BACKSPACE) {
        if (!(this.opts.zen && key === KEY_ENTER)) return NONE;
      }
      this.started = true;
      this.startClock = now;
      this.lastT = 0;
    }
    const t = Math.max(this.lastT, Math.round(now - this.startClock));
    let eff: InputEffect;
    if (key === KEY_BACKSPACE || key === KEY_WORD_BACKSPACE) {
      eff = this.backspace(key === KEY_WORD_BACKSPACE, t);
    } else if (key === KEY_SPACE || key === KEY_ENTER) {
      eff = this.separator(key, t);
    } else {
      eff = this.char(key, t);
    }
    if (eff.kind !== "none") {
      this.keys.push(key);
      this.deltas.push(t - this.lastT);
      eff.dt = t - this.lastT;
      this.lastT = t;
      if (eff.finished) this.endMs = t;
    }
    return eff;
  }

  /** End the test externally (timer ran out, zen finish). `atMs` is ms since start. */
  finish(atMs: number): void {
    if (this.finished) return;
    this.finished = true;
    this.endMs = Math.max(this.lastT, Math.round(atMs));
  }

  private effect(partial: Partial<InputEffect> & { kind: EffectKind; t: number }): InputEffect {
    return {
      word: this.wordIndex,
      prevWord: this.wordIndex,
      correct: false,
      dt: 0,
      appended: 0,
      finished: false,
      ...partial,
    };
  }

  private char(c: string, t: number): InputEffect {
    const wi = this.wordIndex;
    const word = this.words[wi];
    if (!word) return NONE;
    const typed = this.typed[wi];
    if (this.opts.zen) {
      this.typed[wi] = typed + c;
      word.text = this.typed[wi];
      this.correctKeys++;
      return this.effect({ kind: "char", t, correct: true, expected: c });
    }
    const expected = word.text[typed.length];
    const correct = expected !== undefined && c === expected;
    if (!correct && this.opts.stopOnError === "letter") {
      this.incorrectKeys++;
      return this.effect({ kind: "char", t, correct: false, expected, blocked: true });
    }
    if (typed.length >= word.text.length + this.opts.maxExtra) return NONE;
    this.typed[wi] = typed + c;
    if (correct) this.correctKeys++;
    else this.incorrectKeys++;
    let finished = false;
    // Last word typed perfectly → the test is complete.
    if (wi === this.words.length - 1 && !this.supply && this.typed[wi] === word.text) {
      finished = true;
      this.finished = true;
    }
    return this.effect({ kind: "char", t, correct, expected, finished });
  }

  private separator(key: string, t: number): InputEffect {
    const wi = this.wordIndex;
    const word = this.words[wi];
    if (!word) return NONE;
    const typed = this.typed[wi];

    if (this.opts.zen) {
      if (typed.length === 0) return NONE;
      word.sep = key === KEY_ENTER ? "\n" : " ";
      word.text = typed;
      this.correctKeys++;
      this.words.push({ text: "", sep: " ", indent: 0 });
      this.typed.push("");
      this.wordIndex++;
      return this.effect({ kind: "sep", t, correct: true, prevWord: wi, word: this.wordIndex, appended: 1 });
    }

    if (typed.length === 0) return NONE;
    // Enter only means something in code mode.
    if (key === KEY_ENTER && !this.opts.code) return NONE;

    const wordCorrect = typed === word.text;
    const sepCorrect = word.sep === "" ? true : this.opts.code ? key === word.sep : true;
    const correct = wordCorrect && sepCorrect;

    if (this.opts.stopOnError === "word" && !wordCorrect) {
      this.incorrectKeys++;
      return this.effect({ kind: "sep", t, correct: false, blocked: true });
    }
    if (this.opts.stopOnError === "letter" && !sepCorrect) {
      this.incorrectKeys++;
      return this.effect({ kind: "sep", t, correct: false, blocked: true });
    }

    if (correct) this.correctKeys++;
    else this.incorrectKeys++;

    const isLast = wi === this.words.length - 1;
    if (isLast && !this.supply) {
      // Space on the final word ends the test (remaining chars become "missed").
      this.wordIndex = this.words.length;
      this.finished = true;
      return this.effect({ kind: "sep", t, correct, prevWord: wi, word: wi, finished: true });
    }

    this.wordIndex++;
    let appended = 0;
    if (this.supply && this.words.length - this.wordIndex < 40) {
      const more = this.supply(60);
      for (const w of more) {
        this.words.push({ ...w });
        this.typed.push("");
      }
      appended = more.length;
    }
    return this.effect({ kind: "sep", t, correct, prevWord: wi, word: this.wordIndex, appended });
  }

  private canReturnTo(i: number): boolean {
    if (i < 0) return false;
    if (this.opts.confidence !== "off") return false;
    if (this.opts.zen) return true;
    return this.typed[i] !== this.words[i].text;
  }

  private backspace(wholeWord: boolean, t: number): InputEffect {
    if (this.opts.confidence === "max") return NONE;
    const wi = this.wordIndex;
    const typed = this.typed[wi] ?? "";
    if (typed.length > 0) {
      this.typed[wi] = wholeWord ? "" : typed.slice(0, -1);
      if (this.opts.zen) this.words[wi].text = this.typed[wi];
      this.backspaces++;
      this.wordCorrected[wi] = true;
      return this.effect({ kind: "back", t });
    }
    const prev = wi - 1;
    if (!this.canReturnTo(prev)) return NONE;
    this.wordIndex = prev;
    this.backspaces++;
    this.wordCorrected[prev] = true;
    if (this.opts.zen) {
      // drop the empty trailing word
      this.words.splice(wi, 1);
      this.typed.splice(wi, 1);
    }
    if (wholeWord) {
      this.typed[prev] = "";
      if (this.opts.zen) this.words[prev].text = "";
    }
    return this.effect({ kind: "back", t, prevWord: wi, word: prev });
  }

  /** Character classification + WPM char counts for the current state. */
  charStats(): CharStats {
    const s: CharStats = {
      correct: 0,
      incorrect: 0,
      extra: 0,
      missed: 0,
      wpmChars: 0,
      rawChars: 0,
      correctWords: 0,
      wordsTyped: 0,
    };
    const last = Math.min(this.wordIndex, this.words.length - 1);
    for (let i = 0; i <= last; i++) {
      const target = this.words[i].text;
      const typed = this.typed[i];
      const committed = i < this.wordIndex;
      if (!committed && typed.length === 0) continue;
      s.rawChars += typed.length;
      for (let j = 0; j < typed.length; j++) {
        if (j >= target.length) s.extra++;
        else if (typed[j] === target[j]) s.correct++;
        else s.incorrect++;
      }
      if (committed) {
        if (typed.length < target.length) s.missed += target.length - typed.length;
        const hasSep = this.words[i].sep !== "";
        if (hasSep) s.rawChars += 1;
        s.wordsTyped++;
        if (typed === target) {
          s.correctWords++;
          s.wpmChars += target.length + (hasSep ? 1 : 0);
        }
      } else if (typed.length > 0 && target.startsWith(typed)) {
        // partial word in progress (or the finishing word): correct prefix counts
        s.wpmChars += typed.length;
        if (typed === target) {
          s.correctWords++;
          s.wordsTyped++;
        }
      }
    }
    return s;
  }
}

export function wpmFromChars(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return chars / 5 / (ms / 60000);
}
