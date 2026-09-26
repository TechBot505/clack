"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { TestRecord } from "@/lib/records";
import { dayKey, isValidForStats, rollingAverage } from "@/lib/records";
import { fmtDate } from "@/lib/format";
import { Segmented } from "@/components/ui/primitives";
import { ChartFrame, ChartTip, TipRow, axisProps } from "./chart-kit";

type Metric = "wpm" | "accuracy" | "consistency" | "tests" | "time";

const METRICS: { id: Metric; label: string }[] = [
  { id: "wpm", label: "wpm" },
  { id: "accuracy", label: "accuracy" },
  { id: "consistency", label: "consistency" },
  { id: "tests", label: "tests/day" },
  { id: "time", label: "typing time" },
];

/** History over time with a metric switch and rolling averages. */
export function TimelineChart({ tests, height = 260 }: { tests: TestRecord[]; height?: number }) {
  const [metric, setMetric] = useState<Metric>("wpm");

  const perTest = useMemo(() => {
    const sorted = tests.filter(isValidForStats).sort((a, b) => a.createdAt - b.createdAt);
    const key = metric === "accuracy" ? "accuracy" : metric === "consistency" ? "consistency" : "wpm";
    const vals = sorted.map((t) => t[key]);
    const r10 = rollingAverage(vals, 10);
    const r50 = rollingAverage(vals, 50);
    return sorted.map((t, i) => ({ i: i + 1, at: t.createdAt, v: vals[i], r10: r10[i], r50: r50[i] }));
  }, [tests, metric]);

  const perDay = useMemo(() => {
    const map = new Map<string, { day: string; at: number; tests: number; minutes: number }>();
    for (const t of tests) {
      const k = dayKey(t.createdAt);
      const e = map.get(k) ?? { day: k, at: new Date(k + "T12:00:00").getTime(), tests: 0, minutes: 0 };
      e.tests++;
      e.minutes += t.durationMs / 60000;
      map.set(k, e);
    }
    return Array.from(map.values()).sort((a, b) => a.at - b.at).slice(-60);
  }, [tests]);

  const daily = metric === "tests" || metric === "time";
  const unit = metric === "wpm" ? "wpm" : metric === "tests" ? "tests" : metric === "time" ? "min" : "%";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented id="timeline" label="Metric" size="sm" value={metric} options={METRICS} onChange={setMetric} />
        {!daily && (
          <div className="flex items-center gap-4 font-mono text-[0.68rem] text-sub">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-faint" /> each test
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-accent" /> avg 10
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-accent2" /> avg 50
            </span>
          </div>
        )}
      </div>
      <ChartFrame height={height} label={`${metric} over time`}>
        <ResponsiveContainer width="100%" height="100%">
          {daily ? (
            <BarChart data={perDay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="at" {...axisProps} tickFormatter={(v: number) => fmtDate(v, { month: "short", day: "numeric" })} minTickGap={24} />
              <YAxis {...axisProps} width={44} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--bg-3)" }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <ChartTip title={fmtDate((payload[0].payload as { at: number }).at)}>
                      <TipRow color="var(--accent)" label={metric === "tests" ? "tests" : "minutes"} value={metric === "tests" ? String((payload[0].payload as { tests: number }).tests) : (payload[0].payload as { minutes: number }).minutes.toFixed(1)} />
                    </ChartTip>
                  ) : null
                }
              />
              <Bar dataKey={metric === "tests" ? "tests" : "minutes"} fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          ) : (
            <ComposedChart data={perTest} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="i" type="number" {...axisProps} domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => `#${v}`} allowDecimals={false} />
              <YAxis {...axisProps} width={44} domain={metric === "wpm" ? [0, "auto"] : ["auto", 100]} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: "var(--faint)" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { i: number; at: number; v: number; r10: number | null; r50: number | null } | undefined;
                  if (!active || !p) return null;
                  return (
                    <ChartTip title={`test #${p.i} · ${fmtDate(p.at)}`}>
                      <TipRow color="var(--faint)" label="this test" value={`${p.v.toFixed(1)} ${unit}`} />
                      {p.r10 !== null && <TipRow color="var(--accent)" label="avg 10" value={`${p.r10.toFixed(1)}`} />}
                      {p.r50 !== null && <TipRow color="var(--accent-2)" label="avg 50" value={`${p.r50.toFixed(1)}`} />}
                    </ChartTip>
                  );
                }}
              />
              <Scatter dataKey="v" fill="var(--faint)" shape={(props: unknown) => {
                const { cx, cy } = props as { cx?: number; cy?: number };
                if (cx == null || cy == null) return <g />;
                return <circle cx={cx} cy={cy} r={2.5} fill="var(--faint)" />;
              }} isAnimationActive={false} />
              <Line dataKey="r10" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls isAnimationActive animationDuration={900} />
              <Line dataKey="r50" stroke="var(--accent-2)" strokeWidth={2} dot={false} connectNulls isAnimationActive animationDuration={1100} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
