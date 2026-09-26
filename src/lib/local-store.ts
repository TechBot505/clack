"use client";

import type { RunLog } from "@/engine/types";
import type { TestRecord } from "./records";

/**
 * Local persistence for anonymous users (and an instant cache for signed-in
 * users). Summaries and keystroke logs live under separate keys so the list
 * stays small; logs are kept only for the most recent tests.
 */

const MAX_TESTS = 1000;
const MAX_LOGS = 100;

const testsKey = (owner: string) => `clack:history:v1:${owner}`;
const logsKey = (owner: string) => `clack:logs:v1:${owner}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadTests(owner: string): TestRecord[] {
  const list = read<TestRecord[]>(testsKey(owner), []);
  return Array.isArray(list) ? list : [];
}

export function saveTests(owner: string, tests: TestRecord[]) {
  let list = tests.slice(0, MAX_TESTS);
  // Shrink until it fits (quota errors on very full storage).
  while (!write(testsKey(owner), list) && list.length > 10) {
    list = list.slice(0, Math.floor(list.length * 0.8));
  }
}

type LogMap = Record<string, RunLog>;

export function loadLog(owner: string, id: string): RunLog | null {
  const map = read<LogMap>(logsKey(owner), {});
  return map[id] ?? null;
}

export function loadAllLogs(owner: string): LogMap {
  return read<LogMap>(logsKey(owner), {});
}

export function saveLog(owner: string, id: string, log: RunLog, keepIds: string[]) {
  const map = read<LogMap>(logsKey(owner), {});
  map[id] = log;
  // newest first; keep only logs for tests that still exist
  const order = [id, ...keepIds.filter((k) => k !== id)].filter((k) => map[k]);
  let n = Math.min(order.length, MAX_LOGS);
  while (n >= 1) {
    if (write(logsKey(owner), Object.fromEntries(order.slice(0, n).map((k) => [k, map[k]])))) return;
    n = Math.floor(n * 0.7);
  }
}

export function clearOwner(owner: string) {
  try {
    localStorage.removeItem(testsKey(owner));
    localStorage.removeItem(logsKey(owner));
  } catch {
    /* ignore */
  }
}

export function removeTest(owner: string, id: string) {
  saveTests(owner, loadTests(owner).filter((t) => t.id !== id));
  const map = read<LogMap>(logsKey(owner), {});
  delete map[id];
  write(logsKey(owner), map);
}

/** Small key/value helpers for misc local state (favorites, flags, easter eggs). */
export function getLocal<T>(key: string, fallback: T): T {
  return read<T>(`clack:${key}`, fallback);
}
export function setLocal(key: string, value: unknown) {
  write(`clack:${key}`, value);
}
