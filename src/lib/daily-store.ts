"use client";

import { getLocal, setLocal } from "./local-store";
import type { DailyLog } from "./daily";
import type { TestRecord } from "./records";

const KEY = "daily:v1";

export function loadDaily(): DailyLog {
  return getLocal<DailyLog>(KEY, {});
}

/** Records an attempt. The first one of the day is the official score. */
export function recordDaily(date: string, t: TestRecord): { official: boolean; log: DailyLog } {
  const log = loadDaily();
  const cur = log[date];
  if (cur) {
    cur.attempts += 1;
    setLocal(KEY, log);
    return { official: false, log };
  }
  log[date] = { testId: t.id, wpm: t.wpm, accuracy: t.accuracy, at: t.createdAt, attempts: 1 };
  setLocal(KEY, log);
  return { official: true, log };
}
