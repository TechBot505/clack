"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Fingerprint } from "@/lib/fingerprint";
import { LAYOUTS, ROW_OFFSET } from "@/lib/keyboard";
import { useSettings } from "@/stores/settings";

/** Radar of eight behavioural axes. Every vertex carries its number in a tooltip. */
function Radar({ axes }: { axes: Fingerprint["axes"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const S = 320;
  const c = S / 2;
  const R = S * 0.36;
  const pt = (i: number, v: number) => {
    const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    return { x: c + Math.cos(a) * R * v, y: c + Math.sin(a) * R * v };
  };
  const poly = axes.map((a, i) => pt(i, Math.max(0.04, a.value))).map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[380px]" role="img" aria-label={`Typing fingerprint radar: ${axes.map((a) => `${a.label} ${Math.round(a.value * 100)}`).join(", ")}`}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon key={r} points={axes.map((_, i) => pt(i, r)).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--line)" />
        ))}
        {axes.map((_, i) => {
          const p = pt(i, 1);
          return <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="var(--line)" />;
        })}
        <motion.polygon
          points={poly}
          fill="color-mix(in oklab, var(--accent) 22%, transparent)"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: "50% 50%" }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
        />
        {axes.map((a, i) => {
          const p = pt(i, Math.max(0.04, a.value));
          const l = pt(i, 1.2);
          return (
            <g key={a.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
              <circle cx={p.x} cy={p.y} r={hover === i ? 6 : 4} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" className="fill-[var(--sub)] font-mono text-[10px]">
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="h-5 text-center font-mono text-xs text-sub">
        {hover !== null ? (
          <>
            <span className="text-fg">{axes[hover].label}</span> · {axes[hover].hint}
          </>
        ) : (
          "hover a point"
        )}
      </div>
    </div>
  );
}

/** Keys as stars: brightness = speed, red halo = error rate, lines = frequent transitions. */
function Constellation({ fp }: { fp: Fingerprint }) {
  const layout = useSettings((s) => s.keyboardLayout);
  const [sel, setSel] = useState<string | null>(null);
  const W = 640;
  const H = 250;
  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    LAYOUTS[layout].slice(1).forEach((row, ri) => {
      row.forEach((k, ki) => {
        p[k] = { x: 40 + (ki + ROW_OFFSET[ri + 1]) * 44, y: 50 + ri * 72 };
      });
    });
    return p;
  }, [layout]);
  const stats = fp.keyStats;
  const msList = Object.entries(stats).filter(([k, s]) => pos[k] && s[0] > 5).map(([, s]) => s[2] / s[0]);
  const fast = Math.min(...msList, 999);
  const slow = Math.max(...msList, 1);
  const lines = Object.entries(fp.bigrams)
    .filter(([k]) => pos[k[0]] && pos[k[1]] && k[0] !== k[1])
    .sort((a, b) => b[1][0] - a[1][0])
    .slice(0, 22);
  const maxLine = lines[0]?.[1][0] ?? 1;

  const detail = sel ? stats[sel] : undefined;
  const before = sel
    ? Object.entries(fp.bigrams).filter(([k]) => k[1] === sel && /[a-z]/.test(k[0])).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4).map(([k]) => k[0])
    : [];
  const after = sel
    ? Object.entries(fp.bigrams).filter(([k]) => k[0] === sel && /[a-z]/.test(k[1])).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4).map(([k]) => k[1])
    : [];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Key constellation">
        {lines.map(([k, s]) => {
          const a = pos[k[0]];
          const b = pos[k[1]];
          const hot = sel && (k[0] === sel || k[1] === sel);
          return (
            <line
              key={k}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={hot ? "var(--accent)" : "var(--fg)"}
              strokeOpacity={hot ? 0.8 : 0.1 + 0.25 * (s[0] / maxLine)}
              strokeWidth={0.6 + 2 * (s[0] / maxLine)}
            />
          );
        })}
        {Object.entries(pos).map(([k, p]) => {
          const s = stats[k];
          const n = s ? s[0] + s[1] : 0;
          const ms = s && s[0] ? s[2] / s[0] : slow;
          const bright = n > 5 ? 1 - (ms - fast) / Math.max(1, slow - fast) : 0;
          const err = n ? s![1] / n : 0;
          return (
            <g key={k} onClick={() => setSel(sel === k ? null : k)} className="cursor-pointer" role="button" aria-label={`${k}: ${n} presses`}>
              {err > 0.03 && <circle cx={p.x} cy={p.y} r={Math.min(20, 9 + err * 60)} fill="var(--error)" opacity={Math.min(0.35, 0.1 + err * 1.5)} />}
              <circle cx={p.x} cy={p.y} r={3 + bright * 7} fill="var(--accent)" opacity={n > 5 ? 0.35 + bright * 0.65 : 0.12} style={{ filter: bright > 0.7 ? "drop-shadow(0 0 6px var(--accent))" : undefined }} />
              {sel === k && <circle cx={p.x} cy={p.y} r={16} fill="none" stroke="var(--fg)" strokeWidth={1.5} />}
              <text x={p.x} y={p.y + 24} textAnchor="middle" className="fill-[var(--faint)] font-mono text-[10px]">
                {k}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 min-h-[2.5rem] font-mono text-xs text-sub" aria-live="polite">
        {sel && detail ? (
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="text-lg text-fg">{sel}</span>
            <span>
              <span className="text-fg">{Math.round(detail[2] / Math.max(1, detail[0]))} ms</span> avg response
            </span>
            <span>
              <span className="text-fg">{((detail[1] / Math.max(1, detail[0] + detail[1])) * 100).toFixed(1)}%</span> error rate
            </span>
            {before.length > 0 && (
              <span>
                often after <span className="text-fg">{before.join(" ")}</span>
              </span>
            )}
            {after.length > 0 && (
              <span>
                often before <span className="text-fg">{after.join(" ")}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-faint">brighter = faster · red halo = more errors · lines = frequent transitions · click a key</span>
        )}
      </div>
    </div>
  );
}

function Trait({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="border-t border-line pt-3">
      <div className="label">{label}</div>
      <div className="mt-1 font-mono text-lg text-fg">{value}</div>
      {sub && <div className="font-mono text-[0.65rem] text-faint">{sub}</div>}
    </div>
  );
}

function Chips({ items }: { items: { k: string; v: string }[] }) {
  if (!items.length) return <span className="font-mono text-xs text-faint">not enough data yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i.k} className="border border-line px-2 py-0.5 font-mono text-xs text-sub" style={{ borderRadius: "var(--radius)" }}>
          <span className="text-fg">{i.k}</span> {i.v}
        </span>
      ))}
    </div>
  );
}

export function FingerprintView({ fp }: { fp: Fingerprint }) {
  const bestHour = fp.byHour.filter((h) => h.n >= 2).sort((a, b) => b.wpm - a.wpm)[0];
  const lens = fp.byWordLength.filter((b) => b.n).map((b) => b.wpm);
  const maxLen = Math.max(1, ...lens);
  const minLen = lens.length ? Math.min(...lens) : 0;
  // scale from just below the slowest bucket so differences are visible (numbers are printed on top)
  const barPct = (v: number) => (maxLen === minLen ? 70 : 18 + ((v - minLen) / (maxLen - minLen)) * 82);
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Radar axes={fp.axes} />
        <Constellation fp={fp} />
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        <Trait label="backspace rate" value={`${fp.backspaceRate.toFixed(1)}`} sub="per 100 keystrokes" />
        <Trait label="correction time" value={fp.correctionMs ? `${Math.round(fp.correctionMs)} ms` : "–"} sub="mistake → first backspace" />
        <Trait label="average pause" value={fp.pauseMs ? `${(fp.pauseMs / 1000).toFixed(1)} s` : "–"} sub={`${fp.pausesPerMinute.toFixed(1)} pauses per minute`} />
        <Trait label="burst length" value={fp.burstLength ? `${fp.burstLength.toFixed(1)} keys` : "–"} sub="runs faster than your median" />
        <Trait label="with punctuation" value={fp.punctuation.with ? `${fp.punctuation.with.toFixed(0)} wpm` : "–"} sub={fp.punctuation.without ? `${fp.punctuation.without.toFixed(0)} wpm without` : undefined} />
        <Trait
          label="capitals"
          value={fp.capitals.upperMs ? `+${Math.max(0, Math.round(fp.capitals.upperMs - fp.capitals.lowerMs))} ms` : "–"}
          sub="extra time per capital letter"
        />
        <Trait label="best hour" value={bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "–"} sub={bestHour ? `${bestHour.wpm.toFixed(0)} wpm average` : undefined} />
        <Trait label="consistency" value={`${fp.consistency.toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="label mb-2">most mistyped letters</div>
          <Chips items={fp.mistypedLetters.map((m) => ({ k: m.key, v: `${(m.rate * 100).toFixed(1)}%` }))} />
          <div className="label mb-2 mt-5">most mistyped pairs</div>
          <Chips items={fp.mistypedPairs.map((m) => ({ k: m.pair, v: `${(m.rate * 100).toFixed(1)}%` }))} />
          <div className="label mb-2 mt-5">slowest keys</div>
          <Chips items={fp.slowestKeys.map((m) => ({ k: m.key, v: `${Math.round(m.ms)}ms` }))} />
          <div className="label mb-2 mt-5">strongest keys</div>
          <Chips items={fp.strongestKeys.map((m) => ({ k: m.key, v: `${Math.round(m.ms)}ms` }))} />
          <div className="label mb-2 mt-5">slowest words</div>
          <Chips items={fp.slowestWords.map((w) => ({ k: w.word, v: `${Math.round(w.wpm)}` }))} />
        </div>
        <div>
          <div className="label mb-3">speed by word length</div>
          <div className="flex h-40 items-end gap-2">
            {fp.byWordLength.map((b) => (
              <div key={b.len} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${b.len} letters: ${b.wpm.toFixed(0)} wpm (${b.n} words)`}>
                <span className="font-mono text-[0.65rem] text-sub">{b.n ? Math.round(b.wpm) : ""}</span>
                <motion.div
                  className="w-full bg-accent"
                  style={{ borderRadius: "4px 4px 0 0", opacity: b.n ? 1 : 0.15 }}
                  initial={{ height: 0 }}
                  animate={{ height: `${b.n ? barPct(b.wpm) : 4}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                />
                <span className="font-mono text-[0.65rem] text-faint">{b.len}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 text-center font-mono text-[0.62rem] text-faint">letters per word → equivalent wpm (bars start near your slowest length)</div>
        </div>
      </div>
    </div>
  );
}
