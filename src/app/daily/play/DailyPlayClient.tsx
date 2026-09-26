"use client";

import { sfxLater } from "@/lib/sfx";
import { useMemo, useState } from "react";
import { TestScreen, type Override } from "@/components/typing/TestScreen";
import { dailySpec, utcDay } from "@/lib/daily";
import { loadDaily, recordDaily } from "@/lib/daily-store";
import { useUI } from "@/stores/ui";
import { api } from "@/lib/api";
import { useHistory } from "@/stores/history";
import { useHydrated } from "@/lib/hooks";

export function DailyPlayClient() {
  const [date] = useState(utcDay());
  const hydrated = useHydrated();
  const override = useMemo<Override | null>(() => {
    if (!hydrated) return null;
    const spec = dailySpec(date);
    const done = !!loadDaily()[date];
    return {
      config: spec.config,
      fixed: { seed: spec.seed },
      label: `daily challenge · ${spec.name} · ${done ? "practice (your official score is in)" : "your first finish is official"}`,
    };
  }, [date, hydrated]);

  if (!override) return <div className="flex-1" />;
  return (
    <TestScreen
      override={override}
      lockConfig
      onRecorded={(record) => {
        const { official } = recordDaily(date, record);
        if (official) {
          useUI.getState().toast({ title: "official score locked in", body: "practice as much as you like now. only the first run counts.", tone: "accent" });
          sfxLater("achievement", 700);
        }
        if (useHistory.getState().source === "remote") void api.submitDaily(date, record.id).catch(() => {});
      }}
    />
  );
}
