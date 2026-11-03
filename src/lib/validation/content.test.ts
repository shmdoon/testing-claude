import { describe, expect, it } from "vitest";
import { courseFormSchema, paiseToRupees, rupeesToPaise, slugify } from "./content";

describe("money", () => {
  it.each([
    ["499", 49900],
    ["499.5", 49950],
    ["₹1,299.00", 129900],
    ["0.99", 99],
  ])("%s → %d paise", (input, paise) => expect(rupeesToPaise.parse(input)).toBe(paise));

  it.each(["-1", "abc", "1.999", ""])("rejects %s", (input) => expect(rupeesToPaise.safeParse(input).success).toBe(false));

  it("formats back", () => {
    expect(paiseToRupees(49900)).toBe("499");
    expect(paiseToRupees(49950)).toBe("499.50");
  });
});

describe("courseFormSchema", () => {
  const base = {
    title: "AI Basics",
    slug: "ai-basics",
    subtitle: "",
    description: "",
    outcomes: "One\n\n Two ",
    course_type: "mini",
    class_levels: ["7", "8"],
    subject: "AI",
    is_free: false,
    price: "499",
  };
  it("normalises", () => {
    const r = courseFormSchema.parse(base);
    expect(r).toMatchObject({ outcomes: ["One", "Two"], class_levels: [7, 8], subject: "ai", price_paise: 49900, subtitle: null });
  });
  it("free courses cost 0 and ignore price", () => {
    expect(courseFormSchema.parse({ ...base, is_free: true, price: "abc" }).price_paise).toBe(0);
  });
  it("paid courses need a price", () => {
    expect(courseFormSchema.safeParse({ ...base, price: "" }).success).toBe(false);
  });
  it("rejects bad slugs", () => {
    expect(courseFormSchema.safeParse({ ...base, slug: "AI Basics!" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => expect(slugify("  Spot the AI! (Part 2) ")).toBe("spot-the-ai-part-2"));
});
