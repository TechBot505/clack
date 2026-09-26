"use client";

import { useSettings } from "@/stores/settings";
import { KEYBOARD_SOUNDS, playSound, primeAudio, type SoundEvent } from "./sound";

/**
 * Play a sound if the user's settings allow it. The one function the app
 * calls for sound, so every rule (master switch, keyboard pack, interface
 * sounds, error sound, volume) lives in one place.
 */
export function sfx(event: SoundEvent) {
  const s = useSettings.getState();
  if (!s.sound || s.volume <= 0) return;
  if (KEYBOARD_SOUNDS.includes(event)) {
    if (s.soundPack === "off") return;
    if (event === "error" && !s.errorSound) return;
  } else if (!s.uiSounds) {
    return;
  }
  playSound(event, s.soundPack, s.volume);
}

/** Schedule a sound (e.g. to land with an animation). Returns a cancel function. */
export function sfxLater(event: SoundEvent, ms: number): () => void {
  const id = setTimeout(() => sfx(event), ms);
  return () => clearTimeout(id);
}

export { primeAudio };
