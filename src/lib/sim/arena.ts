/**
 * Arena presets for the rover simulator. Pure data, no app imports (the block
 * schema and the seed generator load this file in Node).
 *
 * Units are metres. The playfield is centred on (0, 0): x runs left→right,
 * z runs toward the viewer (robots start facing −z, "into" the scene).
 */
export type Box = { x: number; z: number; w: number; d: number };
export type Point = { x: number; z: number };

export type Arena = {
  id: ArenaId;
  name: string;
  /** One line for the project card. */
  blurb: string;
  width: number;
  depth: number;
  obstacles: Box[];
  start: { x: number; z: number; heading: number };
  goal: { x: number; z: number; r: number };
  /** Optional path to follow (line sensor is only active when present). */
  line?: Point[];
};

export const ARENA_IDS = ["open-field", "wall-ahead", "line-track", "slalom", "maze", "delivery"] as const;
export type ArenaId = (typeof ARENA_IDS)[number];

const wallPost = (x: number, z: number): Box => ({ x, z, w: 0.6, d: 0.6 });

export const ARENAS: Record<ArenaId, Arena> = {
  "open-field": {
    id: "open-field",
    name: "Open field",
    blurb: "Nothing in the way — just drive to the flag.",
    width: 8,
    depth: 10,
    obstacles: [],
    start: { x: 0, z: 4, heading: 0 },
    goal: { x: 0, z: -4, r: 0.7 },
  },
  "wall-ahead": {
    id: "wall-ahead",
    name: "Wall ahead",
    blurb: "A wall blocks the straight path. Teach the rover to go around.",
    width: 8,
    depth: 10,
    obstacles: [{ x: 0, z: 0, w: 3.2, d: 0.4 }],
    start: { x: 0, z: 4, heading: 0 },
    goal: { x: 0, z: -4, r: 0.7 },
  },
  "line-track": {
    id: "line-track",
    name: "Line track",
    blurb: "Follow the painted line through two bends.",
    width: 10,
    depth: 10,
    obstacles: [],
    start: { x: -3, z: 4, heading: 0 },
    goal: { x: 3, z: -4, r: 0.6 },
    line: [
      { x: -3, z: 4 },
      { x: -3, z: 1.5 },
      { x: -1, z: 0.5 },
      { x: 1, z: -0.5 },
      { x: 3, z: -1.5 },
      { x: 3, z: -4 },
    ],
  },
  slalom: {
    id: "slalom",
    name: "Slalom",
    blurb: "Three posts, staggered. Decide what to do in each situation.",
    width: 8,
    depth: 12,
    obstacles: [wallPost(-0.8, 2), wallPost(0.9, 0), wallPost(-0.8, -2)],
    start: { x: 0, z: 5, heading: 0 },
    goal: { x: 0, z: -5, r: 0.7 },
  },
  maze: {
    id: "maze",
    name: "Maze",
    blurb: "Corridors and corners. Only good examples get you out.",
    width: 10,
    depth: 10,
    obstacles: [
      { x: -1.5, z: 2.5, w: 5, d: 0.4 },
      { x: 2, z: 0, w: 4, d: 0.4 },
      { x: -2.5, z: -2.5, w: 3, d: 0.4 },
      { x: 1, z: -2.5, w: 0.4, d: 3 },
    ],
    start: { x: -3.5, z: 4, heading: 0 },
    goal: { x: 3.5, z: -4, r: 0.6 },
  },
  delivery: {
    id: "delivery",
    name: "Night delivery",
    blurb: "Fuzzy sensors and a cluttered yard. Deliver the parcel with as few bumps as you can.",
    width: 10,
    depth: 12,
    obstacles: [wallPost(-2.2, 3), wallPost(1.5, 2.2), { x: -0.5, z: 0, w: 2.6, d: 0.4 }, wallPost(2.8, -1.4), wallPost(-2.4, -2.2), { x: 1, z: -3.6, w: 0.4, d: 2 }],
    start: { x: -3.5, z: 5, heading: 0 },
    goal: { x: 3.5, z: -5, r: 0.6 },
  },
};

export const ARENA_LIST: Arena[] = ARENA_IDS.map((id) => ARENAS[id]);
