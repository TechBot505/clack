"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useHistory } from "@/stores/history";
import { computeStreaks, computeTotals, mergeKeyStats } from "@/lib/records";
import { inRange, type StatsRange } from "@/lib/stats";
import { fmtDuration, fmtNumber } from "@/lib/format";
import { PageHeader, PageShell, EmptyState, Segmented, SectionTitle, Stat } from "@/components/ui/primitives";
import { KeyboardHeatmap } from "@/components/KeyboardHeatmap";
import { RollingNumber } from "@/components/ui/RollingNumber";

const StatsCharts = dynamic(() => import("@/components/charts/StatsCharts").then((m) => m.StatsCharts), {
  ssr: false,
  loading: () => <div className="h-[900px]" />,
});

const RANGES: { id: StatsRange; label: string }[] = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "365", label: "1 year" },
  { id: "all", label: "all time" },
];

export function StatsClient() {
  const all = useHistory((s) => s.tests);
  const loaded = useHistory((s) => s.loaded);
  const [range, setRange] = useState<StatsRange>("all");
  const tests = useMemo(() => inRange(all, range), [all, range]);
  const totals = useMemo(() => computeTotals(tests), [tests]);
  const streaks = useMemo(() => computeStreaks(all), [all]);
  const keys = useMemo(() => mergeKeyStats(tests), [tests]);

  if (loaded && all.length === 0) {
    return (
      <PageShell>
        <PageHeader n="04" kicker="statistics" title="No numbers yet." />
        <EmptyState title="Stats need a little data." body="Finish a few tests and this page turns into a proper lab: distributions, rhythms, time-of-day and a keyboard that glows." action={{ href: "/type", label: "start typing" }} />
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        n="04"
        kicker="statistics"
        title={
          <>
            the <span className="italic-serif font-normal text-accent">lab</span>
          </>
        }
        dek="Everything you've typed, measured. Hover anything for the exact numbers."
        right={<Segmented id="stats-range" label="Time range" value={range} onChange={setRange} options={RANGES} />}
      />

      <section className="mb-16 grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3 xl:grid-cols-5">
        <div className="col-span-2 md:col-span-1">
          <div className="border-t border-line pt-3">
            <div className="label">current wpm</div>
            <div className="display mt-1.5 text-7xl font-bold text-fg">
              <RollingNumber value={totals.recentWpm} />
            </div>
            <div className="mt-1 font-mono text-[0.7rem] text-faint">average of your last 10</div>
          </div>
        </div>
        <Stat label="average wpm" value={totals.avgWpm.toFixed(1)} />
        <Stat label="best wpm" value={totals.bestWpm.toFixed(1)} />
        <Stat label="accuracy" value={`${totals.avgAcc.toFixed(1)}%`} />
        <Stat label="consistency" value={`${totals.avgConsistency.toFixed(0)}%`} />
        <Stat label="tests" value={fmtNumber(totals.tests)} sub={`${streaks.current}-day streak · best ${streaks.longest}`} />
        <Stat label="typing time" value={fmtDuration(totals.timeMs)} />
        <Stat label="words typed" value={fmtNumber(totals.words)} />
        <Stat label="characters" value={fmtNumber(totals.chars)} />
      </section>

      <StatsCharts tests={tests} />

      <section className="mt-16">
        <SectionTitle n="i">keyboard</SectionTitle>
        <div className="mx-auto max-w-4xl">
          <KeyboardHeatmap stats={keys} title="every key you've pressed" minSamples={5} />
        </div>
      </section>
    </PageShell>
  );
}
