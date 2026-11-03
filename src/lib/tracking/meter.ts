/**
 * Measures *active* seconds: the tab is visible AND (there was input in the
 * last 60 s OR a video is playing). Pure and clock-injected for testing; the
 * React hook (`useActivityTracker`) drives it once per second.
 */
export const IDLE_AFTER_MS = 60_000;
export const BEAT_EVERY_MS = 30_000;
export const MAX_BEAT_SECONDS = 30;

export class ActivityMeter {
  private active = 0;
  private lastInput: number;
  private lastTick: number;
  private lastBeat: number;

  constructor(private readonly now: () => number = Date.now) {
    const t = now();
    this.lastInput = t;
    this.lastTick = t;
    this.lastBeat = t;
  }

  /** Pointer, key, scroll or touch. */
  input() {
    this.lastInput = this.now();
  }

  /**
   * Call about once a second. Uses real elapsed time (capped at 1.5 s) so a
   * throttled background timer can't add a burst of seconds.
   */
  tick(visible: boolean, videoPlaying: boolean) {
    const t = this.now();
    const dt = Math.min(Math.max(t - this.lastTick, 0), 1500);
    this.lastTick = t;
    const engaged = t - this.lastInput < IDLE_AFTER_MS || videoPlaying;
    if (visible && engaged) this.active += dt / 1000;
  }

  /** Seconds to report if a heartbeat is due (every 30 s), else null. */
  takeBeat(): number | null {
    const t = this.now();
    if (t - this.lastBeat < BEAT_EVERY_MS) return null;
    this.lastBeat = t;
    return this.take();
  }

  /** Whatever is left (page hide / unmount). */
  takeFlush(): number | null {
    this.lastBeat = this.now();
    return this.take();
  }

  private take(): number | null {
    const s = Math.min(Math.floor(this.active), MAX_BEAT_SECONDS);
    this.active = Math.max(0, this.active - s);
    if (this.active > MAX_BEAT_SECONDS) this.active = MAX_BEAT_SECONDS; // never bank more than one beat
    return s > 0 ? s : null;
  }
}
