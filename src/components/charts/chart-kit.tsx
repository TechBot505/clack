"use client";

import type { ReactNode } from "react";

/** Shared chart pieces so every chart reads as one system. */

export const axisProps = {
  tickLine: false,
  axisLine: false,
} as const;

export function ChartFrame({ height, label, children }: { height: number; label: string; children: ReactNode }) {
  return (
    <div style={{ height }} role="img" aria-label={label} className="w-full">
      {children}
    </div>
  );
}

export function ChartTip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-line bg-bg2/95 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur" style={{ borderRadius: "var(--radius)" }}>
      <div className="mb-1 text-sub">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-fg">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-sub">{label}</span>
      <span className="ml-auto pl-3">{value}</span>
    </div>
  );
}
