"use client";

import type { SoundPack } from "@/stores/settings";

/**
 * Synthesized keyboard sounds (Web Audio). No audio files: each pack is a
 * tiny recipe of noise bursts and oscillators, scheduled at currentTime so a
 * click lands on the same frame as the keypress.
 */

export type SoundEvent = "key" | "space" | "error" | "back" | "finish" | "pb" | "achievement";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture to unlock audio on iOS/Safari. */
export function primeAudio() {
  ensure();
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function burst(c: AudioContext, t: number, opts: { freq: number; q: number; type: BiquadFilterType; peak: number; decay: number; attack?: number }) {
  if (!noise || !master) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = opts.type;
  f.frequency.value = opts.freq;
  f.Q.value = opts.q;
  const g = c.createGain();
  env(g, t, opts.peak, opts.attack ?? 0.001, opts.decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.1);
  src.stop(t + (opts.attack ?? 0.001) + opts.decay + 0.02);
}

function tone(c: AudioContext, t: number, opts: { freq: number; type: OscillatorType; peak: number; decay: number; attack?: number; slideTo?: number }) {
  if (!master) return;
  const o = c.createOscillator();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + opts.decay);
  const g = c.createGain();
  env(g, t, opts.peak, opts.attack ?? 0.002, opts.decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + (opts.attack ?? 0.002) + opts.decay + 0.02);
}

const jitter = (base: number, spread = 0.08) => base * (1 + (Math.random() * 2 - 1) * spread);

function playKey(c: AudioContext, pack: SoundPack, t: number, heavy: boolean) {
  switch (pack) {
    case "mechanical":
      burst(c, t, { freq: jitter(heavy ? 1800 : 3200), q: 1.2, type: "bandpass", peak: heavy ? 0.9 : 0.7, decay: 0.035 });
      tone(c, t, { freq: jitter(heavy ? 90 : 140), type: "sine", peak: 0.35, decay: 0.05 });
      burst(c, t + 0.018, { freq: 5200, q: 2, type: "highpass", peak: 0.15, decay: 0.012 });
      break;
    case "typewriter":
      burst(c, t, { freq: jitter(2400), q: 3, type: "bandpass", peak: 1, decay: 0.05 });
      tone(c, t, { freq: jitter(220), type: "triangle", peak: 0.25, decay: 0.03 });
      if (heavy) tone(c, t + 0.02, { freq: 2600, type: "sine", peak: 0.12, decay: 0.25 });
      break;
    case "soft":
      burst(c, t, { freq: jitter(900), q: 0.7, type: "lowpass", peak: 0.45, decay: 0.03, attack: 0.003 });
      break;
    case "retro":
      tone(c, t, { freq: jitter(heavy ? 330 : 660, 0.05), type: "square", peak: 0.08, decay: 0.03 });
      break;
    case "digital":
      tone(c, t, { freq: jitter(heavy ? 1200 : 1800, 0.03), type: "sine", peak: 0.12, decay: 0.022 });
      break;
    case "bubble":
      tone(c, t, { freq: jitter(heavy ? 300 : 500, 0.15), type: "sine", peak: 0.3, decay: 0.07, slideTo: jitter(heavy ? 700 : 1100, 0.1) });
      break;
    default:
      break;
  }
}

export function playSound(event: SoundEvent, pack: SoundPack, volume: number) {
  if (pack === "off" || volume <= 0) return;
  const c = ensure();
  if (!c || !master) return;
  master.gain.value = volume * 0.6;
  const t = c.currentTime;
  switch (event) {
    case "key":
      playKey(c, pack, t, false);
      break;
    case "space":
      playKey(c, pack, t, true);
      break;
    case "back":
      burst(c, t, { freq: 1400, q: 1, type: "bandpass", peak: 0.3, decay: 0.02 });
      break;
    case "error":
      tone(c, t, { freq: 180, type: "sawtooth", peak: 0.08, decay: 0.07, slideTo: 120 });
      break;
    case "finish":
      [523.25, 659.25, 783.99].forEach((f, i) => tone(c, t + i * 0.06, { freq: f, type: "sine", peak: 0.18, decay: 0.35 }));
      break;
    case "pb":
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone(c, t + i * 0.07, { freq: f, type: i % 2 ? "triangle" : "sine", peak: 0.2, decay: 0.5 }),
      );
      break;
    case "achievement":
      [880, 1318.5].forEach((f, i) => tone(c, t + i * 0.09, { freq: f, type: "sine", peak: 0.18, decay: 0.4 }));
      break;
  }
}
