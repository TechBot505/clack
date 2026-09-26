import type { Word } from "@/engine/types";
import type { InputEffect, TypingEngine } from "@/engine/engine";

/**
 * Imperative DOM renderer for the typing surface.
 *
 * React renders the container once; after that every keystroke touches only
 * the few letter spans that changed (class diffs, no innerHTML rebuilds), so
 * error animations don't retrigger and input latency stays flat at 150+ WPM.
 */

export type CaretStyle = "line" | "block" | "underscore" | "glow" | "pulse";

const LETTER = "tw-l";

export class TypingRenderer {
  private wordEls: HTMLElement[] = [];
  private activeIndex = -1;
  private scrollShift = 0;
  private linePx = 0;
  private caretStyle: CaretStyle = "line";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostEl: HTMLElement | null = null;
  private pendingSync: number[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly inner: HTMLElement,
    private readonly caret: HTMLElement,
  ) {}

  /** Build DOM for all words. */
  mount(words: Word[], typed: string[]) {
    this.inner.querySelectorAll(".tw-word, .tw-break, .tw-indent").forEach((n) => n.remove());
    this.wordEls = [];
    this.scrollShift = 0;
    this.inner.style.transform = "translate3d(0,0,0)";
    this.append(words, typed, 0);
    this.activeIndex = -1;
    this.measure();
  }

  /** Append DOM for words[from..]. */
  append(words: Word[], typed: string[], from: number) {
    const frag = document.createDocumentFragment();
    for (let i = from; i < words.length; i++) {
      const w = words[i];
      if (i > 0 && words[i - 1].sep === "\n") {
        const br = document.createElement("div");
        br.className = "tw-break";
        frag.appendChild(br);
      }
      if (w.indent > 0) {
        const ind = document.createElement("span");
        ind.className = "tw-indent";
        ind.textContent = " ".repeat(w.indent);
        ind.setAttribute("aria-hidden", "true");
        frag.appendChild(ind);
      }
      const el = document.createElement("div");
      el.className = "tw-word";
      el.dataset.i = String(i);
      for (let j = 0; j < w.text.length; j++) {
        const s = document.createElement("span");
        s.className = LETTER;
        s.textContent = w.text[j];
        if (w.tokens) s.dataset.t = w.tokens[j];
        el.appendChild(s);
      }
      this.wordEls[i] = el;
      frag.appendChild(el);
      if (typed[i]) this.pendingSync.push(i);
    }
    this.caret.before(frag);
    const pending = this.pendingSync.splice(0);
    for (const i of pending) this.syncWord(i, words[i], typed[i] ?? "", false);
  }

  /** Remove a word element (zen mode backspace). */
  removeWord(i: number) {
    const el = this.wordEls[i];
    if (!el) return;
    const prev = el.previousElementSibling;
    if (prev?.classList.contains("tw-break")) prev.remove();
    el.remove();
    this.wordEls.length = i;
  }

  /** Zen mode: add an empty word (optionally after a line break). */
  addZenWord(i: number, afterNewline: boolean) {
    const frag = document.createDocumentFragment();
    if (afterNewline) {
      const br = document.createElement("div");
      br.className = "tw-break";
      frag.appendChild(br);
    }
    const el = document.createElement("div");
    el.className = "tw-word";
    el.dataset.i = String(i);
    frag.appendChild(el);
    this.wordEls[i] = el;
    this.caret.before(frag);
  }

  /**
   * Bring word i's letter spans in line with its target + typed text.
   * `committed` marks words the caret has left (for underline states).
   */
  syncWord(i: number, word: Word, typed: string, committed: boolean) {
    const el = this.wordEls[i];
    if (!el) return;
    const target = word.text;
    const total = Math.max(target.length, typed.length);
    let spans = el.children;
    // add/remove extra-letter spans
    while (spans.length < total) {
      const s = document.createElement("span");
      s.className = LETTER;
      el.appendChild(s);
      spans = el.children;
    }
    while (spans.length > total) {
      el.lastElementChild?.remove();
      spans = el.children;
    }
    for (let j = 0; j < total; j++) {
      const s = spans[j] as HTMLElement;
      let cls = LETTER;
      let ch: string;
      if (j < target.length) {
        ch = target[j];
        if (j < typed.length) cls += typed[j] === target[j] ? " ok" : " no";
      } else {
        ch = typed[j];
        cls += " x";
      }
      if (s.textContent !== ch) s.textContent = ch;
      if (word.tokens && j < target.length) {
        if (s.dataset.t !== word.tokens[j]) s.dataset.t = word.tokens[j];
      } else if (s.dataset.t) {
        delete s.dataset.t;
      }
      if (s.className !== cls) s.className = cls;
    }
    const bad = committed && typed !== target;
    el.classList.toggle("bad", bad);
    el.classList.toggle("miss", committed && typed.length < target.length);
  }

  /** Tiny horizontal shake for blocked keys (stop-on-error). */
  flash(i: number) {
    const el = this.wordEls[i];
    if (!el || document.documentElement.dataset.motion === "reduced" || !el.animate) return;
    el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 180, easing: "ease-out" },
    );
  }

  setActive(i: number) {
    if (this.activeIndex === i) return;
    this.wordEls[this.activeIndex]?.classList.remove("active");
    this.activeIndex = i;
    this.wordEls[i]?.classList.add("active");
  }

  setCaretStyle(style: CaretStyle, smooth: boolean) {
    this.caretStyle = style;
    this.caret.dataset.style = style;
    this.caret.classList.toggle("smooth", smooth);
  }

  /** line the active line is kept on once the text starts scrolling (0-based) */
  anchorLine = 1;

  measure() {
    const cs = getComputedStyle(this.root);
    const lh = parseFloat(cs.lineHeight);
    const first = this.wordEls[0];
    this.linePx = Number.isFinite(lh) && lh > 0 ? lh : first ? first.offsetHeight : 48;
  }

  /** Position the caret after `pos` typed chars of word `wi`. Returns the caret's line index. */
  placeCaret(wi: number, pos: number, target: HTMLElement = this.caret): number {
    const el = this.wordEls[Math.min(wi, this.wordEls.length - 1)];
    if (!el) return 0;
    const spans = el.children;
    let x: number;
    let w = 0;
    if (pos < spans.length) {
      const s = spans[pos] as HTMLElement;
      x = el.offsetLeft + s.offsetLeft;
      w = s.offsetWidth;
    } else if (spans.length > 0) {
      const s = spans[spans.length - 1] as HTMLElement;
      x = el.offsetLeft + s.offsetLeft + s.offsetWidth;
      w = s.offsetWidth;
    } else {
      x = el.offsetLeft;
    }
    const top = el.offsetTop;
    const h = el.offsetHeight;
    const ch = target.offsetHeight || h * 0.6;
    const y = this.caretStyle === "underscore" && target === this.caret ? top + h * 0.82 : top + (h - ch) / 2;
    if (this.caretStyle === "block" && w && target === this.caret) target.style.width = `${w}px`;
    target.style.transform = `translate3d(${x - (this.caretStyle === "line" || this.caretStyle === "glow" || this.caretStyle === "pulse" ? 1 : 0)}px, ${y}px, 0)`;
    if (target === this.caret) this.scrollTo(top);
    return this.linePx ? Math.round(top / this.linePx) : 0;
  }

  private scrollTo(activeTop: number) {
    if (!this.linePx) this.measure();
    const line = Math.round(activeTop / this.linePx);
    const shift = Math.max(0, line - this.anchorLine) * this.linePx;
    if (shift !== this.scrollShift) {
      this.scrollShift = shift;
      this.inner.style.transform = `translate3d(0, ${-shift}px, 0)`;
    }
  }

  /** Caret blinks only while idle. */
  poke() {
    this.caret.classList.remove("idle");
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.caret.classList.add("idle"), 650);
  }

  setIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.caret.classList.add("idle");
  }

  setVelocity(v: number) {
    this.caret.style.setProperty("--vel", v.toFixed(2));
  }

  /** Secondary translucent caret (ghost / pace). */
  ghost(): HTMLElement {
    if (!this.ghostEl) {
      this.ghostEl = document.createElement("div");
      this.ghostEl.className = "caret ghost smooth";
      this.ghostEl.dataset.style = "line";
      this.ghostEl.setAttribute("aria-hidden", "true");
      this.inner.appendChild(this.ghostEl);
    }
    return this.ghostEl;
  }

  destroy() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.ghostEl?.remove();
    this.ghostEl = null;
  }
}

/**
 * Reflect one engine effect in the DOM (shared by live tests and replays).
 * Returns the caret's line index.
 */
export function applyEffect(e: TypingEngine, r: TypingRenderer, eff: InputEffect): number {
  if (eff.blocked) r.flash(e.wordIndex);
  if (eff.kind === "char" || (eff.kind === "back" && eff.word === eff.prevWord)) {
    r.syncWord(eff.word, e.words[eff.word], e.typed[eff.word], false);
  } else if (eff.kind === "sep" && !eff.blocked) {
    r.syncWord(eff.prevWord, e.words[eff.prevWord], e.typed[eff.prevWord], true);
    if (e.options.zen && !eff.finished) {
      r.addZenWord(eff.word, e.words[eff.prevWord].sep === "\n");
    } else if (eff.appended > 0) {
      r.append(e.words, e.typed, e.words.length - eff.appended);
    }
  } else if (eff.kind === "back") {
    if (e.options.zen) r.removeWord(eff.prevWord);
    else r.syncWord(eff.prevWord, e.words[eff.prevWord], e.typed[eff.prevWord], false);
    r.syncWord(eff.word, e.words[eff.word], e.typed[eff.word], false);
  }
  const wi = Math.min(e.wordIndex, e.words.length - 1);
  r.setActive(wi);
  return r.placeCaret(wi, e.wordIndex >= e.words.length ? e.typed[wi].length : e.currentTyped.length);
}
