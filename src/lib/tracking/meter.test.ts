import { describe, expect, it } from "vitest";
import { ActivityMeter } from "./meter";

function setup() {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  return { m: new ActivityMeter(clock.now), clock };
}
const run = (m: ActivityMeter, clock: { advance: (ms: number) => void }, seconds: number, visible = true, video = false, inputEvery?: number) => {
  for (let i = 1; i <= seconds; i++) {
    clock.advance(1000);
    if (inputEvery && i % inputEvery === 0) m.input();
    m.tick(visible, video);
  }
};

describe("ActivityMeter", () => {
  it("counts visible, recently-active seconds and beats every 30 s", () => {
    const { m, clock } = setup();
    run(m, clock, 29, true, false, 5);
    expect(m.takeBeat()).toBeNull();
    run(m, clock, 1, true, false, 1);
    expect(m.takeBeat()).toBe(30);
  });

  it("stops counting 60 s after the last input", () => {
    const { m, clock } = setup();
    run(m, clock, 90); // no input after start → only the first 59 s count
    expect(m.takeFlush()).toBe(30); // one send carries at most 30 s…
    run(m, clock, 30);
    expect(m.takeFlush()).toBe(29); // …the rest goes with the next one
    expect(m.takeFlush()).toBeNull();
  });

  it("keeps counting without input while a video plays", () => {
    const { m, clock } = setup();
    run(m, clock, 120, true, true);
    expect(m.takeFlush()).toBe(30);
  });

  it("never counts a hidden tab", () => {
    const { m, clock } = setup();
    run(m, clock, 60, false, true, 1);
    expect(m.takeFlush()).toBeNull();
  });

  it("ignores huge gaps from throttled timers", () => {
    const { m, clock } = setup();
    clock.advance(10 * 60_000);
    m.input();
    m.tick(true, false);
    expect(m.takeFlush()).toBe(1);
  });

  it("flush reports a partial interval", () => {
    const { m, clock } = setup();
    run(m, clock, 12, true, false, 2);
    expect(m.takeFlush()).toBe(12);
    expect(m.takeFlush()).toBeNull();
  });
});
