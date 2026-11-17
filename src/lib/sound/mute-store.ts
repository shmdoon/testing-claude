/** Mute preference with change notifications. Storage is injected so it's testable and safe without localStorage. */
export type KeyValueStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export const MUTE_KEY = "sound:muted";

export function createMuteStore(storage?: KeyValueStore | null) {
  const listeners = new Set<() => void>();
  let muted = false;
  try {
    muted = storage?.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
  const notify = () => listeners.forEach((l) => l());
  return {
    get: () => muted,
    set(v: boolean) {
      if (v === muted) return;
      muted = v;
      try {
        storage?.setItem(MUTE_KEY, v ? "1" : "0");
      } catch {
        /* private mode etc. — preference just doesn't persist */
      }
      notify();
    },
    toggle() {
      this.set(!muted);
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type MuteStore = ReturnType<typeof createMuteStore>;
