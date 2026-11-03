import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, checkLessonForPublish } from "../blocks/schema";
import { courses, tools } from "./data";
import { seedToSql } from "./to-sql";

describe("seed content", () => {
  const lessons = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));

  it("has one mini course with 2 lessons and one big course with 2 modules × 3 lessons", () => {
    const mini = courses.find((c) => c.course_type === "mini")!;
    const big = courses.find((c) => c.course_type === "big")!;
    expect(mini.modules.flatMap((m) => m.lessons)).toHaveLength(2);
    expect(big.modules.map((m) => m.lessons.length)).toEqual([3, 3]);
  });

  it("uses every block type at least once", () => {
    const used = new Set(lessons.flatMap((l) => l.blocks.map((b) => b.type)));
    expect([...BLOCK_TYPES].filter((t) => !used.has(t))).toEqual([]);
  });

  it("every lesson is publishable", () => {
    for (const l of lessons) expect(checkLessonForPublish(l.blocks).ok, l.slug).toBe(true);
  });

  it("external tasks reference registered tools", () => {
    const ids = new Set(tools.map((t) => t.id));
    for (const b of lessons.flatMap((l) => l.blocks)) {
      if (b.type === "external_task") expect(ids.has(b.tool_id)).toBe(true);
    }
  });

  it("supabase/seed.sql is up to date (run `npm run db:seed:gen`)", () => {
    expect(readFileSync("supabase/seed.sql", "utf8")).toBe(seedToSql(tools, courses));
  });
});
