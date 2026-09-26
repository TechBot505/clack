"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Code2, Quote, Waves, Eye, Flame, AtSign, Hash, Target, Timer, Type, Brain } from "lucide-react";
import { PageHeader, PageShell, SectionTitle } from "@/components/ui/primitives";
import { CustomBuilder } from "@/components/practice/CustomBuilder";
import { AdaptivePanel } from "@/components/practice/AdaptivePanel";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import type { TestConfig } from "@/engine/types";

interface Drill {
  id: string;
  name: string;
  line: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  config: Partial<TestConfig>;
}

const DRILLS: Drill[] = [
  { id: "code", name: "code", line: "real syntax, real indentation. enter ends a line.", icon: Code2, config: { mode: "code", flow: false } },
  { id: "quotes", name: "quotes", line: "public-domain lines worth typing twice.", icon: Quote, config: { mode: "quote", flow: false } },
  { id: "zen", name: "zen", line: "no text, no timer. type what you think. shift+enter ends.", icon: Waves, config: { mode: "zen" } },
  { id: "flow", name: "flow", line: "every number disappears until the very end.", icon: Eye, config: { mode: "time", duration: 60, flow: true } },
  { id: "difficult", name: "difficult words", line: "chrysanthemum. onomatopoeia. good luck.", icon: Flame, config: { mode: "words", wordCount: 25, content: "difficult", flow: false } },
  { id: "punct", name: "punctuation", line: "commas, quotes, question marks; the works.", icon: AtSign, config: { mode: "time", duration: 30, punctuation: true, flow: false } },
  { id: "numbers", name: "numbers", line: "years, percentages, decimals.", icon: Hash, config: { mode: "time", duration: 30, numbers: true, flow: false } },
  { id: "accuracy", name: "accuracy mode", line: "mistakes block you until you fix them.", icon: Target, config: { mode: "words", wordCount: 25, strict: true, flow: false } },
  { id: "sprint", name: "15s sprint", line: "short, loud, honest.", icon: Timer, config: { mode: "time", duration: 15, flow: false } },
  { id: "marathon", name: "marathon", line: "two minutes of pure stamina.", icon: Type, config: { mode: "time", duration: 120, flow: false } },
];

export function PracticeClient() {
  const router = useRouter();
  const start = (config: Partial<TestConfig>) => {
    useSettings.getState().setTest({ punctuation: false, numbers: false, content: "common", strict: false, ...config });
    useUI.getState().requestRestart();
    router.push("/type");
  };

  return (
    <PageShell wide>
      <PageHeader n="02" kicker="practice" title={<>drills <span className="italic-serif font-normal text-sub">&</span> experiments</>} dek="Targeted practice, odd modes, and a builder for your own tests." />

      <section className="mb-16">
        <SectionTitle n="a">
          <span className="inline-flex items-center gap-2">
            <Brain size={13} /> adaptive training
          </span>
        </SectionTitle>
        <AdaptivePanel onStart={start} />
      </section>

      <section className="mb-16">
        <SectionTitle n="b">drills</SectionTitle>
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-5" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
          {DRILLS.map((d, i) => (
            <motion.button
              key={d.id}
              onClick={() => start(d.config)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="press group flex min-h-[9.5rem] flex-col justify-between bg-bg p-5 text-left transition-colors hover:bg-bg2"
            >
              <d.icon size={18} className="text-sub transition-colors group-hover:text-accent" />
              <div>
                <div className="font-display text-xl font-semibold text-fg">{d.name}</div>
                <div className="mt-1 text-[0.8rem] leading-snug text-sub">{d.line}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <section id="custom" className="mb-10 scroll-mt-8">
        <SectionTitle n="c">custom test builder</SectionTitle>
        <CustomBuilder />
      </section>
    </PageShell>
  );
}
