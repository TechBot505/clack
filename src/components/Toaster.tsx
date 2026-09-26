"use client";

import { AnimatePresence, motion } from "motion/react";
import { useUI } from "@/stores/ui";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[95] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="pointer-events-auto w-full border bg-bg2/95 px-4 py-3 text-left shadow-xl backdrop-blur"
            style={{
              borderRadius: "calc(var(--radius) + 6px)",
              borderColor: t.tone === "accent" ? "var(--accent)" : t.tone === "error" ? "var(--error)" : "var(--line)",
            }}
          >
            <div className="text-sm font-medium text-fg">{t.title}</div>
            {t.body ? <div className="mt-0.5 font-mono text-xs text-sub">{t.body}</div> : null}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
