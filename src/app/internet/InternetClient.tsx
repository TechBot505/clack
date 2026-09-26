"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { PageHeader, PageShell } from "@/components/ui/primitives";
import { INTERNET_PACKS, type InternetPack } from "@/content/internet";
import { useSettings } from "@/stores/settings";
import { useUI } from "@/stores/ui";
import { createRng, newSeed } from "@/engine/rng";

export function InternetClient() {
  const router = useRouter();
  const start = (p: InternetPack) => {
    const s = useSettings.getState();
    if (p.codeLanguage) s.setTest({ mode: "code", codeLanguage: p.codeLanguage, flow: false });
    else if (p.quoteGroup) s.setTest({ mode: "quote", quoteGroup: p.quoteGroup, quoteLength: "any", flow: false });
    else if (p.passages) {
      const text = createRng(newSeed()).pick(p.passages);
      s.setTest({ mode: "custom", customText: text, customTimer: 0, strict: false, flow: false });
    }
    useUI.getState().requestRestart();
    router.push("/type");
  };

  return (
    <PageShell wide>
      <PageHeader
        n="✳"
        kicker="experimental"
        title={
          <>
            type the <span className="italic-serif font-normal text-accent">internet</span>
          </>
        }
        dek="Speeches, stage lines, tongue twisters, URLs, JSON, terminal commands and a few things that should not be typed. Pick a pack; each run draws a random passage."
      />
      <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" style={{ borderRadius: "calc(var(--radius) + 4px)" }}>
        {INTERNET_PACKS.map((p, i) => (
          <motion.button
            key={p.id}
            onClick={() => start(p)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            className="press group relative flex min-h-[10rem] flex-col justify-between overflow-hidden bg-bg p-5 text-left transition-colors hover:bg-bg2"
          >
            <span className="font-mono text-[0.65rem] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="font-display text-2xl font-semibold text-fg transition-colors group-hover:text-accent">{p.name}</div>
              <div className="mt-1 text-[0.8rem] leading-snug text-sub">{p.blurb}</div>
            </div>
            {p.passages && (
              <span className="pointer-events-none absolute -right-2 top-3 max-w-[70%] truncate font-mono text-[0.62rem] text-faint/60 opacity-0 transition-opacity group-hover:opacity-100">
                {p.passages[0]}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </PageShell>
  );
}
