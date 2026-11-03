import { describe, expect, it } from "vitest";
import { blockRegistry } from "./registry";
import { BLOCK_TYPES, allowedPhases, blockSchema } from "./schema";

describe("block registry", () => {
  it("has an entry for every block type", () => {
    expect(Object.keys(blockRegistry).sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it.each(BLOCK_TYPES)("%s template is a valid block in an allowed phase", (type) => {
    const def = blockRegistry[type];
    const block = def.template("x1");
    expect(blockSchema.safeParse(block).success).toBe(true);
    expect(allowedPhases(type)).toContain(def.defaultPhase);
    expect(block.phase).toBe(def.defaultPhase);
  });
});
