"use client";

import { useMemo, useState } from "react";
import { dayKey } from "@/lib/records";
import { fmtDate } from "@/lib/format";

export interface DayValue {
  count: number;
  /** optional secondary value shown in the tooltip */
  best?: number;
  minutes?: number;
}

/**
 * Contribution-style activity calendar. One hue, five steps (sequential),
 * plus a count in every tooltip so intensity is never color-only.
 */
export function CalendarHeatmap({
  days,
  weeks = 53,
  selected,
  onSelect,
  unit = "test",
}: {
  days: Record<string, DayValue>;
  weeks?: number;
  selected?: string | null;
  onSelect?: (day: string | null) => void;
  unit?: string;
}) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);

  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay())); // end on Saturday
    const start = new Date(end);
    start.setDate(start.getDate() - weeks * 7 + 1);
    const cols: { key: string; date: Date; future: boolean }[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        col.push({ key: dayKey(cur.getTime()), date: new Date(cur), future: cur > today });
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [weeks]);

  const max = Math.max(1, ...Object.values(days).map((d) => d.count));
  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const fill = ["var(--bg-3)", "color-mix(in oklab, var(--accent) 28%, var(--bg-3))", "color-mix(in oklab, var(--accent) 50%, var(--bg-3))", "color-mix(in oklab, var(--accent) 75%, var(--bg-3))", "var(--accent)"];

  const months: { label: string; col: number }[] = [];
  grid.forEach((col, i) => {
    const first = col.find((c) => c.date.getDate() === 1);
    if (first) months.push({ label: first.date.toLocaleString("en-US", { month: "short" }).toLowerCase(), col: i });
  });

  const hv = hover ? days[hover.key] : undefined;

  return (
    <div data-cal className="relative w-full" style={{ containerType: "inline-size" }}>
      <div className="no-scrollbar overflow-x-auto">
        <div className="relative w-max" style={{ ["--cell" as string]: `max(9px, min(15px, calc((100cqw - 40px) / ${weeks} - 3px)))` }}>
          <div className="relative mb-1.5 ml-8 h-4 font-mono text-[0.62rem] text-faint">
            {months.map((m) => (
              <span key={`${m.label}${m.col}`} className="absolute" style={{ left: `calc(${m.col} * (var(--cell) + 3px))` }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 flex w-7 flex-col gap-[3px] font-mono text-[0.6rem] text-faint">
              {["", "mon", "", "wed", "", "fri", ""].map((d, i) => (
                <span key={i} className="flex items-center" style={{ height: "var(--cell)" }}>
                  {d}
                </span>
              ))}
            </div>
            {grid.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((c) => {
                  const v = days[c.key];
                  const lv = level(v?.count ?? 0);
                  const isSel = selected === c.key;
                  return (
                    <button
                      key={c.key}
                      disabled={c.future}
                      onClick={() => onSelect?.(isSel ? null : c.key)}
                      onMouseEnter={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const pr = (e.currentTarget.closest("[data-cal]") as HTMLElement | null)?.getBoundingClientRect();
                        setHover({ key: c.key, x: r.left - (pr?.left ?? 0) + r.width / 2, y: r.top - (pr?.top ?? 0) });
                      }}
                      onMouseLeave={() => setHover(null)}
                      aria-label={`${fmtDate(c.date.getTime())}: ${v?.count ?? 0} ${unit}${(v?.count ?? 0) === 1 ? "" : "s"}`}
                      className="press transition-[background-color,box-shadow] duration-300 disabled:opacity-0"
                      style={{
                        width: "var(--cell)",
                        height: "var(--cell)",
                        background: fill[lv],
                        borderRadius: 3,
                        boxShadow: isSel ? "0 0 0 2px var(--fg)" : lv === 4 ? "0 0 8px var(--glow)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 font-mono text-[0.62rem] text-faint">
        less
        {fill.map((f, i) => (
          <span key={i} className="h-2.5 w-2.5" style={{ background: f, borderRadius: 2 }} />
        ))}
        more
      </div>
      {hover && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-line bg-bg2 px-2.5 py-1.5 font-mono text-[0.7rem] text-fg shadow-lg"
            style={{ left: hover.x, top: hover.y - 6, borderRadius: "var(--radius)" }}
          >
            <span className="text-sub">{fmtDate(new Date(hover.key + "T12:00:00").getTime())}</span> · {hv?.count ?? 0} {unit}
            {(hv?.count ?? 0) === 1 ? "" : "s"}
            {hv?.best ? ` · best ${Math.round(hv.best)} wpm` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
