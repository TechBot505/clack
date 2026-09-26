"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { TypingEngine, wpmFromChars } from "@/engine/engine";
import { buildText } from "@/content/generator";
import { optionsFromInput, specFromInput, type RunInput } from "@/engine/record";
import type { RunLog } from "@/engine/types";
import { TypingRenderer, applyEffect } from "@/components/typing/renderer";
import { useSettings } from "@/stores/settings";
import { Segmented } from "@/components/ui/primitives";

const SPEEDS = [0.5, 1, 2, 4] as const;

/**
 * Telemetry-style replay: re-feeds the recorded keystrokes through a fresh
 * engine at their original timing (scaled), rendered by the same renderer
 * the live test uses. Seeking backwards rebuilds state instantly.
 */
export function Replay({ input, log, onTime }: { input: RunInput; log: RunLog; onTime?: (ms: number) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const wpmRef = useRef<HTMLSpanElement>(null);
  const accRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  const state = useRef<{ engine: TypingEngine; renderer: TypingRenderer; idx: number; times: number[]; head: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const speedRef = useRef(speed);
  const onTimeRef = useRef(onTime);
  useEffect(() => {
    speedRef.current = speed;
    onTimeRef.current = onTime;
  });

  const times = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < log.deltas.length; i++) out.push((out[i - 1] ?? 0) + log.deltas[i]);
    return out;
  }, [log.deltas]);

  const hud = useCallback((head: number) => {
    const s = state.current;
    if (!s) return;
    const e = s.engine;
    const el = Math.max(1, Math.min(head, log.endMs));
    const stats = e.charStats();
    const total = e.correctKeys + e.incorrectKeys;
    if (wpmRef.current) wpmRef.current.textContent = String(Math.round(head > 400 ? wpmFromChars(stats.wpmChars, el) : 0));
    if (accRef.current) accRef.current.textContent = total ? `${((e.correctKeys / total) * 100).toFixed(1)}%` : "100%";
    if (timeRef.current) timeRef.current.textContent = `${(Math.min(head, log.endMs) / 1000).toFixed(1)}s`;
    if (scrubRef.current) scrubRef.current.value = String(Math.round(Math.min(head, log.endMs)));
    onTimeRef.current?.(head);
  }, [log.endMs]);

  /** fresh engine + DOM, fast-forwarded to `to` ms */
  const rebuild = useCallback(
    (to: number) => {
      const root = rootRef.current;
      const inner = innerRef.current;
      const caret = caretRef.current;
      if (!root || !inner || !caret) return;
      state.current?.renderer.destroy();
      const built = buildText(specFromInput(input));
      const engine = new TypingEngine(built.words, { ...optionsFromInput(input), zen: built.zen, code: built.code }, built.supply);
      const renderer = new TypingRenderer(root, inner, caret);
      renderer.anchorLine = input.mode === "code" ? 2 : 1;
      const st = useSettings.getState();
      renderer.setCaretStyle(st.caretStyle, false);
      let idx = 0;
      while (to > 0 && idx < log.keys.length && times[idx] <= to) {
        engine.input(log.keys[idx], times[idx]);
        idx++;
      }
      renderer.mount(engine.words, engine.typed);
      for (let i = 0; i < Math.min(engine.wordIndex, engine.words.length); i++) renderer.syncWord(i, engine.words[i], engine.typed[i], true);
      const wi = Math.min(engine.wordIndex, engine.words.length - 1);
      renderer.setActive(wi);
      renderer.placeCaret(wi, engine.typed[wi]?.length ?? 0);
      renderer.setCaretStyle(st.caretStyle, true);
      state.current = { engine, renderer, idx, times: times, head: to };
      hud(to);
    },
    [input, log.keys, hud, times],
  );

  useEffect(() => {
    rebuild(0);
    return () => state.current?.renderer.destroy();
  }, [rebuild]);

  // playback loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const s = state.current;
      if (!s) return;
      s.head += (now - last) * speedRef.current;
      last = now;
      let recent = 0;
      while (s.idx < log.keys.length && s.times[s.idx] <= s.head) {
        const eff = s.engine.input(log.keys[s.idx], s.times[s.idx]);
        if (eff.kind !== "none") applyEffect(s.engine, s.renderer, eff);
        s.idx++;
        recent++;
      }
      if (recent) s.renderer.poke();
      hud(s.head);
      if (s.head >= log.endMs) {
        setPlaying(false);
        s.renderer.setIdle();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, log.keys, log.endMs, hud]);

  const toggle = () => {
    const s = state.current;
    if (s && s.head >= log.endMs) rebuild(0);
    setPlaying((p) => !p);
  };

  const seek = (ms: number) => {
    const s = state.current;
    if (!s) return;
    if (ms < s.head) rebuild(ms);
    else {
      while (s.idx < log.keys.length && s.times[s.idx] <= ms) {
        const eff = s.engine.input(log.keys[s.idx], s.times[s.idx]);
        if (eff.kind !== "none") applyEffect(s.engine, s.renderer, eff);
        s.idx++;
      }
      s.head = ms;
      hud(ms);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" && (e.target as HTMLInputElement).type !== "range") return;
      if (e.key === "k" || (e.key === " " && (e.target as HTMLElement)?.tagName !== "BUTTON")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <div className="relative border border-line bg-bg2/40 px-5 py-6 sm:px-8" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
        <div className="mb-3 flex items-baseline gap-6 font-mono text-sm text-sub">
          <span>
            <span ref={timeRef} className="display text-3xl font-semibold text-accent">
              0.0s
            </span>
          </span>
          <span>
            <span ref={wpmRef} className="text-lg text-fg">
              0
            </span>{" "}
            wpm
          </span>
          <span>
            <span ref={accRef} className="text-lg text-fg">
              100%
            </span>{" "}
            acc
          </span>
        </div>
        <div ref={rootRef} className="tw" style={{ ["--lines" as string]: input.mode === "code" ? 5 : 3, fontSize: "clamp(1rem, 4.5vw, 1.6rem)" }}>
          <div ref={innerRef} className="tw-inner">
            <div ref={caretRef} className="caret smooth idle" data-style="line" aria-hidden />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          onClick={toggle}
          className="press grid h-10 w-10 place-items-center bg-fg text-bg hover:bg-accent hover:text-on-accent"
          style={{ borderRadius: "var(--radius)" }}
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => { setPlaying(false); rebuild(0); }} className="press grid h-10 w-10 place-items-center text-sub hover:text-fg" aria-label="Restart replay">
          <RotateCcw size={15} />
        </button>
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={Math.max(1, log.endMs)}
          defaultValue={0}
          step={10}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Replay position"
          className="h-1 min-w-[10rem] flex-1 cursor-pointer accent-[var(--accent)]"
        />
        <Segmented id="replay-speed" label="Playback speed" size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ id: s, label: `${s}×` }))} />
      </div>
      <p className="mt-2 font-mono text-[0.68rem] text-faint">space / k to play · drag to scrub</p>
    </div>
  );
}
