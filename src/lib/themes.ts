/**
 * Themes change the whole atmosphere: palette, display face, background
 * effect, grain, glow and corner radius. CSS variables live in globals.css
 * under [data-theme="…"]; this file holds metadata for pickers and effects.
 */

export type Atmosphere =
  | "grid"
  | "aurora"
  | "scanlines"
  | "petals"
  | "synth"
  | "paper"
  | "waves"
  | "embers"
  | "void"
  | "nebula";

export interface ThemeMeta {
  id: string;
  name: string;
  tagline: string;
  dark: boolean;
  atmosphere: Atmosphere;
  /** swatches for pickers: bg, fg, accent */
  swatch: [string, string, string];
  hidden?: boolean;
  /** cosmetic unlocked by level (see progression) */
  unlock?: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "graphite", name: "Graphite", tagline: "the default dark. warm, quiet, sharp.", dark: true, atmosphere: "grid", swatch: ["#0f0f10", "#ecebe6", "#ff6b3d"] },
  { id: "daylight", name: "Daylight", tagline: "bright paper-white with ink-blue accents.", dark: false, atmosphere: "grid", swatch: ["#f4f3ef", "#151515", "#2f5bff"] },
  { id: "midnight", name: "Midnight", tagline: "deep navy and a slow aurora.", dark: true, atmosphere: "aurora", swatch: ["#0a0f1f", "#dfe6ff", "#8aa8ff"] },
  { id: "terminal", name: "Terminal", tagline: "phosphor green on a humming CRT.", dark: true, atmosphere: "scanlines", swatch: ["#050805", "#b7ffb0", "#39ff14"] },
  { id: "sakura", name: "Sakura", tagline: "soft pink, drifting petals.", dark: false, atmosphere: "petals", swatch: ["#fff3f5", "#4a2b35", "#ff5c8a"] },
  { id: "cyber", name: "Cyber", tagline: "neon horizon, synth grid.", dark: true, atmosphere: "synth", swatch: ["#0b0118", "#f0e6ff", "#00f0ff"] },
  { id: "paper", name: "Paper", tagline: "cream stock, red ink, serif soul.", dark: false, atmosphere: "paper", swatch: ["#f2ecdf", "#2b2622", "#b3372b"] },
  { id: "ocean", name: "Ocean", tagline: "cold water and moving light.", dark: true, atmosphere: "waves", swatch: ["#04161f", "#d6f3ff", "#3ee6c5"] },
  { id: "ember", name: "Ember", tagline: "a fire that rises as you type.", dark: true, atmosphere: "embers", swatch: ["#140b08", "#ffe9d6", "#ff7a1a"] },
  { id: "oled", name: "OLED", tagline: "true black. nothing else.", dark: true, atmosphere: "void", swatch: ["#000000", "#e6e6e6", "#f5f5f5"] },
  { id: "solar", name: "Solar", tagline: "gold light for people who show up.", dark: true, atmosphere: "embers", swatch: ["#120d02", "#fff4d6", "#ffc233"], unlock: "solar" },
  { id: "nebula", name: "Nebula", tagline: "you found it.", dark: true, atmosphere: "nebula", swatch: ["#07030f", "#f3e9ff", "#ff7ae6"], hidden: true },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function getTheme(id: string): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
