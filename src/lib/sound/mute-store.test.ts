import { describe, expect, it, vi } from "vitest";
import { MUTE_KEY, createMuteStore } from "./mute-store";

function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
}

describe("mute store", () => {
  it("defaults to sound on and persists the toggle", () => {
    const s = memory();
    const store = createMuteStore(s);
    expect(store.get()).toBe(false);
    store.toggle();
    expect(store.get()).toBe(true);
    expect(s.map.get(MUTE_KEY)).toBe("1");
    expect(createMuteStore(s).get()).toBe(true);
  });
  it("notifies subscribers once per change", () => {
    const store = createMuteStore(memory());
    const l = vi.fn();
    const off = store.subscribe(l);
    store.set(true);
    store.set(true);
    expect(l).toHaveBeenCalledTimes(1);
    off();
    store.set(false);
    expect(l).toHaveBeenCalledTimes(1);
  });
  it("survives a storage that throws (private mode)", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createMuteStore(broken);
    expect(store.get()).toBe(false);
    store.set(true);
    expect(store.get()).toBe(true);
  });
  it("works without storage at all", () => {
    const store = createMuteStore(null);
    store.toggle();
    expect(store.get()).toBe(true);
  });
});
