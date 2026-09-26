"use client";

import { create } from "zustand";
import type { RunLog } from "@/engine/types";
import type { RunInput } from "@/engine/record";
import { pbImprovements, type PbImprovement, type TestRecord } from "@/lib/records";
import * as local from "@/lib/local-store";
import { api, ApiError } from "@/lib/api";

/**
 * Test history. Anonymous users: localStorage only. Signed-in users: the
 * server is the source of truth (it re-validates every run), with a local
 * cache so pages render instantly and offline work isn't lost.
 */

export type HistorySource = "local" | "remote";

interface HistoryState {
  owner: string;
  source: HistorySource;
  tests: TestRecord[];
  loaded: boolean;
  syncing: boolean;
  /** anonymous tests that could be imported into the account */
  importable: number;
  init: (owner: string, remote: boolean) => Promise<void>;
  add: (input: RunInput, record: TestRecord, log: RunLog) => Promise<{ record: TestRecord; pbs: PbImprovement[] }>;
  getLog: (id: string) => Promise<RunLog | null>;
  getTest: (id: string) => Promise<TestRecord | null>;
  remove: (id: string) => Promise<void>;
  importAnonymous: () => Promise<number>;
  dismissImport: () => void;
  clearLocal: () => void;
}

const byNewest = (a: TestRecord, b: TestRecord) => b.createdAt - a.createdAt;

function anonImportable(): number {
  if (local.getLocal<boolean>("import-dismissed", false)) return 0;
  return local.loadTests("anon").filter((t) => !t.synced).length;
}

export const useHistory = create<HistoryState>((set, get) => ({
  owner: "anon",
  source: "local",
  tests: [],
  loaded: false,
  syncing: false,
  importable: 0,

  async init(owner, remote) {
    const cached = local.loadTests(owner).sort(byNewest);
    set({ owner, source: remote ? "remote" : "local", tests: cached, loaded: !remote || cached.length > 0, importable: owner !== "anon" ? anonImportable() : 0 });
    if (!remote) {
      set({ loaded: true });
      return;
    }
    set({ syncing: true });
    try {
      const { tests } = await api.listTests(1000);
      // keep local-only tests that failed to upload earlier
      const serverIds = new Set(tests.map((t) => t.id));
      const pending = get().tests.filter((t) => !t.synced && !serverIds.has(t.id));
      const merged = [...tests.map((t) => ({ ...t, synced: true })), ...pending].sort(byNewest);
      local.saveTests(owner, merged);
      set({ tests: merged, loaded: true, syncing: false });
      // retry pending uploads in the background
      for (const p of pending) {
        const log = local.loadLog(owner, p.id);
        if (log) void get().add(p as unknown as RunInput, p, log).catch(() => {});
      }
    } catch {
      // server unavailable → behave like local mode
      set({ source: "local", loaded: true, syncing: false });
    }
  },

  async add(input, record, log) {
    const { owner, source } = get();
    const prior = get().tests.filter((t) => t.id !== record.id);
    const pbs = pbImprovements(prior, record);
    let saved: TestRecord = { ...record, isPb: pbs.length > 0, synced: false };
    const tests = [saved, ...prior].sort(byNewest);
    set({ tests });
    local.saveTests(owner, tests);
    local.saveLog(owner, saved.id, log, tests.map((t) => t.id));
    if (source === "remote") {
      try {
        const { test } = await api.saveTest(input, log);
        saved = { ...test, synced: true };
        const next = get().tests.map((t) => (t.id === saved.id ? saved : t));
        set({ tests: next });
        local.saveTests(owner, next);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) set({ source: "local" });
      }
    }
    return { record: saved, pbs };
  },

  async getLog(id) {
    const { owner, source } = get();
    const cached = local.loadLog(owner, id);
    if (cached) return cached;
    if (source === "remote") {
      try {
        const { log } = await api.getTest(id);
        return log;
      } catch {
        return null;
      }
    }
    return null;
  },

  async getTest(id) {
    const found = get().tests.find((t) => t.id === id);
    if (found) return found;
    if (get().source === "remote") {
      try {
        const { test } = await api.getTest(id);
        return test;
      } catch {
        return null;
      }
    }
    return null;
  },

  async remove(id) {
    const { owner, source } = get();
    const tests = get().tests.filter((t) => t.id !== id);
    set({ tests });
    local.removeTest(owner, id);
    if (source === "remote") await api.deleteTest(id).catch(() => {});
  },

  async importAnonymous() {
    const anon = local.loadTests("anon").filter((t) => !t.synced);
    if (!anon.length || get().source !== "remote") return 0;
    const logs = local.loadAllLogs("anon");
    let imported = 0;
    for (let i = 0; i < anon.length; i += 100) {
      const chunk = anon.slice(i, i + 100);
      const res = await api.importTests(
        chunk.map((t) => ({ input: t as unknown as RunInput, log: logs[t.id] ?? null, record: t })),
      );
      imported += res.imported;
    }
    // mark as synced so we never offer them again
    local.saveTests("anon", local.loadTests("anon").map((t) => ({ ...t, synced: true })));
    set({ importable: 0 });
    await get().init(get().owner, true);
    return imported;
  },

  dismissImport() {
    local.setLocal("import-dismissed", true);
    set({ importable: 0 });
  },

  clearLocal() {
    local.clearOwner(get().owner);
    set({ tests: [] });
  },
}));
