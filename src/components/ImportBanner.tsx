"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useHistory } from "@/stores/history";
import { useUI } from "@/stores/ui";

/** After signing in: offer to move anonymous local history into the account. */
export function ImportBanner() {
  const importable = useHistory((s) => s.importable);
  const source = useHistory((s) => s.source);
  const [busy, setBusy] = useState(false);
  const show = importable > 0 && source === "remote";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-[90] w-[min(92vw,380px)] border border-accent/50 bg-bg2/95 p-4 shadow-2xl backdrop-blur"
          style={{ borderRadius: "calc(var(--radius) + 6px)" }}
          role="region"
          aria-label="Import local history"
        >
          <div className="font-display text-lg font-semibold text-fg">Bring your history along?</div>
          <p className="mt-1 text-sm text-sub">
            {importable} test{importable === 1 ? "" : "s"} from before you signed in {importable === 1 ? "is" : "are"} still on this device.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const n = await useHistory.getState().importAnonymous();
                  useUI.getState().toast({ title: `imported ${n} tests`, body: "they're verified and in your account now.", tone: "accent" });
                } catch {
                  useUI.getState().toast({ title: "import failed", body: "try again from settings → account.", tone: "error" });
                } finally {
                  setBusy(false);
                }
              }}
              className="press bg-accent px-3 py-1.5 font-mono text-xs text-on-accent disabled:opacity-50"
              style={{ borderRadius: "var(--radius)" }}
            >
              {busy ? "importing…" : "import"}
            </button>
            <button onClick={() => useHistory.getState().dismissImport()} className="press px-3 py-1.5 font-mono text-xs text-sub hover:text-fg">
              not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
