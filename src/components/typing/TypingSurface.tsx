"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MousePointerClick } from "lucide-react";
import type { TestConfig } from "@/engine/types";
import { KEY_BACKSPACE, KEY_ENTER, KEY_WORD_BACKSPACE } from "@/engine/types";
import type { InputEffect } from "@/engine/engine";
import { TypingRenderer } from "./renderer";
import { TestSession, type FinishedRun, type GhostTrack, type LiveStats } from "./session";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { playSound, primeAudio } from "@/lib/sound";

export interface TypingSurfaceHandle {
  focus: () => void;
  finish: () => void;
  session: () => TestSession | null;
}

export interface TypingSurfaceProps {
  config: TestConfig;
  /** bump to restart with fresh text */
  nonce: number;
  fixed?: { seed?: string; sourceId?: string; text?: string };
  /** start typing from anywhere on the page without clicking */
  captureGlobal?: boolean;
  /** fade the site chrome while typing */
  focusMode?: boolean;
  lines?: number;
  ghost?: GhostTrack | null;
  className?: string;
  onStart?: () => void;
  onTick?: (live: LiveStats) => void;
  onFinish: (run: FinishedRun) => void;
  onRestart?: () => void;
  onKey?: (effect: InputEffect, key: string) => void;
  ariaLabel?: string;
}

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "checkbox", "radio", "range", "submit"].includes(type);
  }
  return (el as HTMLElement).isContentEditable;
}

export const TypingSurface = forwardRef<TypingSurfaceHandle, TypingSurfaceProps>(function TypingSurface(
  { config, nonce, fixed, captureGlobal = true, focusMode = true, lines = 3, ghost, className = "", onStart, onTick, onFinish, onRestart, onKey, ariaLabel },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<TestSession | null>(null);
  const rendererRef = useRef<TypingRenderer | null>(null);
  const lastValue = useRef("");
  const tabArmed = useRef(0);
  const [focused, setFocused] = useState(true);

  // keep callbacks fresh without re-creating the session
  const cbs = useRef({ onStart, onTick, onFinish, onRestart, onKey });
  cbs.current = { onStart, onTick, onFinish, onRestart, onKey };

  const focus = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useImperativeHandle(ref, () => ({
    focus,
    finish: () => sessionRef.current?.finish(),
    session: () => sessionRef.current,
  }));

  // (re)create the session whenever the test changes
  const fixedKey = fixed ? `${fixed.seed}|${fixed.sourceId}|${fixed.text?.length}` : "";
  useEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    const caret = caretRef.current;
    if (!root || !inner || !caret) return;
    const renderer = new TypingRenderer(root, inner, caret);
    renderer.anchorLine = lines >= 5 ? 2 : 1;
    const s = useSettings.getState();
    renderer.setCaretStyle(s.caretStyle, s.smoothCaret);
    rendererRef.current = renderer;
    const session = new TestSession(
      config,
      renderer,
      {
        onStart: () => {
          if (focusMode) useUI.getState().setTyping(true);
          cbs.current.onStart?.();
        },
        onFinish: (run) => {
          useUI.getState().setTyping(false);
          cbs.current.onFinish(run);
        },
        onTick: (live) => cbs.current.onTick?.(live),
        onKey: (eff, key) => {
          const st = useSettings.getState();
          if (st.soundPack !== "off") {
            if (eff.kind === "back") playSound("back", st.soundPack, st.volume);
            else if (!eff.correct && st.errorSound) playSound("error", st.soundPack, st.volume);
            else playSound(eff.kind === "sep" ? "space" : "key", st.soundPack, st.volume);
          }
          if (focusMode) useUI.getState().setTyping(true);
          window.dispatchEvent(new CustomEvent("clack:key", { detail: { key, correct: eff.correct, kind: eff.kind } }));
          cbs.current.onKey?.(eff, key);
        },
      },
      fixed,
      { favorites: s.favoriteQuotes },
    );
    if (ghost) session.setGhost(ghost);
    sessionRef.current = session;
    lastValue.current = "";
    if (inputRef.current) inputRef.current.value = "";
    return () => {
      session.destroy();
      sessionRef.current = null;
      useUI.getState().setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, nonce, fixedKey, lines]);

  useEffect(() => {
    sessionRef.current?.setGhost(ghost ?? null);
  }, [ghost]);

  // live caret style changes
  useEffect(
    () =>
      useSettings.subscribe((s, prev) => {
        if (s.caretStyle !== prev.caretStyle || s.smoothCaret !== prev.smoothCaret) {
          rendererRef.current?.setCaretStyle(s.caretStyle, s.smoothCaret);
        }
      }),
    [],
  );

  // re-measure on resize / font changes
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = rendererRef.current;
      const s = sessionRef.current;
      if (!r || !s) return;
      r.measure();
      const e = s.engine;
      const wi = Math.min(e.wordIndex, e.words.length - 1);
      r.placeCaret(wi, e.typed[wi]?.length ?? 0);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const feed = useCallback((key: string, t: number) => {
    const s = sessionRef.current;
    if (!s || s.finished) return;
    s.key(key, t);
  }, []);

  const restart = useCallback(() => {
    cbs.current.onRestart?.();
  }, []);

  const handleTab = useCallback(() => {
    const mode = useSettings.getState().quickRestart;
    if (mode === "tab") restart();
    else if (mode === "tab-enter") tabArmed.current = performance.now();
  }, [restart]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // a dialog (palette, share…) owns the keyboard while it's open
      if (useUI.getState().paletteOpen || document.querySelector("[role=dialog]")) {
        if (e.key !== "Escape") e.preventDefault();
        return;
      }
      const t = e.timeStamp || performance.now();
      primeAudio();
      if (e.key === "Tab") {
        e.preventDefault();
        handleTab();
        return;
      }
      if (e.key === "Enter" && tabArmed.current && performance.now() - tabArmed.current < 1500) {
        e.preventDefault();
        tabArmed.current = 0;
        restart();
        return;
      }
      tabArmed.current = 0;
      if (e.key === "Escape") {
        if (useSettings.getState().quickRestart === "esc") {
          e.preventDefault();
          restart();
        }
        return; // bubbles to the page (controls / palette)
      }
      if (e.nativeEvent.isComposing || e.keyCode === 229 || e.key === "Unidentified" || e.key === "Process") return;
      if (e.metaKey || (e.ctrlKey && e.key !== "Backspace")) return; // shortcuts pass through
      if (e.key === "Backspace") {
        e.preventDefault();
        feed(e.ctrlKey || e.altKey ? KEY_WORD_BACKSPACE : KEY_BACKSPACE, t);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const s = sessionRef.current;
        if (e.shiftKey && s && s.config.mode === "zen") {
          s.finish();
          return;
        }
        feed(KEY_ENTER, t);
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        feed(e.key, t);
      }
    },
    [feed, handleTab, restart],
  );

  // Mobile / IME path: diff the hidden input's value.
  const onInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      if (useUI.getState().paletteOpen) {
        el.value = lastValue.current;
        return;
      }
      const v = el.value;
      const prev = lastValue.current;
      const t = e.timeStamp || performance.now();
      let p = 0;
      while (p < v.length && p < prev.length && v[p] === prev[p]) p++;
      for (let i = 0; i < prev.length - p; i++) feed(KEY_BACKSPACE, t);
      for (const ch of v.slice(p)) feed(ch === "\n" ? KEY_ENTER : ch, t);
      lastValue.current = v;
      const composing = (e.nativeEvent as InputEvent).isComposing;
      if (!composing && v.length > 48) {
        el.value = "";
        lastValue.current = "";
      }
    },
    [feed],
  );

  // Start typing from anywhere: forward the first printable key to the surface.
  useEffect(() => {
    if (!captureGlobal) return;
    const onKey = (e: KeyboardEvent) => {
      if (useUI.getState().paletteOpen) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const input = inputRef.current;
      if (!input || document.activeElement === input) return;
      if (isTextField(document.activeElement)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "Tab" && sessionRef.current?.started) {
        e.preventDefault();
        handleTab();
        return;
      }
      if (e.key.length !== 1 || e.key === " ") return;
      e.preventDefault();
      input.focus({ preventScroll: true });
      feed(e.key, e.timeStamp || performance.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureGlobal, feed, handleTab]);

  // autofocus on mount (desktop only; avoid popping the mobile keyboard)
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) focus();
  }, [focus, nonce]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={rootRef}
        className="tw"
        style={{ ["--lines" as string]: lines }}
        onMouseDown={(e) => {
          e.preventDefault();
          focus();
        }}
        role="application"
        aria-label={ariaLabel ?? "Typing test. Start typing to begin."}
      >
        <div ref={innerRef} className="tw-inner">
          <div ref={caretRef} className="caret smooth idle" data-style="line" aria-hidden />
        </div>
      </div>
      <input
        ref={inputRef}
        className="absolute inset-0 h-full w-full cursor-default opacity-0"
        style={{ fontSize: 16, caretColor: "transparent" }}
        aria-label="Typing input"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="next"
        onKeyDown={onKeyDown}
        onInput={onInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${focused ? "opacity-0" : "opacity-100"}`}
        aria-hidden={focused}
      >
        <div className="flex items-center gap-2 bg-bg/80 px-4 py-2 font-mono text-sm text-sub backdrop-blur-sm" style={{ borderRadius: "var(--radius)" }}>
          <MousePointerClick size={14} /> click or press any key to focus
        </div>
      </div>
    </div>
  );
});
