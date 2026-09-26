"use client";

import type { RunLog } from "@/engine/types";
import type { RunInput } from "@/engine/record";
import type { TestRecord } from "./records";
import type { Settings } from "@/stores/settings";

/** Thin typed client for the clack. API. Every call degrades gracefully. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export interface ServerStatus {
  database: boolean;
  auth: boolean;
}

export interface DailyBoard {
  date: string;
  entries: { rank: number; name: string; wpm: number; accuracy: number; you: boolean }[];
  total: number;
  you: { wpm: number; accuracy: number; rank: number; percentile: number } | null;
}

export const api = {
  status: () => call<ServerStatus>("/api/status"),
  listTests: (limit = 1000) => call<{ tests: TestRecord[] }>(`/api/tests?limit=${limit}`),
  getTest: (id: string) => call<{ test: TestRecord; log: RunLog | null }>(`/api/tests/${encodeURIComponent(id)}`),
  saveTest: (input: RunInput, log: RunLog) =>
    call<{ test: TestRecord }>("/api/tests", { method: "POST", body: JSON.stringify({ input, log }) }),
  deleteTest: (id: string) => call<{ ok: true }>(`/api/tests/${encodeURIComponent(id)}`, { method: "DELETE" }),
  importTests: (items: { input: RunInput; log: RunLog | null; record: TestRecord }[]) =>
    call<{ imported: number; skipped: number }>("/api/tests/import", { method: "POST", body: JSON.stringify({ items }) }),
  getSettings: () => call<{ settings: Partial<Settings> | null }>("/api/settings"),
  saveSettings: (settings: Settings) =>
    call<{ ok: true }>("/api/settings", { method: "PUT", body: JSON.stringify({ settings }) }),
  submitDaily: (date: string, testId: string) =>
    call<{ official: boolean }>("/api/daily", { method: "POST", body: JSON.stringify({ date, testId }) }),
  getDaily: (date: string) => call<DailyBoard>(`/api/daily?date=${encodeURIComponent(date)}`),
  me: () => call<{ user: { id: string; username: string | null; displayName: string | null; avatarUrl: string | null; visibility: string; createdAt: string } | null }>("/api/me"),
  updateMe: (patch: { username?: string; displayName?: string; visibility?: string }) =>
    call<{ ok: true }>("/api/me", { method: "PATCH", body: JSON.stringify(patch) }),
};
