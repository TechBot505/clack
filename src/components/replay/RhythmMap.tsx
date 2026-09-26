"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayEvent } from "@/engine/analyze";

/**
 * Rhythm Map: every keystroke on one horizontal timeline. Dense clusters are
 * bursts, gaps are pauses, × marks errors, arcs below the line are
 * corrections travelling backwards. Drag to zoom; double-click to reset.
 */
export function RhythmMap({ events, endMs, playhead, height = 150 }: { events: ReplayEvent[]; endMs: number; playhead?: number; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [zoom, setView] = useState<[number, number] | null>(null);
  const view: [number, number] = zoom ?? [0, Math.max(1, endMs)];
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; ev: ReplayEvent; dt: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);


  const [v0, v1] = view;
  const span = Math.max(1, v1 - v0);
  const PAD_L = 10;
  const PAD_R = 16;
  const x = (t: number) => PAD_L + ((t - v0) / span) * (w - PAD_L - PAD_R);
  const mid = height * 0.46;

  const marks = useMemo(() => {
    const out: { ev: ReplayEvent; dt: number; kind: "ok" | "err" | "back" | "sep" }[] = [];
    let prevT = 0;
    for (const ev of events) {
      const dt = ev.t - prevT;
      prevT = ev.t;
      if (ev.kind === "back") out.push({ ev, dt, kind: "back" });
      else if (!ev.correct) out.push({ ev, dt, kind: "err" });
      else if (ev.kind === "sep") out.push({ ev, dt, kind: "sep" });
      else out.push({ ev, dt, kind: "ok" });
    }
    return out;
  }, [events]);

  const pauses = useMemo(() => {
    const out: { from: number; to: number }[] = [];
    for (let i = 1; i < events.length; i++) {
      if (events[i].t - events[i - 1].t >= 700) out.push({ from: events[i - 1].t, to: events[i].t });
    }
    return out;
  }, [events]);

  const visible = marks.filter((m) => m.ev.t >= v0 - 50 && m.ev.t <= v1 + 50);
  const zoomed = zoom !== null;

  const toMs = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return v0 + ((clientX - r.left - PAD_L) / Math.max(1, r.width - PAD_L - PAD_R)) * span;
  };

  // second ticks
  const step = span > 60000 ? 10000 : span > 20000 ? 5000 : span > 6000 ? 1000 : span > 2000 ? 500 : 100;
  const ticks: number[] = [];
  for (let t = Math.ceil(v0 / step) * step; t <= v1; t += step) ticks.push(t);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[0.68rem] text-sub">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px bg-fg" /> keystroke
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-4 w-px bg-accent" /> word end
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-bold text-err">×</span> error
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-accent2">↶</span> correction
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 bg-bg3" /> pause ≥ 0.7s
          </span>
        </div>
        {zoomed ? (
          <button onClick={() => setView(null)} className="press text-accent hover:text-fg">
            reset zoom
          </button>
        ) : (
          <span className="text-faint">drag across the map to zoom</span>
        )}
      </div>
      <div
        ref={wrap}
        className="relative w-full cursor-crosshair select-none overflow-hidden border-y border-line"
        style={{ height }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const t = toMs(e.clientX);
          setDrag({ a: t, b: t });
        }}
        onPointerMove={(e) => {
          if (drag) setDrag({ ...drag, b: toMs(e.clientX) });
          else {
            const t = toMs(e.clientX);
            let best: (typeof visible)[number] | null = null;
            for (const m of visible) if (!best || Math.abs(m.ev.t - t) < Math.abs(best.ev.t - t)) best = m;
            if (best && Math.abs(x(best.ev.t) - x(t)) < 12) setHover({ x: x(best.ev.t), ev: best.ev, dt: best.dt });
            else setHover(null);
          }
        }}
        onPointerUp={() => {
          if (drag) {
            const a = Math.max(0, Math.min(drag.a, drag.b));
            const b = Math.min(endMs, Math.max(drag.a, drag.b));
            if (b - a > 80) setView([a, b]);
          }
          setDrag(null);
        }}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={() => setView(null)}
        role="img"
        aria-label={`Rhythm map of ${events.length} keystrokes over ${(endMs / 1000).toFixed(1)} seconds`}
      >
        <svg width={w} height={height} className="absolute inset-0">
          {pauses.map((p, i) =>
            x(p.to) < 0 || x(p.from) > w ? null : (
              <g key={i}>
                <rect x={x(p.from)} y={8} width={Math.max(1, x(p.to) - x(p.from))} height={height - 30} fill="var(--bg-3)" opacity={0.7} />
                {x(p.to) - x(p.from) > 34 && (
                  <text x={(x(p.from) + x(p.to)) / 2} y={20} textAnchor="middle" className="fill-[var(--sub)] font-mono text-[10px]">
                    {((p.to - p.from) / 1000).toFixed(1)}s
                  </text>
                )}
              </g>
            ),
          )}
          <line x1={0} x2={w} y1={mid} y2={mid} stroke="var(--line)" />
          {visible.map((m, i) => {
            const px = x(m.ev.t);
            if (m.kind === "ok") return <line key={i} x1={px} x2={px} y1={mid - 12} y2={mid + 12} stroke="var(--fg)" strokeOpacity={0.55} strokeWidth={1} />;
            if (m.kind === "sep") return <line key={i} x1={px} x2={px} y1={mid - 20} y2={mid + 14} stroke="var(--accent)" strokeWidth={1.5} />;
            if (m.kind === "err")
              return (
                <path key={i} d={`M${px - 4} ${mid - 30} l8 8 m0 -8 l-8 8`} stroke="var(--error)" strokeWidth={2} strokeLinecap="round" />
              );
            // correction: small arc sweeping backwards under the line
            const r = Math.max(5, Math.min(18, (8 / span) * 20000));
            return <path key={i} d={`M${px} ${mid + 14} q ${-r / 2} ${r} ${-r} 0`} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} />;
          })}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={height - 18} y2={height - 12} stroke="var(--faint)" />
              <text x={x(t)} y={height - 2} textAnchor="middle" className="fill-[var(--faint)] font-mono text-[10px]">
                {step < 1000 ? (t / 1000).toFixed(1) : Math.round(t / 1000)}s
              </text>
            </g>
          ))}
          {playhead !== undefined && playhead > 0 && x(playhead) >= 0 && x(playhead) <= w && (
            <line x1={x(playhead)} x2={x(playhead)} y1={0} y2={height - 18} stroke="var(--accent)" strokeWidth={2} />
          )}
          {drag && <rect x={Math.min(x(drag.a), x(drag.b))} y={0} width={Math.abs(x(drag.b) - x(drag.a))} height={height - 18} fill="var(--accent)" opacity={0.12} />}
        </svg>
        {hover && !drag && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap border border-line bg-bg2 px-2 py-1 font-mono text-[0.68rem] text-fg"
            style={{ left: Math.max(40, Math.min(w - 40, hover.x)), borderRadius: "var(--radius)" }}
          >
            {hover.ev.kind === "back" ? "⌫" : hover.ev.key === " " ? "␣" : hover.ev.key === "\n" ? "↵" : hover.ev.key} · {(hover.ev.t / 1000).toFixed(2)}s · +{hover.dt}ms
            {!hover.ev.correct && hover.ev.kind !== "back" ? <span className="text-err"> · miss</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}
