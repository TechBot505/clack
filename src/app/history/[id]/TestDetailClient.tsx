"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Trash2, Sparkles, RotateCcw } from "lucide-react";
import { useHistory } from "@/stores/history";
import type { TestRecord } from "@/lib/records";
import type { RunLog } from "@/engine/types";
import { replayInput, type RunInput } from "@/engine/record";
import type { RunResult } from "@/engine/analyze";
import { describeTest, fmtDate, fmtDuration, fmtTime, sourceLine } from "@/lib/format";
import { generateInsights } from "@/engine/insights";
import { PageShell, SectionTitle, Stat, EmptyState } from "@/components/ui/primitives";
import { KeyboardHeatmap } from "@/components/KeyboardHeatmap";
import { Replay } from "@/components/replay/Replay";
import { RhythmMap } from "@/components/replay/RhythmMap";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";

const WpmChart = dynamic(() => import("@/components/results/WpmChart").then((m) => m.WpmChart), { ssr: false, loading: () => <div className="h-[270px]" /> });
const ShareDialog = dynamic(() => import("@/components/results/ShareDialog").then((m) => m.ShareDialog), { ssr: false });

export function TestDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const loaded = useHistory((s) => s.loaded);
  const tests = useHistory((s) => s.tests);
  const [record, setRecord] = useState<TestRecord | null | undefined>(undefined);
  const [log, setLog] = useState<RunLog | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      const h = useHistory.getState();
      const t = await h.getTest(id);
      if (cancelled) return;
      setRecord(t);
      if (t) setLog(await h.getLog(id));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loaded]);

  const result: RunResult | null = useMemo(() => {
    if (!record || !log) return null;
    try {
      return replayInput(record as unknown as RunInput, log);
    } catch {
      return null;
    }
  }, [record, log]);

  const insights = useMemo(() => (record && result ? generateInsights(result, record, tests) : []), [record, result, tests]);

  if (record === undefined) return <PageShell><div className="h-[60vh]" /></PageShell>;
  if (record === null)
    return (
      <PageShell>
        <EmptyState title="That test isn't here." body="It may have been deleted, or it lives on another device." action={{ href: "/history", label: "back to history" }} />
      </PageShell>
    );

  const src = sourceLine(record);

  return (
    <PageShell>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/history" className="press inline-flex items-center gap-2 font-mono text-xs text-sub hover:text-fg">
          <ArrowLeft size={14} /> history
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              useSettings.getState().setTest({
                mode: record.mode,
                ...(record.mode === "time" ? { duration: record.mode2 } : {}),
                ...(record.mode === "words" ? { wordCount: record.mode2 } : {}),
                punctuation: record.punctuation,
                numbers: record.numbers,
                content: record.content,
                language: record.language,
                ...(record.mode === "custom" ? { customText: record.customText ?? "" } : {}),
              });
              useUI.getState().requestRestart();
              router.push("/type");
            }}
            className="press inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg"
            style={{ borderRadius: "var(--radius)" }}
          >
            <RotateCcw size={13} /> same settings
          </button>
          <button onClick={() => setShare(true)} className="press border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
            share
          </button>
          <button
            onClick={async () => {
              if (!confirm("Delete this test from your history?")) return;
              await useHistory.getState().remove(record.id);
              router.push("/history");
            }}
            className="press grid h-8 w-8 place-items-center text-sub hover:text-err"
            aria-label="Delete test"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="label flex flex-wrap items-center gap-x-3">
        <span className="text-accent">{fmtDate(record.createdAt, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toLowerCase()}</span>
        <span>{fmtTime(record.createdAt)}</span>
        <span>{describeTest(record)}</span>
        {src && <span className="normal-case tracking-normal text-faint">{src}</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div className="flex items-end gap-3">
          <span className="display text-[clamp(5rem,14vw,10rem)] font-bold">{Math.round(record.wpm)}</span>
          <span className="italic-serif mb-4 text-3xl text-sub">wpm</span>
        </div>
        <div className="mb-5 flex items-baseline gap-2">
          <span className="display text-5xl font-semibold">{record.accuracy.toFixed(record.accuracy === 100 ? 0 : 1)}%</span>
          <span className="italic-serif text-xl text-sub">accuracy</span>
        </div>
        {record.isPb && (
          <span className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">
            <Sparkles size={13} /> personal best
          </span>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="raw" value={Math.round(record.raw)} />
        <Stat label="consistency" value={`${Math.round(record.consistency)}%`} />
        <Stat label="peak" value={Math.round(record.peakWpm)} />
        <Stat label="time" value={fmtDuration(record.durationMs)} />
        <Stat label="correct" value={record.correct} />
        <Stat label="incorrect" value={record.incorrect} />
        <Stat label="extra / missed" value={`${record.extra}/${record.missed}`} />
        <Stat label="keystrokes" value={record.keystrokes} sub={`${record.backspaces} backspaces`} />
      </div>

      <section className="mt-16">
        <SectionTitle n="a">replay</SectionTitle>
        {log ? (
          <Replay input={record as unknown as RunInput} log={log} onTime={setPlayhead} />
        ) : (
          <p className="border border-dashed border-line p-6 font-mono text-sm text-sub" style={{ borderRadius: "var(--radius)" }}>
            The keystroke timeline for this test isn&apos;t kept on this device anymore (only the most recent 100 are), so there&apos;s no replay. The numbers above are still exact.
          </p>
        )}
      </section>

      {result && (
        <section className="mt-16">
          <SectionTitle n="b">rhythm map</SectionTitle>
          <RhythmMap events={result.events} endMs={result.durationMs} playhead={playhead} />
        </section>
      )}

      {record.samples.t.length > 1 && (
        <section className="mt-16">
          <SectionTitle n="c">speed</SectionTitle>
          <WpmChart samples={record.samples} animate={false} />
        </section>
      )}

      <section className="mt-16 grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-2">
        <div>
          <SectionTitle n="d">observations</SectionTitle>
          {insights.length ? (
            <ol className="space-y-3">
              {insights.map((ins, i) => (
                <li key={ins.id} className="flex gap-4 border-b border-line pb-3 text-[0.95rem] text-fg">
                  <span className="pt-0.5 font-mono text-[0.7rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  {ins.text}
                </li>
              ))}
            </ol>
          ) : (
            <p className="font-mono text-sm text-sub">{log ? "Nothing unusual. A tidy run." : "Observations need the keystroke timeline."}</p>
          )}
        </div>
        <div>
          <SectionTitle n="e">keys</SectionTitle>
          <KeyboardHeatmap stats={record.keyStats} bigrams={result?.bigramStats} compact minSamples={1} title="this test" />
        </div>
      </section>
      {share && <ShareDialog record={record} pbs={[]} onClose={() => setShare(false)} />}
    </PageShell>
  );
}
