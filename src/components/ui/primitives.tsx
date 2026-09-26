"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Editorial page header: numbered kicker, oversized title, short dek. */
export function PageHeader({ n, kicker, title, dek, right }: { n: string; kicker: string; title: ReactNode; dek?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
      <div>
        <div className="label flex items-center gap-3">
          <span className="text-accent">{n}</span>
          <span className="h-px w-8 bg-line" />
          <span>{kicker}</span>
        </div>
        <h1 className="display mt-4 text-[clamp(2.8rem,7vw,6rem)] font-semibold text-fg">{title}</h1>
        {dek ? <p className="mt-4 max-w-xl text-sub">{dek}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? "max-w-[1400px]" : "max-w-[1200px]"} px-5 pb-10 pt-8 sm:px-8 sm:pt-12`}>{children}</div>;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  id,
  label,
  size = "md",
}: {
  value: T;
  options: { id: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  id: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex flex-wrap items-center border border-line bg-bg2/60 p-0.5" style={{ borderRadius: "calc(var(--radius) + 3px)" }} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={String(o.id)}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={`press relative font-mono transition-colors ${size === "sm" ? "px-2 py-1 text-[0.7rem]" : "px-3 py-1.5 text-[0.76rem]"} ${active ? "text-bg" : "text-sub hover:text-fg"}`}
          >
            {active && (
              <motion.span layoutId={`segm-${id}`} className="absolute inset-0 bg-fg" style={{ borderRadius: "var(--radius)" }} transition={{ type: "spring", stiffness: 520, damping: 38 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A beautiful empty state: a tiny animated keyboard-row illustration + one clear action. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  const keys = ["c", "l", "a", "c", "k"];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-8 flex gap-2" aria-hidden>
        {keys.map((k, i) => (
          <motion.span
            key={i}
            className="grid h-12 w-12 place-items-center border border-line bg-bg2 font-mono text-sub"
            style={{ borderRadius: "calc(var(--radius) + 4px)" }}
            animate={{ y: [0, 4, 0], borderColor: ["var(--line)", "var(--accent)", "var(--line)"] }}
            transition={{ duration: 0.5, delay: i * 0.18, repeat: Infinity, repeatDelay: 2.4 }}
          >
            {k}
          </motion.span>
        ))}
      </div>
      <h2 className="font-display text-3xl font-semibold text-fg">{title}</h2>
      <p className="mt-3 max-w-md text-sub">{body}</p>
      {action && (
        <Link href={action.href} className="press mt-8 inline-flex items-center gap-2 bg-accent px-5 py-3 font-mono text-sm text-on-accent" style={{ borderRadius: "var(--radius)" }}>
          {action.label} →
        </Link>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, big = false }: { label: string; value: ReactNode; sub?: ReactNode; big?: boolean }) {
  return (
    <div className="border-t border-line pt-3">
      <div className="label">{label}</div>
      <div className={`mt-1.5 text-fg ${big ? "display text-5xl font-semibold" : "font-mono text-2xl"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub ? <div className="mt-1 font-mono text-[0.7rem] text-faint">{sub}</div> : null}
    </div>
  );
}

export function SectionTitle({ n, children, right }: { n?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="label flex items-center gap-3">
        {n ? <span className="text-accent">{n}</span> : null}
        <span>{children}</span>
      </h2>
      {right}
    </div>
  );
}
