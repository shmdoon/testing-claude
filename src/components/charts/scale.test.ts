import { describe, expect, it } from "vitest";
import { compact, formatDuration, niceTicks } from "./scale";

describe("chart scale", () => {
  it.each([
    [0, [0, 1]],
    [7, [0, 2, 4, 6, 8]],
    [42, [0, 20, 40, 60]],
    [100, [0, 50, 100]],
    [1234, [0, 500, 1000, 1500]],
  ])("niceTicks(%d)", (max, ticks) => expect(niceTicks(max)).toEqual(ticks));
  it("integer ticks for counts", () => {
    expect(niceTicks(1, 4, true)).toEqual([0, 1]);
    expect(niceTicks(3, 4, true)).toEqual([0, 1, 2, 3]);
  });
  it("formats", () => {
    expect(compact(1284)).toBe("1,284");
    expect(compact(12_900)).toBe("12.9K");
    expect(formatDuration(59)).toBe("1 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
    expect(formatDuration(7200)).toBe("2 h");
  });
});
