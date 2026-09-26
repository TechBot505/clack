"use client";

import { useId, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { Download, ImageDown } from "lucide-react";
import { buildDna } from "@/lib/dna";
import type { Fingerprint } from "@/lib/fingerprint";

/** Renders a DNA shape with theme colors (live) — also the source for exports. */
export function DnaArt({ fp, seed, size = 600, animate = true, className = "", label }: { fp: Fingerprint; seed: string; size?: number; animate?: boolean; className?: string; label?: string }) {
  const shape = useMemo(() => buildDna(fp, seed, size), [fp, seed, size]);
  const id = useId().replace(/:/g, "");
  const draw = animate ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 } } : {};
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={label ?? "Typing DNA artwork"}>
      <defs>
        <linearGradient id={`g1${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
        <linearGradient id={`g2${id}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent-3)" />
        </linearGradient>
        <radialGradient id={`glow${id}`}>
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={size * 0.48} fill={`url(#glow${id})`} />
      {shape.chords.map((ch, i) => (
        <motion.path key={`c${i}`} d={ch.d} fill="none" stroke="var(--fg)" strokeOpacity={0.22} strokeWidth={ch.w} strokeLinecap="round" {...draw} transition={{ duration: 1.2, delay: 0.6 + i * 0.03 }} />
      ))}
      {shape.dots.map((d, i) => (
        <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill="var(--fg)" opacity={d.o * 0.7} />
      ))}
      {shape.rungs.map((r, i) => (
        <motion.line
          key={`r${i}`}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke={r.weak ? "var(--error)" : "var(--fg)"}
          strokeOpacity={r.weak ? 0.8 : r.o * 0.45}
          strokeWidth={r.weak ? 2 : 1.2}
          strokeLinecap="round"
          initial={animate ? { opacity: 0 } : undefined}
          animate={animate ? { opacity: 1 } : undefined}
          transition={{ delay: 0.9 + i * 0.012 }}
        />
      ))}
      <motion.path d={shape.strandA} fill="none" stroke={`url(#g1${id})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...draw} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} />
      <motion.path d={shape.strandB} fill="none" stroke={`url(#g2${id})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" {...draw} transition={{ duration: 1.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} />
      {shape.flares.map((f, i) => (
        <line key={`f${i}`} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
      ))}
      {shape.curls.map((c, i) => (
        <path key={`k${i}`} d={c.d} fill="none" stroke="var(--error)" strokeWidth={1.8} strokeLinecap="round" opacity={0.75} />
      ))}
      <circle cx={size / 2} cy={size / 2} r={3} fill="var(--accent)" />
    </svg>
  );
}

/** Replace CSS variables with concrete colors so the SVG works outside the page. */
function resolveSvg(svg: SVGSVGElement, withBackground: boolean): string {
  const css = getComputedStyle(document.documentElement);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  let out = new XMLSerializer().serializeToString(clone);
  out = out.replace(/var\((--[a-z0-9-]+)\)/gi, (_, v: string) => css.getPropertyValue(v).trim() || "#888");
  if (withBackground) {
    const bg = css.getPropertyValue("--bg").trim();
    const size = svg.viewBox.baseVal.width;
    out = out.replace(/(<svg[^>]*>)/, `$1<rect width="${size}" height="${size}" fill="${bg}"/>`);
  }
  if (!out.includes('xmlns="http://www.w3.org/2000/svg"')) out = out.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return out;
}

export function DnaExport({ targetRef, name }: { targetRef: React.RefObject<HTMLDivElement | null>; name: string }) {
  const getSvg = () => targetRef.current?.querySelector("svg") as SVGSVGElement | null;
  const download = (href: string, file: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = file;
    a.click();
  };
  const svgOut = () => {
    const svg = getSvg();
    if (!svg) return;
    const blob = new Blob([resolveSvg(svg, true)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    download(url, `typing-dna-${name}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const pngOut = () => {
    const svg = getSvg();
    if (!svg) return;
    const img = new Image();
    const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(resolveSvg(svg, true))}`;
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = 2048;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 2048, 2048);
      const css = getComputedStyle(document.documentElement);
      ctx.fillStyle = css.getPropertyValue("--sub").trim() || "#888";
      ctx.font = `500 34px "Geist Mono Variable", monospace`;
      ctx.fillText("typing dna · clack.", 64, 2048 - 64);
      download(c.toDataURL("image/png"), `typing-dna-${name}.png`);
    };
    img.src = data;
  };
  return (
    <div className="flex gap-2">
      <button onClick={pngOut} className="press inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
        <ImageDown size={13} /> png
      </button>
      <button onClick={svgOut} className="press inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
        <Download size={13} /> svg
      </button>
    </div>
  );
}

const LEGEND: [string, string][] = [
  ["twists", "speed"],
  ["strand jitter", "rhythm (less jitter = steadier)"],
  ["swelling", "your fastest letters"],
  ["rung density", "accuracy"],
  ["red rungs & curls", "error-prone letters and corrections"],
  ["gaps", "long pauses"],
  ["flares", "burst keys"],
  ["inner web", "your most common letter transitions"],
];

export function TypingDNA({ fp, seed, history }: { fp: Fingerprint; seed: string; history: { label: string; fp: Fingerprint }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[560px]">
        <DnaArt fp={fp} seed={seed} className="h-full w-full" />
      </div>
      <div>
        <p className="max-w-md text-sub">
          A portrait generated from {fp.tests} tests{fp.replayed ? ` and ${fp.replayed} replayed keystroke timelines` : ""}. Nobody else types quite like this, and it changes as you do.
        </p>
        <dl className="mt-6 grid grid-cols-1 gap-y-2 font-mono text-xs sm:grid-cols-2">
          {LEGEND.map(([a, b]) => (
            <div key={a} className="flex gap-2">
              <dt className="text-fg">{a}</dt>
              <dd className="text-faint">{b}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <DnaExport targetRef={ref} name={seed.slice(0, 12)} />
        </div>
        {history.length > 1 && (
          <div className="mt-8">
            <div className="label mb-3">how it evolved</div>
            <div className="flex flex-wrap gap-3">
              {history.map((h) => (
                <div key={h.label} className="text-center">
                  <div className="h-20 w-20 border border-line bg-bg2/50" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
                    <DnaArt fp={h.fp} seed={seed} size={600} animate={false} className="h-full w-full" label={`Typing DNA as of ${h.label}`} />
                  </div>
                  <div className="mt-1 font-mono text-[0.62rem] text-faint">{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
