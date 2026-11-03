import { describe, expect, it } from "vitest";
import { move } from "./reorder";

describe("move", () => {
  it("moves items", () => {
    expect(move(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("ignores out-of-range moves", () => {
    expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(move(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});
