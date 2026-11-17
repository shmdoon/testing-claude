/**
 * SimRunner — the simulator's state machine, independent of React and Three.
 *
 *  teach  → the student drives; each 1/10 s of driving becomes a labelled example
 *  label  → the rover is dropped into a random situation; the student picks the action
 *  train  → a model is fitted to the examples (held-out accuracy reported)
 *  test   → the model drives alone until the flag, a time-out, or it gets stuck
 *
 * `live` is mutated every frame and read directly by the 3D scene; React
 * subscribes to `snapshot`, which changes at most 10×/s plus on events.
 */
import { ARENAS, type Arena } from "@/lib/sim/arena";
import { atGoal, featuresOf, randomFreePose, sense, stepPose, type Action, type Pose, type Sensors } from "@/lib/sim/physics";
import { coverage, predict, trainKnn, trainMlpSteps, trainModel, type Example, type LearnerKind, type Model, type TrainReport } from "@/lib/sim/learner";
import { seeded, type Rng } from "@/lib/sim/rng";
import type { BlockOf } from "@/content/blocks/schema";

export type SimPhase = "teach" | "label" | "train" | "test";
export type SimEvent = "record" | "bump" | "goal" | "fail" | "trained" | "labelled";
export type Outcome = { success: boolean; seconds: number; bumps: number; reason: "goal" | "timeout" | "stuck" | "stopped" };

export type Live = { pose: Pose; sensors: Sensors; action: Action | null; contact: boolean; trail: Pose[]; trailVersion: number };

export type Snapshot = {
  phase: SimPhase;
  examples: number;
  coverage: Record<Action, number>;
  hasModel: boolean;
  report: TrainReport | null;
  losses: number[];
  training: boolean;
  running: boolean;
  elapsed: number;
  bumps: number;
  outcome: Outcome | null;
  runs: number;
  labelled: number;
  // Telemetry (throttled copy of `live`)
  pose: Pose;
  sensors: Sensors;
  action: Action | null;
  contact: boolean;
};

const RECORD_EVERY = 0.1;
const UI_EVERY = 0.1;
const MAX_EXAMPLES = 2000;
const STUCK_AFTER = 3;

export class SimRunner {
  readonly arena: Arena;
  readonly block: BlockOf<"robot_sim">;
  readonly live: Live;
  private rng: Rng;
  private examples: Example[] = [];
  private model: Model | null = null;
  private report: TrainReport | null = null;
  private losses: number[] = [];
  private training = false;
  private phase: SimPhase;
  private running = false;
  private elapsed = 0;
  private bumps = 0;
  private touching = false;
  private stuckFor = 0;
  private outcome: Outcome | null = null;
  private runs = 0;
  private labelled = 0;
  private recordAcc = 0;
  private uiAcc = 0;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot;
  private onEvent: ((e: SimEvent) => void) | null = null;
  setOnEvent(cb: ((e: SimEvent) => void) | null) {
    this.onEvent = cb;
  }

  constructor(block: BlockOf<"robot_sim">, seed = 1) {
    this.block = block;
    this.arena = ARENAS[block.arena];
    this.rng = seeded(seed);
    this.phase = block.mode === "label" ? "label" : "teach";
    const pose = { ...this.arena.start };
    this.live = { pose, sensors: this.senseAt(pose), action: null, contact: false, trail: [pose], trailVersion: 0 };
    this.snapshot = this.buildSnapshot();
    if (this.phase === "label") this.nextSituation();
  }

  /** Called once on the client so random situations and noise differ per visit (prerender-safe). */
  reseed(seed: number) {
    this.rng = seeded(seed);
  }

  // --- subscription ---------------------------------------------------------
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getSnapshot = () => this.snapshot;
  getOutcome = () => this.outcome;
  private emit() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }
  private buildSnapshot(): Snapshot {
    return {
      phase: this.phase,
      examples: this.examples.length,
      coverage: coverage(this.examples),
      hasModel: this.model !== null,
      report: this.report,
      losses: this.losses,
      training: this.training,
      running: this.running,
      elapsed: Math.round(this.elapsed * 10) / 10,
      bumps: this.bumps,
      outcome: this.outcome,
      runs: this.runs,
      labelled: this.labelled,
      pose: this.live.pose,
      sensors: this.live.sensors,
      action: this.live.action,
      contact: this.live.contact,
    };
  }

  private senseAt(pose: Pose): Sensors {
    return sense(pose, this.arena, this.block.sensor_noise, this.rng);
  }

  // --- examples -------------------------------------------------------------
  getExamples(): Example[] {
    return this.examples;
  }
  loadExamples(examples: Example[]) {
    this.examples = examples.slice(0, MAX_EXAMPLES);
    this.model = null;
    this.report = null;
    this.emit();
  }
  clearExamples() {
    this.examples = [];
    this.model = null;
    this.report = null;
    this.losses = [];
    this.outcome = null;
    this.emit();
  }
  private addExample(x: number[], y: Action) {
    if (this.examples.length >= MAX_EXAMPLES) return;
    this.examples.push({ x, y });
    this.model = null; // new data → retrain before testing
  }

  // --- phases ---------------------------------------------------------------
  setPhase(p: SimPhase) {
    if (this.running) this.stopTest("stopped");
    this.phase = p;
    this.live.action = null;
    if (p === "label") this.nextSituation();
    else if (p === "teach") this.resetPose();
    else if (p === "test") {
      this.resetPose();
      this.outcome = null;
    }
    this.emit();
  }

  resetPose() {
    this.live.pose = { ...this.arena.start };
    this.live.sensors = this.senseAt(this.live.pose);
    this.live.contact = false;
    this.touching = false;
    this.live.trail = [this.live.pose];
    this.live.trailVersion++;
    this.emit();
  }

  setInput(a: Action | null) {
    if (this.phase !== "teach") return;
    this.live.action = a;
  }

  // --- label mode -----------------------------------------------------------
  nextSituation() {
    this.live.pose = randomFreePose(this.arena, this.rng);
    this.live.sensors = this.senseAt(this.live.pose);
    this.live.action = null;
    this.live.contact = false;
    this.live.trail = [this.live.pose];
    this.live.trailVersion++;
    this.emit();
  }
  label(action: Action) {
    this.addExample(featuresOf(this.live.sensors), action);
    this.labelled++;
    this.onEvent?.("labelled");
    this.nextSituation();
  }

  // --- training -------------------------------------------------------------
  /** Fits the block's learner. The MLP yields per epoch so the UI can draw the loss. */
  async train(onEpoch?: (loss: number, epoch: number, total: number) => void): Promise<TrainReport | null> {
    if (this.training || this.examples.length === 0) return this.report;
    this.training = true;
    this.losses = [];
    this.outcome = null;
    this.emit();
    const kind: LearnerKind = this.block.learner;
    const seed = 7;
    if (kind === "knn") {
      await new Promise((r) => setTimeout(r, 350)); // a beat, so "training" is visible
      this.report = trainModel(this.examples, "knn", seed);
      this.model = this.report.model;
    } else {
      // Held-out score first (silent), then the visible fit on everything.
      const held = trainModel(this.examples, "mlp", seed);
      const total = 60;
      const it = trainMlpSteps(this.examples, { seed, epochs: total });
      let model: Model | null = null;
      for (;;) {
        const r = it.next();
        if (r.done) {
          model = r.value;
          break;
        }
        this.losses = [...this.losses, r.value.loss];
        onEpoch?.(r.value.loss, r.value.epoch, total);
        if (r.value.epoch % 2 === 0) {
          this.emit();
          await new Promise((res) => setTimeout(res, 16));
        }
      }
      this.model = model ?? trainKnn(this.examples);
      this.report = { ...held, model: this.model, losses: this.losses };
    }
    this.training = false;
    this.onEvent?.("trained");
    this.emit();
    return this.report;
  }

  // --- test mode ------------------------------------------------------------
  startTest() {
    if (!this.model) return;
    this.resetPose();
    this.elapsed = 0;
    this.bumps = 0;
    this.stuckFor = 0;
    this.outcome = null;
    this.running = true;
    this.emit();
  }
  stopTest(reason: Outcome["reason"] = "stopped") {
    if (!this.running) return;
    this.running = false;
    this.runs++;
    this.outcome = { success: reason === "goal", seconds: Math.round(this.elapsed * 10) / 10, bumps: this.bumps, reason };
    this.live.action = null;
    this.emit(); // snapshot first, so event handlers see the outcome
    this.onEvent?.(reason === "goal" ? "goal" : "fail");
  }

  // --- the clock ------------------------------------------------------------
  tick(dt: number) {
    dt = Math.min(dt, 0.05);
    const live = this.live;
    let action: Action | null = null;
    if (this.phase === "teach") action = live.action;
    else if (this.phase === "test" && this.running && this.model) action = predict(this.model, featuresOf(live.sensors));
    else return;

    const before = live.pose;
    const r = stepPose(before, action, dt, this.arena);
    live.action = action;
    live.pose = r.pose;
    live.sensors = this.senseAt(r.pose);
    live.contact = r.contact;
    const moved = Math.hypot(r.pose.x - before.x, r.pose.z - before.z) > 1e-4;
    if (r.contact && !this.touching) {
      this.bumps++;
      this.onEvent?.("bump");
    }
    this.touching = r.contact;
    if (moved) {
      const last = live.trail.at(-1)!;
      if (Math.hypot(r.pose.x - last.x, r.pose.z - last.z) > 0.12) {
        live.trail.push(r.pose);
        live.trailVersion++;
      }
    }

    if (this.phase === "teach") {
      if (action) {
        this.recordAcc += dt;
        if (this.recordAcc >= RECORD_EVERY) {
          this.recordAcc = 0;
          this.addExample(featuresOf(live.sensors), action);
          this.onEvent?.("record");
        }
      } else this.recordAcc = 0;
    } else if (this.running) {
      this.elapsed += dt;
      this.stuckFor = moved ? 0 : this.stuckFor + dt;
      if (atGoal(live.pose, this.arena)) return this.stopTest("goal");
      if (this.stuckFor > STUCK_AFTER) return this.stopTest("stuck");
      if (this.elapsed >= this.block.pass.max_seconds + 15) return this.stopTest("timeout");
    }

    this.uiAcc += dt;
    if (this.uiAcc >= UI_EVERY) {
      this.uiAcc = 0;
      this.emit();
    }
  }
}
