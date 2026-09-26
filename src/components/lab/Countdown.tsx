"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { playSound } from "@/lib/sound";
import { useSettings } from "@/stores/settings";

/** 3 · 2 · 1 · GO — a launch sequence. Calls onDone when it's time to type. */
export function Countdown({ word = "GO", onDone }: { word?: string; onDone: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    const s = useSettings.getState();
    playSound("key", s.soundPack, s.volume);
    const id = setTimeout(() => {
      if (n > 1) setN(n - 1);
      else if (n === 1) setN(0);
      else onDone();
    }, n === 0 ? 450 : 700);
    return () => clearTimeout(id);
  }, [n, onDone]);
  return (
    <div className="pointer-events-none flex h-[40vh] items-center justify-center" aria-live="assertive">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={n}
          initial={{ scale: 2.2, opacity: 0, filter: "blur(12px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className={`display font-bold ${n === 0 ? "text-accent" : "text-fg"} text-[clamp(6rem,22vw,16rem)]`}
        >
          {n === 0 ? word : n}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
