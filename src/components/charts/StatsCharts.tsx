"use client";

import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { TestRecord } from "@/lib/records";
import { accuracyDistribution, byCategory, byHour, byWeekday, histogram, wpmHistory } from "@/lib/stats";
import { isValidForStats } from "@/lib/records";
import { fmtDate } from "@/lib/format";
import { ChartFrame, ChartTip, TipRow, axisProps } from "./chart-kit";
import { SectionTitle } from "@/components/ui/primitives";

const M = { top: 8, right: 8, bottom: 0, left: -16 };

function Legend({ items }: { items: { color: string; label: string; dot?: boolean }[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 font-mono text-[0.68rem] text-sub">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dot ? <span className="h-2 w-2 rounded-full" style={{ background: i.color }} /> : <span className="h-0.5 w-4" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function StatsCharts({ tests }: { tests: TestRecord[] }) {
  const hist = wpmHistory(tests);
  const valid = tests.filter(isValidForStats);
  const wpmDist = histogram(valid.map((t) => t.wpm), 10);
  const accDist = accuracyDistribution(tests);
  const scatter = valid.map((t) => ({ wpm: t.wpm, acc: t.accuracy, at: t.createdAt }));
  const weekday = byWeekday(tests);
  const hours = byHour(tests);
  const cats = byCategory(tests);
  const maxHourCount = Math.max(1, ...hours.map((h) => h.count));

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-1 gap-x-12 gap-y-16 xl:grid-cols-2">
        <section>
          <SectionTitle n="a">wpm history</SectionTitle>
          <Legend items={[{ color: "var(--faint)", label: "each test", dot: true }, { color: "var(--accent)", label: "rolling 10" }, { color: "var(--accent-2)", label: "rolling 50" }]} />
          <ChartFrame height={240} label="WPM history with rolling averages">
            <ResponsiveContainer>
              <ComposedChart data={hist} margin={M}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]} {...axisProps} tickFormatter={(v: number) => `#${v}`} allowDecimals={false} />
                <YAxis {...axisProps} width={44} domain={[0, "auto"]} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as (typeof hist)[number] | undefined;
                    if (!active || !p) return null;
                    return (
                      <ChartTip title={`#${p.i} · ${fmtDate(p.at)}`}>
                        <TipRow color="var(--faint)" label="wpm" value={p.wpm.toFixed(1)} />
                        {p.r10 !== null && <TipRow color="var(--accent)" label="avg 10" value={p.r10.toFixed(1)} />}
                        {p.r50 !== null && <TipRow color="var(--accent-2)" label="avg 50" value={p.r50.toFixed(1)} />}
                      </ChartTip>
                    );
                  }}
                />
                <Scatter dataKey="wpm" isAnimationActive={false} shape={(p: unknown) => {
                  const { cx, cy } = p as { cx?: number; cy?: number };
                  return cx == null || cy == null ? <g /> : <circle cx={cx} cy={cy} r={2.5} fill="var(--faint)" />;
                }} />
                <Line dataKey="r10" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls animationDuration={900} />
                <Line dataKey="r50" stroke="var(--accent-2)" strokeWidth={2} dot={false} connectNulls animationDuration={1100} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>

        <section>
          <SectionTitle n="b">accuracy history</SectionTitle>
          <Legend items={[{ color: "var(--faint)", label: "each test", dot: true }, { color: "var(--accent)", label: "rolling 10" }]} />
          <ChartFrame height={240} label="Accuracy history">
            <ResponsiveContainer>
              <ComposedChart data={hist} margin={M}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]} {...axisProps} tickFormatter={(v: number) => `#${v}`} allowDecimals={false} />
                <YAxis {...axisProps} width={44} domain={[(min: number) => Math.max(0, Math.floor(min - 2)), 100]} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as (typeof hist)[number] | undefined;
                    if (!active || !p) return null;
                    return (
                      <ChartTip title={`#${p.i} · ${fmtDate(p.at)}`}>
                        <TipRow color="var(--faint)" label="accuracy" value={`${p.acc.toFixed(1)}%`} />
                        {p.a10 !== null && <TipRow color="var(--accent)" label="avg 10" value={`${p.a10.toFixed(1)}%`} />}
                      </ChartTip>
                    );
                  }}
                />
                <Scatter dataKey="acc" isAnimationActive={false} shape={(p: unknown) => {
                  const { cx, cy } = p as { cx?: number; cy?: number };
                  return cx == null || cy == null ? <g /> : <circle cx={cx} cy={cy} r={2.5} fill="var(--faint)" />;
                }} />
                <Line dataKey="a10" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls animationDuration={900} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>

        <section>
          <SectionTitle n="c">wpm distribution</SectionTitle>
          <ChartFrame height={220} label="Distribution of WPM in 10-WPM buckets">
            <ResponsiveContainer>
              <BarChart data={wpmDist} margin={M}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--bg-3)" }} content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof wpmDist)[number] | undefined;
                  return active && p ? <ChartTip title={`${p.bucket}–${p.bucket + 9} wpm`}><TipRow color="var(--accent)" label="tests" value={String(p.count)} /></ChartTip> : null;
                }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>

        <section>
          <SectionTitle n="d">accuracy distribution</SectionTitle>
          <ChartFrame height={220} label="Distribution of accuracy">
            <ResponsiveContainer>
              <BarChart data={accDist} margin={M}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--bg-3)" }} content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof accDist)[number] | undefined;
                  return active && p ? <ChartTip title={p.label === "<90" ? "below 90%" : `${p.label}%`}><TipRow color="var(--accent-2)" label="tests" value={String(p.count)} /></ChartTip> : null;
                }} />
                <Bar dataKey="count" fill="var(--accent-2)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>

        <section>
          <SectionTitle n="e">speed vs accuracy</SectionTitle>
          <ChartFrame height={240} label="Scatter plot of WPM against accuracy">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid />
                <XAxis dataKey="wpm" type="number" name="wpm" {...axisProps} domain={["auto", "auto"]} tickFormatter={(v: number) => `${Math.round(v)}`} />
                <YAxis dataKey="acc" type="number" name="accuracy" {...axisProps} width={44} domain={[(min: number) => Math.max(0, Math.floor(min - 1)), 100]} />
                <ZAxis range={[36, 36]} />
                <Tooltip content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof scatter)[number] | undefined;
                  return active && p ? (
                    <ChartTip title={fmtDate(p.at)}>
                      <TipRow color="var(--accent)" label="wpm" value={p.wpm.toFixed(1)} />
                      <TipRow color="var(--accent)" label="accuracy" value={`${p.acc.toFixed(1)}%`} />
                    </ChartTip>
                  ) : null;
                }} />
                <Scatter data={scatter} fill="var(--accent)" fillOpacity={0.6} stroke="var(--bg)" strokeWidth={1} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>

        <section>
          <SectionTitle n="f">tests by weekday</SectionTitle>
          <ChartFrame height={240} label="Number of tests by weekday">
            <ResponsiveContainer>
              <BarChart data={weekday} margin={M}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--bg-3)" }} content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof weekday)[number] | undefined;
                  return active && p ? (
                    <ChartTip title={p.label}>
                      <TipRow color="var(--accent)" label="tests" value={String(p.count)} />
                      <TipRow color="var(--sub)" label="avg wpm" value={p.avg ? p.avg.toFixed(1) : "–"} />
                    </ChartTip>
                  ) : null;
                }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </section>
      </div>

      <section>
        <SectionTitle n="g">performance by hour</SectionTitle>
        <p className="-mt-2 mb-4 font-mono text-[0.68rem] text-faint">bar height = average wpm · faded bars have fewer tests behind them</p>
        <ChartFrame height={220} label="Average WPM by hour of day">
          <ResponsiveContainer>
            <BarChart data={hours} margin={M}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={1} tickFormatter={(v: string) => `${v.padStart(2, "0")}h`} />
              <YAxis {...axisProps} width={44} allowDecimals={false} />
              <Tooltip cursor={{ fill: "var(--bg-3)" }} content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof hours)[number] | undefined;
                return active && p ? (
                  <ChartTip title={`${String(p.hour).padStart(2, "0")}:00 – ${String(p.hour).padStart(2, "0")}:59`}>
                    <TipRow color="var(--accent)" label="avg wpm" value={p.count ? p.avg.toFixed(1) : "–"} />
                    <TipRow color="var(--sub)" label="tests" value={String(p.count)} />
                  </ChartTip>
                ) : null;
              }} />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {hours.map((h) => (
                  <Cell key={h.hour} fill="var(--accent)" fillOpacity={h.count ? 0.3 + 0.7 * (h.count / maxHourCount) : 0} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </section>

      <section>
        <SectionTitle n="h">by test length</SectionTitle>
        <div className="space-y-2.5">
          {cats.length === 0 && <p className="font-mono text-sm text-sub">No tests in this range.</p>}
          {cats.map((c) => {
            const max = Math.max(...cats.map((x) => x.best), 1);
            return (
              <div key={c.category} className="grid grid-cols-[7.5rem_1fr_6rem] items-center gap-4 font-mono text-xs" title={`${c.count} tests`}>
                <span className="text-sub">{c.label}</span>
                <div className="relative h-5 bg-bg2" style={{ borderRadius: 4 }}>
                  <div className="absolute inset-y-0 left-0 bg-accent/80 transition-[width] duration-700" style={{ width: `${(c.avg / max) * 100}%`, borderRadius: 4 }} />
                  <div className="absolute inset-y-[-3px] w-0.5 bg-fg" style={{ left: `calc(${(c.best / max) * 100}% - 1px)` }} title="best" />
                </div>
                <span className="text-right text-fg">
                  {c.avg.toFixed(0)} <span className="text-faint">/ {c.best.toFixed(0)}</span>
                </span>
              </div>
            );
          })}
          {cats.length > 0 && <p className="pt-1 font-mono text-[0.65rem] text-faint">bar = average · tick = best · right = avg / best wpm</p>}
        </div>
      </section>
    </div>
  );
}
