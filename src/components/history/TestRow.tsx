"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { TestRecord } from "@/lib/records";
import { describeTest, fmtTime } from "@/lib/format";

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <svg width="96" height="28" aria-hidden />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 96},${26 - (v / max) * 24}`).join(" ");
  return (
    <svg width="96" height="28" viewBox="0 0 96 28" aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/** One test in the history explorer: an editorial row, not a table cell. */
export function TestRow({ t }: { t: TestRecord }) {
  return (
    <Link
      href={`/history/${encodeURIComponent(t.id)}`}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-1 border-b border-line py-4 transition-colors hover:bg-bg2/60 sm:grid-cols-[5.5rem_1fr_7rem_6rem_auto] sm:px-2"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="display text-4xl font-semibold text-fg transition-colors group-hover:text-accent">{Math.round(t.wpm)}</span>
        <span className="font-mono text-[0.65rem] text-faint">wpm</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate font-mono text-[0.78rem] text-fg">
          {t.isPb && <Sparkles size={12} className="shrink-0 text-accent" aria-label="personal best" />}
          <span className="truncate">{describeTest(t)}</span>
          {t.flagged && <span className="text-err">· flagged</span>}
        </div>
        <div className="mt-0.5 font-mono text-[0.68rem] text-faint">
          {fmtTime(t.createdAt)} · raw {Math.round(t.raw)} · {Math.round(t.consistency)}% consistent
        </div>
      </div>
      <div className="hidden text-right font-mono text-sm text-sub sm:block">
        <span className="text-fg">{t.accuracy.toFixed(1)}%</span>
        <div className="text-[0.65rem] text-faint">accuracy</div>
      </div>
      <div className="hidden sm:block">
        <Spark values={t.samples?.wpm ?? []} />
      </div>
      <span className="font-mono text-xs text-faint transition-transform group-hover:translate-x-1 group-hover:text-fg">→</span>
    </Link>
  );
}
