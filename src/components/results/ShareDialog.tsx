"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Check, Copy, Download, Share, X } from "lucide-react";
import type { PbImprovement, TestRecord } from "@/lib/records";
import { describeTest, fmtDate } from "@/lib/format";
import { useClientAuth } from "@/lib/auth-client";

type CardStyle = "poster" | "terminal" | "paper";
type CardFormat = "landscape" | "square" | "story";

const FORMATS: Record<CardFormat, { w: number; h: number; label: string }> = {
  landscape: { w: 1200, h: 630, label: "wide · X / LinkedIn / Discord" },
  square: { w: 1080, h: 1080, label: "square" },
  story: { w: 1080, h: 1920, label: "story" },
};

interface CardData {
  wpm: number;
  acc: number;
  raw: number;
  consistency: number;
  label: string;
  date: string;
  pb: number | null;
  isPb: boolean;
  series: number[];
  name: string | null;
}

function css(v: string, fb: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;
}

function sparkline(ctx: CanvasRenderingContext2D, series: number[], x: number, y: number, w: number, h: number, color: string, width = 4) {
  if (series.length < 2) return;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  ctx.beginPath();
  series.forEach((v, i) => {
    const px = x + (i / (series.length - 1)) * w;
    const py = y + h - ((v - min) / (max - min || 1)) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function drawPoster(ctx: CanvasRenderingContext2D, W: number, H: number, d: CardData) {
  const bg = css("--bg", "#0f0f10");
  const fg = css("--fg", "#ecebe6");
  const sub = css("--sub", "#8b8984");
  const accent = css("--accent", "#ff6b3d");
  const line = css("--line", "#262627");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // glow
  const g = ctx.createRadialGradient(W * 0.85, H * 0.1, 10, W * 0.85, H * 0.1, W * 0.8);
  g.addColorStop(0, accent + "33");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // dot grid
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.06;
  for (let y = 24; y < H; y += 36) for (let x = 24; x < W; x += 36) ctx.fillRect(x, y, 2, 2);
  ctx.globalAlpha = 1;

  const pad = W * 0.07;
  const tall = H > W;
  ctx.fillStyle = sub;
  ctx.font = `500 ${W * 0.022}px "Geist Mono Variable", monospace`;
  ctx.fillText(d.label.toUpperCase(), pad, pad + W * 0.02);
  if (d.isPb) {
    ctx.fillStyle = accent;
    ctx.fillText(`PERSONAL BEST${d.pb !== null ? `  ↑ ${Math.round(d.pb)}` : ""}`, pad, pad + W * 0.055);
  }

  const big = tall ? W * 0.42 : H * 0.52;
  ctx.fillStyle = fg;
  ctx.font = `800 ${big}px "Bricolage Grotesque Variable", sans-serif`;
  const wpmStr = String(Math.round(d.wpm));
  const baseY = tall ? H * 0.52 : H * 0.72;
  ctx.fillText(wpmStr, pad - big * 0.04, baseY);
  const wpmW = ctx.measureText(wpmStr).width;
  ctx.fillStyle = sub;
  ctx.font = `italic 400 ${big * 0.22}px "Fraunces Variable", serif`;
  ctx.fillText("wpm", pad + wpmW + big * 0.05, baseY - big * 0.08);

  // stats row
  const rowY = tall ? baseY + W * 0.16 : baseY + H * 0.14;
  const stats: [string, string][] = [
    [`${d.acc % 1 === 0 ? d.acc.toFixed(0) : d.acc.toFixed(1)}%`, "accuracy"],
    [String(Math.round(d.raw)), "raw"],
    [`${Math.round(d.consistency)}%`, "consistency"],
  ];
  const colW = (W - pad * 2) / 3;
  stats.forEach(([v, l], i) => {
    const x = pad + i * colW;
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, rowY - W * 0.05);
    ctx.lineTo(x + colW - W * 0.02, rowY - W * 0.05);
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.font = `600 ${W * 0.045}px "Bricolage Grotesque Variable", sans-serif`;
    ctx.fillText(v, x, rowY);
    ctx.fillStyle = sub;
    ctx.font = `500 ${W * 0.017}px "Geist Mono Variable", monospace`;
    ctx.fillText(l.toUpperCase(), x, rowY + W * 0.03);
  });

  if (tall) sparkline(ctx, d.series, pad, H * 0.72, W - pad * 2, H * 0.12, accent, 6);
  else sparkline(ctx, d.series, W * 0.62, pad * 0.9, W * 0.3, H * 0.18, accent, 4);

  // footer
  ctx.fillStyle = fg;
  ctx.font = `700 ${W * 0.038}px "Bricolage Grotesque Variable", sans-serif`;
  const fy = H - pad * 0.8;
  ctx.fillText("clack", pad, fy);
  const lw = ctx.measureText("clack").width;
  ctx.fillStyle = accent;
  ctx.fillText(".", pad + lw, fy);
  ctx.fillStyle = sub;
  ctx.font = `500 ${W * 0.018}px "Geist Mono Variable", monospace`;
  const right = d.name ? `${d.name} · ${d.date}` : d.date;
  ctx.fillText(right, W - pad - ctx.measureText(right).width, fy);
  noise(ctx, W, H, 0.05);
}

function drawTerminal(ctx: CanvasRenderingContext2D, W: number, H: number, d: CardData) {
  const green = "#39ff14";
  ctx.fillStyle = "#050805";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = green;
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;
  const pad = W * 0.07;
  const fs = W * (H > W ? 0.042 : 0.03);
  ctx.font = `500 ${fs}px "JetBrains Mono Variable", monospace`;
  ctx.shadowColor = green;
  ctx.shadowBlur = 12;
  const lines = [
    `$ clack --result`,
    ``,
    `  test ........ ${d.label}`,
    `  wpm ......... ${Math.round(d.wpm)}${d.isPb ? "   [NEW PB" + (d.pb !== null ? ` +${Math.round(d.pb)}` : "") + "]" : ""}`,
    `  accuracy .... ${d.acc.toFixed(d.acc % 1 === 0 ? 0 : 1)}%`,
    `  raw ......... ${Math.round(d.raw)}`,
    `  consistency . ${Math.round(d.consistency)}%`,
    ``,
    `$ exit 0  # ${d.date}${d.name ? ` · ${d.name}` : ""}`,
  ];
  let y = pad + fs;
  for (const l of lines) {
    ctx.fillStyle = l.startsWith("$") ? "#b7ffb0" : green;
    ctx.fillText(l, pad, y);
    y += fs * 1.6;
  }
  ctx.shadowBlur = 0;
  // big ascii number
  ctx.font = `800 ${H > W ? W * 0.3 : H * 0.34}px "JetBrains Mono Variable", monospace`;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = green;
  const s = String(Math.round(d.wpm));
  ctx.fillText(s, W - pad - ctx.measureText(s).width, H - pad);
  ctx.globalAlpha = 1;
  sparkline(ctx, d.series, pad, H - pad - H * 0.1, W * 0.4, H * 0.08, green, 3);
}

function drawPaper(ctx: CanvasRenderingContext2D, W: number, H: number, d: CardData) {
  const ink = "#2b2622";
  const red = "#b3372b";
  ctx.fillStyle = "#f2ecdf";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#2d5d7b22";
  ctx.lineWidth = 2;
  for (let y = 80; y < H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = red + "66";
  ctx.beginPath();
  ctx.moveTo(W * 0.1, 0);
  ctx.lineTo(W * 0.1, H);
  ctx.stroke();
  const pad = W * 0.16;
  const tall = H > W;
  ctx.fillStyle = ink;
  ctx.font = `italic 400 ${W * 0.035}px "Fraunces Variable", serif`;
  ctx.fillText("I typed", pad, tall ? H * 0.3 : H * 0.28);
  const big = tall ? W * 0.36 : H * 0.42;
  ctx.font = `600 ${big}px "Fraunces Variable", serif`;
  const n = String(Math.round(d.wpm));
  ctx.fillText(n, pad, (tall ? H * 0.3 : H * 0.28) + big * 0.95);
  const nw = ctx.measureText(n).width;
  ctx.fillStyle = red;
  ctx.font = `italic 400 ${big * 0.25}px "Fraunces Variable", serif`;
  ctx.fillText("words a minute", pad + nw + big * 0.06, (tall ? H * 0.3 : H * 0.28) + big * 0.9);
  ctx.fillStyle = ink;
  ctx.font = `italic 400 ${W * 0.03}px "Fraunces Variable", serif`;
  const tail = `with ${d.acc.toFixed(d.acc % 1 === 0 ? 0 : 1)}% accuracy — ${d.label}.`;
  ctx.fillText(tail, pad, (tall ? H * 0.3 : H * 0.28) + big * 1.25);
  if (d.isPb) {
    ctx.save();
    ctx.translate(W - pad * 0.9, tall ? H * 0.18 : H * 0.22);
    ctx.rotate(-0.18);
    ctx.strokeStyle = red;
    ctx.lineWidth = 4;
    ctx.strokeRect(-W * 0.12, -W * 0.035, W * 0.24, W * 0.07);
    ctx.fillStyle = red;
    ctx.font = `700 ${W * 0.026}px "Geist Mono Variable", monospace`;
    const t = d.pb !== null ? `NEW BEST +${Math.round(d.pb)}` : "NEW BEST";
    ctx.fillText(t, -ctx.measureText(t).width / 2, W * 0.01);
    ctx.restore();
  }
  ctx.fillStyle = ink;
  ctx.font = `600 ${W * 0.032}px "Fraunces Variable", serif`;
  ctx.fillText("clack.", pad, H - W * 0.06);
  ctx.fillStyle = "#7a6f62";
  ctx.font = `italic 400 ${W * 0.02}px "Fraunces Variable", serif`;
  const r = d.name ? `${d.name}, ${d.date}` : d.date;
  ctx.fillText(r, W - W * 0.06 - ctx.measureText(r).width, H - W * 0.06);
  noise(ctx, W, H, 0.07);
}

export function ShareDialog({ record, pbs, onClose }: { record: TestRecord; pbs: PbImprovement[]; onClose: () => void }) {
  const [style, setStyle] = useState<CardStyle>("poster");
  const [format, setFormat] = useState<CardFormat>("landscape");
  const [showName, setShowName] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const auth = useClientAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { w, h } = FORMATS[format];
      const c = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = c;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      try {
        await Promise.all([
          document.fonts.load(`800 100px "Bricolage Grotesque Variable"`),
          document.fonts.load(`italic 400 100px "Fraunces Variable"`),
          document.fonts.load(`600 100px "Fraunces Variable"`),
          document.fonts.load(`500 20px "Geist Mono Variable"`),
          document.fonts.load(`500 20px "JetBrains Mono Variable"`),
        ]);
      } catch {
        /* fall back to system fonts */
      }
      const best = pbs.find((p) => p.previous !== null);
      const data: CardData = {
        wpm: record.wpm,
        acc: record.accuracy,
        raw: record.raw,
        consistency: record.consistency,
        label: describeTest(record).split(" · ").slice(0, 2).join(" · ").replace(/^time (\d+)/, "$1 sec").replace(/^words (\d+)/, "$1 words"),
        date: fmtDate(record.createdAt),
        pb: best ? best.wpm - (best.previous ?? 0) : null,
        isPb: pbs.length > 0,
        series: record.samples.wpm,
        name: showName ? auth.name : null,
      };
      if (style === "poster") drawPoster(ctx, w, h, data);
      else if (style === "terminal") drawTerminal(ctx, w, h, data);
      else drawPaper(ctx, w, h, data);
      if (!cancelled) setUrl(c.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
  }, [style, format, showName, record, pbs, auth.name]);

  const blob = () => new Promise<Blob | null>((res) => canvasRef.current?.toBlob(res, "image/png") ?? res(null));
  const fileName = `clack-${Math.round(record.wpm)}wpm.png`;

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };
  const copy = async () => {
    const b = await blob();
    if (!b || !navigator.clipboard || typeof ClipboardItem === "undefined") return download();
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      download();
    }
  };
  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "clack.", text: `${Math.round(record.wpm)} wpm on clack.` }).catch(() => {});
    } else download();
  };

  const seg = (active: boolean) =>
    `press px-3 py-1.5 font-mono text-[0.72rem] ${active ? "bg-fg text-bg" : "text-sub hover:text-fg"}`;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Share result">
      <motion.div className="absolute inset-0 bg-bg/80 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto border border-line bg-bg2 p-5"
        style={{ borderRadius: "calc(var(--radius) + 6px)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="label">share card</div>
            <div className="font-display text-2xl font-semibold">Show off, quietly.</div>
          </div>
          <button onClick={onClose} className="press grid h-9 w-9 place-items-center text-sub hover:text-fg" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid place-items-center bg-bg p-3" style={{ borderRadius: "var(--radius)" }}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Share card preview" className="max-h-[50vh] w-auto max-w-full shadow-2xl" />
          ) : (
            <div className="h-48 w-full animate-pulse bg-bg3" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden border border-line" style={{ borderRadius: "var(--radius)" }} role="radiogroup" aria-label="Style">
            {(["poster", "terminal", "paper"] as CardStyle[]).map((s) => (
              <button key={s} role="radio" aria-checked={style === s} onClick={() => setStyle(s)} className={seg(style === s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden border border-line" style={{ borderRadius: "var(--radius)" }} role="radiogroup" aria-label="Format">
            {(Object.keys(FORMATS) as CardFormat[]).map((f) => (
              <button key={f} role="radio" aria-checked={format === f} onClick={() => setFormat(f)} className={seg(format === f)} title={FORMATS[f].label}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {auth.signedIn ? (
            <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-sub">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="accent-[var(--accent)]" />
              show my name
            </label>
          ) : (
            <span className="font-mono text-xs text-faint">no username on the card. ever, unless you want it.</span>
          )}
          <div className="flex gap-2">
            <button onClick={copy} className="press inline-flex items-center gap-2 border border-line px-3.5 py-2 font-mono text-[0.75rem] text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "copied" : "copy"}
            </button>
            <button onClick={download} className="press inline-flex items-center gap-2 border border-line px-3.5 py-2 font-mono text-[0.75rem] text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
              <Download size={14} /> png
            </button>
            <button onClick={share} className="press inline-flex items-center gap-2 bg-accent px-3.5 py-2 font-mono text-[0.75rem] text-on-accent" style={{ borderRadius: "var(--radius)" }}>
              <Share size={14} /> share
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
