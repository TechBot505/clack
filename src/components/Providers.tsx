"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { AuthBridge, useClientAuth } from "@/lib/auth-client";
import { applySettingsToDocument, pickSettings, useSettings } from "@/stores/settings";
import { useHistory } from "@/stores/history";
import { api } from "@/lib/api";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "./Toaster";
import { EasterEggs } from "./EasterEggs";
import { Background } from "./Background";

/** Keeps <html> attributes in sync with settings (theme, font, motion…). */
function SettingsApplier() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => applySettingsToDocument(useSettings.getState(), mq.matches);
    apply();
    const unsub = useSettings.subscribe(apply);
    mq.addEventListener("change", apply);
    mm.addEventListener("change", apply);
    return () => {
      unsub();
      mq.removeEventListener("change", apply);
      mm.removeEventListener("change", apply);
    };
  }, []);
  return null;
}

/** Loads the right history (anonymous vs account) and syncs settings when signed in. */
function SessionSync() {
  const auth = useClientAuth();
  const init = useHistory((s) => s.init);
  const lastOwner = useRef<string | null>(null);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!auth.loaded) return;
    const owner = auth.signedIn && auth.userId ? auth.userId : "anon";
    if (lastOwner.current === owner) return;
    lastOwner.current = owner;
    if (owner === "anon") {
      void init("anon", false);
      return;
    }
    let cancelled = false;
    (async () => {
      const status = await api.status().catch(() => ({ database: false, auth: true }));
      if (cancelled) return;
      await init(owner, status.database);
      if (!status.database) return;
      // settings: server copy wins if it exists, otherwise upload local
      try {
        const { settings } = await api.getSettings();
        if (settings) useSettings.getState().replaceAll(settings);
        else await api.saveSettings(pickSettings(useSettings.getState()));
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.loaded, auth.signedIn, auth.userId, init]);

  // debounced settings upload
  useEffect(() => {
    if (!auth.signedIn) return;
    const unsub = useSettings.subscribe((s) => {
      if (useHistory.getState().source !== "remote") return;
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => void api.saveSettings(pickSettings(s)).catch(() => {}), 1500);
    });
    return () => unsub();
  }, [auth.signedIn]);

  return null;
}

export function Providers({ children, authEnabled }: { children: ReactNode; authEnabled: boolean }) {
  return (
    <AuthBridge enabled={authEnabled}>
      <MotionConfig reducedMotion="user">
        <SettingsApplier />
        <SessionSync />
        <Background />
        {children}
        <CommandPalette />
        <Toaster />
        <EasterEggs />
      </MotionConfig>
    </AuthBridge>
  );
}
