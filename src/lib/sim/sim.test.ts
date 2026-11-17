import { describe, expect, it } from "vitest";
import { ARENAS, ARENA_LIST } from "./arena";
import { atGoal, collides, featuresOf, forwardOf, leftOf, rayDistance, referencePolicy, sense, stepPose, type Pose } from "./physics";
import { runEpisode } from "./episode";
import { accuracy, coverage, predict, trainKnn, trainMlp, trainModel, type Example } from "./learner";
import { seeded } from "./rng";

const open = ARENAS["open-field"];

describe("physics", () => {
  it("heading 0 faces −z and left is −x", () => {
    expect(forwardOf(0)).toEqual({ x: -0, z: -1 });
    expect(leftOf(0).x).toBeCloseTo(-1);
  });
  it("forward moves along the heading; turning changes the heading", () => {
    const p: Pose = { x: 0, z: 0, heading: 0 };
    const f = stepPose(p, "forward", 0.5, open).pose;
    expect(f.z).toBeLessThan(0);
    expect(f.x).toBeCloseTo(0);
    expect(stepPose(p, "left", 0.5, open).pose.heading).toBeGreaterThan(0);
    expect(stepPose(p, "right", 0.5, open).pose.heading).toBeLessThan(0);
    expect(stepPose(p, null, 0.5, open).pose).toBe(p);
  });
  it("a wall cancels the move and reports a collision", () => {
    const wall = ARENAS["wall-ahead"];
    const p: Pose = { x: 0, z: 0.55, heading: 0 }; // just in front of the wall (depth 0.4 → face at z = 0.2)
    const r = stepPose(p, "forward", 0.3, wall);
    expect(r.contact).toBe(true);
    expect(r.pose.z).toBe(0.55);
    // Driving diagonally into the wall slides along it.
    const slide = stepPose({ x: 0, z: 0.55, heading: 0.6 }, "forward", 0.3, wall);
    expect(slide.contact).toBe(true);
    expect(slide.pose.x).toBeLessThan(0);
    expect(slide.pose.z).toBe(0.55);
    expect(collides({ x: 3.9, z: 0 }, open)).toBe(true); // edge of the playfield
  });
  it("rays measure the distance to the nearest wall or obstacle", () => {
    const wall = ARENAS["wall-ahead"];
    expect(rayDistance({ x: 0, z: 2 }, { x: 0, z: -1 }, wall)).toBeCloseTo(1.8); // wall face at z = 0.2
    expect(rayDistance({ x: 0, z: 2 }, { x: 1, z: 0 }, wall)).toBeCloseTo(4); // arena edge at x = 4
    const s = sense({ x: 0, z: 2, heading: 0 }, wall);
    expect(s.front).toBeCloseTo(1.8 / 3);
    expect(s.left).toBeGreaterThan(s.front);
  });
  it("goal bearing is positive when the goal is to the left", () => {
    const s = sense({ x: 0, z: 0, heading: 0 }, { ...open, goal: { x: -2, z: -2, r: 0.5 } });
    expect(s.goalSin).toBeGreaterThan(0.5);
    const behind = sense({ x: 0, z: 0, heading: 0 }, { ...open, goal: { x: 0, z: 3, r: 0.5 } });
    expect(behind.goalCos).toBeLessThan(0);
  });
  it("line sensor is signed and null without a line", () => {
    const track = ARENAS["line-track"];
    // Line runs straight down x = −3 at the start; stand to its right (x = −2.7) facing −z → line is to the left.
    const s = sense({ x: -2.7, z: 3, heading: 0 }, track);
    expect(s.line).toBeGreaterThan(0.3);
    expect(sense({ x: 0, z: 0, heading: 0 }, open).line).toBeNull();
  });
  it("noise is reproducible and bounded", () => {
    const a = sense({ x: 0, z: 0, heading: 0 }, open, 0.2, seeded(7));
    const b = sense({ x: 0, z: 0, heading: 0 }, open, 0.2, seeded(7));
    expect(a).toEqual(b);
    expect(a.front).toBeLessThanOrEqual(1);
    expect(featuresOf(a)).toHaveLength(7);
  });
});

describe("reference driver", () => {
  for (const arena of ARENA_LIST) {
    it(`reaches the goal in ${arena.id}`, () => {
      const r = runEpisode(arena, referencePolicy, { maxSeconds: 90 });
      expect(r.success, `${arena.id}: ${r.reason} after ${r.seconds}s, ${r.collisions} collisions`).toBe(true);
      expect(atGoal(r.path.at(-1)!, arena)).toBe(true);
    });
  }
});

/** Examples the way the Teach tab records them: the reference driver's choices along its own run. */
function demonstrate(arenaId: keyof typeof ARENAS, noise = 0, seed = 1): Example[] {
  const arena = ARENAS[arenaId];
  const rng = seeded(seed);
  const out: Example[] = [];
  runEpisode(
    arena,
    (s) => {
      const y = referencePolicy(s);
      out.push({ x: featuresOf(s), y });
      return y;
    },
    { noise, seed, maxSeconds: 90 },
  );
  // A few "look around" examples so the learner sees turns near walls too.
  for (let i = 0; i < 40; i++) {
    const pose: Pose = { x: (rng() - 0.5) * (arena.width - 1), z: (rng() - 0.5) * (arena.depth - 1), heading: rng() * Math.PI * 2 };
    const s = sense(pose, arena, noise, rng);
    out.push({ x: featuresOf(s), y: referencePolicy(s) });
  }
  return out;
}

describe("learners", () => {
  const data = demonstrate("wall-ahead");

  it("k-NN copies the nearest example", () => {
    const m = trainKnn([
      { x: [0, 0.1, 1, 0, 0, 1, 0.5], y: "right" },
      { x: [1, 1, 1, 0, 0, 1, 0.5], y: "forward" },
    ]);
    expect(predict(m, [0.05, 0.12, 0.9, 0, 0, 1, 0.5])).toBe("right");
    expect(predict(m, [0.9, 0.95, 0.9, 0, 0, 1, 0.5])).toBe("forward");
  });

  it("MLP loss falls and it fits the demonstrations", () => {
    const { model, losses } = trainMlp(data, { seed: 3, epochs: 80 });
    expect(losses.at(-1)!).toBeLessThan(losses[0]! * 0.6);
    expect(accuracy(model, data)).toBeGreaterThan(0.85);
  });

  it("reports a held-out accuracy only with enough examples", () => {
    expect(trainModel(data.slice(0, 6), "knn").accuracy).toBeNull();
    const r = trainModel(data, "knn", 5);
    expect(r.testCount).toBeGreaterThan(0);
    expect(r.accuracy).toBeGreaterThan(0.8);
  });

  it("coverage counts actions", () => {
    const c = coverage(data);
    expect(c.forward + c.left + c.right).toBe(data.length);
    expect(c.left + c.right).toBeGreaterThan(0);
  });

  for (const [arenaId, kind, noise] of [
    ["open-field", "knn", 0],
    ["wall-ahead", "knn", 0],
    ["line-track", "mlp", 0],
    ["slalom", "knn", 0],
    ["maze", "mlp", 0],
    ["delivery", "mlp", 0.1],
  ] as const) {
    it(`a model trained from demonstrations drives ${arenaId} on its own (${kind})`, () => {
      const examples = demonstrate(arenaId, noise, 2);
      const { model } = trainModel(examples, kind, 11);
      const r = runEpisode(ARENAS[arenaId], (s) => predict(model, featuresOf(s)), { maxSeconds: 90, noise, seed: 99 });
      expect(r.success, `${arenaId}: ${r.reason} after ${r.seconds}s, ${r.collisions} collisions`).toBe(true);
    });
  }
});
