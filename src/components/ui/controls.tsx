"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`press relative h-6 w-11 shrink-0 border transition-colors ${checked ? "border-accent bg-accent" : "border-line bg-bg3"}`}
      style={{ borderRadius: 999 }}
    >
      <motion.span
        className={`absolute top-0.5 h-[18px] w-[18px] ${checked ? "bg-on-accent" : "bg-sub"}`}
        style={{ borderRadius: 999 }}
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
      />
      <span className="sr-only">{checked ? "on" : "off"}</span>
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format = (v) => String(v),
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex w-full max-w-xs items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-fg [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg"
        style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--bg-3) ${pct}%)`, borderRadius: 999 }}
      />
      <span className="w-14 text-right font-mono text-xs text-fg">{format(value)}</span>
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="cursor-pointer border border-line bg-bg2 px-3 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent"
      style={{ borderRadius: "var(--radius)" }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SettingRow({ title, description, children, stack = false }: { title: string; description?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`flex gap-4 border-b border-line py-5 ${stack ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"}`}>
      <div className="max-w-md">
        <div className="text-[0.95rem] text-fg">{title}</div>
        {description ? <div className="mt-1 text-sm text-sub">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
