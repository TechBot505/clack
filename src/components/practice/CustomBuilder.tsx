"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Play } from "lucide-react";
import { sanitizeText } from "@/content/generator";
import { challengeUrl } from "@/lib/challenge";
import { LIMITS } from "@/engine/config";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { Segmented } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/controls";

const SAMPLE =
  "Paste anything here: a paragraph you love, lines you need to memorize, the README you keep rewriting. clack. turns it into a test, and a link turns it into a challenge.";

export function processCustomText(raw: string, o: { punctuation: boolean; numbers: boolean; caseSensitive: boolean; limit: number }): string {
  let t = sanitizeText(raw, LIMITS.maxCustomText * 2);
  if (!o.caseSensitive) t = t.toLowerCase();
  if (!o.punctuation) t = t.replace(/[^\p{L}\p{N}\s]/gu, "");
  if (!o.numbers) t = t.replace(/\p{N}+/gu, "");
  const words = t.split(/\s+/).filter(Boolean);
  const limited = o.limit > 0 ? words.slice(0, o.limit) : words;
  return limited.join(" ").slice(0, LIMITS.maxCustomText);
}

export function CustomBuilder() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [punctuation, setPunctuation] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [limit, setLimit] = useState(0);
  const [timer, setTimer] = useState(0);
  const [strict, setStrict] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => processCustomText(raw || SAMPLE, { punctuation, numbers, caseSensitive, limit }), [raw, punctuation, numbers, caseSensitive, limit]);
  const words = text ? text.split(" ").length : 0;

  const start = () => {
    useSettings.getState().setTest({ mode: "custom", customText: text, customTimer: timer, strict });
    useUI.getState().requestRestart();
    router.push("/type");
  };

  const share = async () => {
    const url = challengeUrl({ v: 1, title: title.trim() || undefined, config: { mode: "custom", customText: text, customTimer: timer, strict } });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      useUI.getState().toast({ title: "challenge link copied", body: "anyone opening it gets exactly this test.", tone: "accent" });
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <label className="label mb-2 block" htmlFor="custom-text">
          text
        </label>
        <textarea
          id="custom-text"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={SAMPLE}
          rows={9}
          className="w-full resize-y border border-line bg-bg2/60 p-4 font-mono text-sm leading-relaxed text-fg outline-none placeholder:text-faint focus:border-accent"
          style={{ borderRadius: "calc(var(--radius) + 4px)" }}
        />
        <div className="mt-2 flex justify-between font-mono text-[0.68rem] text-faint">
          <span>
            {words} words · {text.length} characters
          </span>
          <span>max {LIMITS.maxCustomText} characters</span>
        </div>
        <label className="label mb-2 mt-6 block" htmlFor="custom-title">
          challenge name (optional)
        </label>
        <input
          id="custom-title"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="friday speed trial"
          className="w-full max-w-sm border border-line bg-bg2/60 px-3 py-2 font-mono text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
          style={{ borderRadius: "var(--radius)" }}
        />
      </div>
      <div className="space-y-5">
        <Opt label="punctuation">
          <Switch checked={punctuation} onChange={setPunctuation} label="Keep punctuation" />
        </Opt>
        <Opt label="numbers">
          <Switch checked={numbers} onChange={setNumbers} label="Keep numbers" />
        </Opt>
        <Opt label="case sensitive">
          <Switch checked={caseSensitive} onChange={setCaseSensitive} label="Case sensitive" />
        </Opt>
        <Opt label="accuracy mode">
          <Switch checked={strict} onChange={setStrict} label="Accuracy mode" />
        </Opt>
        <div>
          <div className="label mb-2">word count</div>
          <Segmented id="cb-limit" label="Word count" size="sm" value={limit} onChange={setLimit} options={[0, 10, 25, 50, 100].map((n) => ({ id: n, label: n ? String(n) : "all" }))} />
        </div>
        <div>
          <div className="label mb-2">timer</div>
          <Segmented id="cb-timer" label="Timer" size="sm" value={timer} onChange={setTimer} options={[0, 15, 30, 60, 120].map((n) => ({ id: n, label: n ? `${n}s` : "off" }))} />
        </div>
        <div className="flex flex-wrap gap-2 pt-3">
          <button onClick={start} disabled={!words} className="press inline-flex items-center gap-2 bg-accent px-4 py-2.5 font-mono text-xs text-on-accent disabled:opacity-40" style={{ borderRadius: "var(--radius)" }}>
            <Play size={13} /> start
          </button>
          <button onClick={share} disabled={!words} className="press inline-flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-xs text-sub hover:text-fg disabled:opacity-40" style={{ borderRadius: "var(--radius)" }}>
            {copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? "copied" : "copy challenge link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Opt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-4">
      <span className="font-mono text-sm text-fg">{label}</span>
      {children}
    </div>
  );
}
