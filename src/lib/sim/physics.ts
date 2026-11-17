/**
 * Rover physics + sensors. Pure functions over plain objects so the same code
 * runs in the browser loop, in the autonomous episode runner and in tests.
 *
 * Frame: heading θ in radians; forward = (−sin θ, −cos θ), so θ = 0 faces −z
 * and matches a Three.js `rotation.y = θ`. "left" increases θ.
 */
import type { Arena, Box, Point } from "./arena";
import { gaussian, type Rng } from "./rng";

export const ACTIONS = ["forward", "left", "right"] as const;
export type Action = (typeof ACTIONS)[number];

export type Pose = { x: number; z: number; heading: number };

export const ROBOT = {
  radius: 0.32,
  /** m/s when driving straight. */
  speed: 1.7,
  /** rad/s while turning (the rover keeps rolling at half speed). */
  turn: 2.4,
  rayRange: 3,
  /** Side rays, radians from forward. */
  rayAngle: (40 * Math.PI) / 180,
  /** Metres of line offset that saturate the line sensor. */
  lineRange: 0.6,
} as const;

export type Sensors = {
  /** Distance rays, 0 = touching, 1 = nothing within range. */
  left: number;
  front: number;
  right: number;
  /** Signed offset of the line: +1 line is to the left, −1 to the right. null when the arena has no line. */
  line: number | null;
  /** Goal bearing relative to heading, as sin/cos (positive sin = goal is to the left). */
  goalSin: number;
  goalCos: number;
  /** Goal distance, 0..1 of the arena diagonal. */
  goalDist: number;
};

export const forwardOf = (heading: number): Point => ({ x: -Math.sin(heading), z: -Math.cos(heading) });
export const leftOf = (heading: number): Point => ({ x: -Math.cos(heading), z: Math.sin(heading) });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Collisions
// ---------------------------------------------------------------------------
function circleHitsBox(p: Point, r: number, b: Box): boolean {
  const dx = Math.max(Math.abs(p.x - b.x) - b.w / 2, 0);
  const dz = Math.max(Math.abs(p.z - b.z) - b.d / 2, 0);
  return dx * dx + dz * dz < r * r;
}

export function collides(p: Point, arena: Arena, r: number = ROBOT.radius): boolean {
  if (Math.abs(p.x) + r > arena.width / 2 || Math.abs(p.z) + r > arena.depth / 2) return true;
  return arena.obstacles.some((b) => circleHitsBox(p, r, b));
}

/**
 * Advance the rover by `dt` seconds. A move into a wall slides along it
 * (axis-separated), like a bumper car; `contact` is true whenever the full
 * move was blocked. Callers count a "bump" when contact starts, not per tick.
 */
export function stepPose(pose: Pose, action: Action | null, dt: number, arena: Arena): { pose: Pose; contact: boolean } {
  if (!action) return { pose, contact: false };
  let heading = pose.heading;
  let speed = ROBOT.speed;
  if (action === "left") {
    heading += ROBOT.turn * dt;
    speed *= 0.5;
  } else if (action === "right") {
    heading -= ROBOT.turn * dt;
    speed *= 0.5;
  }
  const f = forwardOf(heading);
  const dx = f.x * speed * dt;
  const dz = f.z * speed * dt;
  const full = { x: pose.x + dx, z: pose.z + dz, heading };
  if (!collides(full, arena)) return { pose: full, contact: false };
  const onlyX = { x: pose.x + dx, z: pose.z, heading };
  if (!collides(onlyX, arena)) return { pose: onlyX, contact: true };
  const onlyZ = { x: pose.x, z: pose.z + dz, heading };
  if (!collides(onlyZ, arena)) return { pose: onlyZ, contact: true };
  // Allow the turn but not the move, so the rover can rotate away from a wall.
  return { pose: { ...pose, heading }, contact: true };
}

export function atGoal(pose: Pose, arena: Arena): boolean {
  const dx = pose.x - arena.goal.x;
  const dz = pose.z - arena.goal.z;
  return dx * dx + dz * dz <= arena.goal.r * arena.goal.r;
}

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------
/** Ray vs axis-aligned slab; returns the entry distance or Infinity. */
function rayBox(o: Point, d: Point, b: Box): number {
  let tmin = 0;
  let tmax = Infinity;
  for (const [oc, dc, c, half] of [
    [o.x, d.x, b.x, b.w / 2],
    [o.z, d.z, b.z, b.d / 2],
  ] as const) {
    if (Math.abs(dc) < 1e-9) {
      if (Math.abs(oc - c) > half) return Infinity;
      continue;
    }
    let t1 = (c - half - oc) / dc;
    let t2 = (c + half - oc) / dc;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/** Distance from `o` along unit `d` to the first wall or obstacle. */
export function rayDistance(o: Point, d: Point, arena: Arena): number {
  let best = Infinity;
  // Arena bounds as four slabs: distance to each plane the ray moves toward.
  if (d.x > 1e-9) best = Math.min(best, (arena.width / 2 - o.x) / d.x);
  if (d.x < -1e-9) best = Math.min(best, (-arena.width / 2 - o.x) / d.x);
  if (d.z > 1e-9) best = Math.min(best, (arena.depth / 2 - o.z) / d.z);
  if (d.z < -1e-9) best = Math.min(best, (-arena.depth / 2 - o.z) / d.z);
  for (const b of arena.obstacles) best = Math.min(best, rayBox(o, d, b));
  return Math.max(0, best);
}

export function rayDirection(heading: number, offset: number): Point {
  return forwardOf(heading + offset);
}

function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz || 1;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / len2, 0, 1);
  return { x: a.x + abx * t, z: a.z + abz * t };
}

/** Closest point on the arena's line to `p` (null without a line). */
export function nearestOnLine(p: Point, line: Point[] | undefined): Point | null {
  if (!line || line.length < 2) return null;
  let best: Point | null = null;
  let bestD = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const q = nearestOnSegment(p, line[i]!, line[i + 1]!);
    const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** Read the sensors at a pose. `noise` is the std-dev added to distance/line readings. */
export function sense(pose: Pose, arena: Arena, noise = 0, rng?: Rng): Sensors {
  const o = { x: pose.x, z: pose.z };
  const ray = (offset: number) => clamp(rayDistance(o, rayDirection(pose.heading, offset), arena) / ROBOT.rayRange, 0, 1);
  const f = forwardOf(pose.heading);
  const l = leftOf(pose.heading);
  const gx = arena.goal.x - pose.x;
  const gz = arena.goal.z - pose.z;
  const bearing = Math.atan2(gx * l.x + gz * l.z, gx * f.x + gz * f.z);
  const diag = Math.hypot(arena.width, arena.depth);
  const n = (v: number) => (noise > 0 && rng ? clamp(v + gaussian(rng) * noise, -1, 1) : v);
  const q = nearestOnLine(o, arena.line);
  const line = q ? clamp(((q.x - pose.x) * l.x + (q.z - pose.z) * l.z) / ROBOT.lineRange, -1, 1) : null;
  return {
    left: clamp(n(ray(ROBOT.rayAngle)), 0, 1),
    front: clamp(n(ray(0)), 0, 1),
    right: clamp(n(ray(-ROBOT.rayAngle)), 0, 1),
    line: line === null ? null : n(line),
    goalSin: Math.sin(bearing),
    goalCos: Math.cos(bearing),
    goalDist: clamp(Math.hypot(gx, gz) / diag, 0, 1),
  };
}

/** The feature vector a learner sees. Fixed order; the line slot is 0 without a line. */
export const FEATURE_NAMES = ["left", "front", "right", "line", "goalSin", "goalCos", "goalDist"] as const;
export function featuresOf(s: Sensors): number[] {
  return [s.left, s.front, s.right, s.line ?? 0, s.goalSin, s.goalCos, s.goalDist];
}

/**
 * A sensible hand-written driver, used by tests and the "show me" demo. It is
 * memoryless on purpose: a learned model sees the same seven numbers, so any
 * behaviour the reference needs must be expressible as sensors → action.
 * Side-clearance rules outrank the goal pull, which gives wall-following.
 */
export function referencePolicy(s: Sensors): Action {
  if (s.front < 0.4) return s.left >= s.right ? "left" : "right";
  if (s.right < 0.3 && s.left >= s.right) return "left";
  if (s.left < 0.3) return "right";
  if (s.line !== null) {
    if (s.line > 0.15) return "left";
    if (s.line < -0.15) return "right";
    return "forward";
  }
  if (s.goalSin > 0.2) return "left";
  if (s.goalSin < -0.2) return "right";
  return "forward";
}

/** A random pose inside the arena that doesn't touch anything (for labelling snapshots). */
export function randomFreePose(arena: Arena, rng: Rng): Pose {
  for (let i = 0; i < 200; i++) {
    const p = {
      x: (rng() - 0.5) * (arena.width - 2 * ROBOT.radius - 0.2),
      z: (rng() - 0.5) * (arena.depth - 2 * ROBOT.radius - 0.2),
      heading: rng() * Math.PI * 2,
    };
    if (!collides(p, arena, ROBOT.radius + 0.15) && !atGoal(p, arena)) return p;
  }
  return { ...arena.start };
}
