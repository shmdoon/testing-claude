import { describe, expect, it } from "vitest";
import { filterCourses, parseFilters } from "./filters";
import type { CatalogCourse } from "./catalog";

const c = (o: Partial<CatalogCourse>): CatalogCourse => ({
  id: "x",
  slug: "x",
  title: "X",
  subtitle: null,
  course_type: "mini",
  class_levels: [7, 8],
  subject: "ai",
  cover_image_path: null,
  is_free: true,
  price_paise: 0,
  lesson_count: 1,
  ...o,
});

describe("catalog filters", () => {
  const list = [c({ id: "a" }), c({ id: "b", course_type: "big", is_free: false, price_paise: 100, class_levels: [8] }), c({ id: "d", subject: "data" })];

  it("ignores junk params", () => {
    expect(parseFilters({ class: "abc", type: "huge", price: ["free", "paid"], subject: "<script>" })).toEqual({
      class: undefined,
      type: undefined,
      price: "free",
      subject: undefined,
    });
  });

  it("filters", () => {
    const ids = (f: Record<string, string>) => filterCourses(list, parseFilters(f)).map((x) => x.id);
    expect(ids({})).toEqual(["a", "b", "d"]);
    expect(ids({ class: "7" })).toEqual(["a", "d"]);
    expect(ids({ type: "big" })).toEqual(["b"]);
    expect(ids({ price: "free" })).toEqual(["a", "d"]);
    expect(ids({ subject: "data" })).toEqual(["d"]);
  });
});
