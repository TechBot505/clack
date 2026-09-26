"use client";

import { useEffect, useState } from "react";
import { TestScreen, type Override } from "@/components/typing/TestScreen";
import { decodeChallenge } from "@/lib/challenge";

/** Reads a shared challenge (?c=…) and hands it to the test screen. */
export function TypePageClient() {
  const [override, setOverride] = useState<Override | null | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    const ch = c ? decodeChallenge(c) : null;
    setOverride(
      ch
        ? {
            config: ch.config,
            fixed: { text: ch.config.customText, seed: ch.seed, sourceId: ch.sourceId },
            label: ch.title ? `challenge: ${ch.title}` : "shared challenge",
          }
        : null,
    );
  }, []);

  if (override === undefined) return <div className="flex-1" />;
  return <TestScreen override={override} />;
}
