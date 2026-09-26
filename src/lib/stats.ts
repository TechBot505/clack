import type { TestRecord } from "./records";
import { isValidForStats, rollingAverage } from "./records";
import { categoryLabel } from "@/engine/config";

export type StatsRange = "7" | "30" | "90" | "365" | "all";

export function inRange(tests: TestRecord[], range: StatsRange, now = Date.now()): TestRecord[] {
  if (range === "all") return tests;
  const from = now - Number(range) * 86400000;
  return tests.filter((t) => t.createdAt >= from);
}

export function wpmHistory(tests: TestRecord[]) {
  const valid = tests.filter(isValidForStats).sort((a, b) => a.createdAt - b.createdAt);
  const w = valid.map((t) => t.wpm);
  const a = valid.map((t) => t.accuracy);
  const r10 = rollingAverage(w, 10);
  const r50 = rollingAverage(w, 50);
  const a10 = rollingAverage(a, 10);
  return valid.map((t, i) => ({ i: i + 1, at: t.createdAt, wpm: t.wpm, acc: t.accuracy, r10: r10[i], r50: r50[i], a10: a10[i], id: t.id }));
}

export function histogram(values: number[], size: number, floor = 0): { bucket: number; label: string; count: number }[] {
  if (!values.length) return [];
  const min = Math.max(floor, Math.floor(Math.min(...values) / size) * size);
  const max = Math.floor(Math.max(...values) / size) * size;
  const out: { bucket: number; label: string; count: number }[] = [];
  for (let b = min; b <= max; b += size) out.push({ bucket: b, label: `${b}`, count: 0 });
  for (const v of values) {
    const idx = Math.floor((Math.max(v, min) - min) / size);
    if (out[idx]) out[idx].count++;
  }
  return out;
}

export function accuracyDistribution(tests: TestRecord[]) {
  const buckets = ["<90", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "100"];
  const out = buckets.map((b) => ({ label: b === "100" ? "100" : b, count: 0 }));
  for (const t of tests.filter(isValidForStats)) {
    const a = t.accuracy;
    let idx: number;
    if (a >= 100) idx = 11;
    else if (a < 90) idx = 0;
    else idx = Math.floor(a) - 89;
    out[idx].count++;
  }
  return out;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function byWeekday(tests: TestRecord[]) {
  const out = WEEKDAYS.map((d) => ({ label: d, count: 0, sum: 0, avg: 0 }));
  for (const t of tests.filter(isValidForStats)) {
    const d = new Date(t.createdAt).getDay();
    out[d].count++;
    out[d].sum += t.wpm;
  }
  out.forEach((o) => (o.avg = o.count ? o.sum / o.count : 0));
  // Monday-first reads better
  return [...out.slice(1), out[0]];
}

export function byHour(tests: TestRecord[]) {
  const out = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}`, count: 0, sum: 0, avg: 0 }));
  for (const t of tests.filter(isValidForStats)) {
    const h = new Date(t.createdAt).getHours();
    out[h].count++;
    out[h].sum += t.wpm;
  }
  out.forEach((o) => (o.avg = o.count ? o.sum / o.count : 0));
  return out;
}

export function byCategory(tests: TestRecord[]) {
  const map = new Map<string, { category: string; label: string; count: number; sum: number; best: number; order: number }>();
  for (const t of tests.filter(isValidForStats)) {
    const cat = t.category;
    const e = map.get(cat) ?? { category: cat, label: categoryLabel(cat), count: 0, sum: 0, best: 0, order: orderOf(cat) };
    e.count++;
    e.sum += t.wpm;
    e.best = Math.max(e.best, t.wpm);
    map.set(cat, e);
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, avg: e.sum / e.count }))
    .sort((a, b) => a.order - b.order);
}

function orderOf(cat: string): number {
  const [k, n] = cat.split(":");
  const base = { time: 0, words: 1000, quote: 2000, code: 2100, custom: 2200, zen: 2300 }[k] ?? 3000;
  return base + (Number(n) || 0);
}
