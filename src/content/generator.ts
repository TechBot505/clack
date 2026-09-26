import type { TextSpec, Word } from "@/engine/types";
import type { WordSupplier } from "@/engine/engine";
import { createRng, type Rng } from "@/engine/rng";
import { getLanguage } from "./languages";
import { getQuote } from "./quotes";
import { getSnippet } from "./code";
import { highlight } from "./highlight";

/** Deterministic word stream: same seed → same sequence, regardless of batch sizes. */
export class WordStream {
  private rng: Rng;
  private prev = "";
  private sentenceStart = true;
  private pool: string[];
  private readonly skew: number;

  constructor(
    private readonly spec: Extract<TextSpec, { kind: "words" }>,
  ) {
    this.rng = createRng(`${spec.seed}:${spec.language}:${spec.content}:${spec.punctuation ? 1 : 0}${spec.numbers ? 1 : 0}`);
    const pack = getLanguage(spec.language);
    this.pool = spec.content === "difficult" ? pack.difficult : pack.words;
    this.skew = spec.content === "difficult" ? 1 : 1.35;
  }

  private pickWord(): string {
    for (let attempt = 0; attempt < 6; attempt++) {
      const idx = Math.floor(Math.pow(this.rng.next(), this.skew) * this.pool.length);
      const w = this.pool[idx];
      if (w !== this.prev) return w;
    }
    return this.pool[this.rng.int(0, this.pool.length - 1)];
  }

  private number(): string {
    const r = this.rng.next();
    if (r < 0.25) return String(this.rng.int(1900, 2099));
    if (r < 0.4) return `${this.rng.int(1, 99)}.${this.rng.int(0, 9)}`;
    if (r < 0.5) return `${this.rng.int(1, 100)}%`;
    const digits = this.rng.int(1, 4);
    return String(this.rng.int(digits === 1 ? 0 : 10 ** (digits - 1), 10 ** digits - 1));
  }

  next(): string {
    const { punctuation, numbers } = this.spec;
    let w = numbers && this.rng.chance(0.14) ? this.number() : this.pickWord();
    if (punctuation) {
      if (this.sentenceStart && /^[a-z]/.test(w)) w = w[0].toUpperCase() + w.slice(1);
      this.sentenceStart = false;
      const r = this.rng.next();
      if (r < 0.1) {
        w += ".";
        this.sentenceStart = true;
      } else if (r < 0.13) {
        w += "?";
        this.sentenceStart = true;
      } else if (r < 0.15) {
        w += "!";
        this.sentenceStart = true;
      } else if (r < 0.24) {
        w += ",";
      } else if (r < 0.26) {
        w += ";";
      } else if (r < 0.28) {
        w += ":";
      } else if (r < 0.31) {
        w = `"${w}"`;
      } else if (r < 0.33) {
        w = `(${w})`;
      } else if (r < 0.35 && /^[a-z]+$/.test(w)) {
        w += "'s";
      } else if (r < 0.37) {
        w = `${w}-${this.pickWord()}`;
      }
    }
    this.prev = w;
    return w;
  }

  take(n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(this.next());
    return out;
  }
}

export interface BuiltText {
  words: Word[];
  /** endless modes supply more words on demand */
  supply?: WordSupplier;
  code?: boolean;
  zen?: boolean;
}

const toWords = (list: string[], finite: boolean): Word[] =>
  list.map((text, i) => ({ text, sep: finite && i === list.length - 1 ? "" : " ", indent: 0 }));

/** Collapse whitespace and strip characters that cannot be typed on a keyboard. */
export function sanitizeText(input: string, maxLength = 5000): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    // drop control chars and anything outside printable ranges we support
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Split code into words with newline separators, indentation and token classes. */
export function codeToWords(code: string, language: string): Word[] {
  const tokens = highlight(code, language);
  const words: Word[] = [];
  const lines = code.split("\n");
  let offset = 0;
  lines.forEach((line, li) => {
    const indent = line.length - line.trimStart().length;
    let col = indent;
    const body = line.slice(indent);
    if (body.length === 0) {
      offset += line.length + 1;
      return;
    }
    const parts = body.split(" ");
    parts.forEach((part, pi) => {
      if (part.length === 0) {
        col += 1;
        return;
      }
      const start = offset + col;
      words.push({
        text: part,
        sep: pi === parts.length - 1 ? "\n" : " ",
        indent: pi === 0 ? indent : 0,
        tokens: tokens.slice(start, start + part.length),
      });
      col += part.length + 1;
    });
    offset += line.length + 1;
    if (li === lines.length - 1 && words.length) words[words.length - 1].sep = "";
  });
  if (words.length) words[words.length - 1].sep = "";
  return words;
}

export function buildText(spec: TextSpec): BuiltText {
  switch (spec.kind) {
    case "words": {
      const stream = new WordStream(spec);
      if (spec.count && spec.count > 0) {
        return { words: toWords(stream.take(spec.count), true) };
      }
      return {
        words: toWords(stream.take(100), false),
        supply: (n) => toWords(stream.take(n), false),
      };
    }
    case "quote": {
      const q = getQuote(spec.id);
      const text = q ? q.text : "quote not found";
      return { words: toWords(text.split(" "), true) };
    }
    case "code": {
      const s = getSnippet(spec.id);
      if (!s) return { words: toWords(["snippet", "not", "found"], true), code: true };
      return { words: codeToWords(s.code, s.language), code: true };
    }
    case "custom": {
      const clean = sanitizeText(spec.text);
      const list = clean.length ? clean.split(" ") : ["empty"];
      return { words: toWords(list, true) };
    }
    case "zen":
      return { words: [], zen: true };
  }
}
