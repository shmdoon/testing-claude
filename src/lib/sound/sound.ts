"use client";

/**
 * Tiny synthesised UI sounds (Web Audio, no files). Nothing plays until the
 * user has interacted with the page, and never while muted. Each cue is a
 * short, soft tone so it stays pleasant across hundreds of clicks.
 */
import { useSyncExternalStore } from "react";
import { createMuteStore } from "./mute-store";

export type SoundName = "tap" | "tick" | "success" | "error" | "whoosh" | "levelup" | "bump" | "train" | "record";

const storage = typeof window === "undefined" ? null : window.localStorage;
export const muteStore = createMuteStore(storage);

let ctx: AudioContext | null = null;
function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // Browsers block audio until a user gesture; we only play from event handlers, but be safe.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Note = { f: number; t: number; d: number; g?: number; type?: OscillatorType; to?: number };

/** Each cue is a list of notes: frequency, start offset, duration (seconds), gain, waveform, optional glide target. */
const CUES: Record<SoundName, Note[]> = {
  tap: [{ f: 880, t: 0, d: 0.035, g: 0.07 }],
  tick: [{ f: 1320, t: 0, d: 0.04, g: 0.05, type: "triangle" }],
  record: [{ f: 660, t: 0, d: 0.03, g: 0.04, type: "triangle" }],
  success: [
    { f: 523, t: 0, d: 0.12, g: 0.1 },
    { f: 784, t: 0.11, d: 0.18, g: 0.1 },
  ],
  error: [{ f: 180, t: 0, d: 0.16, g: 0.06, type: "sawtooth", to: 140 }],
  whoosh: [{ f: 420, t: 0, d: 0.12, g: 0.04, to: 900 }],
  levelup: [
    { f: 523, t: 0, d: 0.1, g: 0.1 },
    { f: 659, t: 0.09, d: 0.1, g: 0.1 },
    { f: 784, t: 0.18, d: 0.1, g: 0.1 },
    { f: 1047, t: 0.27, d: 0.3, g: 0.12 },
  ],
  bump: [{ f: 110, t: 0, d: 0.09, g: 0.09, type: "square", to: 70 }],
  train: [{ f: 300, t: 0, d: 0.4, g: 0.05, to: 1200, type: "triangle" }],
};

export function play(name: SoundName) {
  if (muteStore.get()) return;
  const ac = context();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of CUES[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.f, now + n.t);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, now + n.t + n.d);
    gain.gain.setValueAtTime(0, now + n.t);
    gain.gain.linearRampToValueAtTime(n.g ?? 0.08, now + n.t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.02);
  }
}

export function useMuted(): boolean {
  return useSyncExternalStore(muteStore.subscribe, muteStore.get, () => false);
}

/** CSS `prefers-reduced-motion` at call time (false on the server). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
