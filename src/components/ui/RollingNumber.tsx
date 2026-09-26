"use client";

import { motion } from "motion/react";

/**
 * Odometer-style number: each digit is a vertical strip that rolls into
 * place. Used for WPM reveals, PB deltas and stat counters.
 */
export function RollingNumber({
  value,
  decimals = 0,
  className = "",
  delay = 0,
  stagger = 0.05,
  stiffness = 90,
}: {
  value: number;
  decimals?: number;
  className?: string;
  delay?: number;
  stagger?: number;
  stiffness?: number;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const str = safe.toFixed(decimals);
  const chars = str.split("");
  return (
    <span className={`inline-flex leading-none ${className}`} style={{ fontVariantNumeric: "tabular-nums" }} aria-label={str} role="text">
      {chars.map((ch, i) => {
        const key = chars.length - i; // stable from the right so tens/hundreds keep identity
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${key}`} aria-hidden>
              {ch}
            </span>
          );
        }
        return <Digit key={`d${key}`} digit={Number(ch)} delay={delay + i * stagger} stiffness={stiffness} />;
      })}
    </span>
  );
}

function Digit({ digit, delay, stiffness }: { digit: number; delay: number; stiffness: number }) {
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: "1em", lineHeight: 1 }} aria-hidden>
      <span className="invisible">0</span>
      <motion.span
        className="absolute left-0 top-0 flex flex-col"
        initial={{ y: "0em" }}
        animate={{ y: `${-digit}em` }}
        transition={{ type: "spring", stiffness, damping: 17, mass: 1, delay }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: "1em", lineHeight: 1 }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
