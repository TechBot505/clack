"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyz#%&*+=<>/";

/** Cycles through words with a quick scramble-and-settle morph. */
export function MorphingWord({ words, interval = 2600, className = "" }: { words: string[]; interval?: number; className?: string }) {
  const [text, setText] = useState(words[0]);
  const idx = useRef(0);

  useEffect(() => {
    const reduced = document.documentElement.dataset.motion === "reduced";
    let raf = 0;
    const cycle = setInterval(() => {
      const from = words[idx.current];
      idx.current = (idx.current + 1) % words.length;
      const to = words[idx.current];
      if (reduced) {
        setText(to);
        return;
      }
      const len = Math.max(from.length, to.length);
      const start = performance.now();
      const dur = 520;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        let out = "";
        for (let i = 0; i < len; i++) {
          const settle = (i + 1) / len;
          if (p >= settle * 0.85 + 0.15) out += to[i] ?? "";
          else if (p > i / len / 2) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
          else out += from[i] ?? "";
        }
        setText(out.replace(/\s+$/, ""));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setText(to);
      };
      raf = requestAnimationFrame(tick);
    }, interval);
    return () => {
      clearInterval(cycle);
      cancelAnimationFrame(raf);
    };
  }, [words, interval]);

  return (
    <span className={className} aria-live="off">
      {text}
      <span className="blink ml-0.5 inline-block w-[0.5ch] text-accent">_</span>
    </span>
  );
}
