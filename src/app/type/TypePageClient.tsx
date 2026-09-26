"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TestScreen, type Override } from "@/components/typing/TestScreen";
import { decodeChallenge } from "@/lib/challenge";

/** Reads a shared challenge (?c=…) and hands it to the test screen. */
export function TypePageClient() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <WithChallenge />
    </Suspense>
  );
}

function WithChallenge() {
  const params = useSearchParams();
  const c = params.get("c");
  const override = useMemo<Override | null>(() => {
    const ch = c ? decodeChallenge(c) : null;
    if (!ch) return null;
    return {
      config: ch.config,
      fixed: { text: ch.config.customText, seed: ch.seed, sourceId: ch.sourceId },
      label: ch.title ? `challenge: ${ch.title}` : "shared challenge",
    };
  }, [c]);
  return <TestScreen key={c ?? "free"} override={override} />;
}
