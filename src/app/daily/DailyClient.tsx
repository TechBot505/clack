"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Flame, Play } from "lucide-react";
import { dailySpec, dailyStreaks, utcDay, type DailyLog } from "@/lib/daily";
import { loadDaily } from "@/lib/daily-store";
import { PageHeader, PageShell, SectionTitle, Stat } from "@/components/ui/primitives";
import { CalendarHeatmap, type DayValue } from "@/components/CalendarHeatmap";
import { describeTest, fmtDate } from "@/lib/format";
import { api, type DailyBoard } from "@/lib/api";
import { useHistory } from "@/stores/history";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { useHydrated } from "@/lib/hooks";

function useCountdown() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
      setLeft(`${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

export function DailyClient() {
  const today = utcDay();
  const spec = useMemo(() => dailySpec(today), [today]);
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const source = useHistory((s) => s.source);
  const countdown = useCountdown();

  const hydrated = useHydrated();
  const log = useMemo<DailyLog>(() => (hydrated ? loadDaily() : {}), [hydrated]);
  useEffect(() => {
    if (source !== "remote") return;
    api.getDaily(today).then(setBoard).catch(() => setBoard(null));
  }, [source, today]);

  const mine = log[today];
  const streak = dailyStreaks(log, today);
  const days = useMemo(() => {
    const out: Record<string, DayValue> = {};
    for (const [d, e] of Object.entries(log)) {
      // local-time key for the calendar component
      out[d] = { count: 1, best: e.wpm };
    }
    return out;
  }, [log]);

  return (
    <PageShell wide>
      <PageHeader
        n="✦"
        kicker={`daily challenge · ${fmtDate(Date.parse(today + "T12:00:00Z"), { weekday: "long", month: "long", day: "numeric" }).toLowerCase()}`}
        title={
          <>
            today: <span className="italic-serif font-normal text-accent">{spec.name}</span>
          </>
        }
        dek="Everyone on earth gets the same text today. Your first finish is your official score; after that, practice as much as you want."
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
        <section className="border border-line bg-bg2/40 p-6 sm:p-8" style={{ borderRadius: "calc(var(--radius) + 6px)" }}>
          {mine ? (
            <>
              <div className="label !text-accent">your official score</div>
              <div className="mt-3 flex items-end gap-3">
                <span className="display text-[clamp(4.5rem,10vw,8rem)] font-bold">
                  <RollingNumber value={mine.wpm} />
                </span>
                <span className="italic-serif mb-3 text-2xl text-sub">wpm</span>
              </div>
              <div className="font-mono text-sm text-sub">
                {mine.accuracy.toFixed(1)}% accuracy · {mine.attempts} run{mine.attempts === 1 ? "" : "s"} today
              </div>
              {board?.you && (
                <div className="mt-4 font-mono text-sm text-fg">
                  rank #{board.you.rank} of {board.total} · top {Math.max(1, Math.round(100 - board.you.percentile))}%
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/daily/play" className="press inline-flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
                  <Play size={13} /> practice today&apos;s text
                </Link>
                <Link href={`/history/${encodeURIComponent(mine.testId)}`} className="font-mono text-xs text-sub underline decoration-line underline-offset-4 hover:text-fg">
                  replay your official run
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="label">not played yet</div>
              <p className="mt-3 max-w-md text-[0.95rem] text-fg">{describeTest({ ...spec.config, mode2: spec.config.mode === "time" ? spec.config.duration : spec.config.wordCount, sourceId: null })}</p>
              <p className="mt-2 max-w-md text-sm text-sub">One official attempt. Take a breath first; the clock starts on your first key.</p>
              <motion.div whileHover={{ scale: 1.02 }} className="mt-8 inline-block">
                <Link href="/daily/play" className="press inline-flex items-center gap-2 bg-accent px-6 py-3.5 font-mono text-sm text-on-accent" style={{ borderRadius: "var(--radius)" }}>
                  <Play size={15} /> start official attempt
                </Link>
              </motion.div>
            </>
          )}
          <div className="mt-10 font-mono text-xs text-faint">next challenge in {countdown}</div>
        </section>

        <section>
          <div className="grid grid-cols-2 gap-6">
            <Stat
              label="daily streak"
              value={
                <span className="inline-flex items-center gap-2">
                  {streak.current > 0 && <Flame size={22} className="text-accent" />}
                  {streak.current}
                </span>
              }
              sub={streak.current ? "days in a row" : "starts today"}
              big
            />
            <Stat label="longest" value={streak.longest} sub="days" big />
          </div>
          <div className="mt-8">
            <SectionTitle>leaderboard</SectionTitle>
            {board && board.entries.length ? (
              <ol className="font-mono text-sm">
                {board.entries.map((e) => (
                  <li key={e.rank} className={`flex items-center justify-between border-b border-line py-2 ${e.you ? "text-accent" : "text-fg"}`}>
                    <span>
                      <span className="mr-3 inline-block w-6 text-faint">{e.rank}</span>
                      {e.name}
                    </span>
                    <span>
                      {e.wpm.toFixed(0)} <span className="text-faint">· {e.accuracy.toFixed(0)}%</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-sub">{source === "remote" ? "No official scores yet today. Be the first." : "Sign in to see where you land among everyone else. Your scores and streak work without an account."}</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-16">
        <SectionTitle n="a">your daily calendar</SectionTitle>
        <CalendarHeatmap days={days} unit="challenge" />
      </section>
    </PageShell>
  );
}
