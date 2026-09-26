"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_CONFIG, type TestConfig } from "@/engine/types";
import { clampConfig } from "@/engine/config";
import { getTheme } from "@/lib/themes";
import { SETTINGS_KEY } from "@/lib/boot-script";
import type { Goal } from "@/lib/goals";

export type CaretStyle = "line" | "block" | "underscore" | "glow" | "pulse" | "comet";
export type SoundPack = "off" | "mechanical" | "typewriter" | "soft" | "retro" | "digital" | "bubble" | "chime";
export type TypeFont = "jetbrains" | "geist-mono" | "fira-code" | "ibm-plex" | "space-mono" | "bricolage" | "fraunces";
export type QuickRestart = "tab" | "tab-enter" | "esc";
export type MotionPref = "system" | "reduced" | "full";
export type KeyboardLayout = "qwerty" | "dvorak" | "colemak";

export interface Settings {
  theme: string;
  /** theme to use when the OS is dark / light, if followSystem is on */
  followSystem: boolean;
  darkTheme: string;
  lightTheme: string;
  font: TypeFont;
  fontSize: number; // rem
  lineHeight: number;
  caretStyle: CaretStyle;
  smoothCaret: boolean;
  caretTrail: boolean;
  showLiveWpm: boolean;
  showLiveAcc: boolean;
  showTimer: boolean;
  showProgress: boolean;
  quickRestart: QuickRestart;
  soundPack: SoundPack;
  volume: number; // 0..1
  errorSound: boolean;
  backgroundFx: boolean;
  motion: MotionPref;
  highContrast: boolean;
  colorblind: boolean;
  keyboardLayout: KeyboardLayout;
  showKeyboard: boolean;
  /** race a translucent caret replaying your personal best */
  ghost: boolean;
  /** anonymous-friendly: never auto-upload even when signed in */
  privateMode: boolean;
  weeklyGoalWpm: number;
  unlockedThemes: string[];
  /** optional XP / levels; off = no levels shown and every cosmetic available */
  progression: boolean;
  goals: Goal[];
  neonKeyboard: boolean;
  dnaHalo: boolean;
  favoriteQuotes: string[];
  /** last used test configuration */
  test: TestConfig;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "graphite",
  followSystem: false,
  darkTheme: "graphite",
  lightTheme: "daylight",
  font: "jetbrains",
  fontSize: 1.9,
  lineHeight: 1.9,
  caretStyle: "line",
  smoothCaret: true,
  caretTrail: true,
  showLiveWpm: true,
  showLiveAcc: false,
  showTimer: true,
  showProgress: true,
  quickRestart: "tab",
  soundPack: "off",
  volume: 0.5,
  errorSound: true,
  backgroundFx: true,
  motion: "system",
  highContrast: false,
  colorblind: false,
  keyboardLayout: "qwerty",
  showKeyboard: false,
  ghost: false,
  privateMode: false,
  weeklyGoalWpm: 0,
  unlockedThemes: [],
  progression: true,
  goals: [],
  neonKeyboard: false,
  dnaHalo: false,
  favoriteQuotes: [],
  test: DEFAULT_CONFIG,
};

export { SETTINGS_KEY };

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  setTest: (patch: Partial<TestConfig>) => void;
  reset: () => void;
  replaceAll: (s: Partial<Settings>) => void;
}


export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setTest: (patch) => set((s) => ({ test: clampConfig({ ...s.test, ...patch }) })),
      reset: () => set({ ...DEFAULT_SETTINGS }),
      replaceAll: (s) => set({ ...DEFAULT_SETTINGS, ...s, test: clampConfig({ ...DEFAULT_CONFIG, ...(s.test ?? {}) }) }),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { set: _a, setTest: _b, reset: _c, replaceAll: _d, ...rest } = s;
        return rest;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...p,
          test: clampConfig({ ...DEFAULT_CONFIG, ...(p.test ?? {}) }),
        };
      },
    },
  ),
);

/** Only the serializable settings (for syncing to the server). */
export function pickSettings(s: SettingsStore | Settings): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = (s as unknown as Record<string, unknown>)[k];
  return out as unknown as Settings;
}

/** Apply settings to <html> attributes and CSS variables. */
export function applySettingsToDocument(s: Settings, systemDark: boolean) {
  const root = document.documentElement;
  const themeId = s.followSystem ? (systemDark ? s.darkTheme : s.lightTheme) : s.theme;
  const theme = getTheme(themeId);
  root.dataset.theme = theme.id;
  root.dataset.dark = String(theme.dark);
  root.dataset.font = s.font;
  root.dataset.contrast = s.highContrast ? "high" : "normal";
  root.dataset.cb = String(s.colorblind);
  root.dataset.trail = String(s.caretTrail);
  root.dataset.fx = String(s.backgroundFx);
  const reduce =
    s.motion === "reduced" || (s.motion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  root.dataset.motion = reduce ? "reduced" : "full";
  root.style.setProperty("--type-size", `${s.fontSize}rem`);
  root.style.setProperty("--type-lh", String(s.lineHeight));
  root.style.colorScheme = theme.dark ? "dark" : "light";
}

