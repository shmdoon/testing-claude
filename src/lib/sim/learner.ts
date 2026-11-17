/**
 * Supervised learners that run in the browser on a few hundred examples.
 *
 * - k-NN: "copy what you did in the most similar situation". Instant, robust
 *   with little data — the first thing students meet.
 * - MLP: a tiny neural network (one hidden layer, softmax) trained with plain
 *   SGD. Its loss curve is shown while training so "learning" is visible.
 *
 * Everything is deterministic given a seed.
 */
import { ACTIONS, type Action } from "./physics";
import { seeded, shuffle, type Rng } from "./rng";

export type Example = { x: number[]; y: Action };
export type LearnerKind = "knn" | "mlp";

export type KnnModel = { kind: "knn"; k: number; examples: Example[] };
export type MlpModel = { kind: "mlp"; w1: number[][]; b1: number[]; w2: number[][]; b2: number[] };
export type Model = KnnModel | MlpModel;

const actionIndex = (a: Action) => ACTIONS.indexOf(a);

// ---------------------------------------------------------------------------
// k-NN
// ---------------------------------------------------------------------------
export function trainKnn(examples: Example[], k = 5): KnnModel {
  return { kind: "knn", k: Math.max(1, Math.min(k, examples.length)), examples: examples.map((e) => ({ x: [...e.x], y: e.y })) };
}

function predictKnn(m: KnnModel, x: number[]): Action {
  if (m.examples.length === 0) return "forward";
  const scored = m.examples.map((e) => {
    let d = 0;
    for (let i = 0; i < x.length; i++) d += (x[i]! - (e.x[i] ?? 0)) ** 2;
    return { d, y: e.y };
  });
  scored.sort((a, b) => a.d - b.d);
  const votes = new Map<Action, number>();
  for (const s of scored.slice(0, m.k)) votes.set(s.y, (votes.get(s.y) ?? 0) + 1 / (1e-6 + s.d));
  let best: Action = "forward";
  let bestV = -1;
  for (const a of ACTIONS) {
    const v = votes.get(a) ?? 0;
    if (v > bestV) {
      bestV = v;
      best = a;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// MLP
// ---------------------------------------------------------------------------
export type MlpOptions = { hidden?: number; epochs?: number; lr?: number; seed?: number };

function forward(m: MlpModel, x: number[]) {
  const h = m.b1.map((b, j) => {
    let s = b;
    for (let i = 0; i < x.length; i++) s += (m.w1[i]?.[j] ?? 0) * x[i]!;
    return Math.max(0, s); // ReLU
  });
  const logits = m.b2.map((b, k) => {
    let s = b;
    for (let j = 0; j < h.length; j++) s += m.w2[j]![k]! * h[j]!;
    return s;
  });
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return { h, p: exps.map((e) => e / sum) };
}

export function initMlp(inputs: number, hidden: number, rng: Rng): MlpModel {
  const r = (scale: number) => (rng() * 2 - 1) * scale;
  return {
    kind: "mlp",
    w1: Array.from({ length: inputs }, () => Array.from({ length: hidden }, () => r(Math.sqrt(2 / inputs)))),
    b1: Array.from({ length: hidden }, () => 0),
    w2: Array.from({ length: hidden }, () => Array.from({ length: ACTIONS.length }, () => r(Math.sqrt(2 / hidden)))),
    b2: Array.from({ length: ACTIONS.length }, () => 0),
  };
}

/** One epoch of SGD over shuffled examples; returns the mean cross-entropy loss. */
export function mlpEpoch(m: MlpModel, examples: Example[], lr: number, rng: Rng): number {
  let total = 0;
  for (const ex of shuffle(examples, rng)) {
    const { h, p } = forward(m, ex.x);
    const yi = actionIndex(ex.y);
    total += -Math.log(Math.max(p[yi]!, 1e-9));
    // Output gradient: p − onehot(y)
    const dLogit = p.map((v, k) => v - (k === yi ? 1 : 0));
    const dH = h.map((_, j) => {
      let s = 0;
      for (let k = 0; k < dLogit.length; k++) s += m.w2[j]![k]! * dLogit[k]!;
      return h[j]! > 0 ? s : 0;
    });
    for (let j = 0; j < h.length; j++) for (let k = 0; k < dLogit.length; k++) m.w2[j]![k]! -= lr * dLogit[k]! * h[j]!;
    for (let k = 0; k < dLogit.length; k++) m.b2[k]! -= lr * dLogit[k]!;
    for (let i = 0; i < ex.x.length; i++) for (let j = 0; j < h.length; j++) m.w1[i]![j]! -= lr * dH[j]! * ex.x[i]!;
    for (let j = 0; j < h.length; j++) m.b1[j]! -= lr * dH[j]!;
  }
  return examples.length ? total / examples.length : 0;
}

/** Generator so a UI can animate the loss per epoch; the final value is the model. */
export function* trainMlpSteps(examples: Example[], opts: MlpOptions = {}): Generator<{ epoch: number; loss: number }, MlpModel> {
  const { hidden = 12, epochs = 60, lr = 0.03, seed = 1 } = opts;
  const rng = seeded(seed);
  const inputs = examples[0]?.x.length ?? 7;
  const m = initMlp(inputs, hidden, rng);
  for (let e = 0; e < epochs; e++) yield { epoch: e + 1, loss: mlpEpoch(m, examples, lr, rng) };
  return m;
}

export function trainMlp(examples: Example[], opts: MlpOptions = {}): { model: MlpModel; losses: number[] } {
  const losses: number[] = [];
  const it = trainMlpSteps(examples, opts);
  for (;;) {
    const r = it.next();
    if (r.done) return { model: r.value, losses };
    losses.push(r.value.loss);
  }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
export function predict(m: Model, x: number[]): Action {
  if (m.kind === "knn") return predictKnn(m, x);
  const { p } = forward(m, x);
  let best = 0;
  for (let k = 1; k < p.length; k++) if (p[k]! > p[best]!) best = k;
  return ACTIONS[best]!;
}

export function accuracy(m: Model, examples: Example[]): number {
  if (!examples.length) return 0;
  return examples.filter((e) => predict(m, e.x) === e.y).length / examples.length;
}

export type TrainReport = { model: Model; accuracy: number | null; trainCount: number; testCount: number; losses?: number[] };

/**
 * Hold out 20% (deterministic) to report an honest accuracy, then train the
 * returned model on everything. Below 10 examples there is no held-out score.
 */
export function trainModel(examples: Example[], kind: LearnerKind, seed = 1): TrainReport {
  const rng = seeded(seed);
  const shuffled = shuffle(examples, rng);
  const testCount = examples.length >= 10 ? Math.max(2, Math.floor(examples.length * 0.2)) : 0;
  const test = shuffled.slice(0, testCount);
  const train = shuffled.slice(testCount);
  const fit = (xs: Example[]) => (kind === "knn" ? { model: trainKnn(xs) as Model, losses: undefined } : trainMlp(xs, { seed }));
  const held = testCount ? accuracy(fit(train).model, test) : null;
  const final = fit(examples);
  return { model: final.model, accuracy: held, trainCount: train.length, testCount, losses: final.losses };
}

/** Which actions the examples cover — the "did you teach it to turn?" hint. */
export function coverage(examples: Example[]): Record<Action, number> {
  const out = { forward: 0, left: 0, right: 0 };
  for (const e of examples) out[e.y]++;
  return out;
}
