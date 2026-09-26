"use client";

import type { SoundPack } from "@/stores/settings";

/**
 * Synthesized sound (Web Audio). No audio files: each sound is a tiny recipe
 * of noise bursts and oscillators, scheduled at currentTime so a click lands
 * on the same frame as the keypress.
 *
 * Two families:
 * - keyboard sounds (key, space, back, error) follow the chosen sound pack
 * - interface sounds (finish, pb, achievement, …) are one shared, gentle
 *   palette tuned to the same pentatonic scale, routed through a soft "air"
 *   delay so they feel like part of one product.
 */

export type KeyboardSound = "key" | "space" | "error" | "back";
export type InterfaceSound =
  | "finish"
  | "pb"
  | "perfect"
  | "achievement"
  | "levelup"
  | "restart"
  | "countdown"
  | "go"
  | "toggle"
  | "unlock";
export type SoundEvent = KeyboardSound | InterfaceSound;

export const KEYBOARD_SOUNDS: readonly SoundEvent[] = ["key", "space", "error", "back"];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let uiBus: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.connect(ctx.destination);
    // interface bus: dry signal + a quiet, short feedback delay for a little air
    uiBus = ctx.createGain();
    uiBus.connect(master);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.13;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    uiBus.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(wet).connect(master);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
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

function burst(
  c: AudioContext,
  t: number,
  opts: { freq: number; q: number; type: BiquadFilterType; peak: number; decay: number; attack?: number; sweepTo?: number; bus?: AudioNode | null },
) {
  const out = opts.bus ?? master;
  if (!noise || !out) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = opts.type;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + (opts.attack ?? 0.001) + opts.decay);
  f.Q.value = opts.q;
  const g = c.createGain();
  env(g, t, opts.peak, opts.attack ?? 0.001, opts.decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.05);
  src.stop(t + (opts.attack ?? 0.001) + opts.decay + 0.02);
}

function tone(
  c: AudioContext,
  t: number,
  opts: { freq: number; type: OscillatorType; peak: number; decay: number; attack?: number; slideTo?: number; bus?: AudioNode | null },
) {
  const out = opts.bus ?? master;
  if (!out) return;
  const o = c.createOscillator();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.freq, t);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + opts.decay);
  const g = c.createGain();
  env(g, t, opts.peak, opts.attack ?? 0.002, opts.decay);
  o.connect(g).connect(out);
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
    case "chime":
      tone(c, t, { freq: jitter(heavy ? 660 : 1320, 0.015), type: "sine", peak: 0.1, decay: 0.16 });
      tone(c, t, { freq: jitter(heavy ? 1320 : 2640, 0.015), type: "sine", peak: 0.04, decay: 0.1 });
      break;
    case "bubble":
      tone(c, t, { freq: jitter(heavy ? 300 : 500, 0.15), type: "sine", peak: 0.3, decay: 0.07, slideTo: jitter(heavy ? 700 : 1100, 0.1) });
      break;
    default:
      break;
  }
}

// C major pentatonic, the whole interface palette lives here
const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093 };

/** A soft bell: sine fundamental + a quiet octave partial. */
function bell(c: AudioContext, t: number, freq: number, peak: number, decay: number) {
  tone(c, t, { freq, type: "sine", peak, decay, attack: 0.004, bus: uiBus });
  tone(c, t, { freq: freq * 2, type: "sine", peak: peak * 0.18, decay: decay * 0.6, attack: 0.004, bus: uiBus });
}

function playInterface(c: AudioContext, event: InterfaceSound, t: number) {
  switch (event) {
    case "finish":
      // a breath of air, then a two-note resolve
      burst(c, t, { freq: 600, sweepTo: 2400, q: 0.8, type: "bandpass", peak: 0.08, decay: 0.28, attack: 0.08, bus: uiBus });
      bell(c, t + 0.05, N.G5, 0.13, 0.5);
      bell(c, t + 0.16, N.C6, 0.14, 0.8);
      break;
    case "pb":
      [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => bell(c, t + i * 0.075, f, 0.12 + i * 0.012, 0.7));
      bell(c, t + 0.45, N.G6, 0.1, 1.2);
      burst(c, t + 0.38, { freq: 3000, sweepTo: 7000, q: 1.2, type: "bandpass", peak: 0.05, decay: 0.5, attack: 0.05, bus: uiBus });
      break;
    case "perfect":
      [N.E6, N.G6, N.C7].forEach((f, i) => bell(c, t + i * 0.06, f, 0.06, 0.6));
      break;
    case "achievement":
      bell(c, t, N.A5, 0.12, 0.5);
      bell(c, t + 0.09, N.E6, 0.12, 0.9);
      break;
    case "levelup":
      [N.C5, N.D5, N.E5, N.G5, N.C6].forEach((f, i) => tone(c, t + i * 0.055, { freq: f, type: "triangle", peak: 0.11, decay: 0.35, bus: uiBus }));
      bell(c, t + 0.3, N.E6, 0.1, 1);
      break;
    case "unlock":
      bell(c, t, N.D6, 0.09, 0.5);
      bell(c, t + 0.07, N.G6, 0.08, 0.8);
      break;
    case "restart":
      // a quick swish downward
      burst(c, t, { freq: 3800, sweepTo: 500, q: 0.9, type: "bandpass", peak: 0.12, decay: 0.16, attack: 0.012 });
      break;
    case "countdown":
      tone(c, t, { freq: N.G5, type: "sine", peak: 0.12, decay: 0.12, bus: uiBus });
      break;
    case "go":
      tone(c, t, { freq: N.C6, type: "triangle", peak: 0.14, decay: 0.3, bus: uiBus });
      tone(c, t, { freq: N.G6, type: "sine", peak: 0.06, decay: 0.3, bus: uiBus });
      break;
    case "toggle":
      tone(c, t, { freq: N.E6, type: "sine", peak: 0.08, decay: 0.09, bus: uiBus });
      tone(c, t + 0.06, { freq: N.A5, type: "sine", peak: 0.06, decay: 0.12, bus: uiBus });
      break;
  }
}

/**
 * Low-level player. Most code should call `sfx()` from "@/lib/sfx", which
 * applies the user's settings; this only needs the pack and volume.
 */
export function playSound(event: SoundEvent, pack: SoundPack, volume: number) {
  if (volume <= 0) return;
  const isKeyboard = KEYBOARD_SOUNDS.includes(event);
  if (isKeyboard && pack === "off") return;
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
    default:
      playInterface(c, event, t);
  }
}
