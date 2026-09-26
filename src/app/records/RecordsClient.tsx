"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { useHistory } from "@/stores/history";
import { computePbs, pbProgression } from "@/lib/records";
import { RECORD_CATEGORIES } from "@/engine/config";
import { fmtDate, relativeTime } from "@/lib/format";
import { PageHeader, PageShell } from "@/components/ui/primitives";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import type { TestConfig } from "@/engine/types";

function configFor(id: string): Partial<TestConfig> {
  const [k, n] = id.split(":");
  if (k === "time") return { mode: "time", duration: Number(n), punctuation: false, numbers: false, content: "common" };
  if (k === "words") return { mode: "words", wordCount: Number(n), punctuation: false, numbers: false, content: "common" };
  if (k === "quote") return { mode: "quote" };
  if (k === "code") return { mode: "code" };
  if (k === "numbers") return { mode: "time", duration: 30, numbers: true, punctuation: false };
  if (k === "punctuation") return { mode: "time", duration: 30, punctuation: true, numbers: false };
  return {};
}

function Progression({ points }: { points: { at: number; wpm: number }[] }) {
  if (points.length < 2) return <div className="h-10" />;
  const max = Math.max(...points.map((p) => p.wpm));
  const min = Math.min(...points.map((p) => p.wpm));
  const w = 200;
  const h = 40;
  // step line: a PB holds until the next one
  let d = "";
  points.forEach((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.wpm - min) / (max - min || 1)) * (h - 4) - 2;
    if (i === 0) d += `M${x} ${y}`;
    else d += ` H${x} V${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RecordsClient() {
  const tests = useHistory((s) => s.tests);
  const router = useRouter();
  const pbs = useMemo(() => computePbs(tests), [tests]);
  const [open, setOpen] = useState<string | null>(null);
  const groups: { id: "time" | "words" | "modes"; label: string }[] = [
    { id: "time", label: "time" },
    { id: "words", label: "words" },
    { id: "modes", label: "modes" },
  ];
  const set = Object.keys(pbs).length;

  const start = (id: string) => {
    useSettings.getState().setTest(configFor(id));
    useUI.getState().requestRestart();
    router.push("/type");
  };

  return (
    <PageShell wide>
      <PageHeader
        n="07"
        kicker="personal records"
        title={
          <>
            {set} <span className="italic-serif font-normal text-sub">of</span> {RECORD_CATEGORIES.length} <span className="italic-serif font-normal text-sub">records set</span>
          </>
        }
        dek="Each category keeps its own best. Records only count clean runs: no flagged tests, at least three seconds long."
      />

      {groups.map((g) => (
        <section key={g.id} className="mb-14">
          <div className="label mb-4">{g.label}</div>
          <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 xl:grid-cols-4" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
            {RECORD_CATEGORIES.filter((c) => c.group === g.id).map((c) => {
              const pb = pbs[c.id];
              const fresh = pb && Date.now() - pb.at < 86400000;
              const prog = pb ? pbProgression(tests, c.id) : [];
              const expanded = open === c.id;
              return (
                <div key={c.id} className="group relative flex min-h-[15rem] flex-col justify-between bg-bg p-6 transition-colors hover:bg-bg2">
                  {fresh && <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 60px var(--glow)" }} aria-hidden />}
                  <div className="flex items-start justify-between">
                    <div className="font-mono text-sm text-sub">{c.label}</div>
                    {fresh && <span className="label !text-accent">new ✦</span>}
                  </div>
                  {pb ? (
                    <>
                      <div className="mt-4 flex items-end gap-2">
                        <span className="display text-7xl font-bold text-fg">
                          <RollingNumber value={pb.wpm} />
                        </span>
                        <span className="italic-serif mb-2 text-xl text-sub">wpm</span>
                      </div>
                      <div className="mt-2 font-mono text-xs text-sub">
                        {pb.accuracy.toFixed(1)}% · raw {Math.round(pb.raw)} · {fmtDate(pb.at)}
                      </div>
                      <button onClick={() => setOpen(expanded ? null : c.id)} className="mt-4 text-left" aria-expanded={expanded} aria-label={`${c.label} progression`}>
                        <Progression points={prog} />
                        <div className="mt-1 font-mono text-[0.65rem] text-faint">
                          {prog.length} record{prog.length === 1 ? "" : "s"} set · {expanded ? "hide" : "show"} progression
                        </div>
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 space-y-1 overflow-hidden font-mono text-[0.72rem]">
                            {[...prog].reverse().map((p, i, arr) => (
                              <li key={p.testId} className="flex items-center justify-between border-b border-line py-1">
                                <Link href={`/history/${encodeURIComponent(p.testId)}`} className="text-fg hover:text-accent">
                                  {p.wpm.toFixed(1)} wpm
                                </Link>
                                <span className="text-faint">
                                  {i < arr.length - 1 ? `+${(p.wpm - arr[i + 1].wpm).toFixed(1)} · ` : ""}
                                  {relativeTime(p.at)}
                                </span>
                              </li>
                            ))}
                          </motion.ol>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <div className="mt-6">
                      <div className="display text-7xl font-bold text-faint/40">—</div>
                      <button onClick={() => start(c.id)} className="press mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-sub hover:text-accent">
                        set the first one <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
                  {pb && (
                    <button onClick={() => start(c.id)} className="press absolute right-5 top-12 grid h-8 w-8 place-items-center text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100" aria-label={`Beat your ${c.label} record`}>
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </PageShell>
  );
}
