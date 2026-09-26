"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, type Variants } from "motion/react";
import { ArrowRight, Film, Repeat2, Share2, Sparkles, LogIn } from "lucide-react";
import type { RunResult } from "@/engine/analyze";
import type { PbImprovement, TestRecord } from "@/lib/records";
import { codeErrors, generateInsights } from "@/engine/insights";
import { categoryLabel } from "@/engine/config";
import { describeTest, fmtDuration, sourceLine } from "@/lib/format";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { KeyboardHeatmap } from "@/components/KeyboardHeatmap";
import { Confetti } from "./Confetti";
import { WpmChart } from "./WpmChart";
import { playSound } from "@/lib/sound";
import { useSettings } from "@/stores/settings";
import { useClientAuth } from "@/lib/auth-client";
import { FavoriteButton } from "./FavoriteButton";

const ShareDialog = dynamic(() => import("./ShareDialog").then((m) => m.ShareDialog), { ssr: false });

export interface ResultsViewProps {
  record: TestRecord;
  result: RunResult;
  pbs: PbImprovement[];
  history: TestRecord[];
  cinematic?: boolean;
  /** first test ever on this device → gentle save prompt */
  firstTest?: boolean;
  onNext?: () => void;
  onRepeat?: () => void;
  replayHref?: string;
}

export function ResultsView({ record, result, pbs, history, cinematic = false, firstTest = false, onNext, onRepeat, replayHref }: ResultsViewProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const auth = useClientAuth();
  const insights = useMemo(() => generateInsights(result, record, history), [result, record, history]);
  const isPb = pbs.length > 0;
  const gain = (p: PbImprovement) => (p.previous === null ? 0 : p.wpm - p.previous);
  const bestPb = pbs.length ? [...pbs].sort((a, b) => gain(b) - gain(a))[0] : null;
  const perfect = record.accuracy === 100 && record.keystrokes >= 20;
  const hyper = record.wpm >= 150;
  const slow = cinematic ? 1.8 : 1;

  useEffect(() => {
    const s = useSettings.getState();
    const t = setTimeout(() => playSound(isPb ? "pb" : "finish", s.soundPack, s.volume), 250 * slow);
    return () => clearTimeout(t);
  }, [isPb, slow]);

  // share shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]")) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "s" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShareOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09 * slow, delayChildren: 0.05 * slow } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7 * slow, ease: [0.16, 1, 0.3, 1] } },
  };

  const cpm = record.durationMs > 0 ? ((record.correct + record.extra + record.incorrect) / record.durationMs) * 60000 : 0;
  const src = sourceLine(record);
  const zen = record.mode === "zen";

  return (
    <motion.section variants={container} initial="hidden" animate="show" className="relative mx-auto w-full max-w-[1200px]" aria-label="Test results">
      {isPb && <Confetti />}

      <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* hero number */}
        <motion.div variants={item} className="relative">
          <div className="label flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-accent">result</span>
            <span>{describeTest(record)}</span>
            {src && <span className="normal-case tracking-normal text-faint">{src}</span>}
            {record.mode === "quote" && record.sourceId && <FavoriteButton id={record.sourceId} />}
          </div>

          {isPb && bestPb && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 * slow, type: "spring", stiffness: 300, damping: 22 }}
              className="mt-5 inline-flex items-center gap-3 border border-accent/60 bg-accent/10 px-3 py-1.5"
              style={{ borderRadius: "var(--radius)" }}
            >
              <Sparkles size={14} className="text-accent" />
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-accent">new personal best</span>
              <span className="font-mono text-xs text-sub">{categoryLabel(bestPb.category)}</span>
              {bestPb.previous !== null && (
                <span className="font-mono text-xs text-fg">
                  +<RollingNumber value={bestPb.wpm - bestPb.previous} decimals={0} delay={0.9 * slow} /> wpm
                </span>
              )}
            </motion.div>
          )}

          <div className="relative mt-4 flex items-end gap-4">
            {hyper && <span className="absolute -left-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full border border-accent/40" style={{ animation: "sonic 1.8s ease-out 3" }} aria-hidden />}
            <h2 className="display text-[clamp(6rem,19vw,14rem)] font-bold text-fg" aria-label={`${Math.round(record.wpm)} words per minute`}>
              <RollingNumber value={zen ? record.raw : record.wpm} stagger={0.07} delay={0.15 * slow} stiffness={cinematic ? 45 : 80} />
            </h2>
            <div className="mb-[1.2em] flex flex-col gap-1">
              <span className="italic-serif text-3xl text-sub sm:text-4xl">wpm</span>
              {zen && <span className="font-mono text-[0.65rem] text-faint">(raw, zen)</span>}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className={`display text-5xl font-semibold ${perfect ? "shimmer-text" : "text-fg"}`}>
                <RollingNumber value={record.accuracy} decimals={record.accuracy === 100 ? 0 : 1} delay={0.35 * slow} />
                <span className="text-3xl">%</span>
              </span>
              <span className="italic-serif text-xl text-sub">accuracy</span>
            </div>
            {perfect && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 * slow }} className="label !text-accent">
                clean sheet ✦
              </motion.span>
            )}
          </div>
        </motion.div>

        {/* stat ledger */}
        <motion.dl variants={item} className="grid grid-cols-2 self-end border-t border-line font-mono text-sm sm:grid-cols-3 lg:grid-cols-2">
          <Stat label="raw" value={record.raw.toFixed(0)} />
          <Stat label="consistency" value={`${record.consistency.toFixed(0)}%`} />
          <Stat label="peak" value={`${record.peakWpm.toFixed(0)}`} unit="wpm" />
          <Stat label="cpm" value={cpm.toFixed(0)} />
          <Stat
            label="chars"
            title="correct / incorrect / extra / missed"
            value={
              <>
                <span className="text-ok">{record.correct}</span>
                <span className="text-faint">/</span>
                <span className="text-err">{record.incorrect}</span>
                <span className="text-faint">/</span>
                <span>{record.extra}</span>
                <span className="text-faint">/</span>
                <span className="text-sub">{record.missed}</span>
              </>
            }
            sub="correct · wrong · extra · missed"
          />
          <Stat label="keystrokes" value={String(record.keystrokes)} sub={`${record.backspaces} backspace${record.backspaces === 1 ? "" : "s"}`} />
          <Stat label="time" value={fmtDuration(record.durationMs)} sub={`${(record.durationMs / 1000).toFixed(2)}s`} />
          {record.mode === "code" ? (
            <Stat
              label="code errors"
              title="mistakes on syntax characters / on letters and digits"
              value={
                <>
                  <span>{codeErrors(result.keyStats).symbols}</span>
                  <span className="text-faint">/</span>
                  <span>{codeErrors(result.keyStats).letters}</span>
                </>
              }
              sub="syntax · letters"
            />
          ) : (
            <Stat label="words" value={String(record.wordsTyped)} />
          )}
        </motion.dl>
      </div>

      {/* graph */}
      {record.samples.t.length > 1 && (
        <motion.div variants={item} className="mt-12">
          <WpmChart samples={record.samples} />
        </motion.div>
      )}

      {/* insights + heatmap */}
      <div className="mt-12 grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-2">
        <motion.div variants={item}>
          <div className="label mb-4">observations</div>
          {insights.length ? (
            <ol className="space-y-3">
              {insights.map((ins, i) => (
                <motion.li
                  key={ins.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (0.8 + i * 0.12) * slow }}
                  className="flex gap-4 border-b border-line pb-3 text-[0.95rem] leading-snug text-fg"
                >
                  <span className="pt-0.5 font-mono text-[0.7rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className={ins.tone === "warn" ? "text-fg" : ""}>
                    <Highlighted text={ins.text} highlight={ins.highlight} tone={ins.tone} />
                  </span>
                </motion.li>
              ))}
            </ol>
          ) : (
            <p className="font-mono text-sm text-sub">Type a little longer and patterns will start to show up here.</p>
          )}
        </motion.div>
        <motion.div variants={item}>
          <KeyboardHeatmap stats={result.keyStats} bigrams={result.bigramStats} compact minSamples={1} title="this test, by key" />
        </motion.div>
      </div>

      {/* actions */}
      <motion.div variants={item} className="mt-12 flex flex-wrap items-center gap-2">
        {onNext && (
          <ActionButton onClick={onNext} primary icon={<ArrowRight size={15} />} label="next test" kbd="tab" />
        )}
        {onRepeat && <ActionButton onClick={onRepeat} icon={<Repeat2 size={15} />} label="repeat text" />}
        <ActionButton onClick={() => setShareOpen(true)} icon={<Share2 size={15} />} label="share card" kbd="s" />
        {replayHref && (
          <Link href={replayHref} className="press inline-flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[0.78rem] text-sub hover:border-faint hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
            <Film size={15} /> details & replay
          </Link>
        )}
      </motion.div>

      {firstTest && auth.enabled && !auth.signedIn && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 * slow }}
          className="mt-10 flex flex-col items-start justify-between gap-4 border border-line bg-bg2/60 p-5 sm:flex-row sm:items-center"
          style={{ borderRadius: "calc(var(--radius) + 4px)" }}
        >
          <div>
            <div className="font-display text-xl font-semibold text-fg">Keep this one?</div>
            <p className="mt-1 max-w-md text-sm text-sub">
              Your results are saved on this device. Create an account to keep your history, records and heatmap everywhere.
            </p>
          </div>
          <button onClick={auth.openSignUp} className="press inline-flex items-center gap-2 bg-accent px-4 py-2.5 font-mono text-[0.78rem] text-on-accent" style={{ borderRadius: "var(--radius)" }}>
            <LogIn size={14} /> save my progress
          </button>
        </motion.div>
      )}

      {shareOpen && <ShareDialog record={record} pbs={pbs} onClose={() => setShareOpen(false)} />}
      <style>{`@keyframes sonic{from{transform:translateY(-50%) scale(.6);opacity:.8}to{transform:translateY(-50%) scale(2.4);opacity:0}}`}</style>
    </motion.section>
  );
}

function Stat({ label, value, unit, sub, title }: { label: string; value: React.ReactNode; unit?: string; sub?: string; title?: string }) {
  return (
    <div className="border-b border-line py-3 pr-3" title={title}>
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-xl text-fg" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
        {unit ? <span className="ml-1 text-xs text-sub">{unit}</span> : null}
      </dd>
      {sub ? <dd className="mt-0.5 text-[0.68rem] text-faint">{sub}</dd> : null}
    </div>
  );
}

function Highlighted({ text, highlight, tone }: { text: string; highlight?: string; tone: string }) {
  if (!highlight || !text.includes(highlight)) return <>{text}</>;
  const i = text.indexOf(highlight);
  return (
    <>
      {text.slice(0, i)}
      <span className={`font-semibold ${tone === "warn" ? "text-accent3" : "text-accent"}`}>{highlight}</span>
      {text.slice(i + highlight.length)}
    </>
  );
}

function ActionButton({ onClick, label, icon, kbd, primary }: { onClick: () => void; label: string; icon: React.ReactNode; kbd?: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`press inline-flex items-center gap-2 px-4 py-2.5 font-mono text-[0.78rem] ${primary ? "bg-fg text-bg hover:bg-accent hover:text-on-accent" : "border border-line text-sub hover:border-faint hover:text-fg"}`}
      style={{ borderRadius: "var(--radius)" }}
    >
      {icon} {label}
      {kbd ? <span className={`ml-1 text-[0.65rem] ${primary ? "opacity-60" : "text-faint"}`}>{kbd}</span> : null}
    </button>
  );
}
