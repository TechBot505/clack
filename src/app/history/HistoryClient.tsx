"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { X, SlidersHorizontal } from "lucide-react";
import { useHistory } from "@/stores/history";
import { dayKey, type TestRecord } from "@/lib/records";
import { fmtDate, fmtDuration } from "@/lib/format";
import { PageHeader, PageShell, EmptyState, SectionTitle, Segmented } from "@/components/ui/primitives";
import { CalendarHeatmap, type DayValue } from "@/components/CalendarHeatmap";
import { TestRow } from "@/components/history/TestRow";
import { LANGUAGES } from "@/content/languages";
import { useNow } from "@/lib/hooks";

const TimelineChart = dynamic(() => import("@/components/charts/TimelineChart").then((m) => m.TimelineChart), {
  ssr: false,
  loading: () => <div className="h-[300px]" />,
});

type ModeFilter = "all" | TestRecord["mode"];
type RangeFilter = "all" | "7" | "30" | "90" | "365";

const PAGE = 40;

export function HistoryClient() {
  const tests = useHistory((s) => s.tests);
  const loaded = useHistory((s) => s.loaded);
  const [day, setDay] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeFilter>("all");
  const [range, setRange] = useState<RangeFilter>("all");
  const [duration, setDuration] = useState<number | "all">("all");
  const [minWpm, setMinWpm] = useState("");
  const [maxWpm, setMaxWpm] = useState("");
  const [minAcc, setMinAcc] = useState<number>(0);
  const [language, setLanguage] = useState("all");
  const [content, setContent] = useState<"all" | "punctuation" | "numbers" | "difficult">("all");
  const [limit, setLimit] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);

  const calendar = useMemo(() => {
    const out: Record<string, DayValue> = {};
    for (const t of tests) {
      const k = dayKey(t.createdAt);
      const v = (out[k] ??= { count: 0, best: 0, minutes: 0 });
      v.count++;
      v.best = Math.max(v.best ?? 0, t.wpm);
      v.minutes = (v.minutes ?? 0) + t.durationMs / 60000;
    }
    return out;
  }, [tests]);

  const durations = useMemo(() => {
    const set = new Set<number>();
    tests.forEach((t) => (mode === "all" || t.mode === mode) && (t.mode === "time" || t.mode === "words") && set.add(t.mode2));
    return Array.from(set).sort((a, b) => a - b);
  }, [tests, mode]);

  const now = useNow();
  const filtered = useMemo(() => {
    const lo = minWpm ? Number(minWpm) : -Infinity;
    const hi = maxWpm ? Number(maxWpm) : Infinity;
    return tests.filter((t) => {
      if (day && dayKey(t.createdAt) !== day) return false;
      if (range !== "all" && t.createdAt < now - Number(range) * 86400000) return false;
      if (mode !== "all" && t.mode !== mode) return false;
      if (duration !== "all" && t.mode2 !== duration) return false;
      if (t.wpm < lo || t.wpm > hi) return false;
      if (t.accuracy < minAcc) return false;
      if (language !== "all" && t.language !== language) return false;
      if (content === "punctuation" && !t.punctuation) return false;
      if (content === "numbers" && !t.numbers) return false;
      if (content === "difficult" && t.content !== "difficult") return false;
      return true;
    });
  }, [tests, day, range, mode, duration, minWpm, maxWpm, minAcc, language, content, now]);

  const grouped = useMemo(() => {
    const groups: { key: string; items: TestRecord[] }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const k = dayKey(t.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.items.push(t);
      else groups.push({ key: k, items: [t] });
    }
    return groups;
  }, [filtered, limit]);

  const activeFilters =
    (day ? 1 : 0) + (mode !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0) + (duration !== "all" ? 1 : 0) + (minWpm || maxWpm ? 1 : 0) + (minAcc ? 1 : 0) + (language !== "all" ? 1 : 0) + (content !== "all" ? 1 : 0);

  const clear = () => {
    setDay(null);
    setMode("all");
    setRange("all");
    setDuration("all");
    setMinWpm("");
    setMaxWpm("");
    setMinAcc(0);
    setLanguage("all");
    setContent("all");
  };

  if (loaded && tests.length === 0) {
    return (
      <PageShell>
        <PageHeader n="05" kicker="history" title="Nothing typed yet." />
        <EmptyState title="Your history starts with one test." body="Every run you finish lands here: replayable, filterable, and quietly judged by a calendar." action={{ href: "/type", label: "take a test" }} />
      </PageShell>
    );
  }

  const totalMs = filtered.reduce((a, t) => a + t.durationMs, 0);

  return (
    <PageShell>
      <PageHeader
        n="05"
        kicker="history"
        title={
          <>
            {tests.length} <span className="italic-serif font-normal text-sub">tests,</span> {fmtDuration(tests.reduce((a, t) => a + t.durationMs, 0))}
          </>
        }
        dek="Every run you've finished. Click a day to see what happened, click a test to replay it."
      />

      <section className="mb-14">
        <SectionTitle n="a">activity</SectionTitle>
        <CalendarHeatmap days={calendar} selected={day} onSelect={setDay} />
      </section>

      <section className="mb-14">
        <SectionTitle n="b">over time</SectionTitle>
        <TimelineChart tests={filtered} />
      </section>

      <section>
        <SectionTitle
          n="c"
          right={
            <div className="flex items-center gap-2">
              {activeFilters > 0 && (
                <button onClick={clear} className="press inline-flex items-center gap-1 font-mono text-xs text-sub hover:text-fg">
                  <X size={12} /> clear {activeFilters}
                </button>
              )}
              <button
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={`press inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-xs ${showFilters ? "border-accent text-fg" : "border-line text-sub hover:text-fg"}`}
                style={{ borderRadius: "var(--radius)" }}
              >
                <SlidersHorizontal size={13} /> filters
              </button>
            </div>
          }
        >
          {filtered.length} result{filtered.length === 1 ? "" : "s"} · {fmtDuration(totalMs)}
          {day ? ` · ${fmtDate(new Date(day + "T12:00:00").getTime())}` : ""}
        </SectionTitle>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-6 grid grid-cols-1 gap-5 border border-line bg-bg2/50 p-5 md:grid-cols-2" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
                <Field label="date">
                  <Segmented id="h-range" label="Date range" size="sm" value={range} onChange={setRange} options={[{ id: "all", label: "all" }, { id: "7", label: "7d" }, { id: "30", label: "30d" }, { id: "90", label: "90d" }, { id: "365", label: "1y" }]} />
                </Field>
                <Field label="test type">
                  <Segmented
                    id="h-mode"
                    label="Test type"
                    size="sm"
                    value={mode}
                    onChange={(m) => {
                      setMode(m);
                      setDuration("all");
                    }}
                    options={(["all", "time", "words", "quote", "code", "custom", "zen"] as ModeFilter[]).map((m) => ({ id: m, label: m }))}
                  />
                </Field>
                {durations.length > 0 && (
                  <Field label="duration / length">
                    <Segmented id="h-dur" label="Duration" size="sm" value={duration} onChange={setDuration} options={[{ id: "all" as const, label: "all" }, ...durations.map((d) => ({ id: d, label: String(d) }))]} />
                  </Field>
                )}
                <Field label="mode">
                  <Segmented id="h-content" label="Mode" size="sm" value={content} onChange={setContent} options={(["all", "punctuation", "numbers", "difficult"] as const).map((c) => ({ id: c, label: c }))} />
                </Field>
                <Field label="wpm range">
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <NumInput value={minWpm} onChange={setMinWpm} placeholder="min" label="Minimum WPM" />
                    <span className="text-faint">–</span>
                    <NumInput value={maxWpm} onChange={setMaxWpm} placeholder="max" label="Maximum WPM" />
                  </div>
                </Field>
                <Field label="accuracy at least">
                  <Segmented id="h-acc" label="Minimum accuracy" size="sm" value={minAcc} onChange={setMinAcc} options={[0, 90, 95, 98, 100].map((a) => ({ id: a, label: a ? `${a}%` : "any" }))} />
                </Field>
                <Field label="language">
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="border border-line bg-bg px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent" style={{ borderRadius: "var(--radius)" }}>
                    <option value="all">all languages</option>
                    {Object.values(LANGUAGES).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-sub">No tests match these filters.</p>
        ) : (
          <div>
            {grouped.map((g) => (
              <div key={g.key} className="mb-6">
                <div className="sticky top-0 z-10 -mx-2 flex items-center gap-3 bg-bg/90 px-2 py-2 backdrop-blur">
                  <span className="font-mono text-xs text-fg">{fmtDate(new Date(g.key + "T12:00:00").getTime(), { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toLowerCase()}</span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[0.65rem] text-faint">
                    {g.items.length} · best {Math.round(Math.max(...g.items.map((t) => t.wpm)))}
                  </span>
                </div>
                {g.items.map((t) => (
                  <TestRow key={t.id} t={t} />
                ))}
              </div>
            ))}
            {filtered.length > limit && (
              <div className="flex justify-center pt-4">
                <button onClick={() => setLimit((l) => l + PAGE)} className="press border border-line px-4 py-2 font-mono text-xs text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
                  show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-2">{label}</div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
      className="w-20 border border-line bg-bg px-2 py-1.5 text-fg outline-none placeholder:text-faint focus:border-accent"
      style={{ borderRadius: "var(--radius)" }}
    />
  );
}
