"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "accent" | "error";
}

interface UIState {
  paletteOpen: boolean;
  /** increments on every open so the palette always mounts fresh */
  paletteKey: number;
  /** test running: chrome fades out */
  typing: boolean;
  toasts: Toast[];
  /** restart requests from anywhere (palette, shortcuts) — bump to restart */
  restartNonce: number;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setTyping: (v: boolean) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  requestRestart: () => void;
}

let toastId = 1;

export const useUI = create<UIState>((set, get) => ({
  paletteOpen: false,
  paletteKey: 0,
  typing: false,
  toasts: [],
  restartNonce: 0,
  openPalette: () => {
    if (typeof document !== "undefined") (document.activeElement as HTMLElement | null)?.blur?.();
    set({ paletteOpen: true, paletteKey: get().paletteKey + 1 });
  },
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => (get().paletteOpen ? get().closePalette() : get().openPalette()),
  setTyping: (v) => {
    if (get().typing === v) return;
    set({ typing: v });
    if (typeof document !== "undefined") document.documentElement.dataset.typing = String(v);
  },
  toast: (t) => {
    const id = toastId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-4) });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  requestRestart: () => set({ restartNonce: get().restartNonce + 1 }),
}));
