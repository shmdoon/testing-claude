/**
 * Run the rover autonomously under a policy until it reaches the goal, gets
 * stuck, or runs out of time. Used by tests and by the "fast check" in the UI.
 */
import type { Arena } from "./arena";
import { atGoal, sense, stepPose, type Action, type Pose, type Sensors } from "./physics";
import { seeded } from "./rng";

export type Policy = (s: Sensors) => Action;

export type EpisodeResult = {
  success: boolean;
  seconds: number;
  collisions: number;
  path: Pose[];
  reason: "goal" | "timeout" | "stuck";
};

export type EpisodeOptions = { dt?: number; maxSeconds?: number; noise?: number; seed?: number; start?: Pose };

export function runEpisode(arena: Arena, policy: Policy, opts: EpisodeOptions = {}): EpisodeResult {
  const { dt = 0.1, maxSeconds = 60, noise = 0, seed = 1 } = opts;
  const rng = seeded(seed);
  let pose: Pose = opts.start ?? { ...arena.start };
  const path: Pose[] = [pose];
  let collisions = 0;
  let touching = false;
  let stuckFor = 0;
  let t = 0;
  while (t < maxSeconds) {
    const s = sense(pose, arena, noise, rng);
    const r = stepPose(pose, policy(s), dt, arena);
    t += dt;
    if (r.contact && !touching) collisions++; // a bump = contact starting
    touching = r.contact;
    const moved = Math.hypot(r.pose.x - pose.x, r.pose.z - pose.z) > 1e-4;
    stuckFor = moved ? 0 : stuckFor + dt;
    pose = r.pose;
    path.push(pose);
    if (atGoal(pose, arena)) return { success: true, seconds: round(t), collisions, path, reason: "goal" };
    if (stuckFor > 3) return { success: false, seconds: round(t), collisions, path, reason: "stuck" };
  }
  return { success: false, seconds: round(t), collisions, path, reason: "timeout" };
}

const round = (v: number) => Math.round(v * 10) / 10;
