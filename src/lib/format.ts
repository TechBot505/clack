import type { TestRecord } from "./records";
import { getQuote } from "@/content/quotes";
import { getSnippet, CODE_LANGUAGES } from "@/content/code";
import { getLanguage } from "@/content/languages";

export function describeTest(t: Pick<TestRecord, "mode" | "mode2" | "language" | "punctuation" | "numbers" | "content" | "sourceId" | "strict">): string {
  const parts: string[] = [];
  switch (t.mode) {
    case "time":
      parts.push(`time ${t.mode2}`);
      break;
    case "words":
      parts.push(`words ${t.mode2}`);
      break;
    case "quote":
      parts.push("quote");
      break;
    case "code": {
      const s = t.sourceId ? getSnippet(t.sourceId) : undefined;
      parts.push(`code${s ? ` · ${CODE_LANGUAGES.find((l) => l.id === s.language)?.name ?? s.language}` : ""}`);
      break;
    }
    default:
      parts.push(t.mode);
  }
  if (t.mode === "time" || t.mode === "words") {
    parts.push(getLanguage(t.language).name.toLowerCase());
    if (t.content === "difficult") parts.push("difficult");
    if (t.punctuation) parts.push("punctuation");
    if (t.numbers) parts.push("numbers");
  }
  if (t.strict) parts.push("accuracy mode");
  return parts.join(" · ");
}

export function sourceLine(t: Pick<TestRecord, "mode" | "sourceId">): string | null {
  if (t.mode === "quote" && t.sourceId) {
    const q = getQuote(t.sourceId);
    return q ? `${q.author} — ${q.source}` : null;
  }
  if (t.mode === "code" && t.sourceId) {
    const s = getSnippet(t.sourceId);
    return s ? s.title : null;
  }
  return null;
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(ms));
}

export function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

export function relativeTime(ms: number, now = Date.now()): string {
  const d = Math.round((now - ms) / 1000);
  if (d < 45) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  if (d < 86400 * 7) return `${Math.round(d / 86400)}d ago`;
  return fmtDate(ms, { month: "short", day: "numeric" });
}
