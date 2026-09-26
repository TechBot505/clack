"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PageHeader, PageShell } from "@/components/ui/primitives";

const RACERS = [
  { name: "you", color: "var(--accent)", speed: 13, delay: 0 },
  { name: "ghost", color: "var(--accent-2)", speed: 15.5, delay: 0.3 },
  { name: "friend", color: "var(--accent-3)", speed: 17, delay: 0.1 },
];

/** Race mode placeholder: a preview of the comet tracks while real-time racing is being built. */
export function RaceClient() {
  return (
    <PageShell wide>
      <PageHeader
        n="03"
        kicker="race"
        title={
          <>
            3, 2, 1, <span className="italic-serif font-normal text-accent">type.</span>
          </>
        }
        dek="Real-time races with friends are on the way: private rooms, share links, comets instead of cars. Until then, race your own ghost."
      />

      <div className="relative overflow-hidden border border-line bg-bg2/40 px-6 py-10" style={{ borderRadius: "calc(var(--radius) + 6px)" }} aria-hidden>
        {RACERS.map((r) => (
          <div key={r.name} className="relative mb-8 h-10 last:mb-0">
            <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: "repeating-linear-gradient(to right, var(--line) 0 8px, transparent 8px 16px)" }} />
            <motion.div
              className="absolute top-1/2 flex -translate-y-1/2 items-center"
              initial={{ left: "-10%" }}
              animate={{ left: ["-10%", "96%"] }}
              transition={{ duration: r.speed, delay: r.delay, repeat: Infinity, ease: [0.3, 0.1, 0.4, 1] }}
            >
              <span className="h-[3px] w-24" style={{ background: `linear-gradient(to right, transparent, ${r.color})`, borderRadius: 2 }} />
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: r.color, boxShadow: `0 0 18px ${r.color}` }} />
              <span className="ml-3 font-mono text-xs text-sub">{r.name}</span>
            </motion.div>
          </div>
        ))}
        <div className="absolute bottom-0 right-8 top-0 w-px bg-accent/50" />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/type" className="press bg-accent px-5 py-3 font-mono text-sm text-on-accent" style={{ borderRadius: "var(--radius)" }}>
          race your ghost →
        </Link>
        <Link href="/daily" className="press border border-line px-5 py-3 font-mono text-sm text-sub hover:text-fg" style={{ borderRadius: "var(--radius)" }}>
          today&apos;s daily challenge
        </Link>
      </div>
      <p className="mt-6 max-w-lg font-mono text-xs text-faint">
        The database already has rooms and participants. Plugging in a real-time host (PartyKit, Liveblocks or a small WebSocket server) is all that&apos;s left.
      </p>
    </PageShell>
  );
}
