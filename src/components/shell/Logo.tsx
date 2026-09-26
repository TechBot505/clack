"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useUI } from "@/stores/ui";

const LETTERS = ["c", "l", "a", "c", "k"];

/** The wordmark. Click it a few times. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const clicks = useRef<number[]>([]);
  const [chaos, setChaos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const onClick = (e: React.MouseEvent) => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2500), now];
    const n = clicks.current.length;
    if (n >= 5) {
      e.preventDefault();
      setChaos((c) => c + 1);
      if (n === 5) useUI.getState().toast({ title: "stop poking me.", body: "i'm a logo, not a button." });
      if (n === 9) {
        setFlipped((f) => !f);
        useUI.getState().toast({ title: "ok. you win.", body: "¡ɹǝʇʇǝq ƃuᴉdʎʇ oƃ ʍou" });
        clicks.current = [];
      }
    }
  };

  const text = size === "lg" ? "text-4xl" : "text-[1.35rem]";

  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="clack. home"
      className={`press group relative inline-flex items-baseline font-display font-bold tracking-tight text-fg ${text}`}
      style={{ fontVariationSettings: '"wdth" 80, "opsz" 48' }}
    >
      <motion.span className="inline-flex" animate={{ rotate: flipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        {LETTERS.map((l, i) => (
          <motion.span
            key={i}
            className="inline-block"
            animate={
              chaos
                ? {
                    y: [0, (Math.sin(chaos * 7 + i * 3) * 18) | 0, 0],
                    rotate: [0, (Math.cos(chaos * 5 + i) * 40) | 0, 0],
                  }
                : { y: 0, rotate: 0 }
            }
            transition={{ duration: 0.6, delay: i * 0.03, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {l}
          </motion.span>
        ))}
      </motion.span>
      <span className="blink ml-[1px] text-accent" aria-hidden>
        .
      </span>
    </Link>
  );
}
