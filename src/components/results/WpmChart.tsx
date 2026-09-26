"use client";

import { ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Scatter, ResponsiveContainer } from "recharts";
import type { Samples } from "@/engine/analyze";

interface Point {
  t: number;
  wpm: number;
  raw: number;
  err: number;
  /** y position for the error marker (sits on the raw line) */
  errY: number | null;
}

/**
 * WPM over the test. One y-axis (WPM): net and raw lines, and mistakes drawn
 * as × markers riding the raw line (size = mistakes in that second), so no
 * second scale is ever needed.
 */
export function WpmChart({ samples, height = 240, animate = true }: { samples: Samples; height?: number; animate?: boolean }) {
  const data: Point[] = samples.t.map((t, i) => ({
    t,
    wpm: samples.wpm[i],
    raw: samples.raw[i],
    err: samples.err[i],
    errY: samples.err[i] > 0 ? samples.raw[i] : null,
  }));
  const max = Math.max(10, ...samples.raw, ...samples.wpm);
  const yMax = Math.ceil((max * 1.1) / 20) * 20;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-5 font-mono text-[0.7rem] text-sub">
        <LegendSwatch color="var(--accent)" label="wpm" />
        <LegendSwatch color="var(--sub)" label="raw" dashed />
        <span className="inline-flex items-center gap-1.5">
          <span className="font-bold text-err">×</span> mistakes
        </span>
      </div>
      <div style={{ height }} role="img" aria-label={`WPM over time. Final ${samples.wpm[samples.wpm.length - 1] ?? 0} WPM.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[data[0]?.t ?? 0, data[data.length - 1]?.t ?? 1]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v)}s`}
              allowDecimals={false}
            />
            <YAxis domain={[0, yMax]} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
            <Tooltip content={ChartTooltip} cursor={{ strokeWidth: 1 }} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="raw"
              stroke="var(--sub)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 3, fill: "var(--sub)", stroke: "var(--bg)", strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={1100}
            />
            <Line
              type="monotone"
              dataKey="wpm"
              stroke="var(--accent)"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4.5, fill: "var(--accent)", stroke: "var(--bg)", strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={1300}
            />
            <Scatter dataKey="errY" shape={ErrorMark} isAnimationActive={false} legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "3 3" : undefined} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

function ErrorMark(props: unknown) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: Point };
  if (cx == null || cy == null || !payload || payload.errY == null) return <g />;
  const s = Math.min(7, 3.5 + payload.err);
  return (
    <g aria-hidden>
      <circle cx={cx} cy={cy} r={s + 3} fill="var(--bg)" opacity={0.85} />
      <path d={`M${cx - s} ${cy - s} L${cx + s} ${cy + s} M${cx + s} ${cy - s} L${cx - s} ${cy + s}`} stroke="var(--error)" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function ChartTooltip(props: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point | undefined;
  if (!p) return null;
  return (
    <div className="border border-line bg-bg2/95 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur" style={{ borderRadius: "var(--radius)" }}>
      <div className="mb-1 text-sub">{p.t.toFixed(p.t % 1 ? 1 : 0)}s</div>
      <div className="flex items-center gap-2 text-fg">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" /> {Math.round(p.wpm)} wpm
      </div>
      <div className="flex items-center gap-2 text-sub">
        <span className="inline-block h-2 w-2 rounded-full bg-sub" /> {Math.round(p.raw)} raw
      </div>
      {p.err > 0 && (
        <div className="flex items-center gap-2 text-fg">
          <span className="font-bold text-err">×</span> {p.err} mistake{p.err > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
